# MicUp

Private anchoring team coordination platform — scripts, events, run of show, announcements, and event-day GPS attendance in one backstage workspace.

Built for a college anchoring team of 10–20 members. Invite-only, role-based, with final script approval reserved for the Anchoring Officer and Deputy Anchoring Officer.

## Stack

- **Framework:** Next.js App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui-style components
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Security:** Row Level Security (RLS) on every table, SECURITY DEFINER RPCs for privileged writes
- **Editor:** TipTap (rich text, autosave, conflict detection)
- **Validation:** Zod
- **Tests:** Vitest
- **Deployment:** Vercel

## Features

| Feature | Details |
|---|---|
| **Invite-only auth** | No public signup. Officers invite members via one-time links. Unapproved accounts cannot access workspace data. |
| **Roles** | Anchoring Officer, Deputy Anchoring Officer, Team Member. Enforced in RLS + server actions, not just UI. |
| **Script library** | Search, filter by status/category, card layout. |
| **Script editor** | TipTap rich text with headings, bold, italic, lists. Debounced autosave, save indicator, manual save fallback. |
| **Conflict detection** | Revision-based compare-and-swap. Concurrent edits never silently overwrite — users see a conflict banner with reload/overwrite options. |
| **Version history** | Append-only snapshots. Officers can restore any version as a new revision (history is never deleted). |
| **Script discussion** | Realtime comments scoped to each script. Comments never modify script content or status. |
| **Status workflow** | Draft → In Progress → Need Review → Ready. Only officers can set Ready. Editing a Ready script forces it back through review. |
| **Events** | Create events, assign team members with responsibilities, link scripts, configure attendance. |
| **Run of show** | Sequence items with times, stage cues (visually distinct), assignees, and linked scripts. Reorder with up/down controls. |
| **Announcements** | Officers publish with priority labels. Members acknowledge. Shown on dashboard. |
| **GPS attendance** | Browser Geolocation on user initiation. Server-side Haversine geofence validation, time window checks, duplicate prevention via unique constraint. Audit log for every attempt. Manual correction workflow for officers. CSV export. |

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/purvapatil11/micUp.git
cd micUp
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note the **Project URL** and **anon key** from Settings → API.
3. Also copy the **service_role key** (server-only — never expose to the browser).

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run migrations

Open the Supabase SQL Editor (or use the CLI) and run each migration in order:

```
supabase/migrations/00001_init_helpers.sql
supabase/migrations/00002_profiles.sql
supabase/migrations/00003_team_invites.sql
supabase/migrations/00004_events.sql
supabase/migrations/00005_scripts.sql
supabase/migrations/00006_script_comments.sql
supabase/migrations/00007_run_of_show.sql
supabase/migrations/00008_announcements.sql
supabase/migrations/00009_attendance.sql
```

Or with the Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 5. Disable public signup

In Supabase Dashboard → Authentication → Providers → Email, **disable "Confirm email"** if you want invited users to sign in immediately (the invite flow confirms them server-side). Public self-registration stays disabled because profiles cannot be created by clients (enforced by a database trigger).

### 6. Create the first officer

Since public signup is disabled, you need to bootstrap the first Anchoring Officer manually:

1. In Supabase Auth → Users, create a user with email + password (confirm email).
2. In the SQL Editor, insert their profile:

```sql
insert into public.profiles (id, full_name, email, role, status)
values (
  'AUTH-USER-UUID-HERE',
  'Your Name',
  'your@email.com',
  'anchoring_officer',
  'active'
);
```

3. Sign in at `/login`. From the Team page you can now invite everyone else.

### 7. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
npm run test
```

Covers:
- Only officers can mark scripts Ready (`authorizeScriptStatusChange`)
- Editing a Ready script requires review again
- Haversine distance and geofence evaluation
- Check-in time window validation
- Coordinate sanity checks
- Zod schemas for scripts, comments, events, attendance, announcements

Database-level behavior (RLS, triggers, CAS conflicts, duplicate check-in rejection) is tested by `supabase/tests/db_test.sql` — run it against a Postgres instance with `supabase/tests/stub_supabase_env.sql` applied first.

## Deployment (Vercel)

1. Push to GitHub.
2. In [Vercel](https://vercel.com), import the repository.
3. Add the three environment variables (same as `.env.local`).
4. Deploy. The app redirects to `/setup` if Supabase env vars are missing.

## Project structure

```
src/
  actions/          Server actions (auth, scripts, events, announcements, attendance, team, run-of-show)
  app/
    (auth)/         Login, password reset, invite accept
    (app)/          Protected app shell: dashboard, scripts, events, run-of-show, announcements, team, settings
    setup/          Shown when env vars are missing
    pending/        Shown for unapproved accounts
    suspended/      Shown for suspended accounts
  components/
    script/         TipTap editor, discussion, version history
    attendance/     GPS check-in button, manual correction dialog
    layout/         Sidebar, page header, user menu
    ui/             shadcn-style primitives
  lib/
    auth.ts         requireUser / requireOfficer (server-side)
    permissions.ts  Role gates and script status rules
    geo.ts          Haversine + geofence (mirrors Postgres fn_haversine_m)
    validation.ts   All Zod schemas
    supabase/       Server, browser, and admin clients
  types/            Domain types mirroring the database schema
supabase/
  migrations/       9 SQL migrations with RLS, triggers, SECURITY DEFINER RPCs
  tests/            Database behavior tests
tests/              Vitest unit tests
```

## Security notes

- The service-role key is only used server-side (`src/lib/supabase/admin.ts` imports `server-only`).
- All privileged writes go through SECURITY DEFINER Postgres functions (`fn_save_script`, `fn_check_in`, `fn_correct_attendance`, `fn_restore_script_revision`).
- Clients cannot INSERT attendance rows directly — only the `fn_check_in` RPC can.
- Clients cannot create profiles — only the server-side invite flow (service role) can.
- Nobody can change their own role or approval status (enforced by a trigger).
- Geofence distance is computed server-side with Haversine; the client never sends a distance or `isWithinRadius` flag.
- GPS can be spoofed — the UI states this and officers can correct records with an audit trail.
