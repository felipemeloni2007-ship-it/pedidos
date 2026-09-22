-- DRAFT ONLY: not applied. Module-specific authorization must be reviewed before migration.
-- Mesa Pronta · Admin operating system
-- Adds the durable records behind stock, purchasing, floor service, delivery,
-- loyalty, promotions, CRM automation, finance and integrations. Every row is
-- scoped to tenant_id and store_id; RLS is enabled before any grant is added.

insert into public.permissions (code, description) values
  ('inventory.read', 'Read inventory, recipes and purchasing'),
  ('inventory.manage', 'Manage inventory, recipes, suppliers and purchasing'),
  ('marketing.read', 'Read campaigns, coupons and loyalty'),
  ('marketing.manage', 'Manage campaigns, coupons and loyalty'),
  ('pos.read', 'Read point of sale, tables and cash registers'),
  ('pos.manage', 'Manage point of sale, tables and cash registers'),
  ('reports.read', 'Read operational and financial reports'),
  ('integrations.manage', 'Manage providers, webhooks and devices')
on conflict (code) do nothing;

-- Inventory and cost accounting ------------------------------------------------
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  sku text,
  unit text not null check (unit in ('g','kg','ml','l','un','porcao')),
  current_quantity numeric(14,3) not null default 0 check (current_quantity >= 0),
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  average_cost numeric(12,4) not null default 0 check (average_cost >= 0),
  supplier_id uuid,
  last_purchase_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  product_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),
  waste_percent numeric(5,2) not null default 0 check (waste_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, product_id, ingredient_id),
  foreign key (tenant_id, store_id, product_id) references public.products (tenant_id, store_id, id) on delete cascade,
  foreign key (tenant_id, store_id, ingredient_id) references public.ingredients (tenant_id, store_id, id) on delete cascade
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  legal_name text not null,
  trade_name text,
  document_number text,
  contact_name text,
  phone text,
  email citext,
  payment_terms text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

alter table public.ingredients drop constraint if exists ingredients_supplier_fk;
alter table public.ingredients add constraint ingredients_supplier_fk foreign key (tenant_id, store_id, supplier_id) references public.suppliers (tenant_id, store_id, id) on delete set null;

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  ingredient_id uuid not null,
  movement_type text not null check (movement_type in ('purchase','sale','adjustment','waste','transfer','return')),
  quantity_delta numeric(14,3) not null,
  unit_cost numeric(12,4) not null default 0 check (unit_cost >= 0),
  source_reference text,
  notes text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id, ingredient_id) references public.ingredients (tenant_id, store_id, id) on delete restrict
);

create unique index if not exists inventory_sale_source_uidx on public.inventory_movements (tenant_id, store_id, source_reference) where source_reference is not null and movement_type = 'sale';

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  supplier_id uuid not null,
  status text not null default 'draft' check (status in ('draft','ordered','partially_received','received','canceled')),
  expected_at date,
  received_at timestamptz,
  subtotal_amount numeric(12,2) not null default 0,
  notes text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id, supplier_id) references public.suppliers (tenant_id, store_id, id) on delete restrict
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  purchase_order_id uuid not null,
  ingredient_id uuid not null,
  ordered_quantity numeric(14,3) not null check (ordered_quantity > 0),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  unit_cost numeric(12,4) not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, purchase_order_id) references public.purchase_orders (tenant_id, store_id, id) on delete cascade,
  foreign key (tenant_id, store_id, ingredient_id) references public.ingredients (tenant_id, store_id, id) on delete restrict
);

-- Floor, tabs and delivery -----------------------------------------------------
create table if not exists public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  code text not null,
  name text not null,
  seats integer not null default 2 check (seats > 0),
  zone text,
  status text not null default 'available' check (status in ('available','occupied','waiting_payment','blocked')),
  qr_token uuid not null default gen_random_uuid(),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  unique (tenant_id, store_id, code),
  unique (qr_token),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table if not exists public.tabs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  table_id uuid,
  opened_by_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open','waiting_payment','paid','canceled')),
  guest_count integer not null default 1 check (guest_count > 0),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  total_amount numeric(12,2) not null default 0,
  notes text,
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id, table_id) references public.restaurant_tables (tenant_id, store_id, id) on delete restrict
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  driver_id uuid,
  status text not null default 'queued' check (status in ('queued','assigned','picked_up','arrived','delivered','failed','canceled')),
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  eta_minutes integer check (eta_minutes is null or eta_minutes >= 0),
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  route_batch text,
  tracking_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(tracking_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  unique (tenant_id, store_id, order_id),
  foreign key (tenant_id, store_id, order_id) references public.orders (tenant_id, store_id, id) on delete restrict
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  full_name text not null,
  phone text,
  vehicle_type text,
  plate text,
  status text not null default 'offline' check (status in ('available','on_delivery','offline')),
  photo_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

alter table public.deliveries drop constraint if exists deliveries_driver_fk;
alter table public.deliveries add constraint deliveries_driver_fk foreign key (tenant_id, store_id, driver_id) references public.drivers (tenant_id, store_id, id) on delete set null;

-- Revenue, campaigns and loyalty ----------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  code citext not null,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed','free_delivery','free_product')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  allowed_weekdays smallint[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, code),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  name text not null,
  kind text not null check (kind in ('bogo','combo','progressive','happy_hour','category_discount','flash_sale','free_item')),
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id)
);

create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  customer_id uuid not null,
  points_balance integer not null default 0 check (points_balance >= 0),
  cashback_balance numeric(12,2) not null default 0 check (cashback_balance >= 0),
  tier text not null default 'bronze' check (tier in ('bronze','silver','gold')),
  lifetime_spend numeric(12,2) not null default 0 check (lifetime_spend >= 0),
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, customer_id),
  foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete cascade
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid,
  customer_id uuid not null,
  order_id uuid,
  points_delta integer not null,
  cashback_delta numeric(12,2) not null default 0,
  reason text not null,
  expires_at date,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id, order_id) references public.orders (tenant_id, store_id, id) on delete set null
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  order_id uuid not null,
  customer_id uuid,
  food_rating smallint check (food_rating between 1 and 5),
  delivery_rating smallint check (delivery_rating between 1 and 5),
  service_rating smallint check (service_rating between 1 and 5),
  comment text,
  response text,
  responded_at timestamptz,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, order_id),
  foreign key (tenant_id, store_id, order_id) references public.orders (tenant_id, store_id, id) on delete restrict,
  foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete set null
);

create table if not exists public.abandoned_carts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  customer_id uuid,
  session_key text not null,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal_amount numeric(12,2) not null default 0,
  recovered_at timestamptz,
  last_contacted_at timestamptz,
  consent_to_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, session_key),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, customer_id) references public.customers (tenant_id, id) on delete set null
);

-- Finance, notifications and providers ---------------------------------------
create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  opened_by_user_id uuid references auth.users (id) on delete set null,
  closed_by_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open','closed','reconciled')),
  opening_amount numeric(12,2) not null default 0,
  expected_amount numeric(12,2) not null default 0,
  counted_amount numeric(12,2),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, id),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  cash_register_id uuid not null,
  movement_type text not null check (movement_type in ('sale','supply','withdrawal','deposit','refund','adjustment')),
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text,
  description text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, store_id, cash_register_id) references public.cash_registers (tenant_id, store_id, id) on delete cascade
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid not null,
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  paid_at timestamptz,
  supplier_id uuid,
  attachment_path text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade,
  foreign key (tenant_id, store_id, supplier_id) references public.suppliers (tenant_id, store_id, id) on delete set null
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid,
  recipient_user_id uuid references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  store_id uuid,
  provider text not null,
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error')),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, provider),
  foreign key (tenant_id, store_id) references public.stores (tenant_id, id) on delete cascade
);

-- Updated-at triggers for mutable operational records.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'ingredients','recipes','suppliers','purchase_orders','restaurant_tables','deliveries','drivers',
    'coupons','promotions','loyalty_accounts','abandoned_carts','cash_registers','expenses',
    'notifications','integration_connections'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- A delivered order consumes ingredients exactly once. The source reference
-- uniqueness makes retries safe and keeps inventory auditability intact.
create or replace function private.consume_recipe_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  recipe record;
  source_key text;
  consumed numeric;
  movement_id uuid;
begin
  if new.status <> 'delivered'::public.order_status or old.status = new.status then
    return new;
  end if;
  for item in select oi.id, oi.product_id, oi.quantity from public.order_items oi where oi.tenant_id = new.tenant_id and oi.store_id = new.store_id and oi.order_id = new.id loop
    for recipe in select r.ingredient_id, r.quantity, r.waste_percent from public.recipes r where r.tenant_id = new.tenant_id and r.store_id = new.store_id and r.product_id = item.product_id loop
      source_key := new.id::text || ':' || item.id::text || ':' || recipe.ingredient_id::text;
      consumed := round(item.quantity * recipe.quantity * (1 + recipe.waste_percent / 100), 3);
      movement_id := null;
      insert into public.inventory_movements (tenant_id, store_id, ingredient_id, movement_type, quantity_delta, source_reference, notes)
      values (new.tenant_id, new.store_id, recipe.ingredient_id, 'sale', -consumed, source_key, 'Baixa automática pela venda')
      on conflict (tenant_id, store_id, source_reference) where source_reference is not null and movement_type = 'sale' do nothing
      returning id into movement_id;
      if movement_id is not null then
        update public.ingredients set current_quantity = greatest(0, current_quantity - consumed) where tenant_id = new.tenant_id and store_id = new.store_id and id = recipe.ingredient_id;
      end if;
    end loop;
  end loop;
  return new;
end;
$$;

drop trigger if exists consume_recipe_inventory_on_delivery on public.orders;
create trigger consume_recipe_inventory_on_delivery after update of status on public.orders for each row execute function private.consume_recipe_inventory();

-- Indexes keep dashboards and dispatch screens fast without broad scans.
create index if not exists ingredients_stock_alert_idx on public.ingredients (tenant_id, store_id, current_quantity) where is_active and deleted_at is null;
create index if not exists inventory_movements_ingredient_created_idx on public.inventory_movements (tenant_id, store_id, ingredient_id, created_at desc);
create index if not exists deliveries_dispatch_idx on public.deliveries (tenant_id, store_id, status, created_at);
create index if not exists customers_segment_idx on public.customers (tenant_id, updated_at desc) where deleted_at is null;
create index if not exists reviews_store_created_idx on public.reviews (tenant_id, store_id, created_at desc);
create index if not exists notifications_recipient_idx on public.notifications (tenant_id, recipient_user_id, read_at, created_at desc);
create index if not exists expenses_due_idx on public.expenses (tenant_id, store_id, due_date, paid_at);

-- Tenant/store-scoped tables use the same backend permission gate as Phase 1.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'ingredients','recipes','suppliers','inventory_movements','purchase_orders','purchase_order_items',
    'restaurant_tables','tabs','deliveries','drivers','coupons','promotions','loyalty_accounts',
    'loyalty_transactions','reviews','abandoned_carts','cash_registers','cash_movements','expenses',
    'notifications','integration_connections'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('drop policy if exists %I_read on public.%I', table_name, table_name);
    execute format('drop policy if exists %I_write on public.%I', table_name, table_name);
    execute format('create policy %I_read on public.%I for select to authenticated using ((select private.has_permission(tenant_id, ''reports.read'')) or (select private.has_permission(tenant_id, ''inventory.read'')) or (select private.has_permission(tenant_id, ''crm.read'')) or (select private.has_permission(tenant_id, ''delivery.read'')) or (select private.has_permission(tenant_id, ''pos.read'')) or (select private.has_permission(tenant_id, ''marketing.read'')) or (select private.has_permission(tenant_id, ''settings.manage'')) or (select private.is_platform_admin()))', table_name, table_name);
    execute format('create policy %I_write on public.%I for all to authenticated using ((select private.has_permission(tenant_id, ''inventory.manage'')) or (select private.has_permission(tenant_id, ''crm.manage'')) or (select private.has_permission(tenant_id, ''delivery.manage'')) or (select private.has_permission(tenant_id, ''pos.manage'')) or (select private.has_permission(tenant_id, ''marketing.manage'')) or (select private.has_permission(tenant_id, ''finance.manage'')) or (select private.has_permission(tenant_id, ''integrations.manage'')) or (select private.is_platform_admin())) with check ((select private.has_permission(tenant_id, ''inventory.manage'')) or (select private.has_permission(tenant_id, ''crm.manage'')) or (select private.has_permission(tenant_id, ''delivery.manage'')) or (select private.has_permission(tenant_id, ''pos.manage'')) or (select private.has_permission(tenant_id, ''marketing.manage'')) or (select private.has_permission(tenant_id, ''finance.manage'')) or (select private.has_permission(tenant_id, ''integrations.manage'')) or (select private.is_platform_admin()))', table_name, table_name);
  end loop;
end $$;

-- Existing tenants receive the new operational permissions without changing
-- their role identity. Owners already receive every permission by design.
insert into public.role_permissions (tenant_id, role_id, permission_id)
select r.tenant_id, r.id, p.id
from public.roles r
join public.permissions p on p.code = any (case r.code
  when 'manager' then array['inventory.read','inventory.manage','marketing.read','marketing.manage','pos.read','pos.manage','reports.read','integrations.manage']::text[]
  when 'cashier' then array['pos.read','pos.manage']::text[]
  when 'waiter' then array['pos.read','pos.manage']::text[]
  when 'driver' then array['reports.read']::text[]
  when 'marketing' then array['marketing.read','marketing.manage','reports.read']::text[]
  when 'finance' then array['inventory.read','reports.read']::text[]
  else array[]::text[]
end)
on conflict do nothing;

-- Customer-facing review/favorite-style flows can be added through verified
-- customer identities; anonymous checkout never receives direct table writes.
revoke all on table public.reviews, public.loyalty_accounts, public.loyalty_transactions from anon;
