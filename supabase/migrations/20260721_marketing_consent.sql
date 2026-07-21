-- ─────────────────────────────────────────────────────────────────────────────
-- Marketing consent — explicit opt-in for promotional email, tracked separately
-- from the required Terms/Privacy/Cookie consent (legal_consents).
--
-- Israel's Communications Law (Bezeq and Broadcasts) Amendment (Section 30א,
-- the "anti-spam law") requires PRIOR, EXPLICIT, FREELY-GIVEN opt-in consent
-- before sending advertising by email/SMS/fax/auto-dialer, kept separate from
-- any other agreement (no bundling with Terms acceptance), and the sender must
-- be able to PROVE consent was given (and honor withdrawal immediately). This
-- migration adds the query-friendly current-state flag plus an audit trail:
--
--   • profiles.marketing_opt_in / marketing_opt_in_updated_at — the current
--     decision (null = never asked/decided; true/false = explicit answer),
--     cheap to filter on when a send pipeline exists later.
--   • marketing_consents — append-only history of every opt-in/opt-out event
--     (source, channels, consent copy version, IP, user agent, timestamp) —
--     the actual proof-of-consent record. Unlike legal_consents this always
--     ties to a real account (you need an email/account to market to), so
--     user_id is NOT NULL and cascades on account deletion.
--
-- Expand step: both changes are purely additive (nullable column + a new
-- table with no dependents). No backfill of existing rows — every current user
-- correctly starts at marketing_opt_in = null ("not yet asked"), which is
-- exactly the state that drives the re-prompt for pre-existing accounts.
-- Verify = column + table present, RLS on, 0 policies, before shipping code
-- that depends on them.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists marketing_opt_in boolean;
alter table public.profiles add column if not exists marketing_opt_in_updated_at timestamptz;

create table if not exists public.marketing_consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  opted_in      boolean not null,
  channels      text[] not null default '{email}',
  source        text not null check (source in ('signup','dashboard_prompt','settings')),
  consent_version text not null,
  user_agent    text,
  ip_address    inet,
  created_at    timestamptz not null default now()
);

create index if not exists marketing_consents_user_idx on public.marketing_consents (user_id, created_at desc);

alter table public.marketing_consents enable row level security;
