-- Food-service SaaS — Phase 1 PostgreSQL / Supabase schema draft
--
-- Scope: multitenant catalog, storefront ordering data, delivery, orders,
-- payments, KDS and authorization. This file is intentionally a DRAFT: test it
-- against a disposable Supabase project, split it into dated migrations, and
-- add RLS tests before applying it to a production project.
--
-- API boundary:
--   * The browser never gets INSERT/UPDATE access to order, payment, KDS, or
--     customer identity tables.
--   * Guest checkout must go through a Next.js server route or Supabase Edge
--     Function using a server-only service-role client. That endpoint must
--     calculate prices and delivery eligibility on the server, enforce an
--     idempotency key, verify payment webhooks, and write the order in one
--     transaction.
--   * Anon users receive only narrow catalog/tracking RPC responses below; no
--     base-table grants are made to anon.
--
-- Assumes Postgres 15+ (Supabase) and that `private` is NOT an exposed Data API
-- schema. All instants use timestamptz; local opening hours use time without
-- time zone and are interpreted with stores.timezone.

-- ---------------------------------------------------------------------------
-- Extensions and private helpers
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'tenant_status' and typnamespace = 'public'::regnamespace) then
    create type public.tenant_status as enum ('onboarding', 'active', 'suspended', 'canceled');
  end if;
  if not exists (select 1 from pg_type where typname = 'membership_status' and typnamespace = 'public'::regnamespace) then
    create type public.membership_status as enum ('invited', 'active', 'suspended');
  end if;
  if not exists (select 1 from pg_type where typname = 'product_kind' and typnamespace = 'public'::regnamespace) then
    create type public.product_kind as enum ('simple', 'variant', 'combo', 'pizza');
  end if;
  if not exists (select 1 from pg_type where typname = 'fulfillment_type' and typnamespace = 'public'::regnamespace) then
    create type public.fulfillment_type as enum ('delivery', 'pickup', 'dine_in', 'counter');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_channel' and typnamespace = 'public'::regnamespace) then
    create type public.order_channel as enum ('storefront', 'pos', 'qr_table', 'whatsapp', 'phone', 'api');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status' and typnamespace = 'public'::regnamespace) then
    create type public.order_status as enum (
      'new', 'confirmed', 'preparing', 'ready', 'awaiting_driver',
      'out_for_delivery', 'delivered', 'canceled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method' and typnamespace = 'public'::regnamespace) then
    create type public.payment_method as enum ('pix', 'credit_card', 'debit_card', 'cash', 'on_delivery', 'wallet');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status' and typnamespace = 'public'::regnamespace) then
    create type public.payment_status as enum (
      'pending', 'authorized', 'paid', 'failed', 'refunded',
      'partially_refunded', 'canceled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'delivery_zone_type' and typnamespace = 'public'::regnamespace) then
    create type public.delivery_zone_type as enum ('neighborhood', 'distance', 'polygon');
  end if;
  if not exists (select 1 from pg_type where typname = 'kds_task_status' and typnamespace = 'public'::regnamespace) then
    create type public.kds_task_status as enum ('queued', 'in_progress', 'ready', 'void');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Identity, tenants, stores, RBAC and feature configuration
-- ---------------------------------------------------------------------------

-- Global profile. It intentionally has no tenant_id because it mirrors one
-- Supabase Auth user across potentially many tenants.
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seeded out-of-band only. Do not let an application user insert this row.
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 140),
  slug citext not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  legal_name text,
  tax_identifier text,
  timezone text not null default 'America/Sao_Paulo',
  currency_code char(3) not null default 'BRL' check (currency_code ~ '^[A-Z]{3}$'),
  status public.tenant_status not null default 'onboarding',
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 140),
  public_slug citext not null unique check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  custom_domain citext unique,
  timezone text not null default 'America/Sao_Paulo',
  currency_code char(3) not null default 'BRL' check (currency_code ~ '^[A-Z]{3}$'),
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone_e164 text,
  whatsapp_e164 text,
  logo_path text,
  cover_image_path text,
  public_theme jsonb not null default '{}'::jsonb check (jsonb_typeof(public_theme) = 'object'),
  is_storefront_published boolean not null default false,
  accepting_orders boolean not null default false,
  accepts_delivery boolean not null default true,
  accepts_pickup boolean not null default true,
  accepts_dine_in boolean not null default false,
  default_prep_minutes integer not null default 30 check (default_prep_minutes between 0 and 1440),
  min_order_amount numeric(12,2) not null default 0 check (min_order_amount >= 0),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create table if not exists public.store_business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  shift_index smallint not null default 0 check (shift_index >= 0),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, weekday, shift_index),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  check (
    (is_closed and opens_at is null and closes_at is null)
    or
    (not is_closed and opens_at is not null and closes_at is not null and opens_at <> closes_at)
  )
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z]+\.[a-z_]+$'),
  description text not null,
  created_at timestamptz not null default now()
);

-- Roles are tenant-scoped. Built-in role templates should be copied into this
-- table during onboarding, enabling each owner to customize them safely.
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,62}$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text,
  is_system boolean not null default false,
  is_editable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table if not exists public.role_permissions (
  tenant_id uuid not null,
  role_id uuid not null,
  permission_id uuid not null references public.permissions (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tenant_id, role_id, permission_id),
  foreign key (tenant_id, role_id) references public.roles (tenant_id, id) on delete cascade
);

create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.membership_status not null default 'invited',
  is_owner boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, user_id),
  check ((status <> 'active') or accepted_at is not null)
);

-- Name deliberately matches the expected user_roles domain entity. A user can
-- have several roles inside one tenant through one tenant membership.
create table if not exists public.user_roles (
  tenant_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, membership_id, role_id),
  foreign key (tenant_id, membership_id) references public.tenant_memberships (tenant_id, id) on delete cascade,
  foreign key (tenant_id, role_id) references public.roles (tenant_id, id) on delete cascade
);

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,62}$'),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_features (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  feature_id uuid not null references public.features (id) on delete restrict,
  enabled boolean not null default false,
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, feature_id)
);

-- ---------------------------------------------------------------------------
-- Customers (tenant-wide) and addresses
-- ---------------------------------------------------------------------------

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 160),
  email citext,
  phone_e164 text,
  birth_date date,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  marketing_opt_out_at timestamptz,
  notes text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id),
  check (email is not null or phone_e164 is not null),
  check (not marketing_opt_in or marketing_opt_in_at is not null)
);

create unique index if not exists customers_live_phone_per_tenant_uidx
  on public.customers (tenant_id, phone_e164)
  where phone_e164 is not null and deleted_at is null;

create unique index if not exists customers_live_email_per_tenant_uidx
  on public.customers (tenant_id, email)
  where email is not null and deleted_at is null;

-- A customer can remain a guest. This is only created after an authenticated
-- ownership flow (for example magic-link confirmation), never from a bare phone
-- number supplied at checkout.
create table if not exists public.customer_auth_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_id uuid not null,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, customer_id, auth_user_id),
  unique (tenant_id, auth_user_id),
  foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete cascade
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_id uuid not null,
  label text,
  recipient_name text,
  recipient_phone_e164 text,
  postal_code text,
  street text not null,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  country_code char(2) not null default 'BR',
  reference text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete cascade,
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create unique index if not exists customer_one_default_address_uidx
  on public.customer_addresses (tenant_id, customer_id)
  where is_default and deleted_at is null;

-- ---------------------------------------------------------------------------
-- Catalog: categories, products, images, variants and modifiers
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  parent_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  description text,
  image_path text,
  display_order integer not null default 0 check (display_order >= 0),
  is_visible boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id, parent_id) references public.categories (tenant_id, store_id, id) on delete restrict
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  category_id uuid,
  kind public.product_kind not null default 'simple',
  name text not null check (char_length(btrim(name)) between 1 and 160),
  slug citext,
  short_description text,
  description text,
  sku text,
  internal_code text,
  base_price numeric(12,2) not null check (base_price >= 0),
  sale_price numeric(12,2) check (sale_price is null or sale_price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  cost_price numeric(12,2) check (cost_price is null or cost_price >= 0),
  prep_minutes integer check (prep_minutes is null or prep_minutes between 0 and 1440),
  display_order integer not null default 0 check (display_order >= 0),
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  is_new boolean not null default false,
  is_promotion boolean not null default false,
  is_visible boolean not null default true,
  is_available boolean not null default true,
  unavailable_until timestamptz,
  daily_limit integer check (daily_limit is null or daily_limit >= 0),
  available_quantity numeric(12,3) check (available_quantity is null or available_quantity >= 0),
  dietary_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, store_id, id),
  unique (tenant_id, store_id, slug),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id, category_id) references public.categories (tenant_id, store_id, id) on delete restrict,
  check (sale_price is null or sale_price <= base_price)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  storage_path text not null,
  alt_text text,
  display_order integer not null default 0 check (display_order >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id, product_id) references public.products (tenant_id, store_id, id) on delete cascade
);

create unique index if not exists product_one_primary_image_uidx
  on public.product_images (tenant_id, store_id, product_id)
  where is_primary;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  sku text,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  price_delta numeric(12,2) not null default 0,
  cost_delta numeric(12,2) not null default 0,
  available_quantity numeric(12,3) check (available_quantity is null or available_quantity >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, store_id, id),
  unique (tenant_id, store_id, product_id, id),
  foreign key (tenant_id, store_id, product_id) references public.products (tenant_id, store_id, id) on delete cascade
);

create unique index if not exists product_one_default_variant_uidx
  on public.product_variants (tenant_id, store_id, product_id)
  where is_default and deleted_at is null;

create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer check (max_selections is null or max_selections >= min_selections),
  allow_option_quantity boolean not null default false,
  allow_repeated_options boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  modifier_group_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  sku text,
  price_delta numeric(12,2) not null default 0,
  cost_delta numeric(12,2) not null default 0,
  available_quantity numeric(12,3) check (available_quantity is null or available_quantity >= 0),
  max_quantity_per_order integer check (max_quantity_per_order is null or max_quantity_per_order > 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id, modifier_group_id) references public.modifier_groups (tenant_id, store_id, id) on delete cascade
);

create table if not exists public.product_modifier_groups (
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  modifier_group_id uuid not null,
  condition_variant_id uuid,
  min_selections_override integer check (min_selections_override is null or min_selections_override >= 0),
  max_selections_override integer check (max_selections_override is null or max_selections_override >= 0),
  display_order integer not null default 0 check (display_order >= 0),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, store_id, product_id, modifier_group_id),
  foreign key (tenant_id, store_id, product_id) references public.products (tenant_id, store_id, id) on delete cascade,
  foreign key (tenant_id, store_id, modifier_group_id) references public.modifier_groups (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, product_id, condition_variant_id)
    references public.product_variants (tenant_id, store_id, product_id, id) on delete restrict,
  check (max_selections_override is null or max_selections_override >= coalesce(min_selections_override, 0))
);

-- Multiple rows permit lunch, happy-hour and other recurring windows. Store
-- local time determines their interpretation; split cross-midnight windows into
-- two rows at the application layer.
create table if not exists public.catalog_availability_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  category_id uuid,
  product_id uuid,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  fulfillment_types public.fulfillment_type[] not null default array['delivery','pickup','dine_in','counter']::public.fulfillment_type[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id, category_id) references public.categories (tenant_id, store_id, id) on delete cascade,
  foreign key (tenant_id, store_id, product_id) references public.products (tenant_id, store_id, id) on delete cascade,
  check (num_nonnulls(category_id, product_id) = 1),
  check (starts_at <> ends_at),
  check (cardinality(fulfillment_types) > 0)
);

-- ---------------------------------------------------------------------------
-- Delivery zones
-- ---------------------------------------------------------------------------

-- polygon_geojson is deliberately JSONB in Phase 1 so this migration has no
-- PostGIS deployment dependency. Add a separate tested PostGIS migration later
-- to materialize / index polygons for server-side point-in-polygon checks.
create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  zone_type public.delivery_zone_type not null,
  neighborhood_names text[] not null default '{}',
  min_distance_meters integer,
  max_distance_meters integer,
  polygon_geojson jsonb,
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
  free_delivery_above numeric(12,2) check (free_delivery_above is null or free_delivery_above >= 0),
  extra_minutes integer not null default 0 check (extra_minutes >= 0),
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  check (polygon_geojson is null or jsonb_typeof(polygon_geojson) = 'object'),
  check (zone_type <> 'neighborhood' or cardinality(neighborhood_names) > 0),
  check (zone_type <> 'distance' or (min_distance_meters is not null and max_distance_meters is not null and min_distance_meters >= 0 and max_distance_meters > min_distance_meters)),
  check (zone_type <> 'polygon' or polygon_geojson is not null)
);

-- ---------------------------------------------------------------------------
-- Orders, payments and KDS
-- ---------------------------------------------------------------------------

-- Labels and ordering can be customized per store while the canonical enum
-- remains stable for integrations, reports and state-machine validation.
create table if not exists public.order_status_definitions (
  tenant_id uuid not null,
  store_id uuid not null,
  status public.order_status not null,
  label text not null,
  display_order integer not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, store_id, status),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  display_number bigint generated always as identity,
  customer_id uuid,
  delivery_zone_id uuid,
  channel public.order_channel not null default 'storefront',
  fulfillment_type public.fulfillment_type not null,
  status public.order_status not null default 'new',
  payment_status public.payment_status not null default 'pending',
  currency_code char(3) not null default 'BRL' check (currency_code ~ '^[A-Z]{3}$'),
  customer_name text not null,
  customer_phone_e164 text,
  customer_email citext,
  delivery_address_snapshot jsonb,
  customer_note text,
  internal_note text,
  scheduled_for timestamptz,
  estimated_ready_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  subtotal_amount numeric(12,2) not null default 0 check (subtotal_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  cashback_amount numeric(12,2) not null default 0 check (cashback_amount >= 0),
  delivery_fee_amount numeric(12,2) not null default 0 check (delivery_fee_amount >= 0),
  service_fee_amount numeric(12,2) not null default 0 check (service_fee_amount >= 0),
  tip_amount numeric(12,2) not null default 0 check (tip_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  source_id text,
  checkout_idempotency_key uuid,
  public_tracking_token uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  unique (public_tracking_token),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete restrict,
  foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete restrict,
  foreign key (tenant_id, store_id, delivery_zone_id) references public.delivery_zones (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, status) references public.order_status_definitions (tenant_id, store_id, status) on delete restrict,
  check (fulfillment_type <> 'delivery' or delivery_address_snapshot is not null),
  check (delivery_address_snapshot is null or jsonb_typeof(delivery_address_snapshot) = 'object'),
  check (discount_amount + cashback_amount <= subtotal_amount),
  check (total_amount = round(subtotal_amount - discount_amount - cashback_amount + delivery_fee_amount + service_fee_amount + tip_amount, 2))
);

create unique index if not exists orders_idempotency_per_store_uidx
  on public.orders (tenant_id, store_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  product_id uuid,
  product_variant_id uuid,
  product_name text not null,
  product_sku text,
  product_kind public.product_kind not null,
  quantity numeric(12,3) not null check (quantity > 0),
  base_unit_price_amount numeric(12,2) not null check (base_unit_price_amount >= 0),
  modifier_unit_total_amount numeric(12,2) not null default 0,
  unit_total_amount numeric(12,2) not null,
  line_total_amount numeric(12,2) not null check (line_total_amount >= 0),
  notes text,
  item_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(item_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  unique (tenant_id, store_id, order_id, id),
  foreign key (tenant_id, store_id, order_id) references public.orders (tenant_id, store_id, id) on delete restrict,
  -- Historical orders intentionally retain their catalog linkage. Catalog rows
  -- use soft delete, so physical deletion is restricted rather than trying to
  -- set tenant/store columns in a composite FK to NULL.
  foreign key (tenant_id, store_id, product_id) references public.products (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, product_id, product_variant_id)
    references public.product_variants (tenant_id, store_id, product_id, id) on delete restrict,
  check (product_variant_id is null or product_id is not null),
  check (unit_total_amount = base_unit_price_amount + modifier_unit_total_amount),
  check (line_total_amount = round(quantity * unit_total_amount, 2))
);

create table if not exists public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  modifier_group_id uuid,
  modifier_option_id uuid,
  group_name text not null,
  option_name text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_delta_amount numeric(12,2) not null default 0,
  line_total_amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, order_id, order_item_id)
    references public.order_items (tenant_id, store_id, order_id, id) on delete restrict,
  -- Modifier rows are immutable financial snapshots. Do not physically delete
  -- the referenced catalog rows once an order exists.
  foreign key (tenant_id, store_id, modifier_group_id) references public.modifier_groups (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, modifier_option_id) references public.modifier_options (tenant_id, store_id, id) on delete restrict,
  check (line_total_amount = round(quantity * unit_price_delta_amount, 2))
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by_user_id uuid references auth.users (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, order_id) references public.orders (tenant_id, store_id, id) on delete restrict
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  provider text not null,
  provider_payment_id text,
  transaction_id text,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(12,2) not null check (amount >= 0),
  expires_at timestamptz,
  paid_at timestamptz,
  idempotency_key uuid,
  -- Never store PAN, CVV, or raw card/token payloads here.
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id, order_id) references public.orders (tenant_id, store_id, id) on delete restrict
);

create unique index if not exists payments_provider_payment_uidx
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists payments_idempotency_per_store_uidx
  on public.payments (tenant_id, store_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.kds_stations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null,
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,62}$'),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  unique (tenant_id, store_id, code),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table if not exists public.kds_station_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  station_id uuid not null,
  product_id uuid,
  category_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id, station_id) references public.kds_stations (tenant_id, store_id, id) on delete cascade,
  foreign key (tenant_id, store_id, product_id) references public.products (tenant_id, store_id, id) on delete cascade,
  foreign key (tenant_id, store_id, category_id) references public.categories (tenant_id, store_id, id) on delete cascade,
  check (num_nonnulls(product_id, category_id) = 1)
);

create table if not exists public.kds_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  station_id uuid not null,
  order_id uuid not null,
  order_item_id uuid not null,
  status public.kds_task_status not null default 'queued',
  priority smallint not null default 0,
  started_at timestamptz,
  ready_at timestamptz,
  completed_by_user_id uuid references auth.users (id) on delete set null,
  item_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(item_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  unique (tenant_id, store_id, order_item_id, station_id),
  foreign key (tenant_id, store_id, station_id) references public.kds_stations (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, store_id, order_id, order_item_id)
    references public.order_items (tenant_id, store_id, order_id, id) on delete restrict,
  check ((status <> 'in_progress') or started_at is not null),
  check ((status <> 'ready') or ready_at is not null)
);

-- Audit rows are append-only from a server-side audit writer / trigger. IP
-- fields are intentionally nullable: do not invent an IP where a trusted proxy
-- has not supplied one.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  store_id uuid,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  request_id uuid,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete restrict,
  check (before_data is null or jsonb_typeof(before_data) = 'object'),
  check (after_data is null or jsonb_typeof(after_data) = 'object')
);

-- ---------------------------------------------------------------------------
-- Integrity indexes
-- ---------------------------------------------------------------------------

create index if not exists stores_tenant_idx on public.stores (tenant_id) where deleted_at is null;
create index if not exists memberships_user_tenant_idx on public.tenant_memberships (user_id, tenant_id) where status = 'active';
create index if not exists role_permissions_lookup_idx on public.role_permissions (tenant_id, role_id, permission_id);
create index if not exists user_roles_lookup_idx on public.user_roles (tenant_id, membership_id, role_id);
create index if not exists customer_addresses_customer_idx on public.customer_addresses (tenant_id, customer_id) where deleted_at is null;
create index if not exists categories_store_order_idx on public.categories (tenant_id, store_id, display_order) where deleted_at is null and is_active and is_visible;
create index if not exists products_store_category_order_idx on public.products (tenant_id, store_id, category_id, display_order) where deleted_at is null and is_visible;
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops) where deleted_at is null;
create index if not exists modifier_options_group_order_idx on public.modifier_options (tenant_id, store_id, modifier_group_id, display_order) where deleted_at is null and is_active;
create index if not exists delivery_zones_store_active_idx on public.delivery_zones (tenant_id, store_id, priority) where deleted_at is null and is_active;
create index if not exists orders_store_status_created_idx on public.orders (tenant_id, store_id, status, created_at desc);
create index if not exists orders_customer_created_idx on public.orders (tenant_id, customer_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items (tenant_id, store_id, order_id);
create index if not exists payments_order_status_idx on public.payments (tenant_id, store_id, order_id, status);
create index if not exists kds_tasks_station_status_idx on public.kds_tasks (tenant_id, store_id, station_id, status, created_at);
create index if not exists audit_logs_tenant_created_idx on public.audit_logs (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Internal helper functions. Security definer is used only to prevent RLS
-- recursion; each function pins an empty search_path and schema-qualifies every
-- object it reads. They are NOT exposed through the Data API.
-- ---------------------------------------------------------------------------

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_active_tenant_membership(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
  );
$$;

create or replace function private.has_permission(p_tenant_id uuid, p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_platform_admin())
    or exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and tm.is_owner
    )
    or exists (
      select 1
      from public.tenant_memberships tm
      join public.user_roles ur
        on ur.tenant_id = tm.tenant_id
       and ur.membership_id = tm.id
      join public.role_permissions rp
        on rp.tenant_id = ur.tenant_id
       and rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where tm.tenant_id = p_tenant_id
        and tm.user_id = (select auth.uid())
        and tm.status = 'active'
        and p.code = p_permission_code
    );
$$;

create or replace function private.is_customer_identity(p_tenant_id uuid, p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customer_auth_identities ci
    where ci.tenant_id = p_tenant_id
      and ci.customer_id = p_customer_id
      and ci.auth_user_id = (select auth.uid())
  );
$$;

create or replace function private.shares_active_tenant_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships mine
    join public.tenant_memberships theirs
      on theirs.tenant_id = mine.tenant_id
     and theirs.status = 'active'
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = p_other_user_id
  );
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A user who belongs to two tenants must not be able to move a row between
-- them merely because they hold valid permissions in both. The same applies to
-- moving store-scoped rows between stores.
create or replace function private.prevent_tenant_scope_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id is immutable';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_store_scope_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.tenant_id is distinct from old.tenant_id or new.store_id is distinct from old.store_id then
    raise exception 'tenant_id and store_id are immutable';
  end if;
  return new;
end;
$$;

-- Order-history rows are written automatically whenever the canonical status
-- changes. Application code must not insert history directly.
create or replace function private.capture_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history (
      tenant_id, store_id, order_id, from_status, to_status, changed_by_user_id
    ) values (
      new.tenant_id, new.store_id, new.id, null, new.status, (select auth.uid())
    );
  elsif new.status is distinct from old.status then
    insert into public.order_status_history (
      tenant_id, store_id, order_id, from_status, to_status, changed_by_user_id
    ) values (
      new.tenant_id, new.store_id, new.id, old.status, new.status, (select auth.uid())
    );
  end if;
  return new;
end;
$$;

revoke all on function private.is_platform_admin() from public, anon, authenticated;
revoke all on function private.has_active_tenant_membership(uuid) from public, anon, authenticated;
revoke all on function private.has_permission(uuid, text) from public, anon, authenticated;
revoke all on function private.is_customer_identity(uuid, uuid) from public, anon, authenticated;
revoke all on function private.shares_active_tenant_with(uuid) from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.prevent_tenant_scope_change() from public, anon, authenticated;
revoke all on function private.prevent_store_scope_change() from public, anon, authenticated;
revoke all on function private.capture_order_status_change() from public, anon, authenticated;

-- RLS invokes these functions as the querying authenticated role. They return
-- only a boolean derived from that caller's auth.uid().
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.has_active_tenant_membership(uuid) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.is_customer_identity(uuid, uuid) to authenticated;
grant execute on function private.shares_active_tenant_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Automatic integrity triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_profiles', 'tenants', 'stores', 'store_business_hours', 'roles',
    'features', 'tenant_features', 'tenant_memberships', 'customers',
    'customer_addresses', 'categories', 'products', 'product_images',
    'product_variants', 'modifier_groups', 'modifier_options',
    'product_modifier_groups', 'catalog_availability_rules', 'delivery_zones',
    'order_status_definitions', 'orders', 'payments', 'kds_stations',
    'kds_station_routes', 'kds_tasks'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t
    );
  end loop;

  foreach t in array array[
    'stores', 'roles', 'role_permissions', 'tenant_memberships', 'user_roles',
    'tenant_features', 'customers', 'customer_auth_identities', 'customer_addresses'
  ] loop
    execute format(
      'create trigger prevent_tenant_scope_change before update on public.%I for each row execute function private.prevent_tenant_scope_change()',
      t
    );
  end loop;

  foreach t in array array[
    'store_business_hours', 'categories', 'products', 'product_images',
    'product_variants', 'modifier_groups', 'modifier_options',
    'product_modifier_groups', 'catalog_availability_rules', 'delivery_zones',
    'order_status_definitions', 'orders', 'order_items',
    'order_item_modifiers', 'order_status_history', 'payments', 'kds_stations',
    'kds_station_routes', 'kds_tasks'
  ] loop
    execute format(
      'create trigger prevent_store_scope_change before update on public.%I for each row execute function private.prevent_store_scope_change()',
      t
    );
  end loop;
end
$$;

create trigger capture_order_status_change
after insert or update of status on public.orders
for each row execute function private.capture_order_status_change();

-- ---------------------------------------------------------------------------
-- Minimal reference data. A later seed migration should create cloned roles
-- (owner, manager, cashier, attendant, kitchen, driver, marketing, finance)
-- and assign the appropriate permission codes to each tenant's roles.
-- ---------------------------------------------------------------------------

insert into public.permissions (code, description) values
  ('tenant.manage', 'Manage tenant-level configuration'),
  ('settings.manage', 'Manage stores, hours, visual identity and feature settings'),
  ('team.manage', 'Manage memberships, roles and permissions'),
  ('catalog.read', 'Read catalog configuration'),
  ('catalog.manage', 'Create and manage catalog configuration'),
  ('orders.read', 'Read operational orders'),
  ('orders.manage', 'Manage order lifecycle through trusted commands'),
  ('kds.read', 'Read kitchen display tasks'),
  ('kds.manage', 'Manage kitchen stations and tasks through trusted commands'),
  ('delivery.read', 'Read delivery zones and dispatch data'),
  ('delivery.manage', 'Manage delivery zones and dispatch through trusted commands'),
  ('crm.read', 'Read customer data'),
  ('crm.manage', 'Manage customer data and consent'),
  ('finance.read', 'Read payments and financial data'),
  ('finance.manage', 'Manage financial configuration'),
  ('audit.read', 'Read audit logs')
on conflict (code) do nothing;

insert into public.features (code, name, description) values
  ('storefront', 'Loja online', 'Cardápio público e checkout'),
  ('kds', 'KDS', 'Kitchen display system'),
  ('delivery', 'Delivery', 'Zonas e pedidos de entrega'),
  ('pos', 'PDV', 'Frente de caixa'),
  ('inventory', 'Estoque', 'Estoque e ficha técnica'),
  ('loyalty', 'Fidelidade', 'Pontos e cashback')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Controlled onboarding and narrow public storefront RPCs
-- ---------------------------------------------------------------------------

-- This is the only client-callable write function in this draft. It cannot
-- choose an arbitrary owner: the owner is always auth.uid(). It creates a
-- private, unpublished first store; further onboarding steps use trusted
-- server-side commands.
create or replace function public.bootstrap_tenant(
  p_tenant_name text,
  p_tenant_slug text,
  p_store_name text,
  p_store_slug text,
  p_timezone text default 'America/Sao_Paulo'
)
returns table (created_tenant_id uuid, created_store_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_tenant_id uuid;
  v_store_id uuid;
  v_tenant_slug text := lower(btrim(p_tenant_slug));
  v_store_slug text := lower(btrim(p_store_slug));
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if char_length(btrim(p_tenant_name)) not between 2 and 140
     or char_length(btrim(p_store_name)) not between 2 and 140
     or v_tenant_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or v_store_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Invalid onboarding input';
  end if;

  insert into public.user_profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  insert into public.tenants (name, slug, timezone, status)
  values (btrim(p_tenant_name), v_tenant_slug::citext, p_timezone, 'onboarding')
  returning id into v_tenant_id;

  insert into public.stores (tenant_id, name, public_slug, timezone)
  values (v_tenant_id, btrim(p_store_name), v_store_slug::citext, p_timezone)
  returning id into v_store_id;

  insert into public.tenant_memberships (tenant_id, user_id, status, is_owner, accepted_at)
  values (v_tenant_id, v_user_id, 'active', true, now());

  insert into public.order_status_definitions (tenant_id, store_id, status, label, display_order) values
    (v_tenant_id, v_store_id, 'new', 'Novo', 10),
    (v_tenant_id, v_store_id, 'confirmed', 'Confirmado', 20),
    (v_tenant_id, v_store_id, 'preparing', 'Em preparo', 30),
    (v_tenant_id, v_store_id, 'ready', 'Pronto', 40),
    (v_tenant_id, v_store_id, 'awaiting_driver', 'Aguardando entregador', 50),
    (v_tenant_id, v_store_id, 'out_for_delivery', 'Saiu para entrega', 60),
    (v_tenant_id, v_store_id, 'delivered', 'Entregue', 70),
    (v_tenant_id, v_store_id, 'canceled', 'Cancelado', 80);

  return query select v_tenant_id, v_store_id;
end;
$$;

-- Public catalog response deliberately excludes tenant IDs, costs, internal
-- codes, stock and all customer/order data. Availability windows and dynamic
-- delivery eligibility must additionally be evaluated by the server checkout.
create or replace function public.get_storefront_catalog(p_store_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.public_slug,
      'timezone', s.timezone,
      'currency_code', s.currency_code,
      'phone_e164', s.phone_e164,
      'whatsapp_e164', s.whatsapp_e164,
      'logo_path', s.logo_path,
      'cover_image_path', s.cover_image_path,
      'theme', s.public_theme,
      'accepting_orders', s.accepting_orders,
      'accepts_delivery', s.accepts_delivery,
      'accepts_pickup', s.accepts_pickup,
      'accepts_dine_in', s.accepts_dine_in,
      'default_prep_minutes', s.default_prep_minutes,
      'min_order_amount', s.min_order_amount
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'description', c.description,
          'image_path', c.image_path,
          'products', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'slug', p.slug,
                'kind', p.kind,
                'short_description', p.short_description,
                'description', p.description,
                'base_price', p.base_price,
                'sale_price', p.sale_price,
                'compare_at_price', p.compare_at_price,
                'prep_minutes', p.prep_minutes,
                'dietary_tags', p.dietary_tags,
                'allergens', p.allergens,
                'image_path', (
                  select pi.storage_path
                  from public.product_images pi
                  where pi.tenant_id = p.tenant_id
                    and pi.store_id = p.store_id
                    and pi.product_id = p.id
                  order by pi.is_primary desc, pi.display_order, pi.created_at
                  limit 1
                ),
                'variants', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', pv.id,
                      'name', pv.name,
                      'price_override', pv.price_override,
                      'price_delta', pv.price_delta,
                      'is_default', pv.is_default
                    ) order by pv.display_order, pv.name
                  )
                  from public.product_variants pv
                  where pv.tenant_id = p.tenant_id
                    and pv.store_id = p.store_id
                    and pv.product_id = p.id
                    and pv.is_active
                    and pv.deleted_at is null
                ), '[]'::jsonb),
                'modifier_groups', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', mg.id,
                      'name', mg.name,
                      'description', mg.description,
                      'min_selections', coalesce(pmg.min_selections_override, mg.min_selections),
                      'max_selections', coalesce(pmg.max_selections_override, mg.max_selections),
                      'allow_option_quantity', mg.allow_option_quantity,
                      'allow_repeated_options', mg.allow_repeated_options,
                      'options', coalesce((
                        select jsonb_agg(
                          jsonb_build_object(
                            'id', mo.id,
                            'name', mo.name,
                            'description', mo.description,
                            'price_delta', mo.price_delta,
                            'is_default', mo.is_default,
                            'max_quantity_per_order', mo.max_quantity_per_order
                          ) order by mo.display_order, mo.name
                        )
                        from public.modifier_options mo
                        where mo.tenant_id = mg.tenant_id
                          and mo.store_id = mg.store_id
                          and mo.modifier_group_id = mg.id
                          and mo.is_active
                          and mo.deleted_at is null
                      ), '[]'::jsonb)
                    ) order by pmg.display_order, mg.name
                  )
                  from public.product_modifier_groups pmg
                  join public.modifier_groups mg
                    on mg.tenant_id = pmg.tenant_id
                   and mg.store_id = pmg.store_id
                   and mg.id = pmg.modifier_group_id
                  where pmg.tenant_id = p.tenant_id
                    and pmg.store_id = p.store_id
                    and pmg.product_id = p.id
                    and pmg.is_visible
                    and mg.is_active
                    and mg.deleted_at is null
                ), '[]'::jsonb)
              ) order by p.display_order, p.name
            )
            from public.products p
            where p.tenant_id = c.tenant_id
              and p.store_id = c.store_id
              and p.category_id = c.id
              and p.is_visible
              and p.is_available
              and (p.unavailable_until is null or p.unavailable_until <= now())
              and p.deleted_at is null
          ), '[]'::jsonb)
        ) order by c.display_order, c.name
      )
      from public.categories c
      where c.tenant_id = s.tenant_id
        and c.store_id = s.id
        and c.parent_id is null
        and c.is_visible
        and c.is_active
        and c.deleted_at is null
    ), '[]'::jsonb)
  )
  from public.stores s
  where s.public_slug = lower(btrim(p_store_slug))::citext
    and s.is_storefront_published
    and s.deleted_at is null;
$$;

-- A guest receives this token only from the server after a successful order
-- transaction. Possession of an unguessable UUID is required to see a narrow
-- tracking response, and this response contains no customer PII or payment
-- secrets.
create or replace function public.get_guest_order_tracking(
  p_order_id uuid,
  p_tracking_token uuid
)
returns table (
  display_number bigint,
  status public.order_status,
  fulfillment_type public.fulfillment_type,
  payment_status public.payment_status,
  estimated_ready_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.display_number,
    o.status,
    o.fulfillment_type,
    o.payment_status,
    o.estimated_ready_at,
    o.completed_at,
    o.updated_at
  from public.orders o
  where o.id = p_order_id
    and o.public_tracking_token = p_tracking_token;
$$;

revoke all on function public.bootstrap_tenant(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_storefront_catalog(text) from public, anon, authenticated;
revoke all on function public.get_guest_order_tracking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_tenant(text, text, text, text, text) to authenticated;
grant execute on function public.get_storefront_catalog(text) to anon, authenticated;
grant execute on function public.get_guest_order_tracking(uuid, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.tenants enable row level security;
alter table public.stores enable row level security;
alter table public.store_business_hours enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.user_roles enable row level security;
alter table public.features enable row level security;
alter table public.tenant_features enable row level security;
alter table public.customers enable row level security;
alter table public.customer_auth_identities enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.product_modifier_groups enable row level security;
alter table public.catalog_availability_rules enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.order_status_definitions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_modifiers enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.kds_stations enable row level security;
alter table public.kds_station_routes enable row level security;
alter table public.kds_tasks enable row level security;
alter table public.audit_logs enable row level security;

-- No anonymous base-table access. Explicit authenticated grants below are safe
-- only because every granted table has RLS enabled and matching policies.
revoke all on table
  public.user_profiles, public.platform_admins, public.tenants, public.stores,
  public.store_business_hours, public.permissions, public.roles,
  public.role_permissions, public.tenant_memberships, public.user_roles,
  public.features, public.tenant_features, public.customers,
  public.customer_auth_identities, public.customer_addresses, public.categories,
  public.products, public.product_images, public.product_variants,
  public.modifier_groups, public.modifier_options, public.product_modifier_groups,
  public.catalog_availability_rules, public.delivery_zones,
  public.order_status_definitions, public.orders, public.order_items,
  public.order_item_modifiers, public.order_status_history, public.payments,
  public.kds_stations, public.kds_station_routes, public.kds_tasks,
  public.audit_logs
from anon;

grant select on table
  public.user_profiles, public.tenants, public.stores, public.store_business_hours,
  public.permissions, public.roles, public.role_permissions,
  public.tenant_memberships, public.user_roles, public.features,
  public.tenant_features, public.customers, public.customer_auth_identities,
  public.customer_addresses, public.categories, public.products,
  public.product_images, public.product_variants, public.modifier_groups,
  public.modifier_options, public.product_modifier_groups,
  public.catalog_availability_rules, public.delivery_zones,
  public.order_status_definitions, public.orders, public.order_items,
  public.order_item_modifiers, public.order_status_history, public.payments,
  public.kds_stations, public.kds_station_routes, public.kds_tasks,
  public.audit_logs
to authenticated;

-- Catalog and low-risk configuration can use direct authenticated CRUD. All
-- monetary/order/checkout writes stay server-side even for authenticated users.
grant insert, update, delete on table
  public.categories, public.products, public.product_images,
  public.product_variants, public.modifier_groups, public.modifier_options,
  public.product_modifier_groups, public.catalog_availability_rules,
  public.delivery_zones, public.store_business_hours, public.kds_stations,
  public.kds_station_routes
to authenticated;

grant update on table public.user_profiles, public.tenants, public.stores, public.tenant_features, public.customers, public.customer_addresses
to authenticated;

-- Profiles
create policy user_profiles_select_self_or_colleague
on public.user_profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_active_tenant_with(id))
  or (select private.is_platform_admin())
);

create policy user_profiles_insert_self
on public.user_profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy user_profiles_update_self
on public.user_profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Tenant and store settings
create policy tenants_select_member
on public.tenants for select to authenticated
using ((select private.has_active_tenant_membership(id)) or (select private.is_platform_admin()));

create policy tenants_update_manager
on public.tenants for update to authenticated
using ((select private.has_permission(id, 'tenant.manage')))
with check ((select private.has_permission(id, 'tenant.manage')));

create policy stores_select_member
on public.stores for select to authenticated
using ((select private.has_active_tenant_membership(tenant_id)) or (select private.is_platform_admin()));

create policy stores_update_manager
on public.stores for update to authenticated
using ((select private.has_permission(tenant_id, 'settings.manage')))
with check ((select private.has_permission(tenant_id, 'settings.manage')));

create policy store_hours_read_member
on public.store_business_hours for select to authenticated
using ((select private.has_active_tenant_membership(tenant_id)) or (select private.is_platform_admin()));

create policy store_hours_manage
on public.store_business_hours for all to authenticated
using ((select private.has_permission(tenant_id, 'settings.manage')))
with check ((select private.has_permission(tenant_id, 'settings.manage')));

-- RBAC reads are safe within a tenant. Role/membership mutation deliberately
-- has no direct browser policy: use a server command that prevents privilege
-- escalation and records an audit event.
create policy permissions_read_authenticated
on public.permissions for select to authenticated using (true);

create policy roles_read_member
on public.roles for select to authenticated
using ((select private.has_active_tenant_membership(tenant_id)) or (select private.is_platform_admin()));

create policy role_permissions_read_member
on public.role_permissions for select to authenticated
using ((select private.has_active_tenant_membership(tenant_id)) or (select private.is_platform_admin()));

create policy memberships_read_self_or_team_manager
on public.tenant_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_permission(tenant_id, 'team.manage'))
  or (select private.is_platform_admin())
);

create policy user_roles_read_self_or_team_manager
on public.user_roles for select to authenticated
using ((select private.has_permission(tenant_id, 'team.manage')) or (select private.is_platform_admin()));

create policy features_read_authenticated
on public.features for select to authenticated using (true);

create policy tenant_features_read_member
on public.tenant_features for select to authenticated
using ((select private.has_active_tenant_membership(tenant_id)) or (select private.is_platform_admin()));

create policy tenant_features_update_settings_manager
on public.tenant_features for update to authenticated
using ((select private.has_permission(tenant_id, 'settings.manage')))
with check ((select private.has_permission(tenant_id, 'settings.manage')));

-- CRM: linked customers can see only their own profile/address; restaurant
-- users need CRM permissions. Guest phone numbers alone never grant access.
create policy customers_read_crm_or_self
on public.customers for select to authenticated
using (
  (select private.has_permission(tenant_id, 'crm.read'))
  or (select private.is_customer_identity(tenant_id, id))
  or (select private.is_platform_admin())
);

create policy customers_update_crm_manager
on public.customers for update to authenticated
using ((select private.has_permission(tenant_id, 'crm.manage')))
with check ((select private.has_permission(tenant_id, 'crm.manage')));

create policy customer_identities_read_self_or_crm
on public.customer_auth_identities for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select private.has_permission(tenant_id, 'crm.read'))
  or (select private.is_platform_admin())
);

create policy customer_addresses_read_crm_or_self
on public.customer_addresses for select to authenticated
using (
  (select private.has_permission(tenant_id, 'crm.read'))
  or (select private.is_customer_identity(tenant_id, customer_id))
  or (select private.is_platform_admin())
);

create policy customer_addresses_update_crm_manager
on public.customer_addresses for update to authenticated
using ((select private.has_permission(tenant_id, 'crm.manage')))
with check ((select private.has_permission(tenant_id, 'crm.manage')));

-- Catalog policies. The checkout server performs the final availability and
-- price validation; catalog writes are restricted to catalog.manage.
do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'products', 'product_images', 'product_variants',
    'modifier_groups', 'modifier_options', 'product_modifier_groups',
    'catalog_availability_rules'
  ] loop
    execute format(
      'create policy catalog_read on public.%I for select to authenticated using ((select private.has_permission(tenant_id, ''catalog.read'')) or (select private.has_permission(tenant_id, ''catalog.manage'')) or (select private.is_platform_admin()))',
      t
    );
    execute format(
      'create policy catalog_write on public.%I for all to authenticated using ((select private.has_permission(tenant_id, ''catalog.manage''))) with check ((select private.has_permission(tenant_id, ''catalog.manage'')))',
      t
    );
  end loop;
end
$$;

create policy delivery_zones_read
on public.delivery_zones for select to authenticated
using ((select private.has_permission(tenant_id, 'delivery.read')) or (select private.has_permission(tenant_id, 'delivery.manage')) or (select private.is_platform_admin()));

create policy delivery_zones_write
on public.delivery_zones for all to authenticated
using ((select private.has_permission(tenant_id, 'delivery.manage')))
with check ((select private.has_permission(tenant_id, 'delivery.manage')));

create policy order_status_definitions_read
on public.order_status_definitions for select to authenticated
using ((select private.has_permission(tenant_id, 'orders.read')) or (select private.has_permission(tenant_id, 'orders.manage')) or (select private.is_platform_admin()));

-- Order, item, payment and status-history tables intentionally receive SELECT
-- policies only. Direct client mutations would allow forged totals or payment
-- states; trusted server-side commands own those writes.
create policy orders_read_operational
on public.orders for select to authenticated
using (
  (select private.has_permission(tenant_id, 'orders.read'))
  or (select private.has_permission(tenant_id, 'orders.manage'))
  or (select private.has_permission(tenant_id, 'kds.read'))
  or (select private.has_permission(tenant_id, 'delivery.read'))
  or (select private.has_permission(tenant_id, 'finance.read'))
  or (select private.is_platform_admin())
);

create policy order_items_read_operational
on public.order_items for select to authenticated
using (
  (select private.has_permission(tenant_id, 'orders.read'))
  or (select private.has_permission(tenant_id, 'orders.manage'))
  or (select private.has_permission(tenant_id, 'kds.read'))
  or (select private.has_permission(tenant_id, 'delivery.read'))
  or (select private.is_platform_admin())
);

create policy order_item_modifiers_read_operational
on public.order_item_modifiers for select to authenticated
using (
  (select private.has_permission(tenant_id, 'orders.read'))
  or (select private.has_permission(tenant_id, 'orders.manage'))
  or (select private.has_permission(tenant_id, 'kds.read'))
  or (select private.has_permission(tenant_id, 'delivery.read'))
  or (select private.is_platform_admin())
);

create policy order_history_read_operational
on public.order_status_history for select to authenticated
using (
  (select private.has_permission(tenant_id, 'orders.read'))
  or (select private.has_permission(tenant_id, 'orders.manage'))
  or (select private.has_permission(tenant_id, 'kds.read'))
  or (select private.has_permission(tenant_id, 'delivery.read'))
  or (select private.is_platform_admin())
);

create policy payments_read_finance
on public.payments for select to authenticated
using (
  (select private.has_permission(tenant_id, 'finance.read'))
  or (select private.has_permission(tenant_id, 'finance.manage'))
  or (select private.has_permission(tenant_id, 'orders.manage'))
  or (select private.is_platform_admin())
);

create policy kds_stations_read
on public.kds_stations for select to authenticated
using ((select private.has_permission(tenant_id, 'kds.read')) or (select private.has_permission(tenant_id, 'kds.manage')) or (select private.is_platform_admin()));

create policy kds_stations_write
on public.kds_stations for all to authenticated
using ((select private.has_permission(tenant_id, 'kds.manage')))
with check ((select private.has_permission(tenant_id, 'kds.manage')));

create policy kds_routes_read
on public.kds_station_routes for select to authenticated
using ((select private.has_permission(tenant_id, 'kds.read')) or (select private.has_permission(tenant_id, 'kds.manage')) or (select private.is_platform_admin()));

create policy kds_routes_write
on public.kds_station_routes for all to authenticated
using ((select private.has_permission(tenant_id, 'kds.manage')))
with check ((select private.has_permission(tenant_id, 'kds.manage')));

create policy kds_tasks_read
on public.kds_tasks for select to authenticated
using ((select private.has_permission(tenant_id, 'kds.read')) or (select private.has_permission(tenant_id, 'kds.manage')) or (select private.has_permission(tenant_id, 'orders.read')) or (select private.is_platform_admin()));

create policy audit_logs_read
on public.audit_logs for select to authenticated
using ((select private.has_permission(tenant_id, 'audit.read')) or (select private.is_platform_admin()));

create policy platform_admins_read_self
on public.platform_admins for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_platform_admin()));

-- ---------------------------------------------------------------------------
-- Operational follow-ups before production
-- ---------------------------------------------------------------------------
-- 1. Add SECURITY DEFINER command functions or Edge Functions for:
--    create_checkout_order, transition_order_status, create_or_update_payment,
--    start_or_finish_kds_task, invite_member, and change_role_permissions.
--    Each command must authorize auth.uid(), lock relevant catalog rows, compute
--    prices server-side, and write audit data in the same transaction.
-- 2. Add payment webhook receipt/event tables with signature verification and
--    a unique provider event ID before enabling a real gateway.
-- 3. Add Storage bucket policies for tenant/store paths; never trust a client
--    supplied storage path without enforcing its tenant and store prefix.
-- 4. Add Supabase Realtime publication only for the narrowly-needed operational
--    tables (orders, kds_tasks, payments), then validate every subscription RLS
--    path with two tenant test users.
-- 5. Configure Data API grants/exposed schemas explicitly. New Supabase public
--    tables are not automatically exposed on newer projects; keep `private`
--    unexposed in all environments.
