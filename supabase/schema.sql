-- Personal report archive for the Ankha report terminal.
-- Run this in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- It is safe to run again, and it upgrades an earlier install (the shared
-- campaign archive) in place: tables are renamed and reshaped, data is kept.
--
-- Access rules, in one place:
--   * People sign in with a user name and a password; accounts are made in the app.
--   * A signed-in user can read, change and remove only their own archived reports.
--   * Saving needs campaign membership: the join code, entered once per account.
--   * Nobody can read anyone else's reports, signed in or not.
--
-- Two settings in the dashboard go with this file (Authentication → Sign In / Providers):
--   * Email: on, with "Confirm email" switched OFF. The app signs people in with
--     an address made up from their user name; nobody is there to confirm it.
--   * Allow anonymous sign-ins: off. The app no longer uses them.

-- --- profiles ---------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  is_member boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Every new account gets a profile, named as the person typed their user name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Runs with the owner's rights so that policies can ask about the caller
-- without the profiles table's own policies getting in the way.
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_member from public.profiles p where p.id = auth.uid()), false);
$$;

drop policy if exists "profiles: read own, GMs read all" on public.profiles;
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- Nothing in a profile is writable from the app; membership comes from join_campaign().
drop policy if exists "profiles: rename self" on public.profiles;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- --- join code --------------------------------------------------------------

-- Row level security with no policies: the app can never read this table.
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- A random code on first install. Read or change it with the queries at the end.
insert into public.app_settings (key, value)
values ('join_code', substr(md5(random()::text || clock_timestamp()::text), 1, 10))
on conflict (key) do nothing;

-- The shared archive had game masters and a code for them; the personal one does not.
delete from public.app_settings where key = 'gm_code';

create or replace function public.join_campaign(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  given text := lower(trim(coalesce(code, '')));
  expected text;
begin
  if auth.uid() is null then
    return false;
  end if;
  select lower(s.value) into expected from public.app_settings s where s.key = 'join_code';
  if given = '' or expected is null or given <> expected then
    perform pg_sleep(1); -- makes guessing slow
    return false;
  end if;
  update public.profiles set is_member = true where id = auth.uid();
  return true;
end;
$$;

revoke all on function public.join_campaign(text) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;

-- --- archived reports -------------------------------------------------------

-- An earlier install called this table published_reports.
do $$
begin
  if to_regclass('public.published_reports') is not null and to_regclass('public.archived_reports') is null then
    alter table public.published_reports rename to archived_reports;
  end if;
end;
$$;

create table if not exists public.archived_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  -- The report's id in the author's own library; saving again updates the same row.
  local_id text not null,
  status text not null default 'draft',
  title text not null default '',
  doc_no text not null default '',
  template_name text not null default '',
  classification text not null default 'none',
  accent text not null default '#3fd0c9',
  report jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, local_id)
);

alter table public.archived_reports add column if not exists status text not null default 'draft';
alter table public.archived_reports drop constraint if exists archived_reports_status_check;
alter table public.archived_reports
  add constraint archived_reports_status_check check (status in ('draft', 'final'));

create index if not exists archived_reports_author_idx on public.archived_reports (author_id, updated_at desc);
drop index if exists public.published_reports_updated_idx;

alter table public.archived_reports enable row level security;

-- The owner is always taken from the login, never from what the app sends.
create or replace function public.stamp_archived_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.created_at := now();
  else
    new.author_id := old.author_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.title := left(new.title, 200);
  new.doc_no := left(new.doc_no, 60);
  new.template_name := left(new.template_name, 120);
  new.local_id := left(new.local_id, 80);
  if octet_length(new.report::text) > 4000000 then
    raise exception 'report too large' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_published_report on public.archived_reports;
drop trigger if exists stamp_archived_report on public.archived_reports;
create trigger stamp_archived_report
  before insert or update on public.archived_reports
  for each row execute function public.stamp_archived_report();

drop policy if exists "reports: read public, own, or as GM" on public.archived_reports;
drop policy if exists "reports: members publish" on public.archived_reports;
drop policy if exists "reports: authors update own" on public.archived_reports;
drop policy if exists "reports: authors and GMs remove" on public.archived_reports;

drop policy if exists "reports: read own" on public.archived_reports;
create policy "reports: read own" on public.archived_reports
  for select to authenticated
  using (author_id = auth.uid());

drop policy if exists "reports: members save" on public.archived_reports;
create policy "reports: members save" on public.archived_reports
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_member());

drop policy if exists "reports: update own" on public.archived_reports;
create policy "reports: update own" on public.archived_reports
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.is_member());

drop policy if exists "reports: remove own" on public.archived_reports;
create policy "reports: remove own" on public.archived_reports
  for delete to authenticated
  using (author_id = auth.uid());

revoke all on public.archived_reports from anon, authenticated;
grant select, insert, update, delete on public.archived_reports to authenticated;

-- What the shared archive needed and the personal one does not.
alter table public.archived_reports drop column if exists visibility;
alter table public.archived_reports drop column if exists author_name;
drop function if exists public.stamp_published_report();
drop function if exists public.is_gm();
drop function if exists public.can_publish();
alter table public.profiles drop column if exists is_gm;

-- --- running the campaign (use these in the SQL Editor) -----------------------
--
-- See the join code to hand to your players:
--   select value from public.app_settings where key = 'join_code';
--
-- Change the join code (people who already joined keep their right to save):
--   update public.app_settings set value = 'new-code-here' where key = 'join_code';
--
-- See who has an account, and how much they keep in the archive:
--   select p.display_name, u.email, p.is_member, count(r.id) as reports,
--          pg_size_pretty(coalesce(sum(octet_length(r.report::text)), 0)) as size
--   from public.profiles p
--   join auth.users u on u.id = p.id
--   left join public.archived_reports r on r.author_id = p.id
--   group by p.display_name, u.email, p.is_member
--   order by p.display_name;
--
-- Someone forgot their password: set a new one, tell them, and have them change
-- it under their name in the app. Their sign-in address is the email column above.
--   update auth.users set encrypted_password = crypt('new-password', gen_salt('bf'))
--   where email = 'the-address-from-the-list-above';
--
-- Take away someone's right to save, or delete their account with everything in it:
--   update public.profiles set is_member = false where display_name = 'Their Name';
--   delete from auth.users where email = 'the-address-from-the-list-above';
--
-- Clear out what is left of the shared archive: the browser-only identities it
-- used, together with every report they published.
--   delete from auth.users where is_anonymous;
