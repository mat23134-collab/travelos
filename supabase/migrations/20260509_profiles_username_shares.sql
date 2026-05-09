-- Usernames (signup) + share trips with another user by username
--
-- NOTE: Supabase starter projects often already have public.profiles WITHOUT
-- a "username" column. CREATE TABLE IF NOT EXISTS then skips — and the index
-- on username fails. This migration creates the table OR patches the existing one.

-- ── profiles (create OR add username to existing template table) ─────────────
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'profiles'
  ) then
    create table public.profiles (
      id uuid primary key references auth.users (id) on delete cascade,
      username text not null,
      created_at timestamptz not null default now(),
      constraint profiles_username_len check (char_length(username) between 3 and 24),
      constraint profiles_username_chars check (username ~ '^[a-z0-9_]+$')
    );
  else
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
    ) then
      alter table public.profiles add column username text;
      -- Deterministic unique slug from user id (hex, 3–24 chars, valid for app regex)
      update public.profiles
      set username = 'u' || substr(replace(id::text, '-', ''), 1, 23)
      where username is null or btrim(username) = '';
      alter table public.profiles alter column username set not null;
    end if;

    alter table public.profiles drop constraint if exists profiles_username_len;
    alter table public.profiles drop constraint if exists profiles_username_chars;
    alter table public.profiles
      add constraint profiles_username_len check (char_length(username) between 3 and 24);
    alter table public.profiles
      add constraint profiles_username_chars check (username ~ '^[a-z0-9_]+$');
  end if;
end $$;

-- created_at (only if we are patching an old table that never had it)
alter table public.profiles add column if not exists created_at timestamptz not null default now();

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_all'
  ) then
    create policy profiles_select_all on public.profiles for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles for update using (auth.uid() = id);
  end if;
end $$;

-- ── itinerary_shares (recipient sees trip on their dashboard) ───────────────
create table if not exists public.itinerary_shares (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  shared_with_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (itinerary_id, shared_with_user_id)
);

create index if not exists itinerary_shares_recipient_idx
  on public.itinerary_shares (shared_with_user_id, created_at desc);

create index if not exists itinerary_shares_itinerary_idx
  on public.itinerary_shares (itinerary_id);

alter table public.itinerary_shares enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'itinerary_shares' and policyname = 'itinerary_shares_insert_owner'
  ) then
    create policy itinerary_shares_insert_owner on public.itinerary_shares for insert
      with check (
        exists (
          select 1 from public.itineraries i
          where i.id = itinerary_id and i.user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'itinerary_shares' and policyname = 'itinerary_shares_select_involved'
  ) then
    create policy itinerary_shares_select_involved on public.itinerary_shares for select
      using (
        shared_with_user_id = auth.uid()
        or exists (
          select 1 from public.itineraries i
          where i.id = itinerary_id and i.user_id = auth.uid()
        )
      );
  end if;
end $$;
