-- ============================================================
-- MicUp 00008 — announcements + acknowledgements
-- ============================================================

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(trim(title)) between 2 and 160),
  message     text not null check (char_length(trim(message)) between 1 and 8000),
  priority    text not null default 'normal'
              check (priority in ('normal', 'important', 'urgent')),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index announcements_created_at_idx on public.announcements (created_at desc);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.fn_set_updated_at();

create or replace function public.fn_announcements_guard()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.fn_has_active_profile() then
    raise exception 'Your account is not approved yet.';
  end if;
  if tg_op = 'INSERT' then
    if not public.fn_is_officer_uid(v_uid) then
      raise exception 'Only officers can publish announcements.';
    end if;
    new.author_id := v_uid;
  end if;
  return new;
end;
$$;

create trigger announcements_guard
  before insert or update on public.announcements
  for each row execute function public.fn_announcements_guard();

alter table public.announcements enable row level security;

create policy "announcements_select_active"
  on public.announcements for select
  to authenticated
  using (public.fn_has_active_profile());

create policy "announcements_insert_officer"
  on public.announcements for insert
  to authenticated
  with check (public.fn_is_officer_uid(auth.uid()) and author_id = auth.uid());

create policy "announcements_update_officer"
  on public.announcements for update
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()))
  with check (public.fn_is_officer_uid(auth.uid()));

create policy "announcements_delete_officer"
  on public.announcements for delete
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));

-- ------------------------------------------------------------
-- Acknowledgements
-- ------------------------------------------------------------
create table public.announcement_acknowledgements (
  id               uuid primary key default gen_random_uuid(),
  announcement_id  uuid not null references public.announcements (id) on delete cascade,
  profile_id       uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (announcement_id, profile_id)
);

alter table public.announcement_acknowledgements enable row level security;

create policy "ack_select_active"
  on public.announcement_acknowledgements for select
  to authenticated
  using (public.fn_has_active_profile());

create policy "ack_insert_own"
  on public.announcement_acknowledgements for insert
  to authenticated
  with check (public.fn_has_active_profile() and profile_id = auth.uid());

create policy "ack_delete_own"
  on public.announcement_acknowledgements for delete
  to authenticated
  using (profile_id = auth.uid());

-- ------------------------------------------------------------
-- Realtime for announcements feed
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.announcements;
  end if;
exception
  when duplicate_object then null;
end $$;
