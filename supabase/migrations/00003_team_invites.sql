-- ============================================================
-- MicUp 00003 — team invites (invite-only access)
-- Public self-registration is disabled in Supabase Auth settings.
-- Invited accounts are created server-side with the service role.
-- ============================================================

create table public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (position('@' in email) > 1),
  full_name   text not null check (char_length(trim(full_name)) between 2 and 120),
  role        text not null default 'team_member'
              check (role in ('anchoring_officer', 'deputy_anchoring_officer', 'team_member')),
  token_hash  text not null unique,
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at  timestamptz not null,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- At most one live invite per email address.
create unique index team_invites_pending_email_uidx
  on public.team_invites (lower(email))
  where status = 'pending';

create index team_invites_status_idx on public.team_invites (status);

create trigger team_invites_set_updated_at
  before update on public.team_invites
  for each row execute function public.fn_set_updated_at();

alter table public.team_invites enable row level security;

create policy "team_invites_officer_read"
  on public.team_invites for select
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));

create policy "team_invites_officer_insert"
  on public.team_invites for insert
  to authenticated
  with check (public.fn_is_officer_uid(auth.uid()) and created_by = auth.uid());

create policy "team_invites_officer_update"
  on public.team_invites for update
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()))
  with check (public.fn_is_officer_uid(auth.uid()));

-- Officers may revoke (delete) pending invites; acceptance is server-side.
create policy "team_invites_officer_delete"
  on public.team_invites for delete
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));
