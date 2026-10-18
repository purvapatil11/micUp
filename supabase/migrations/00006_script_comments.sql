-- ============================================================
-- MicUp 00006 — script discussion (comments)
-- Comments are communication only: they never modify script content,
-- status, or approval state.
-- ============================================================

create table public.script_comments (
  id          uuid primary key default gen_random_uuid(),
  script_id   uuid not null references public.scripts (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(trim(body)) between 1 and 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index script_comments_script_idx on public.script_comments (script_id, created_at);

create trigger script_comments_set_updated_at
  before update on public.script_comments
  for each row execute function public.fn_set_updated_at();

create or replace function public.fn_comments_guard()
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
    new.author_id := v_uid;
  elsif new.author_id is distinct from old.author_id then
    raise exception 'Comment author cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger script_comments_guard
  before insert or update on public.script_comments
  for each row execute function public.fn_comments_guard();

alter table public.script_comments enable row level security;

create policy "script_comments_select_active"
  on public.script_comments for select
  to authenticated
  using (public.fn_has_active_profile());

create policy "script_comments_insert_active"
  on public.script_comments for insert
  to authenticated
  with check (public.fn_has_active_profile() and author_id = auth.uid());

create policy "script_comments_update_own"
  on public.script_comments for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- Authors may delete their own comments; officers may moderate.
create policy "script_comments_delete_own_or_officer"
  on public.script_comments for delete
  to authenticated
  using (author_id = auth.uid() or public.fn_is_officer_uid(auth.uid()));

-- ------------------------------------------------------------
-- Realtime: new comments stream to open script pages.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.script_comments;
  end if;
exception
  when duplicate_object then null;
end $$;
