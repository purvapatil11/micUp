-- ============================================================
-- MicUp 00002 — profiles (identity, roles, approval status)
-- ============================================================

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(trim(full_name)) between 2 and 120),
  email       text not null unique check (position('@' in email) > 1),
  avatar_url  text,
  role        text not null default 'team_member'
              check (role in ('anchoring_officer', 'deputy_anchoring_officer', 'team_member')),
  status      text not null default 'pending'
              check (status in ('active', 'pending', 'suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_status_idx on public.profiles (status);

-- ------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so policies never recurse into
-- the profiles table under its own RLS).
-- ------------------------------------------------------------
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
revoke all on function public.fn_is_officer_uid(uuid) from public, anon;
revoke all on function public.fn_is_officer() from public, anon;
revoke all on function public.fn_has_active_profile() from public, anon;
grant execute on function public.fn_is_officer_uid(uuid) to authenticated;
grant execute on function public.fn_is_officer() to authenticated;
grant execute on function public.fn_has_active_profile() to authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.fn_set_updated_at();

-- ------------------------------------------------------------
-- Prevent privilege escalation / mass assignment on profiles.
--  * Non-officers may only change their own display fields.
--  * Officers may change another member's role or status.
--  * Nobody may change their own role or status (no self-promotion).
--  * auth.uid() IS NULL means the trusted server (service role) is acting.
-- ------------------------------------------------------------
create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Trusted server-side path (service role) — allow.
  if v_uid is null then
    return new;
  end if;

  if not public.fn_has_active_profile() then
    raise exception 'Your account is not approved yet.';
  end if;

  if tg_op = 'INSERT' then
    -- Profiles are created by the server/invite flow, never by clients.
    raise exception 'Profiles cannot be created directly.';
  end if;

  -- No one can change their own role or status.
  if new.id = v_uid and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'You cannot change your own role or approval status.';
  end if;

  -- Non-officers cannot change anyone's role or status.
  if not public.fn_is_officer_uid(v_uid) and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'Only officers can change roles or approval status.';
  end if;

  -- Immutable identity fields.
  new.id := old.id;
  new.email := old.email;
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger profiles_guard
  before insert or update on public.profiles
  for each row execute function public.fn_profiles_guard();

alter table public.profiles enable row level security;

-- Read: active members can see each other (team directory), everyone sees
-- their own row, officers see everyone.
create policy "profiles_select_visible"
  on public.profiles for select
  to authenticated
  using (
    status = 'active'
    or id = auth.uid()
    or public.fn_is_officer_uid(auth.uid())
  );

-- Writes are additionally gated by the profiles_guard trigger.
create policy "profiles_update_own_or_officer"
  on public.profiles for update
  to authenticated
  using (
    id = auth.uid() or public.fn_is_officer_uid(auth.uid())
  )
  with check (
    id = auth.uid() or public.fn_is_officer_uid(auth.uid())
  );

-- No client INSERT/DELETE policies: profiles are managed by the server.
