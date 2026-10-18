-- ============================================================
-- MicUp 00009 — event-day GPS attendance + audit log
--
-- Security model:
--   * Clients can never INSERT attendance rows directly (no RLS insert
--     policy) — check-ins go through fn_check_in (SECURITY DEFINER),
--     which validates geofence, time window and duplicates server-side.
--   * Direct UPDATE is officer-only for manual corrections; the
--     correction path is also exposed as fn_correct_attendance so every
--     change lands in the audit log with actor + reason.
--   * GPS alone is not proof of presence — browser coordinates can be
--     spoofed; the UI states this and officers can correct records.
-- ============================================================

create table public.attendance (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  status         text not null default 'present'
                 check (status in ('present', 'absent', 'excused')),
  method         text not null check (method in ('gps', 'manual')),
  checked_in_at  timestamptz,
  latitude       double precision check (latitude between -90 and 90),
  longitude      double precision check (longitude between -180 and 180),
  distance_m     double precision check (distance_m >= 0),
  marked_by      uuid references public.profiles (id) on delete set null,
  reason         text check (char_length(reason) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- One attendance record per member per event (duplicate check-ins rejected).
  unique (event_id, profile_id)
);

create index attendance_event_idx on public.attendance (event_id);
create index attendance_profile_idx on public.attendance (profile_id);

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.fn_set_updated_at();

alter table public.attendance enable row level security;

create policy "attendance_select_active"
  on public.attendance for select
  to authenticated
  using (public.fn_has_active_profile());

-- No INSERT policy for clients: rows are created only by fn_check_in /
-- fn_correct_attendance (SECURITY DEFINER) or the trusted server.
create policy "attendance_update_officer"
  on public.attendance for update
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()))
  with check (public.fn_is_officer_uid(auth.uid()));

create policy "attendance_delete_officer"
  on public.attendance for delete
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));

-- ------------------------------------------------------------
-- Audit log (append-only, written by SECURITY DEFINER functions)
-- ------------------------------------------------------------
create table public.attendance_audit_log (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  profile_id  uuid references public.profiles (id) on delete set null,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (char_length(action) between 1 and 60),
  outcome     text not null check (char_length(outcome) between 1 and 60),
  distance_m  double precision,
  latitude    double precision,
  longitude   double precision,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index attendance_audit_event_idx on public.attendance_audit_log (event_id, created_at desc);

alter table public.attendance_audit_log enable row level security;

create policy "attendance_audit_select_officer"
  on public.attendance_audit_log for select
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));

-- Members may always see their own audit trail.
create policy "attendance_audit_select_own"
  on public.attendance_audit_log for select
  to authenticated
  using (profile_id = auth.uid() or actor_id = auth.uid());

-- No client writes: SECURITY DEFINER functions only.

-- ------------------------------------------------------------
-- Shared Haversine distance (same formula as src/lib/geo.ts)
-- ------------------------------------------------------------
create or replace function public.fn_haversine_m(
  p_lat1 double precision, p_lon1 double precision,
  p_lat2 double precision, p_lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * atan2(
    sqrt(
      sin(radians(p_lat2 - p_lat1) / 2) ^ 2
      + cos(radians(p_lat1)) * cos(radians(p_lat2))
        * sin(radians(p_lon2 - p_lon1) / 2) ^ 2
    ),
    sqrt(1 - (
      sin(radians(p_lat2 - p_lat1) / 2) ^ 2
      + cos(radians(p_lat1)) * cos(radians(p_lat2))
        * sin(radians(p_lon2 - p_lon1) / 2) ^ 2
    ))
  );
$$;

-- ------------------------------------------------------------
-- GPS check-in with server-side geofence + window + duplicate checks
-- ------------------------------------------------------------
create or replace function public.fn_check_in(
  p_event_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_distance double precision;
  v_now timestamptz := now();
  v_row public.attendance%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;
  if not public.fn_has_active_profile() then
    raise exception 'Your account is not approved yet.';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates.';
  end if;

  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found.';
  end if;

  -- Only officers and members assigned to this event may check in.
  if not (public.fn_is_officer_uid(v_uid)
          or exists (select 1 from public.event_assignments
                     where event_id = p_event_id and profile_id = v_uid)) then
    insert into public.attendance_audit_log (event_id, profile_id, actor_id, action, outcome, latitude, longitude, details)
    values (p_event_id, v_uid, v_uid, 'check_in', 'denied_not_assigned', p_latitude, p_longitude, null);
    raise exception 'You are not assigned to this event.';
  end if;

  if not v_event.attendance_enabled
     or v_event.latitude is null or v_event.longitude is null
     or v_event.geofence_radius_m is null then
    raise exception 'Attendance is not enabled for this event.';
  end if;

  if v_event.check_in_opens_at is not null and v_now < v_event.check_in_opens_at then
    insert into public.attendance_audit_log (event_id, profile_id, actor_id, action, outcome, latitude, longitude, details)
    values (p_event_id, v_uid, v_uid, 'check_in', 'denied_window_not_open', p_latitude, p_longitude,
            jsonb_build_object('opens_at', v_event.check_in_opens_at));
    raise exception 'Check-in has not opened yet for this event.';
  end if;

  if v_event.check_in_closes_at is not null and v_now > v_event.check_in_closes_at then
    insert into public.attendance_audit_log (event_id, profile_id, actor_id, action, outcome, latitude, longitude, details)
    values (p_event_id, v_uid, v_uid, 'check_in', 'denied_window_closed', p_latitude, p_longitude,
            jsonb_build_object('closes_at', v_event.check_in_closes_at));
    raise exception 'Check-in has closed for this event. Contact an officer for a manual correction.';
  end if;

  -- Server-side geofence validation (never trusts client distance flags).
  v_distance := public.fn_haversine_m(v_event.latitude, v_event.longitude, p_latitude, p_longitude);

  if v_distance > v_event.geofence_radius_m then
    insert into public.attendance_audit_log (event_id, profile_id, actor_id, action, outcome, distance_m, latitude, longitude, details)
    values (p_event_id, v_uid, v_uid, 'check_in', 'denied_outside_geofence', round(v_distance::numeric)::double precision,
            p_latitude, p_longitude,
            jsonb_build_object('radius_m', v_event.geofence_radius_m));
    raise exception 'You are about % metres from the venue (allowed radius: % m). Check-in denied.',
      round(v_distance)::text, v_event.geofence_radius_m::text;
  end if;

  -- Duplicate prevention: unique(event_id, profile_id).
  insert into public.attendance (event_id, profile_id, status, method, checked_in_at, latitude, longitude, distance_m)
  values (p_event_id, v_uid, 'present', 'gps', v_now, p_latitude, p_longitude, round(v_distance::numeric)::double precision)
  on conflict (event_id, profile_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    insert into public.attendance_audit_log (event_id, profile_id, actor_id, action, outcome, distance_m, details)
    values (p_event_id, v_uid, v_uid, 'check_in', 'denied_duplicate', round(v_distance::numeric)::double precision, null);
    raise exception 'You have already checked in for this event.';
  end if;

  insert into public.attendance_audit_log (event_id, profile_id, actor_id, action, outcome, distance_m, latitude, longitude, details)
  values (p_event_id, v_uid, v_uid, 'check_in', 'accepted', round(v_distance::numeric)::double precision,
          p_latitude, p_longitude, jsonb_build_object('method', 'gps'));

  return jsonb_build_object(
    'outcome', 'ok',
    'attendance_id', v_row.id,
    'status', v_row.status,
    'checked_in_at', v_row.checked_in_at,
    'distance_m', v_row.distance_m,
    'radius_m', v_event.geofence_radius_m
  );
end;
$$;

-- ------------------------------------------------------------
-- Authorized manual attendance correction (officers only).
-- Always audited with actor, reason and timestamp.
-- ------------------------------------------------------------
create or replace function public.fn_correct_attendance(
  p_event_id uuid,
  p_profile_id uuid,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events%rowtype;
  v_row public.attendance%rowtype;
begin
  if v_uid is null or not public.fn_has_active_profile() then
    raise exception 'Not approved.';
  end if;
  if not public.fn_is_officer_uid(v_uid) then
    raise exception 'Only officers can correct attendance.';
  end if;
  if p_status not in ('present', 'absent', 'excused') then
    raise exception 'Invalid attendance status.';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'A reason is required for attendance corrections.';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'Event not found.';
  end if;

  select * into v_row from public.attendance
  where event_id = p_event_id and profile_id = p_profile_id for update;

  if v_row.id is null then
    if p_status = 'present' then
      insert into public.attendance (event_id, profile_id, status, method, checked_in_at, marked_by, reason)
      values (p_event_id, p_profile_id, 'present', 'manual', now(), v_uid, trim(p_reason))
      returning * into v_row;
    else
      insert into public.attendance (event_id, profile_id, status, method, marked_by, reason)
      values (p_event_id, p_profile_id, p_status, 'manual', v_uid, trim(p_reason))
      returning * into v_row;
    end if;
  else
    update public.attendance
    set status = p_status,
        method = 'manual',
        checked_in_at = case when p_status = 'present' then coalesce(checked_in_at, now()) else checked_in_at end,
        marked_by = v_uid,
        reason = trim(p_reason)
    where id = v_row.id
    returning * into v_row;
  end if;

  insert into public.attendance_audit_log (event_id, profile_id, actor_id, action, outcome, details)
  values (p_event_id, p_profile_id, v_uid, 'manual_correction', p_status,
          jsonb_build_object('reason', trim(p_reason)));

  return jsonb_build_object('outcome', 'ok', 'attendance_id', v_row.id, 'status', v_row.status);
end;
$$;

revoke all on function public.fn_haversine_m(double precision, double precision, double precision, double precision) from public, anon;
revoke all on function public.fn_check_in(uuid, double precision, double precision) from public, anon;
revoke all on function public.fn_correct_attendance(uuid, uuid, text, text) from public, anon;
grant execute on function public.fn_haversine_m(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.fn_check_in(uuid, double precision, double precision) to authenticated;
grant execute on function public.fn_correct_attendance(uuid, uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- Realtime for the live attendance board
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.attendance;
  end if;
exception
  when duplicate_object then null;
end $$;
