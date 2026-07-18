-- ─────────────────────────────────────────────────────────────────────────────
-- neighborhood_guide_cache — persistent cache for the Dynamic Neighborhood
-- Profiler's synthesized guides.
--
-- WHY: building one guide fires three paid APIs in sequence (Tavily + Exa +
-- Gemini). Without persistence every render / reload / cold serverless instance
-- re-synthesizes the same guide from scratch — slow and expensive. This caches
-- the finished NeighborhoodProfile JSON keyed by a stable signature of the day
-- (city + rounded POI geometry + trip context), so repeat views are a single
-- fast DB read and zero external calls.
--
-- Written ONLY by the server via the service-role client (bypasses RLS), so RLS
-- is enabled with no policies — anon/authenticated cannot read or poison it.
-- Freshness via `expires_at`: reads filter it out past TTL, so stale grounding
-- (secrets / safety) refreshes on its own without a cron.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.neighborhood_guide_cache (
  cache_key         text primary key,
  city              text not null,
  neighborhood_name text,
  profile           jsonb not null,          -- the full NeighborhoodProfile payload
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null
);

-- Cheap lookup for "still-fresh entry for this key".
create index if not exists neighborhood_guide_cache_expires_idx
  on public.neighborhood_guide_cache (expires_at);

-- Locked down: only the service-role client touches this table.
alter table public.neighborhood_guide_cache enable row level security;
