-- Disposable fixtures: all writes are rolled back, including auth users.
begin;
create temporary table portal_fixture (owner_id uuid, tenant_id uuid, store_id uuid);
grant select, insert on portal_fixture to authenticated;
insert into auth.users (id,email) values
 ('10000000-0000-4000-8000-000000000001','owner-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','owner-b@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','consumer@example.invalid');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into portal_fixture select auth.uid(), created_tenant_id, created_store_id
from public.bootstrap_tenant('Tenant A','test-portal-a','Store A','test-store-a');
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into portal_fixture select auth.uid(), created_tenant_id, created_store_id
from public.bootstrap_tenant('Tenant B','test-portal-b','Store B','test-store-b');
do $$ declare changed integer; begin
 if (select count(*) from public.stores) <> 1 then raise exception 'Cross-tenant store read'; end if;
 if (select count(*) from public.platform_admins) <> 0 then raise exception 'Seller can read admin'; end if;
 update public.stores set name='Forbidden' where id=(select store_id from portal_fixture where owner_id='10000000-0000-4000-8000-000000000001');
 get diagnostics changed=row_count;
 if changed <> 0 then raise exception 'Cross-tenant store write'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.stores) then raise exception 'Consumer can read stores'; end if;
 if exists(select 1 from public.tenant_memberships) then raise exception 'Consumer can read staff'; end if;
 if exists(select 1 from public.platform_admins) then raise exception 'Consumer can read admin'; end if;
 begin
  insert into public.platform_admins(user_id) values(auth.uid());
  raise exception 'Consumer promoted self';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
insert into public.platform_admins(user_id) values('10000000-0000-4000-8000-000000000003');
set local role authenticated;
do $$ begin
 if (select count(*) from public.platform_admins) <> 1 then raise exception 'Admin identity unavailable'; end if;
 if (select count(*) from public.tenants) <> 2 then raise exception 'Admin cannot list tenants'; end if;
end $$;
reset role;
select 'PASS: two tenants, consumer isolation, admin access and privilege escalation rejection' as result;
rollback;
