-- ============================================================
-- MicUp 00001 — extensions, helper functions, updated_at trigger
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- gen_random_uuid() is provided by PostgreSQL core (13+) / pgcrypto.

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies never recurse into
-- the profiles table under its own RLS).
-- ------------------------------------------------------------
create or replace function public.fn_role_of(p_user_id uuid)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select role from public.profiles where id = p_user_id;
$$;

create or replace function public.fn_is_officer_uid(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and status = 'active'
      and role in ('anchoring_officer', 'deputy_anchoring_officer')
  );
$$;

create or replace function public.fn_is_officer()
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select public.fn_is_officer_uid(auth.uid());
$$;

create or replace function public.fn_has_active_profile()
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and status = 'active'
  );
$$;

-- Only the authenticated role may invoke these helpers.
revoke all on function public.fn_role_of(uuid) from public, anon;
revoke all on function public.fn_is_officer_uid(uuid) from public, anon;
revoke all on function public.fn_is_officer() from public, anon;
revoke all on function public.fn_has_active_profile() from public, anon;
grant execute on function public.fn_role_of(uuid) to authenticated;
grant execute on function public.fn_is_officer_uid(uuid) to authenticated;
grant execute on function public.fn_is_officer() to authenticated;
grant execute on function public.fn_has_active_profile() to authenticated;
