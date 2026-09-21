-- Phase 1 hardening: default RBAC, conditional modifier rules and a single
-- transactional checkout command. This migration intentionally keeps the
-- browser away from order/payment base-table writes.

-- A modifier group can occur more than once on a product when each occurrence
-- is conditional on a different variant. The initial composite key prevented
-- that useful (and common) pizza/size configuration.
alter table public.product_modifier_groups
  add column if not exists id uuid default gen_random_uuid();

update public.product_modifier_groups
set id = gen_random_uuid()
where id is null;

alter table public.product_modifier_groups
  alter column id set not null;

alter table public.product_modifier_groups
  drop constraint if exists product_modifier_groups_pkey;

alter table public.product_modifier_groups
  add constraint product_modifier_groups_pkey primary key (id);

create unique index if not exists product_modifier_groups_rule_uidx
  on public.product_modifier_groups (
    tenant_id,
    store_id,
    product_id,
    modifier_group_id,
    coalesce(condition_variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Every new owner receives a tenant-local copy of the platform roles. Owners
-- can add custom roles and change their permission mapping without affecting
-- any other tenant.
create or replace function private.seed_default_roles(
  p_tenant_id uuid,
  p_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.roles (tenant_id, code, name, description, is_system, is_editable)
  select
    p_tenant_id,
    seed.code,
    seed.name,
    seed.description,
    true,
    false
  from (
    values
      ('owner', 'Proprietário', 'Controle total do estabelecimento.'),
      ('manager', 'Gerente', 'Gestão operacional ampla.'),
      ('cashier', 'Caixa', 'Pedidos, pagamentos e frente de caixa.'),
      ('attendant', 'Atendente', 'Atendimento, clientes e pedidos.'),
      ('waiter', 'Garçom', 'Mesas, comandas e pedidos de salão.'),
      ('kitchen', 'Cozinha', 'Produção e KDS.'),
      ('driver', 'Entregador', 'Entregas atribuídas.'),
      ('marketing', 'Marketing', 'CRM, promoções e campanhas.'),
      ('finance', 'Financeiro', 'Recebimentos, despesas e relatórios.')
  ) as seed(code, name, description)
  on conflict (tenant_id, code) do nothing;

  insert into public.role_permissions (tenant_id, role_id, permission_id)
  select p_tenant_id, role_row.id, permission_row.id
  from public.roles role_row
  cross join public.permissions permission_row
  where role_row.tenant_id = p_tenant_id
    and (
      role_row.code = 'owner'
      or permission_row.code = any (
        case role_row.code
          when 'manager' then array[
            'tenant.manage', 'settings.manage', 'catalog.read', 'catalog.manage',
            'orders.read', 'orders.manage', 'kds.read', 'kds.manage',
            'delivery.read', 'delivery.manage', 'crm.read', 'crm.manage',
            'finance.read', 'audit.read'
          ]::text[]
          when 'cashier' then array['orders.read', 'orders.manage', 'finance.read']::text[]
          when 'attendant' then array['orders.read', 'orders.manage', 'crm.read', 'crm.manage']::text[]
          when 'waiter' then array['orders.read', 'orders.manage']::text[]
          when 'kitchen' then array['orders.read', 'kds.read', 'kds.manage']::text[]
          when 'driver' then array['orders.read', 'delivery.read', 'delivery.manage']::text[]
          when 'marketing' then array['catalog.read', 'crm.read', 'crm.manage']::text[]
          when 'finance' then array['orders.read', 'finance.read', 'finance.manage']::text[]
          else array[]::text[]
        end
      )
    )
  on conflict do nothing;

  insert into public.user_roles (tenant_id, membership_id, role_id)
  select p_tenant_id, p_membership_id, role_row.id
  from public.roles role_row
  where role_row.tenant_id = p_tenant_id
    and role_row.code = 'owner'
  on conflict do nothing;
end;
$$;

create or replace function private.seed_roles_for_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_owner and new.status = 'active'::public.membership_status then
    perform private.seed_default_roles(new.tenant_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists seed_default_roles_for_owner on public.tenant_memberships;
create trigger seed_default_roles_for_owner
after insert or update of is_owner, status on public.tenant_memberships
for each row execute function private.seed_roles_for_owner_membership();

do $$
declare
  membership_row record;
begin
  for membership_row in
    select id, tenant_id
    from public.tenant_memberships
    where is_owner and status = 'active'::public.membership_status
  loop
    perform private.seed_default_roles(membership_row.tenant_id, membership_row.id);
  end loop;
end;
$$;

revoke all on function private.seed_default_roles(uuid, uuid) from public, anon, authenticated;
revoke all on function private.seed_roles_for_owner_membership() from public, anon, authenticated;

-- This server-only command makes checkout all-or-nothing. It re-reads the
-- canonical catalog, validates modifiers/prices and delivery rules, creates
-- the KDS work, and uses the client idempotency key under a transaction lock.
create or replace function public.create_checkout_order(
  p_tenant_id uuid,
  p_store_id uuid,
  p_idempotency_key uuid,
  p_fulfillment_type public.fulfillment_type,
  p_customer jsonb,
  p_payment jsonb,
  p_items jsonb
)
returns table (
  order_id uuid,
  display_number bigint,
  order_status public.order_status,
  total_amount numeric(12,2),
  tracking_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store public.stores%rowtype;
  v_existing_order public.orders%rowtype;
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_customer_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_customer_address text;
  v_customer_reference text;
  v_payment_method public.payment_method;
  v_change_for numeric(12,2);
  v_input jsonb;
  v_canonical_item jsonb;
  v_canonical_items jsonb := '[]'::jsonb;
  v_selections jsonb;
  v_selected_options jsonb;
  v_product_id uuid;
  v_quantity numeric(12,3);
  v_base_unit_price numeric(12,2);
  v_modifier_total numeric(12,2);
  v_group_total numeric(12,2);
  v_unit_total numeric(12,2);
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_zone_minimum_order numeric(12,2);
  v_free_delivery_above numeric(12,2);
  v_total numeric(12,2);
  v_delivery_zone_id uuid;
  v_delivery_zone_name text;
  v_group record;
  v_option record;
  v_item_id uuid;
  v_station_id uuid;
  v_selected_count integer;
  v_valid_selected_count integer;
  v_has_duplicate_options boolean;
  v_unknown_group_key text;
begin
  if p_idempotency_key is null
     or jsonb_typeof(p_customer) <> 'object'
     or jsonb_typeof(p_payment) <> 'object'
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'Invalid checkout payload';
  end if;

  -- Serialize retries for the same store/key before the unique index is hit.
  perform pg_advisory_xact_lock(hashtext(p_tenant_id::text || ':' || p_store_id::text || ':' || p_idempotency_key::text));

  select * into v_existing_order
  from public.orders
  where tenant_id = p_tenant_id
    and store_id = p_store_id
    and checkout_idempotency_key = p_idempotency_key;

  if found then
    return query
    select
      v_existing_order.id,
      v_existing_order.display_number,
      v_existing_order.status,
      v_existing_order.total_amount,
      v_existing_order.public_tracking_token;
    return;
  end if;

  select * into v_store
  from public.stores
  where id = p_store_id
    and tenant_id = p_tenant_id
    and deleted_at is null
  for share;

  if not found or not v_store.accepting_orders or not v_store.is_storefront_published then
    raise exception using errcode = 'P0001', message = 'Store is not accepting orders';
  end if;

  if (p_fulfillment_type = 'delivery'::public.fulfillment_type and not v_store.accepts_delivery)
     or (p_fulfillment_type = 'pickup'::public.fulfillment_type and not v_store.accepts_pickup)
     or (p_fulfillment_type = 'dine_in'::public.fulfillment_type and not v_store.accepts_dine_in) then
    raise exception using errcode = 'P0001', message = 'Fulfillment option is unavailable';
  end if;

  v_customer_name := btrim(coalesce(p_customer ->> 'name', ''));
  v_customer_phone := regexp_replace(coalesce(p_customer ->> 'phone', ''), '\D', '', 'g');
  v_customer_address := nullif(btrim(coalesce(p_customer ->> 'address', '')), '');
  v_customer_reference := nullif(btrim(coalesce(p_customer ->> 'reference', '')), '');

  if char_length(v_customer_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Invalid customer name';
  end if;

  if char_length(v_customer_phone) in (10, 11) then
    v_customer_phone := '55' || v_customer_phone;
  end if;

  if v_customer_phone !~ '^55[1-9][0-9]{9,10}$' then
    raise exception using errcode = '22023', message = 'Invalid customer phone';
  end if;
  v_customer_phone := '+' || v_customer_phone;

  if p_fulfillment_type = 'delivery'::public.fulfillment_type
     and v_customer_address is null then
    raise exception using errcode = '22023', message = 'Delivery address is required';
  end if;

  begin
    v_payment_method := (p_payment ->> 'method')::public.payment_method;
  exception when others then
    raise exception using errcode = '22023', message = 'Invalid payment method';
  end;

  if p_payment ? 'changeFor' and p_payment ->> 'changeFor' is not null then
    begin
      v_change_for := round((p_payment ->> 'changeFor')::numeric, 2);
    exception when others then
      raise exception using errcode = '22023', message = 'Invalid change amount';
    end;
  end if;

  for v_input in select value from jsonb_array_elements(p_items) as item(value)
  loop
    begin
      v_product_id := (v_input ->> 'productId')::uuid;
      v_quantity := (v_input ->> 'quantity')::numeric;
    exception when others then
      raise exception using errcode = '22023', message = 'Invalid order item';
    end;

    if v_quantity <= 0 or v_quantity > 30 or trunc(v_quantity) <> v_quantity then
      raise exception using errcode = '22023', message = 'Invalid item quantity';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id
      and tenant_id = p_tenant_id
      and store_id = p_store_id
      and is_visible
      and is_available
      and (unavailable_until is null or unavailable_until <= now())
      and deleted_at is null
    for share;

    if not found then
      raise exception using errcode = 'P0001', message = 'A product is unavailable';
    end if;

    v_selections := coalesce(v_input -> 'selections', '{}'::jsonb);
    if jsonb_typeof(v_selections) <> 'object' then
      raise exception using errcode = '22023', message = 'Invalid product selections';
    end if;

    for v_unknown_group_key in
      select key from jsonb_object_keys(v_selections) as selection(key)
    loop
      if not exists (
        select 1
        from public.product_modifier_groups pmg
        join public.modifier_groups mg
          on mg.id = pmg.modifier_group_id
         and mg.tenant_id = pmg.tenant_id
         and mg.store_id = pmg.store_id
        where pmg.tenant_id = p_tenant_id
          and pmg.store_id = p_store_id
          and pmg.product_id = v_product.id
          and pmg.modifier_group_id = v_unknown_group_key::uuid
          and pmg.is_visible
          and mg.is_active
          and mg.deleted_at is null
      ) then
        raise exception using errcode = '22023', message = 'A selected modifier is not available for this product';
      end if;
    end loop;

    v_modifier_total := 0;
    for v_group in
      select
        mg.id,
        mg.name,
        coalesce(pmg.min_selections_override, mg.min_selections) as min_selections,
        coalesce(pmg.max_selections_override, mg.max_selections) as max_selections,
        mg.allow_repeated_options
      from public.product_modifier_groups pmg
      join public.modifier_groups mg
        on mg.id = pmg.modifier_group_id
       and mg.tenant_id = pmg.tenant_id
       and mg.store_id = pmg.store_id
      where pmg.tenant_id = p_tenant_id
        and pmg.store_id = p_store_id
        and pmg.product_id = v_product.id
        and pmg.condition_variant_id is null
        and pmg.is_visible
        and mg.is_active
        and mg.deleted_at is null
      order by pmg.display_order, mg.name
    loop
      v_selected_options := coalesce(v_selections -> v_group.id::text, '[]'::jsonb);
      if jsonb_typeof(v_selected_options) <> 'array' then
        raise exception using errcode = '22023', message = 'Invalid modifier selection';
      end if;

      v_selected_count := jsonb_array_length(v_selected_options);
      if v_selected_count < v_group.min_selections
         or (v_group.max_selections is not null and v_selected_count > v_group.max_selections) then
        raise exception using errcode = '22023', message = 'Modifier selection limit was not met';
      end if;

      select count(*) <> count(distinct selected.option_id)
      into v_has_duplicate_options
      from jsonb_array_elements_text(v_selected_options) as selected(option_id);

      if v_has_duplicate_options and not v_group.allow_repeated_options then
        raise exception using errcode = '22023', message = 'Duplicate modifier selection is not allowed';
      end if;

      select count(*) into v_valid_selected_count
      from jsonb_array_elements_text(v_selected_options) as selected(option_id)
      join public.modifier_options mo
        on mo.id = selected.option_id::uuid
       and mo.tenant_id = p_tenant_id
       and mo.store_id = p_store_id
       and mo.modifier_group_id = v_group.id
       and mo.is_active
       and mo.deleted_at is null;

      if v_valid_selected_count <> v_selected_count then
        raise exception using errcode = '22023', message = 'A selected modifier option is unavailable';
      end if;

      select coalesce(round(sum(mo.price_delta * selected.quantity), 2), 0)
      into v_group_total
      from (
        select option_id::uuid as option_id, count(*)::numeric as quantity
        from jsonb_array_elements_text(v_selected_options) as selected(option_id)
        group by option_id
      ) selected
      join public.modifier_options mo
        on mo.id = selected.option_id
       and mo.tenant_id = p_tenant_id
       and mo.store_id = p_store_id
       and mo.modifier_group_id = v_group.id
       and mo.is_active
       and mo.deleted_at is null;

      v_modifier_total := round(v_modifier_total + v_group_total, 2);
    end loop;

    v_base_unit_price := coalesce(v_product.sale_price, v_product.base_price);
    v_unit_total := round(v_base_unit_price + v_modifier_total, 2);
    v_line_total := round(v_unit_total * v_quantity, 2);
    v_subtotal := round(v_subtotal + v_line_total, 2);

    v_canonical_items := v_canonical_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'product_sku', v_product.sku,
        'product_kind', v_product.kind,
        'category_id', v_product.category_id,
        'quantity', v_quantity,
        'base_unit_price', v_base_unit_price,
        'modifier_total', v_modifier_total,
        'unit_total', v_unit_total,
        'line_total', v_line_total,
        'selections', v_selections,
        'note', nullif(btrim(coalesce(v_input ->> 'note', '')), '')
      )
    );
  end loop;

  if v_subtotal < v_store.min_order_amount then
    raise exception using errcode = 'P0001', message = 'Minimum order amount was not reached';
  end if;

  if p_fulfillment_type = 'delivery'::public.fulfillment_type then
    select dz.id, dz.name, dz.delivery_fee, dz.minimum_order_amount, dz.free_delivery_above
    into v_delivery_zone_id, v_delivery_zone_name, v_delivery_fee, v_zone_minimum_order, v_free_delivery_above
    from public.delivery_zones dz
    where dz.tenant_id = p_tenant_id
      and dz.store_id = p_store_id
      and dz.is_active
      and dz.deleted_at is null
      and dz.zone_type = 'neighborhood'::public.delivery_zone_type
      and exists (
        select 1
        from unnest(dz.neighborhood_names) as neighborhood(name)
        where lower(v_customer_address) like '%' || lower(neighborhood.name) || '%'
      )
    order by dz.priority desc, dz.created_at
    limit 1;

    if v_delivery_zone_id is null then
      raise exception using errcode = 'P0001', message = 'Address is outside the delivery area';
    end if;

    if v_subtotal < v_zone_minimum_order then
      raise exception using errcode = 'P0001', message = 'Delivery zone minimum order amount was not reached';
    end if;

    if v_free_delivery_above is not null and v_subtotal >= v_free_delivery_above then
      v_delivery_fee := 0;
    end if;
  end if;

  v_total := round(v_subtotal + v_delivery_fee, 2);
  if v_payment_method = 'cash'::public.payment_method
     and v_change_for is not null
     and v_change_for < v_total then
    raise exception using errcode = '22023', message = 'Change amount must cover the order total';
  end if;

  insert into public.customers (tenant_id, full_name, phone_e164)
  values (p_tenant_id, v_customer_name, v_customer_phone)
  on conflict (tenant_id, phone_e164) where deleted_at is null
  do update set full_name = excluded.full_name, updated_at = now()
  returning id into v_customer_id;

  insert into public.orders (
    tenant_id,
    store_id,
    customer_id,
    delivery_zone_id,
    channel,
    fulfillment_type,
    status,
    payment_status,
    customer_name,
    customer_phone_e164,
    delivery_address_snapshot,
    subtotal_amount,
    delivery_fee_amount,
    total_amount,
    checkout_idempotency_key,
    estimated_ready_at
  ) values (
    p_tenant_id,
    p_store_id,
    v_customer_id,
    v_delivery_zone_id,
    'storefront'::public.order_channel,
    p_fulfillment_type,
    'new'::public.order_status,
    'pending'::public.payment_status,
    v_customer_name,
    v_customer_phone,
    case when p_fulfillment_type = 'delivery'::public.fulfillment_type then
      jsonb_build_object(
        'formatted_address', v_customer_address,
        'reference', v_customer_reference,
        'zone_name', v_delivery_zone_name
      )
    else null end,
    v_subtotal,
    coalesce(v_delivery_fee, 0),
    v_total,
    p_idempotency_key,
    now() + make_interval(mins => v_store.default_prep_minutes)
  ) returning * into v_order;

  for v_canonical_item in select value from jsonb_array_elements(v_canonical_items) as item(value)
  loop
    insert into public.order_items (
      tenant_id,
      store_id,
      order_id,
      product_id,
      product_name,
      product_sku,
      product_kind,
      quantity,
      base_unit_price_amount,
      modifier_unit_total_amount,
      unit_total_amount,
      line_total_amount,
      notes,
      item_snapshot
    ) values (
      p_tenant_id,
      p_store_id,
      v_order.id,
      (v_canonical_item ->> 'product_id')::uuid,
      v_canonical_item ->> 'product_name',
      nullif(v_canonical_item ->> 'product_sku', ''),
      (v_canonical_item ->> 'product_kind')::public.product_kind,
      (v_canonical_item ->> 'quantity')::numeric,
      (v_canonical_item ->> 'base_unit_price')::numeric,
      (v_canonical_item ->> 'modifier_total')::numeric,
      (v_canonical_item ->> 'unit_total')::numeric,
      (v_canonical_item ->> 'line_total')::numeric,
      nullif(v_canonical_item ->> 'note', ''),
      jsonb_build_object('selections', coalesce(v_canonical_item -> 'selections', '{}'::jsonb))
    ) returning id into v_item_id;

    for v_group in
      select mg.id, mg.name
      from public.product_modifier_groups pmg
      join public.modifier_groups mg
        on mg.id = pmg.modifier_group_id
       and mg.tenant_id = pmg.tenant_id
       and mg.store_id = pmg.store_id
      where pmg.tenant_id = p_tenant_id
        and pmg.store_id = p_store_id
        and pmg.product_id = (v_canonical_item ->> 'product_id')::uuid
        and pmg.condition_variant_id is null
        and pmg.is_visible
        and mg.is_active
        and mg.deleted_at is null
    loop
      v_selected_options := coalesce(
        v_canonical_item -> 'selections' -> v_group.id::text,
        '[]'::jsonb
      );

      for v_option in
        select
          mo.id,
          mo.name,
          mo.price_delta,
          count(*)::numeric as quantity
        from jsonb_array_elements_text(v_selected_options) as selected(option_id)
        join public.modifier_options mo
          on mo.id = selected.option_id::uuid
         and mo.tenant_id = p_tenant_id
         and mo.store_id = p_store_id
         and mo.modifier_group_id = v_group.id
        group by mo.id, mo.name, mo.price_delta
      loop
        insert into public.order_item_modifiers (
          tenant_id,
          store_id,
          order_id,
          order_item_id,
          modifier_group_id,
          modifier_option_id,
          group_name,
          option_name,
          quantity,
          unit_price_delta_amount,
          line_total_amount
        ) values (
          p_tenant_id,
          p_store_id,
          v_order.id,
          v_item_id,
          v_group.id,
          v_option.id,
          v_group.name,
          v_option.name,
          v_option.quantity,
          v_option.price_delta,
          round(v_option.quantity * v_option.price_delta, 2)
        );
      end loop;
    end loop;

    v_station_id := null;
    select route.station_id into v_station_id
    from public.kds_station_routes route
    join public.kds_stations station
      on station.id = route.station_id
     and station.tenant_id = route.tenant_id
     and station.store_id = route.store_id
     and station.is_active
    where route.tenant_id = p_tenant_id
      and route.store_id = p_store_id
      and (
        route.product_id = (v_canonical_item ->> 'product_id')::uuid
        or route.category_id = (v_canonical_item ->> 'category_id')::uuid
      )
    order by (route.product_id is not null) desc, route.created_at
    limit 1;

    if v_station_id is null then
      select station.id into v_station_id
      from public.kds_stations station
      where station.tenant_id = p_tenant_id
        and station.store_id = p_store_id
        and station.is_active
      order by station.display_order, station.created_at
      limit 1;
    end if;

    if v_station_id is not null then
      insert into public.kds_tasks (
        tenant_id,
        store_id,
        station_id,
        order_id,
        order_item_id,
        item_snapshot
      ) values (
        p_tenant_id,
        p_store_id,
        v_station_id,
        v_order.id,
        v_item_id,
        jsonb_build_object(
          'product_name', v_canonical_item ->> 'product_name',
          'quantity', (v_canonical_item ->> 'quantity')::numeric,
          'notes', nullif(v_canonical_item ->> 'note', ''),
          'selections', coalesce(v_canonical_item -> 'selections', '{}'::jsonb)
        )
      ) on conflict do nothing;
    end if;
  end loop;

  insert into public.payments (
    tenant_id,
    store_id,
    order_id,
    provider,
    method,
    status,
    amount,
    idempotency_key,
    provider_metadata
  ) values (
    p_tenant_id,
    p_store_id,
    v_order.id,
    case when v_payment_method = 'cash'::public.payment_method then 'manual' else 'pending_provider' end,
    v_payment_method,
    'pending'::public.payment_status,
    v_total,
    p_idempotency_key,
    jsonb_build_object('change_for', v_change_for)
  );

  return query
  select
    v_order.id,
    v_order.display_number,
    v_order.status,
    v_order.total_amount,
    v_order.public_tracking_token;
end;
$$;

revoke all on function public.create_checkout_order(
  uuid,
  uuid,
  uuid,
  public.fulfillment_type,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_checkout_order(
  uuid,
  uuid,
  uuid,
  public.fulfillment_type,
  jsonb,
  jsonb,
  jsonb
) to service_role;

-- Operations screens subscribe only to order changes; they re-read the scoped
-- order graph through RLS after each event so item/payment details are never
-- broadcast to an unauthorized client.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
