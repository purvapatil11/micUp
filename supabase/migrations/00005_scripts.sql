-- ============================================================
-- MicUp 00005 — scripts, versions, status guard, concurrency-safe save
--
-- Business rules enforced in the database (mirrored in
-- src/lib/permissions.ts for UX pre-checks):
--   1. Only Anchoring/Deputy Anchoring Officers may set Ready.
--   2. Editing a Ready script requires review again — content and
--      status can no longer both stay "ready".
--   3. Every content change bumps `revision`; saves are compare-and-swap
--      so concurrent editors never silently overwrite each other.
--   4. Versions are append-only and written by SECURITY DEFINER
--      functions only (history cannot be tampered with via RLS).
-- ============================================================

create table public.scripts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(trim(title)) between 2 and 200),
  event_id     uuid references public.events (id) on delete set null,
  category     text not null default 'custom'
               check (category in ('opening', 'welcome', 'speaker_introduction',
                                   'transition', 'prize_distribution', 'closing', 'custom')),
  assigned_to  uuid[] not null default '{}'::uuid[],
  content      jsonb,
  status       text not null default 'draft'
               check (status in ('draft', 'in_progress', 'need_review', 'ready')),
  revision     integer not null default 1 check (revision > 0),
  deadline     date,
  created_by   uuid not null references public.profiles (id),
  updated_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index scripts_event_id_idx on public.scripts (event_id);
create index scripts_status_idx on public.scripts (status);
create index scripts_updated_at_idx on public.scripts (updated_at desc);
create index scripts_assigned_to_idx on public.scripts using gin (assigned_to);

create trigger scripts_set_updated_at
  before update on public.scripts
  for each row execute function public.fn_set_updated_at();

-- ------------------------------------------------------------
-- Guard: assignees must be existing active members; ready/approval
-- rules; revision bump + editor stamping on every content change.
-- ------------------------------------------------------------
create or replace function public.fn_scripts_guard()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_member uuid;
begin
  -- Trusted server (service role) path.
  if v_uid is null then
    if tg_op = 'UPDATE' and (new.content is distinct from old.content
        or new.title is distinct from old.title
        or new.status is distinct from old.status) then
      new.revision := old.revision + 1;
      new.updated_by := coalesce(new.updated_by, old.updated_by);
    end if;
    return new;
  end if;

  if not public.fn_has_active_profile() then
    raise exception 'Your account is not approved yet.';
  end if;

  -- assigned_to must reference active members only.
  foreach v_member in array new.assigned_to loop
    if not exists (select 1 from public.profiles where id = v_member and status = 'active') then
      raise exception 'Assigned anchor is not an active team member.';
    end if;
  end loop;

  if tg_op = 'INSERT' then
    if new.status = 'ready' and not public.fn_is_officer_uid(v_uid) then
      raise exception 'Only Anchoring Officers or Deputies can mark a script as Ready.';
    end if;
    new.created_by := v_uid;
    new.revision := 1;
    return new;
  end if;

  -- Immutable / server-owned fields on update.
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  -- Approve only through officers.
  if new.status = 'ready' and old.status is distinct from 'ready' then
    if not public.fn_is_officer_uid(v_uid) then
      raise exception 'Only Anchoring Officers or Deputies can mark a script as Ready.';
    end if;
  end if;

  -- A Ready script whose content changed must go back through review.
  if (new.content is distinct from old.content or new.title is distinct from old.title)
     and old.status = 'ready' and new.status = 'ready' then
    raise exception 'REVIEW_REQUIRED: this Ready script was edited and must be reviewed again before it can stay Ready.';
  end if;

  -- Any content/status change bumps the revision so stale editors conflict.
  if (new.content is distinct from old.content
      or new.title is distinct from old.title
      or new.status is distinct from old.status
      or new.assigned_to is distinct from old.assigned_to
      or new.event_id is distinct from old.event_id
      or new.category is distinct from old.category
      or new.deadline is distinct from old.deadline) then
    if new.revision <= old.revision then
      new.revision := old.revision + 1;
    end if;
    new.updated_by := v_uid;
  end if;

  return new;
end;
$$;

create trigger scripts_guard
  before insert or update on public.scripts
  for each row execute function public.fn_scripts_guard();

alter table public.scripts enable row level security;

create policy "scripts_select_active"
  on public.scripts for select
  to authenticated
  using (public.fn_has_active_profile());

create policy "scripts_insert_active"
  on public.scripts for insert
  to authenticated
  with check (public.fn_has_active_profile() and created_by = auth.uid());

create policy "scripts_update_active"
  on public.scripts for update
  to authenticated
  using (public.fn_has_active_profile())
  with check (public.fn_has_active_profile());

create policy "scripts_delete_officer"
  on public.scripts for delete
  to authenticated
  using (public.fn_is_officer_uid(auth.uid()));

-- ------------------------------------------------------------
-- Append-only version history
-- ------------------------------------------------------------
create table public.script_versions (
  id          uuid primary key default gen_random_uuid(),
  script_id   uuid not null references public.scripts (id) on delete cascade,
  revision    integer not null check (revision > 0),
  title       text not null,
  content     jsonb,
  status      text not null check (status in ('draft', 'in_progress', 'need_review', 'ready')),
  note        text check (char_length(note) <= 300),
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now(),
  unique (script_id, revision)
);

create index script_versions_script_idx on public.script_versions (script_id, revision desc);

alter table public.script_versions enable row level security;

create policy "script_versions_select_active"
  on public.script_versions for select
  to authenticated
  using (public.fn_has_active_profile());

-- No INSERT/UPDATE/DELETE policies: only SECURITY DEFINER functions
-- write version history.

-- ------------------------------------------------------------
-- Transactional, concurrency-safe save (compare-and-swap on revision).
-- Returns jsonb: { outcome: 'ok', revision, ... } or
--               { outcome: 'conflict', current_revision, ... }
-- ------------------------------------------------------------
create or replace function public.fn_save_script(
  p_script_id uuid,
  p_base_revision integer,
  p_title text,
  p_content jsonb,
  p_status text,
  p_assigned_to uuid[] default null,
  p_event_id uuid default null,
  p_category text default null,
  p_deadline date default null,
  p_note text default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_script public.scripts%rowtype;
  v_last_version public.script_versions%rowtype;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Not authenticated.';
  end if;
  if not public.fn_has_active_profile() then
    raise exception 'Your account is not approved yet.';
  end if;
  if p_title is null or char_length(trim(p_title)) < 2 then
    raise exception 'Title must be at least 2 characters.';
  end if;
  if p_status not in ('draft', 'in_progress', 'need_review', 'ready') then
    raise exception 'Invalid status.';
  end if;
  -- Permission rules (mirror of authorizeScriptStatusChange).
  if p_status = 'ready' and not public.fn_is_officer_uid(v_uid) then
    raise exception 'Only Anchoring Officers or Deputies can mark a script as Ready.';
  end if;

  select * into v_script from public.scripts where id = p_script_id for update;
  if not found then
    raise exception 'Script not found.';
  end if;

  -- Conflict: someone else saved since this editor loaded the script.
  if not p_force and v_script.revision <> p_base_revision then
    return jsonb_build_object(
      'outcome', 'conflict',
      'current_revision', v_script.revision,
      'updated_at', v_script.updated_at,
      'updated_by', (select full_name from public.profiles where id = v_script.updated_by)
    );
  end if;

  -- Edited Ready scripts must go back through review (unless an officer
  -- is explicitly re-approving in this same save).
  if (p_content is distinct from v_script.content or p_title is distinct from v_script.title)
     and v_script.status = 'ready' and p_status = 'ready' then
    raise exception 'REVIEW_REQUIRED: this Ready script was edited and must be reviewed again. Save with status need_review or in_progress, then an officer can re-approve.';
  end if;

  update public.scripts
  set title = trim(p_title),
      content = p_content,
      status = p_status,
      assigned_to = coalesce(p_assigned_to, assigned_to),
      event_id = p_event_id,
      category = coalesce(p_category, category),
      deadline = p_deadline,
      revision = revision + 1,
      updated_by = v_uid,
      updated_at = v_now
  where id = p_script_id
    and (p_force or revision = p_base_revision)
  returning * into v_script;

  if not found then
    -- Lost the race between FOR UPDATE and UPDATE (shouldn't happen with the
    -- row lock, but keep the CAS authoritative).
    select revision into v_script.revision from public.scripts where id = p_script_id;
    return jsonb_build_object('outcome', 'conflict', 'current_revision', v_script.revision);
  end if;

  -- Version snapshot: coalesce rapid autosaves unless this is a manual
  -- save, a different author, or >60s since the last snapshot.
  select * into v_last_version
  from public.script_versions
  where script_id = p_script_id
  order by revision desc
  limit 1;

  if v_last_version.id is null
     or p_note is not null
     or v_last_version.created_by <> v_uid
     or v_last_version.revision < v_script.revision - 1
     or extract(epoch from (v_now - v_last_version.created_at)) > 60 then
    insert into public.script_versions (script_id, revision, title, content, status, note, created_by, created_at)
    values (p_script_id, v_script.revision, v_script.title, v_script.content, v_script.status, p_note, v_uid, v_now)
    on conflict (script_id, revision) do nothing;
  end if;

  return jsonb_build_object(
    'outcome', 'ok',
    'revision', v_script.revision,
    'updated_at', v_script.updated_at,
    'status', v_script.status
  );
end;
$$;

-- ------------------------------------------------------------
-- Restore a previous version by creating a NEW revision (history intact).
-- ------------------------------------------------------------
create or replace function public.fn_restore_script_revision(
  p_script_id uuid,
  p_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_version public.script_versions%rowtype;
  v_current public.scripts%rowtype;
  v_new_revision integer;
begin
  if v_uid is null or not public.fn_has_active_profile() then
    raise exception 'Not approved.';
  end if;
  if not public.fn_is_officer_uid(v_uid) then
    raise exception 'Only officers can restore script versions.';
  end if;

  select * into v_version from public.script_versions
  where id = p_version_id and script_id = p_script_id for update;
  if not found then
    raise exception 'Version not found.';
  end if;

  select * into v_current from public.scripts where id = p_script_id for update;
  if not found then
    raise exception 'Script not found.';
  end if;

  v_new_revision := v_current.revision + 1;

  update public.scripts
  set title = v_version.title,
      content = v_version.content,
      -- Restoring always re-enters review; officers can re-approve after.
      status = case when v_version.status = 'ready' then 'need_review' else v_version.status end,
      revision = v_new_revision,
      updated_by = v_uid,
      updated_at = now()
  where id = p_script_id;

  insert into public.script_versions (script_id, revision, title, content, status, note, created_by)
  values (p_script_id, v_new_revision, v_version.title, v_version.content,
          case when v_version.status = 'ready' then 'need_review' else v_version.status end,
          format('Restored from revision %s', v_version.revision), v_uid);

  return jsonb_build_object('outcome', 'ok', 'revision', v_new_revision);
end;
$$;

revoke all on function public.fn_save_script(uuid, integer, text, jsonb, text, uuid[], uuid, text, date, text, boolean) from public, anon;
revoke all on function public.fn_restore_script_revision(uuid, uuid) from public, anon;
grant execute on function public.fn_save_script(uuid, integer, text, jsonb, text, uuid[], uuid, text, date, text, boolean) to authenticated;
grant execute on function public.fn_restore_script_revision(uuid, uuid) to authenticated;
