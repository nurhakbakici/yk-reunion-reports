-- Shared campaign archive for the Ankha report terminal.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- It is safe to run again; it replaces functions and policies and keeps data.
--
-- Access rules, in one place:
--   * Anyone (no login) can read reports published to "everyone".
--   * Reports published to "gms" are readable only by their author and by GMs.
--   * Publishing needs campaign membership (the join code) or GM status (the GM code).
--     There are no emails or passwords: each browser gets an anonymous identity.
--   * Authors can change or remove their own reports. GMs can remove any report.
--   * Nobody becomes a member or a GM without the matching code; see the end of this file.

-- --- profiles ---------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  is_gm boolean not null default false,
  is_member boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Every new identity gets a profile; the name is filled in by the app right after.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(split_part(coalesce(new.email, ''), '@', 1), 60))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- These run with the owner's rights so that policies can ask about the caller
-- without the profiles table's own policies getting in the way.
create or replace function public.is_gm()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_gm from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.can_publish()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_gm or p.is_member from public.profiles p where p.id = auth.uid()), false);
$$;

drop policy if exists "profiles: read own, GMs read all" on public.profiles;
create policy "profiles: read own, GMs read all" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_gm());

drop policy if exists "profiles: rename self" on public.profiles;
create policy "profiles: rename self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only the display name is writable from the app. is_gm and is_member are not.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- --- join code --------------------------------------------------------------

-- Row level security with no policies: the app can never read this table.
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

-- Random codes on first install: one for players, one for game masters.
-- Read or change them with the queries at the end.
insert into public.app_settings (key, value)
values ('join_code', substr(md5(random()::text || clock_timestamp()::text), 1, 10))
on conflict (key) do nothing;

insert into public.app_settings (key, value)
values ('gm_code', substr(md5(random()::text || clock_timestamp()::text || 'gm'), 1, 14))
on conflict (key) do nothing;

-- The player code lets the caller publish; the GM code also makes them a GM.
create or replace function public.join_campaign(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  given text := lower(trim(coalesce(code, '')));
  player_code text;
  gm_code text;
begin
  if auth.uid() is null then
    return false;
  end if;
  select lower(s.value) into player_code from public.app_settings s where s.key = 'join_code';
  select lower(s.value) into gm_code from public.app_settings s where s.key = 'gm_code';
  if given <> '' and given = gm_code then
    update public.profiles set is_gm = true, is_member = true where id = auth.uid();
    return true;
  end if;
  if given <> '' and given = player_code then
    update public.profiles set is_member = true where id = auth.uid();
    return true;
  end if;
  perform pg_sleep(1); -- makes guessing slow
  return false;
end;
$$;

revoke all on function public.join_campaign(text) from public, anon;
grant execute on function public.join_campaign(text) to authenticated;

-- --- published reports ------------------------------------------------------

create table if not exists public.published_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null default '',
  -- The report's id in the author's own library; publishing again updates the same row.
  local_id text not null,
  visibility text not null default 'everyone' check (visibility in ('everyone', 'gms')),
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

create index if not exists published_reports_updated_idx on public.published_reports (updated_at desc);

alter table public.published_reports enable row level security;

-- The author and the author's name are always taken from the login, never from
-- what the app sends, so nobody can publish under someone else's name.
create or replace function public.stamp_published_report()
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
  new.author_name := coalesce(
    (select nullif(trim(p.display_name), '') from public.profiles p where p.id = new.author_id),
    'İsimsiz'
  );
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

drop trigger if exists stamp_published_report on public.published_reports;
create trigger stamp_published_report
  before insert or update on public.published_reports
  for each row execute function public.stamp_published_report();

drop policy if exists "reports: read public, own, or as GM" on public.published_reports;
create policy "reports: read public, own, or as GM" on public.published_reports
  for select to anon, authenticated
  using (visibility = 'everyone' or author_id = auth.uid() or public.is_gm());

drop policy if exists "reports: members publish" on public.published_reports;
create policy "reports: members publish" on public.published_reports
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_publish());

drop policy if exists "reports: authors update own" on public.published_reports;
create policy "reports: authors update own" on public.published_reports
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.can_publish());

drop policy if exists "reports: authors and GMs remove" on public.published_reports;
create policy "reports: authors and GMs remove" on public.published_reports
  for delete to authenticated
  using (author_id = auth.uid() or public.is_gm());

revoke all on public.published_reports from anon, authenticated;
grant select on public.published_reports to anon, authenticated;
grant insert, update, delete on public.published_reports to authenticated;

-- --- running the campaign (use these in the SQL Editor) -----------------------
--
-- See both codes: join_code is for players, gm_code for game masters.
--   select key, value from public.app_settings;
--
-- Change a code (people who already joined keep their rights):
--   update public.app_settings set value = 'new-code-here' where key = 'join_code';
--   update public.app_settings set value = 'new-gm-code' where key = 'gm_code';
--
-- See who has joined:
--   select id, display_name, is_gm, is_member, created_at from public.profiles order by created_at;
--
-- Remove someone's right to publish (take the id from the list above):
--   update public.profiles set is_member = false, is_gm = false where id = '<id>';
