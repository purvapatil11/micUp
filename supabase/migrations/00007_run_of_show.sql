-- ============================================================
-- MicUp 00007 — run of show (event sequence + stage cues)
-- ============================================================

create table public.run_of_show_items (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  sequence      integer not null check (sequence > 0),
  start_time    time,
  segment_title text not null check (char_length(trim(segment_title)) between 1 and 160),
  description   text check (char_length(description) <= 4000),
  assigned_to   uuid references public.profiles (id) on delete set null,
  script_id     uuid references public.scripts (id) on delete set null,
  stage_cue     text check (char_length(stage_cue) <= 2000),
  notes         text check (char_length(notes) <= 4000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index run_of_show_event_idx on public.run_of_show_items (event_id, sequence);

create trigger run_of_show_set_updated_at
  before update on public.run_of_show_items
  for each row execute function public.fn_set_updated_at();

alter table public.run_of_show_items enable row level security;

create policy "run_of_show_select_active"
  on public.run_of_show_items for select
  to authenticated
  using (public.fn_has_active_profile());

create policy "run_of_show_insert_officer"
  on public.run_of_show_items for insert
  to authenticated
  with check (public.fn_is_officer_uid(auth.uid()));

create policy "run_of_show_update_officer"
  on public.run_of_show_items for update
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()))
  with check (public.fn_is_officer_uid(auth.uid()));

create policy "run_of_show_delete_officer"
  on public.run_of_show_items for delete
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));
