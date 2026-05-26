-- Legal consent audit log: terms, privacy, cookies/local-storage consent.
-- Run in Supabase SQL editor or via migrations.

create table if not exists public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users (id) on delete set null,
  consent_version text not null,
  accepted_terms boolean not null default false,
  accepted_privacy boolean not null default false,
  essential_cookies boolean not null default true,
  preferences_cookies boolean not null default false,
  analytics_cookies boolean not null default false,
  user_agent text null,
  ip_address inet null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint legal_consents_required_acceptance
    check (accepted_terms and accepted_privacy and essential_cookies)
);

create index if not exists legal_consents_user_accepted_idx
  on public.legal_consents (user_id, accepted_at desc);

create index if not exists legal_consents_version_idx
  on public.legal_consents (consent_version, accepted_at desc);

alter table public.legal_consents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'legal_consents'
      and policyname = 'legal_consents_select_own'
  ) then
    create policy legal_consents_select_own
      on public.legal_consents
      for select
      using (auth.uid() = user_id);
  end if;
end $$;
