-- ============================================================
-- MicUp 00001 — extensions and updated_at trigger
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- gen_random_uuid() is provided by PostgreSQL core (13+) / pgcrypto.

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
