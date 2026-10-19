-- ============================================================
-- restrict_script_edit.sql
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor).
--
-- Enforces that only the Anchoring Officer, a Deputy Anchoring
-- Officer, the script's creator, or an assigned anchor can edit
-- a script. Mirrors canEditScript in src/lib/permissions.ts.
-- ============================================================

drop policy if exists "scripts_update_active" on public.scripts;

create policy "scripts_update_active"
  on public.scripts for update
  to authenticated
  using (
    public.fn_has_active_profile()
    and (public.fn_is_officer_uid(auth.uid())
         or created_by = auth.uid()
         or auth.uid() = any(coalesce(assigned_to, array[]::uuid[])))
  )
  with check (
    public.fn_has_active_profile()
    and (public.fn_is_officer_uid(auth.uid())
         or created_by = auth.uid()
         or auth.uid() = any(coalesce(assigned_to, array[]::uuid[])))
  );

-- Recreate fn_save_script with the editing-permission guard.

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

  -- Editing restricted to officers, the creator and assigned anchors
  -- (mirror of canEditScript in src/lib/permissions.ts).
  if not (public.fn_is_officer_uid(v_uid)
          or v_script.created_by = v_uid
          or v_uid = any(coalesce(v_script.assigned_to, array[]::uuid[]))) then
    raise exception 'Only the Anchoring Officer, a Deputy Anchoring Officer, or an assigned anchor can edit this script.';
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
