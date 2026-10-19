-- Minimal Supabase environment stubs so migrations run on vanilla PostgreSQL.
-- On a real Supabase project these objects already exist.
create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end $$;

grant usage on schema public to authenticated, anon, service_role;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- Same semantics as Supabase: uid comes from the request JWT claim.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to public;

-- Supabase grants table access broadly and relies on RLS.
alter default privileges in schema public grant all on tables to authenticated, anon, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, anon, service_role;
