-- Store owners may edit their business profile, but only the platform command
-- may change subscription/suspension status. A table-wide UPDATE grant would
-- let a suspended owner activate their own tenant through the REST API.
revoke update on public.tenants from authenticated;
grant update(name,legal_name,tax_identifier,timezone,settings) on public.tenants to authenticated;
create index order_accounts_user_idx on public.order_accounts(user_id,order_id);
