-- Narrow, validated commands for the live storefront and seller operation.
create table public.order_accounts (
 tenant_id uuid not null,
 store_id uuid not null,
 order_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 primary key(order_id,user_id),
 foreign key(tenant_id,store_id,order_id) references public.orders(tenant_id,store_id,id) on delete cascade
);
alter table public.order_accounts enable row level security;
revoke all on public.order_accounts from anon, authenticated;
grant select on public.order_accounts to authenticated;
create policy order_accounts_self on public.order_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy orders_account_owner on public.orders for select to authenticated using (
 exists(select 1 from public.order_accounts a where a.order_id=orders.id and a.user_id=(select auth.uid()))
);

create function public.storefront_checkout(p_slug text, p_key uuid, p_mode public.fulfillment_type, p_customer jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.stores%rowtype; result record; old_order public.orders%rowtype; phone text; begin
 if p_key is null or p_mode is null or p_mode not in ('delivery','pickup','dine_in')
  or p_customer is null or jsonb_typeof(p_customer)<>'object'
  or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50
  or octet_length(p_customer::text)>8000 or octet_length(p_items::text)>40000 then
  raise exception 'Pedido inválido';
 end if;
 select st.* into s from public.stores st join public.tenants t on t.id=st.tenant_id
 where st.public_slug::text=lower(btrim(p_slug)) and st.deleted_at is null and t.deleted_at is null
 and t.status in ('active','onboarding') and st.is_storefront_published;
 if not found then raise exception 'Loja indisponível'; end if;
 -- Serialize both rate checks and checkout retries for this store.
 perform pg_advisory_xact_lock(hashtextextended(s.id::text,0));
 select * into old_order from public.orders where store_id=s.id and checkout_idempotency_key=p_key;
 if found then
  return jsonb_build_object('id',old_order.id,'number',old_order.display_number,'status',old_order.status,'total',old_order.total_amount,'trackingToken',old_order.public_tracking_token);
 end if;
 if not s.accepting_orders then raise exception 'Loja fechada'; end if;
 phone := regexp_replace(coalesce(p_customer->>'phone',''),'\D','','g');
 if length(phone) in (10,11) then phone:='55'||phone; end if;
 if (select count(*) from public.orders where store_id=s.id and created_at>now()-interval '1 minute')>=60
 or (select count(*) from public.orders where store_id=s.id and customer_phone_e164='+'||phone and created_at>now()-interval '15 minutes')>=5 then
  raise exception 'Limite de pedidos atingido. Aguarde alguns minutos.';
 end if;
 -- Online payment is unavailable until a verified gateway is configured.
 select * into result from public.create_checkout_order(s.tenant_id,s.id,p_key,p_mode,p_customer,'{"method":"cash"}'::jsonb,p_items);
 if auth.uid() is not null then
  insert into public.order_accounts values(s.tenant_id,s.id,result.order_id,auth.uid());
 end if;
 return jsonb_build_object('id',result.order_id,'number',result.display_number,'status',result.order_status,'total',result.total_amount,'trackingToken',result.tracking_token);
end $$;
revoke all on function public.storefront_checkout(text,uuid,public.fulfillment_type,jsonb,jsonb) from public;
grant execute on function public.storefront_checkout(text,uuid,public.fulfillment_type,jsonb,jsonb) to anon,authenticated;

create function public.change_order_status(p_order uuid,p_status public.order_status)
returns void language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype; permitted boolean; begin
 if auth.uid() is null then raise exception 'Faça login'; end if;
 select * into o from public.orders where id=p_order for update;
 if not found then raise exception 'Pedido indisponível'; end if;
 permitted:=private.has_permission(o.tenant_id,'orders.manage')
  or (p_status in ('preparing','ready') and private.has_permission(o.tenant_id,'kds.manage'));
 if not permitted then raise exception 'Sem permissão'; end if;
 if not exists(select 1 from public.tenants where id=o.tenant_id and status in ('active','onboarding') and deleted_at is null) then raise exception 'Estabelecimento suspenso'; end if;
 if p_status is null or not (case o.status
  when 'new' then p_status in ('confirmed','canceled')
  when 'confirmed' then p_status in ('preparing','canceled')
  when 'preparing' then p_status in ('ready','canceled')
  when 'ready' then p_status in ('awaiting_driver','out_for_delivery','delivered','canceled')
  when 'awaiting_driver' then p_status in ('out_for_delivery','canceled')
  when 'out_for_delivery' then p_status in ('delivered','canceled')
  else false end) then raise exception 'Transição inválida'; end if;
 update public.orders set status=p_status,
  accepted_at=case when p_status='confirmed' then now() else accepted_at end,
  completed_at=case when p_status='delivered' then now() else completed_at end,
  canceled_at=case when p_status='canceled' then now() else canceled_at end where id=o.id;
 insert into public.audit_logs(tenant_id,store_id,actor_user_id,action,entity_type,entity_id,before_data,after_data)
 values(o.tenant_id,o.store_id,auth.uid(),'order.status_changed','order',o.id,jsonb_build_object('status',o.status),jsonb_build_object('status',p_status));
end $$;
revoke all on function public.change_order_status(uuid,public.order_status) from public,anon;
grant execute on function public.change_order_status(uuid,public.order_status) to authenticated;

create function public.list_public_stores() returns table(name text,slug text)
language sql stable security definer set search_path='' as $$
 select s.name,s.public_slug::text from public.stores s join public.tenants t on t.id=s.tenant_id
 where s.is_storefront_published and s.deleted_at is null and t.deleted_at is null and t.status in ('active','onboarding') order by s.name limit 100;
$$;
revoke all on function public.list_public_stores() from public;
grant execute on function public.list_public_stores() to anon,authenticated;

create function public.public_delivery_zones(p_slug text) returns table(name text,fee numeric,minimum numeric)
language sql stable security definer set search_path='' as $$
 select z.name,z.delivery_fee,z.minimum_order_amount from public.delivery_zones z
 join public.stores s on s.id=z.store_id join public.tenants t on t.id=s.tenant_id
 where s.public_slug::text=p_slug and s.is_storefront_published and s.deleted_at is null
 and t.status in ('active','onboarding') and z.is_active and z.deleted_at is null and z.zone_type='neighborhood';
$$;
revoke all on function public.public_delivery_zones(text) from public;
grant execute on function public.public_delivery_zones(text) to anon,authenticated;

create function public.platform_tenant_status(p_tenant uuid,p_status public.tenant_status)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_platform_admin() then raise exception 'Sem permissão'; end if;
 if p_status is null or p_status not in ('active','suspended') then raise exception 'Status inválido'; end if;
 update public.tenants set status=p_status where id=p_tenant and deleted_at is null;
 insert into public.audit_logs(tenant_id,actor_user_id,action,entity_type,entity_id,after_data)
 values(p_tenant,auth.uid(),'tenant.status_changed','tenant',p_tenant,jsonb_build_object('status',p_status));
end $$;
revoke all on function public.platform_tenant_status(uuid,public.tenant_status) from public,anon;
grant execute on function public.platform_tenant_status(uuid,public.tenant_status) to authenticated;
