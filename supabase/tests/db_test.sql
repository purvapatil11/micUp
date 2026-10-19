-- ============================================================
-- MicUp database behavior tests (run against vanilla PostgreSQL
-- with stub_supabase_env.sql applied first).
-- Proves: role rules, review-required workflow, CAS conflict
-- detection, geofence validation, duplicate check-in rejection,
-- audit logging, and RLS protections.
-- ============================================================
\set ON_ERROR_STOP on
set search_path = public, extensions;

-- ---------------- Seed users (simulating service-role creation) ----------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'officer@college.edu'),
  ('22222222-2222-2222-2222-222222222222', 'deputy@college.edu'),
  ('33333333-3333-3333-3333-333333333333', 'member@college.edu'),
  ('44444444-4444-4444-4444-444444444444', 'other@college.edu')
on conflict do nothing;

insert into public.profiles (id, full_name, email, role, status) values
  ('11111111-1111-1111-1111-111111111111', 'Olivia Officer', 'officer@college.edu', 'anchoring_officer', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Dan Deputy', 'deputy@college.edu', 'deputy_anchoring_officer', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Mia Member', 'member@college.edu', 'team_member', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'Oli Other', 'other@college.edu', 'team_member', 'active')
on conflict (id) do nothing;

-- Helper to impersonate a user for RLS + auth.uid().
create or replace function pg_temp.become(uid uuid)
returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, false);
$$;

-- ============================================================
-- TEST 1: a Team Member cannot create a Ready script
-- ============================================================
select pg_temp.become('33333333-3333-3333-3333-333333333333');
set role authenticated;

do $$
begin
  begin
    insert into public.scripts (title, status, content)
    values ('Sneaky approval', 'ready', '{"type":"doc"}'::jsonb);
    raise exception 'TEST FAIL: team member created a Ready script';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: member cannot create Ready script (%)', left(sqlerrm, 80);
  end;
end $$;

-- Member CAN create a Draft.
insert into public.scripts (id, title, status, content, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Fresh draft', 'draft', '{"type":"doc","content":[]}'::jsonb, '33333333-3333-3333-3333-333333333333');
\echo 'PASS: member can create a draft'

-- ============================================================
-- TEST 2: member cannot promote to Ready (trigger + fn)
-- ============================================================
do $$
begin
  begin
    update public.scripts set status = 'ready'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'TEST FAIL: member promoted script to Ready';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: member cannot promote to Ready (%)', left(sqlerrm, 90);
  end;
end $$;

do $$
declare r jsonb;
begin
  begin
    select public.fn_save_script('aaaaaaaa-0000-0000-0000-000000000001', 1,
      'Fresh draft', '{"type":"doc","content":[]}'::jsonb, 'ready') into r;
    raise exception 'TEST FAIL: fn_save_script allowed member to set Ready: %', r;
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: fn_save_script blocks Ready for members (%)', left(sqlerrm, 90);
  end;
end $$;

-- ============================================================
-- TEST 3: full approval workflow — review then officer approval
-- ============================================================
select public.fn_save_script('aaaaaaaa-0000-0000-0000-000000000001', 1,
  'Fresh draft', '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb, 'need_review');

select pg_temp.become('11111111-1111-1111-1111-111111111111');
select public.fn_save_script('aaaaaaaa-0000-0000-0000-000000000001', 2,
  'Fresh draft', '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb, 'ready');
\echo 'PASS: officer approved script to Ready'

-- ============================================================
-- TEST 4: editing a Ready script cannot stay Ready
-- ============================================================
do $$
declare r jsonb;
begin
  begin
    select public.fn_save_script('aaaaaaaa-0000-0000-0000-000000000001', 3,
      'Fresh draft v2', '{"type":"doc","content":[{"type":"paragraph"},{"type":"paragraph"}]}'::jsonb, 'ready') into r;
    raise exception 'TEST FAIL: Ready script stayed Ready after edit: %', r;
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: edited Ready script requires review (%)', left(sqlerrm, 100);
  end;
end $$;

-- The same rule via a direct UPDATE (member cannot bypass through raw SQL).
select pg_temp.become('33333333-3333-3333-3333-333333333333');
do $$
begin
  begin
    update public.scripts
    set content = '{"type":"doc","content":[{"type":"paragraph"},{"type":"paragraph"},{"type":"paragraph"}]}'::jsonb
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'TEST FAIL: Ready content edited without review bump';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: raw UPDATE on Ready content rejected (%)', left(sqlerrm, 100);
  end;
end $$;

-- Saving with need_review succeeds (review path).
select public.fn_save_script('aaaaaaaa-0000-0000-0000-000000000001', 3,
  'Fresh draft v2', '{"type":"doc","content":[{"type":"paragraph"},{"type":"paragraph"}]}'::jsonb, 'need_review');
\echo 'PASS: edited script can re-enter review'

-- ============================================================
-- TEST 5: concurrent saves — stale revision gets a conflict, no overwrite
-- ============================================================
-- Member saves (bumps revision to 5).
select public.fn_save_script('aaaaaaaa-0000-0000-0000-000000000001', 4,
  'Fresh draft v3', '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb, 'in_progress');

-- Officer still has base revision 4 -> must conflict.
do $$
declare r jsonb;
begin
  select pg_temp.become('11111111-1111-1111-1111-111111111111');
  select public.fn_save_script('aaaaaaaa-0000-0000-0000-000000000001', 4,
    'Officer overwrite attempt', '{"type":"doc"}'::jsonb, 'ready') into r;
  if r->>'outcome' = 'conflict' then
    raise notice 'PASS: stale save detected as conflict (current revision %)', r->>'current_revision';
  else
    raise exception 'TEST FAIL: stale save was not a conflict: %', r;
  end if;
end $$;

-- No silent overwrite happened.
select pg_temp.become('33333333-3333-3333-3333-333333333333');
do $$
declare t text;
begin
  select title into t from public.scripts where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if t = 'Fresh draft v3' then
    raise notice 'PASS: conflicting write did not overwrite newer content';
  else
    raise exception 'TEST FAIL: content was overwritten (title=%)', t;
  end if;
end $$;

-- ============================================================
-- TEST 6: version history is append-only for clients
-- ============================================================
do $$
begin
  begin
    insert into public.script_versions (script_id, revision, title, status, created_by)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 999, 'Fake', 'ready', '33333333-3333-3333-3333-333333333333');
    raise exception 'TEST FAIL: client inserted a forged version';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: clients cannot write version history (%)', left(sqlerrm, 80);
  end;
end $$;

-- Versions were created by the save function.
do $$
declare n int;
begin
  select count(*) into n from public.script_versions where script_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  if n >= 2 then
    raise notice 'PASS: version snapshots exist (%)', n;
  else
    raise exception 'TEST FAIL: expected >=2 versions, got %', n;
  end if;
end $$;

-- ============================================================
-- TEST 7: no privilege escalation via profiles
-- ============================================================
do $$
begin
  begin
    update public.profiles set role = 'anchoring_officer'
    where id = '33333333-3333-3333-3333-333333333333';
    raise exception 'TEST FAIL: member escalated own role';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: self role escalation blocked (%)', left(sqlerrm, 80);
  end;
end $$;

-- ============================================================
-- TEST 8: announcements require officer role
-- ============================================================
do $$
begin
  begin
    insert into public.announcements (title, message, author_id)
    values ('Fake announcement', 'spam', '33333333-3333-3333-3333-333333333333');
    raise exception 'TEST FAIL: member published an announcement';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: members cannot publish announcements (%)', left(sqlerrm, 80);
  end;
end $$;

select pg_temp.become('11111111-1111-1111-1111-111111111111');
insert into public.announcements (id, title, message, priority, author_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'Rehearsal moved', 'Saturday, 4 PM in Hall B.', 'important', '11111111-1111-1111-1111-111111111111');
\echo 'PASS: officer published announcement'

-- Acknowledgements: own rows only.
select pg_temp.become('33333333-3333-3333-3333-333333333333');
insert into public.announcement_acknowledgements (announcement_id, profile_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
\echo 'PASS: member acknowledged announcement'

do $$
begin
  begin
    insert into public.announcement_acknowledgements (announcement_id, profile_id)
    values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
    raise exception 'TEST FAIL: member acknowledged on behalf of someone else';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: cannot acknowledge for another user (%)', left(sqlerrm, 80);
  end;
end $$;

-- ============================================================
-- TEST 9: event + geofence + attendance
-- ============================================================
select pg_temp.become('11111111-1111-1111-1111-111111111111');
insert into public.events (id, name, event_date, start_time, venue, status,
  attendance_enabled, latitude, longitude, geofence_radius_m,
  check_in_opens_at, check_in_closes_at, created_by)
values ('cccccccc-0000-0000-0000-000000000001', 'Annual Day', current_date + 1, '18:00',
  'Main Auditorium', 'upcoming', true,
  18.5204, 73.8567, 150,
  now() - interval '1 hour', now() + interval '5 hours',
  '11111111-1111-1111-1111-111111111111');

insert into public.event_assignments (event_id, profile_id, responsibility)
values ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Opening anchor');
\echo 'PASS: officer created event with geofence + assignment'

-- Haversine sanity: same point = 0 m; ~0.001 deg lat ≈ 111 m.
do $$
declare d double precision;
begin
  select public.fn_haversine_m(18.5204, 73.8567, 18.5204, 73.8567) into d;
  if d < 0.01 then raise notice 'PASS: haversine same point = 0m'; else raise exception 'TEST FAIL: same point distance %', d; end if;
  select public.fn_haversine_m(18.5204, 73.8567, 18.5214, 73.8567) into d;
  if d between 100 and 125 then raise notice 'PASS: haversine ~111m (% )', round(d); else raise exception 'TEST FAIL: expected ~111m got %', d; end if;
end $$;

-- Unassigned member cannot check in.
select pg_temp.become('44444444-4444-4444-4444-444444444444');
do $$
declare r jsonb;
begin
  begin
    select public.fn_check_in('cccccccc-0000-0000-0000-000000000001', 18.5204, 73.8567) into r;
    raise exception 'TEST FAIL: unassigned member checked in: %', r;
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: unassigned member denied (%)', left(sqlerrm, 70);
  end;
end $$;

-- Assigned member: outside geofence -> denied.
select pg_temp.become('33333333-3333-3333-3333-333333333333');
do $$
declare r jsonb;
begin
  begin
    -- ~5.5 km north
    select public.fn_check_in('cccccccc-0000-0000-0000-000000000001', 18.5704, 73.8567) into r;
    raise exception 'TEST FAIL: outside geofence allowed: %', r;
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: outside geofence denied (%)', left(sqlerrm, 90);
  end;
end $$;

-- Client cannot forge a GPS attendance row directly (no INSERT policy).
do $$
begin
  begin
    insert into public.attendance (event_id, profile_id, method, status, checked_in_at, latitude, longitude)
    values ('cccccccc-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'gps', 'present', now(), 18.5204, 73.8567);
    raise exception 'TEST FAIL: client inserted attendance directly';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: direct attendance insert blocked (%)', left(sqlerrm, 80);
  end;
end $$;

-- Valid check-in inside geofence.
select public.fn_check_in('cccccccc-0000-0000-0000-000000000001', 18.5205, 73.8567);
\echo 'PASS: valid GPS check-in accepted'

-- Duplicate check-in rejected.
do $$
declare r jsonb;
begin
  begin
    select public.fn_check_in('cccccccc-0000-0000-0000-000000000001', 18.5205, 73.8567) into r;
    raise exception 'TEST FAIL: duplicate check-in allowed: %', r;
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: duplicate check-in rejected (%)', left(sqlerrm, 70);
  end;
end $$;

-- Audit log recorded for the accepted check-in and denials.
do $$
declare n int;
begin
  select count(*) into n from public.attendance_audit_log where event_id = 'cccccccc-0000-0000-0000-000000000001';
  if n >= 3 then
    raise notice 'PASS: audit log has entries (%)', n;
  else
    raise exception 'TEST FAIL: expected >=3 audit rows, got %', n;
  end if;
end $$;

-- Team member cannot correct attendance.
do $$
begin
  begin
    select public.fn_correct_attendance('cccccccc-0000-0000-0000-000000000001',
      '44444444-4444-4444-4444-444444444444', 'present', 'I said so');
    raise exception 'TEST FAIL: member corrected attendance';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: members cannot correct attendance (%)', left(sqlerrm, 70);
  end;
end $$;

-- Officer manual correction works and is audited.
select pg_temp.become('11111111-1111-1111-1111-111111111111');
select public.fn_correct_attendance('cccccccc-0000-0000-0000-000000000001',
  '44444444-4444-4444-4444-444444444444', 'present', 'GPS failed on their phone');
\echo 'PASS: officer manual correction accepted'

do $$
declare n int;
begin
  select count(*) into n from public.attendance_audit_log
  where action = 'manual_correction' and profile_id = '44444444-4444-4444-4444-444444444444';
  if n = 1 then raise notice 'PASS: manual correction audited'; else raise exception 'TEST FAIL: audit missing (%)', n; end if;
end $$;

-- Check-in outside the configured window is denied.
select pg_temp.become('33333333-3333-3333-3333-333333333333');
update public.events
set check_in_closes_at = now() - interval '1 minute'
where id = 'cccccccc-0000-0000-0000-000000000001';
-- (direct update as member would be blocked; do it as officer)
select pg_temp.become('11111111-1111-1111-1111-111111111111');
update public.events
set check_in_closes_at = now() - interval '1 minute'
where id = 'cccccccc-0000-0000-0000-000000000001';

select pg_temp.become('22222222-2222-2222-2222-222222222222');
insert into public.event_assignments (event_id, profile_id, responsibility)
values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Vice anchor');
do $$
declare r jsonb;
begin
  begin
    select public.fn_check_in('cccccccc-0000-0000-0000-000000000001', 18.5204, 73.8567) into r;
    raise exception 'TEST FAIL: check-in after window close allowed: %', r;
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: closed check-in window denied (%)', left(sqlerrm, 90);
  end;
end $$;

-- ============================================================
-- TEST 10: script comments — members can talk, not approve
-- ============================================================
select pg_temp.become('33333333-3333-3333-3333-333333333333');
insert into public.script_comments (id, script_id, author_id, body)
values ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333', 'Can we tighten the welcome line?');
\echo 'PASS: member posted a discussion comment'

-- Comment author cannot be spoofed on update.
do $$
begin
  begin
    update public.script_comments set author_id = '11111111-1111-1111-1111-111111111111'
    where id = 'dddddddd-0000-0000-0000-000000000001';
    raise exception 'TEST FAIL: comment author rewritten';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: comment author immutable (%)', left(sqlerrm, 70);
  end;
end $$;

-- ============================================================
-- TEST 11: run of show write is officer-only
-- ============================================================
do $$
begin
  begin
    insert into public.run_of_show_items (event_id, sequence, segment_title)
    values ('cccccccc-0000-0000-0000-000000000001', 1, 'Opening');
    raise exception 'TEST FAIL: member created run-of-show item';
  exception when others then
    if sqlerrm like 'TEST FAIL%' then raise; end if;
    raise notice 'PASS: members cannot edit run of show (%)', left(sqlerrm, 70);
  end;
end $$;

select pg_temp.become('11111111-1111-1111-1111-111111111111');
insert into public.run_of_show_items (event_id, sequence, segment_title, stage_cue, assigned_to)
values ('cccccccc-0000-0000-0000-000000000001', 1, 'Opening announcement',
  'Lights up, walk-in music fades', '33333333-3333-3333-3333-333333333333');
\echo 'PASS: officer created run-of-show item'

reset role;
select pg_temp.become(null);
\echo 'ALL DATABASE TESTS PASSED'
