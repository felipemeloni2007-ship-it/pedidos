-- Portal reads use the signed-in client and RLS; no service key is required.
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
drop policy if exists platform_admins_read_self on public.platform_admins;
create policy platform_admins_read_self on public.platform_admins
for select to authenticated using (user_id = (select auth.uid()));

create policy orders_read_verified_customer on public.orders
for select to authenticated using (
  customer_id is not null and private.is_customer_identity(tenant_id, customer_id)
);

-- The operational portal must not grant a consumer the rest of a store's data.
-- Identity creation remains server-only and is never inferred from submitted phones.
revoke insert, update, delete on public.customer_auth_identities from anon, authenticated;
