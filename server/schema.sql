-- Local-only staging schema. Hosted auth integration is intentionally deferred.
create schema if not exists modisto_private;
create schema if not exists modisto;
do $$ begin create role modisto_staff nologin; exception when duplicate_object then null; end $$;
create table if not exists modisto_private.users (
  id uuid primary key, email text not null unique check(email=lower(email)),
  name text not null, salt text not null, password_hash text not null,
  role text not null check(role in ('owner','office','workshop')),
  employee_id text, enabled boolean not null default true
);
create table if not exists modisto_private.sessions (
  token_hash text primary key, user_id uuid not null references modisto_private.users(id),
  csrf text not null, expires_at timestamptz not null
);
create sequence if not exists modisto.revisions;
create table if not exists modisto.records (
  collection text not null check(collection in ('clients','measurements','measurementVersions','orders','swatches','employees','settings','metadata')),
  id text not null, payload jsonb, deleted boolean not null default false,
  version bigint not null default nextval('modisto.revisions'), primary key(collection,id)
);
create table if not exists modisto.audit (
  id bigint generated always as identity primary key,
  actor uuid not null, at timestamptz not null default now(), action text not null,
  collection text, record_id text, before_value jsonb, after_value jsonb
);
create table if not exists modisto.workshop_jobs (
  id text primary key, employee_id text not null, order_id text not null,
  order_version bigint not null, payload jsonb not null
);
create or replace function modisto_private.actor_id() returns uuid language sql stable
set search_path='' as $$ select nullif(current_setting('modisto.actor_id',true),'')::uuid $$;
-- Narrow, non-exposed lookup: callers cannot read user/password rows directly.
create or replace function modisto_private.staff_role() returns text language sql stable security definer
set search_path='' as $$ select role from modisto_private.users where id=modisto_private.actor_id() and enabled $$;
create or replace function modisto_private.employee_id() returns text language sql stable security definer
set search_path='' as $$ select employee_id from modisto_private.users where id=modisto_private.actor_id() and enabled $$;
revoke all on schema modisto_private from public;
revoke all on all tables in schema modisto_private from public,modisto_staff;
revoke all on all functions in schema modisto_private from public;
grant usage on schema modisto,modisto_private to modisto_staff;
grant execute on all functions in schema modisto_private to modisto_staff;
alter table modisto.records enable row level security;
alter table modisto.audit enable row level security;
alter table modisto.workshop_jobs enable row level security;
create policy records_read on modisto.records for select to modisto_staff
using ((select modisto_private.staff_role()) in ('owner','office'));
create policy records_insert on modisto.records for insert to modisto_staff
with check ((select modisto_private.staff_role())='owner' or ((select modisto_private.staff_role())='office' and collection not in ('settings','metadata')));
create policy records_update on modisto.records for update to modisto_staff
using ((select modisto_private.staff_role())='owner' or ((select modisto_private.staff_role())='office' and collection not in ('settings','metadata')))
with check ((select modisto_private.staff_role())='owner' or ((select modisto_private.staff_role())='office' and collection not in ('settings','metadata')));
create policy audit_read on modisto.audit for select to modisto_staff using ((select modisto_private.staff_role())='owner');
create policy workshop_read on modisto.workshop_jobs for select to modisto_staff
using ((select modisto_private.staff_role()) in ('owner','office') or ((select modisto_private.staff_role())='workshop' and employee_id=(select modisto_private.employee_id())));
grant select,insert,update on modisto.records to modisto_staff;
grant usage on sequence modisto.revisions to modisto_staff;
grant select on modisto.audit,modisto.workshop_jobs to modisto_staff;
create index workshop_assignment_idx on modisto.workshop_jobs(employee_id);
