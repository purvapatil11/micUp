-- ============================================================
-- MicUp 00004 — events and event assignments
-- ============================================================

create table public.events (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (char_length(trim(name)) between 2 and 160),
  description         text check (char_length(description) <= 4000),
  event_date          date not null,
  start_time          time,
  end_time            time,
  venue               text check (char_length(venue) <= 200),
  status              text not null default 'upcoming'
                      check (status in ('upcoming', 'in_progress', 'completed', 'cancelled')),
  notes               text check (char_length(notes) <= 8000),
  -- Attendance / geofence configuration
  attendance_enabled  boolean not null default false,
  latitude            double precision check (latitude between -90 and 90),
  longitude           double precision check (longitude between -180 and 180),
  geofence_radius_m   integer check (geofence_radius_m > 0 and geofence_radius_m <= 10000),
  check_in_opens_at   timestamptz,
  check_in_closes_at  timestamptz,
  created_by          uuid not null references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- Geofence must be fully configured when attendance is enabled.
  constraint events_geofence_complete check (
    attendance_enabled = false
    or (latitude is not null and longitude is not null and geofence_radius_m is not null)
  ),
  constraint events_checkin_window_order check (
    check_in_opens_at is null
    or check_in_closes_at is null
    or check_in_opens_at < check_in_closes_at
  ),
  constraint events_time_order check (
    start_time is null or end_time is null or start_time < end_time
  )
);

create index events_event_date_idx on public.events (event_date);
create index events_status_idx on public.events (status);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.fn_set_updated_at();

alter table public.events enable row level security;

create policy "events_select_active"
  on public.events for select
  to authenticated
  using (public.fn_has_active_profile());

create policy "events_insert_officer"
  on public.events for insert
  to authenticated
  with check (public.fn_is_officer_uid(auth.uid()) and created_by = auth.uid());

create policy "events_update_officer"
  on public.events for update
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()))
  with check (public.fn_is_officer_uid(auth.uid()));

create policy "events_delete_officer"
  on public.events for delete
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));

-- ------------------------------------------------------------
-- Event assignments
-- ------------------------------------------------------------
create table public.event_assignments (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  responsibility text check (char_length(responsibility) <= 160),
  created_at    timestamptz not null default now(),
  unique (event_id, profile_id)
);

create index event_assignments_profile_idx on public.event_assignments (profile_id);

alter table public.event_assignments enable row level security;

create policy "event_assignments_select_active"
  on public.event_assignments for select
  to authenticated
  using (public.fn_has_active_profile());

create policy "event_assignments_officer_write"
  on public.event_assignments for insert
  to authenticated
  with check (public.fn_is_officer_uid(auth.uid()));

create policy "event_assignments_officer_update"
  on public.event_assignments for update
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()))
  with check (public.fn_is_officer_uid(auth.uid()));

create policy "event_assignments_officer_delete"
  on public.event_assignments for delete
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));
