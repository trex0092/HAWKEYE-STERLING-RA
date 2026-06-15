-- ============================================================================
-- Supabase Row Level Security (RLS) — per-user "own records only" policies
-- ============================================================================
--
-- ⚠️  REVIEW THESE POLICIES BEFORE RUNNING THEM. Nothing here has been applied.
--
-- IMPORTANT — context for this repository:
--   The Hawkeye Sterling Entity Risk Assessment app does NOT use Supabase. It is
--   a static single-file app (index.html) that stores data in the browser's
--   localStorage (encrypted at rest with AES-256-GCM), with two Netlify
--   functions as its only backend. There are therefore NO Supabase tables in
--   this project to enable RLS on.
--
--   This file is provided as a ready-to-apply TEMPLATE for a separate Supabase
--   project. Run it in the Supabase SQL editor (or via `supabase db push`) only
--   after reviewing it against your real schema.
--
-- The model below implements exactly what was requested: every user can only
-- SELECT / INSERT / UPDATE / DELETE their own rows. It assumes each protected
-- table has an `owner` column of type uuid that defaults to the authenticated
-- user. Adjust the column name (commonly `user_id`) to match your schema.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0 — SHOW FIRST (run this before anything else)
-- ----------------------------------------------------------------------------
-- List every table in the `public` schema and whether RLS is already enabled,
-- so you can see exactly what will be affected before you change anything.

select
  n.nspname               as schema,
  c.relname               as table_name,
  c.relrowsecurity        as rls_enabled,
  c.relforcerowsecurity   as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname = 'public'
order by c.relname;

-- Show any policies that already exist (so you don't clobber them unknowingly):
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ----------------------------------------------------------------------------
-- STEP 1 — Per-table policies (the explicit, auditable form). RECOMMENDED.
-- ----------------------------------------------------------------------------
-- Copy this block once per table, replacing <TABLE> and the owner column.
-- Using four separate policies (one per command) keeps the intent legible and
-- lets a reviewer confirm INSERT/UPDATE are guarded by WITH CHECK, not just USING.

-- Example for a table called `profiles` with an `owner uuid` column:

alter table public.profiles enable row level security;
-- Optional but stronger: also enforce RLS for the table owner / definer roles.
-- alter table public.profiles force row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = owner);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = owner);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = owner)          -- which existing rows you may target
  with check (auth.uid() = owner);    -- prevents re-assigning a row to someone else

create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = owner);

-- Make new rows default to the caller so clients never have to send `owner`
-- (and cannot spoof it, because the INSERT policy's WITH CHECK still verifies it):
alter table public.profiles
  alter column owner set default auth.uid();


-- ----------------------------------------------------------------------------
-- STEP 2 — Apply to ALL public tables at once (the "every table" form)
-- ----------------------------------------------------------------------------
-- This generates and runs the same owner-only policy set for every base table
-- in `public` that has an `owner` column. Tables WITHOUT an owner column are
-- skipped and reported, so an unrelated table is never silently locked open or
-- locked shut. Change OWNER_COL below if your column is named `user_id`.
--
-- Run STEP 0 first and read the NOTICEs this raises before trusting the result.

do $$
declare
  r        record;
  owner_col text := 'owner';   -- <-- set to your owner column (e.g. 'user_id')
begin
  for r in
    select c.relname as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'public'
    order by c.relname
  loop
    -- Skip tables that have no owner column — report instead of guessing.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = owner_col
    ) then
      raise notice 'SKIP %.% — no "%" column (add a policy by hand or set owner_col)', 'public', r.tbl, owner_col;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', r.tbl);

    -- Drop-if-exists keeps this script safely re-runnable (idempotent).
    execute format('drop policy if exists %I on public.%I', r.tbl || '_select_own', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_insert_own', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_update_own', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_delete_own', r.tbl);

    execute format(
      'create policy %I on public.%I for select to authenticated using (auth.uid() = %I)',
      r.tbl || '_select_own', r.tbl, owner_col);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (auth.uid() = %I)',
      r.tbl || '_insert_own', r.tbl, owner_col);
    execute format(
      'create policy %I on public.%I for update to authenticated using (auth.uid() = %I) with check (auth.uid() = %I)',
      r.tbl || '_update_own', r.tbl, owner_col, owner_col);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (auth.uid() = %I)',
      r.tbl || '_delete_own', r.tbl, owner_col);

    raise notice 'RLS + owner-only policies applied to public.%', r.tbl;
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- STEP 3 — VERIFY after applying
-- ----------------------------------------------------------------------------
-- Re-run STEP 0's two queries. Every protected table should now show
-- rls_enabled = true and carry four policies (select/insert/update/delete).
--
-- Notes / gotchas:
--  • Enabling RLS with NO policy denies all access to that table. Make sure each
--    table you enable also gets policies (STEP 2 does both together).
--  • The `service_role` key bypasses RLS by design — keep it server-side only,
--    never in the browser.
--  • If a table is meant to be world-readable (e.g. a public lookup list), add a
--    separate `for select using (true)` policy instead of the owner-only one.
--  • These policies target the `authenticated` role; anonymous (`anon`) users get
--    no access, which is the safe default for per-user data.
-- ============================================================================
