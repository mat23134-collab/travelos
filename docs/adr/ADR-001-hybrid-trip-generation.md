# ADR-001: Hybrid Trip Generation — Deterministic Assembler with LLM Fallback

**Status:** Proposed
**Date:** 2026-06-15
**Deciders:** Tomer (eng), TravelOS product
**Supersedes:** N/A

## Context

Every trip generation today calls an LLM (`/api/generate` — Gemini primary, Claude
fallback), even when the destination is already well covered by our warm cache.
This costs money (tokens) and latency on every request, including repeat cities.

We already have substantial caching infrastructure:

- **`places`** (1,973 rows, ~25 cities) — venue warm cache. Already carries
  `category`, `lat`/`lng`, `google_rating`, `popularity_rank`, `top_pick_category`,
  and the tag arrays `vibe[]`, `group_suitability[]`, `culinary_focus[]`, plus
  Google-verified `photo_url` / `website_url` / `google_place_id`.
- **`scout-agent.ts`** — populates `places` per city using **Gemini, not Claude**,
  so seeding the cache does not consume our expensive token budget.
- **`web_search_cache`** — per-city/month cache that "avoids 5–7 paid API calls
  per generation."
- **`/api/generate`** — already pulls filtered inventory from `places`
  (`getFilteredInventory` / `formatAvailableInventoryForSystemPrompt`), feeds it to
  the LLM as a soft preference, and writes new venues back (`persistVenuesToCache`).

So venues are cached, but the **assembly of those venues into a day-by-day
itinerary still requires an LLM call**. That assembly step is the remaining cost.

### Forces at play

- Cost & latency: eliminate LLM calls for well-covered cities.
- Freshness: a cached *trip* goes stale (venues close, hours change); a cached
  *venue inventory* is already maintained by scout/janitor.
- Personalization: itineraries vary by duration, group type, budget, pace,
  interests, dates, and hotel — a large parameter space.
- Coverage: only ~25 cities have deep inventory; the rest must still work.
- Quality: the LLM currently writes human-readable narrative, not just a venue list.

## Decision

Adopt a **hybrid generator**:

1. **Deterministic assembler (preferred path).** For a destination with enough
   classified, verified inventory, build the itinerary in code — filter `places`
   by suitability/budget, score, cluster geographically into days, fill slots
   under variety/pacing/opening-hours rules, and anchor to the hotel as a
   post-step. **Zero LLM tokens.**
2. **LLM fallback (existing path).** When a city lacks sufficient inventory, fall
   through to today's `/api/generate` flow unchanged.
3. **Narrative as a dial.** Assembler output is rendered to prose by templates
   (zero tokens). An optional, flag-gated single **Gemini** polish pass can rewrite
   the templated text into flowing prose where quality matters.

An **inventory-threshold gate** decides assembler vs. fallback per request.

We explicitly reject the alternative of caching whole generated itineraries keyed
by trip parameters (the "blueprint cache") — see Options Considered.

## Options Considered

### Option A: Blueprint cache (cache the whole generated itinerary)

Store generated itineraries keyed by a signature of the trip parameters; on a
matching request, hydrate and return without an LLM call.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Low *if* hit rate is high |
| Scalability | Poor — combinatorial key space |
| Freshness | Poor — baked-in venues go stale |
| Team familiarity | High |

**Pros:** Conceptually simple; biggest possible saving on an exact repeat.
**Cons:** Parameter space (city × duration × group × budget × pace × interest set
× dates × hotel …) makes exact-match hit rate near zero; a normalized key throws
away personalization; cached trips reference specific venues that close, so they
need TTL + invalidation; does not reuse the inventory we already scout.

### Option B: Deterministic assembler (build the trip in code from classified places)

Assemble itineraries algorithmically from the `places` inventory. No itinerary
caching; the *venue* cache is the source of truth.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium–High (algorithm + schema additions) |
| Cost | Very low — zero tokens on the assembler path |
| Scalability | Excellent — handles any parameter combo |
| Freshness | Excellent — built fresh from maintained inventory |
| Team familiarity | Medium |

**Pros:** No combinatorial key problem; always fresh; reuses inventory we already
Gemini-scout; deterministic and testable; every venue is pre-verified (GPS,
photos).
**Cons:** Cold start — only works where inventory is deep enough; must re-implement
in code the judgement the LLM did for free (variety, slotting, hours, pacing,
narrative).

### Option C: Hybrid — assembler when inventory is deep, LLM otherwise (CHOSEN)

Run Option B when the gate passes; fall back to the existing LLM path when it
doesn't. Optional Gemini pass for narrative polish only.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium–High |
| Cost | Very low on covered cities; unchanged elsewhere |
| Scalability | Excellent |
| Freshness | Excellent |
| Team familiarity | Medium |

**Pros:** Captures the token/latency win where coverage exists, with no regression
on uncovered cities; degrades gracefully; lets us expand coverage city-by-city via
the existing scout.
**Cons:** Two code paths to maintain; need a clear gate and parity in output shape
so downstream UI is identical regardless of path.

## Trade-off Analysis

The decisive factor is the **key-space problem**. Caching whole trips (A) only pays
off on near-identical repeat requests, which are rare given how many parameters
vary; and the cached artifact rots because it embeds specific venues. The
assembler (B/C) caches at the *venue* level — far fewer, more stable, and already
maintained — and recomputes the cheap assembly per request. That keeps results
fresh and personalized while still removing the LLM call.

The cost of B/C is re-implementing the LLM's implicit judgement. Each piece is
tractable: variety and pacing are algorithm rules; slotting and suitability are
data + filters; opening hours are data (with a maintenance cost); narrative is
templating (with an optional paid polish). None requires the LLM at request time.

Hybrid (C) over pure assembler (B) because coverage is currently ~25 cities; the
fallback guarantees no city regresses while we grow the cache.

## Schema Additions (`public.places`)

Most classification already exists. Add the following:

| Column | Type | Purpose |
|--------|------|---------|
| `price_tier` | `smallint` (1–4) or `text` enum (`budget`/`mid`/`comfort`/`luxury`) | Budget filtering; align with `BudgetLevel` / `HotelNightlyBudget` vocab. |
| `meal_slots` | `text[]` | Which meal slots a food venue suits: `breakfast`/`brunch`/`lunch`/`dinner`. Non-food venues leave empty. |
| `opening_hours` | `jsonb` | Per-weekday open/close so the algorithm can check the actual trip dates. Lighter alternatives if maintenance is too heavy: `closed_days text[]` or `best_time_of_day text`. |
| `suitability` | `text[]` (or keep using `group_suitability[]`) | Standardize the vocabulary: `kids`, `couples`, `solo`, `groups`. Prefer extending the existing `group_suitability[]` rather than a new column, to avoid duplication. |

Notes:
- `variety` is **not** a column — it is enforced in the algorithm (dedupe venues
  across the trip; spread categories within a day).
- `opening_hours` is the only field that goes stale; `scout-agent.ts` (and the
  janitor re-verify pass) must populate and periodically refresh it, or we accept
  a coarser, cheaper signal.

## Day-Building Algorithm (assembler)

1. **Gate.** Count verified, classified `places` for the city. If below a per-trip
   threshold (function of `duration` × slots/day, with headroom so a 7-day trip
   doesn't repeat venues), return `null` → caller uses the LLM fallback.
2. **Filter.** Select candidate places by city + `suitability` (group type) +
   `price_tier` (budget) + interest match (`vibe`/`culinary_focus`/`category`),
   dropping venues closed for the whole trip window.
3. **Score & rank.** Combine `google_rating`, `popularity_rank`, `top_pick_category`,
   and tag-match strength (reuse the existing scoring engine where possible).
4. **Cluster by geography.** Group nearby places (haversine on stored `lat`/`lng`
   — no external API) into `duration` day-clusters so each day is walkable.
5. **Fill slots.** For each day, place activities into morning/afternoon/evening
   and food venues into breakfast/lunch/dinner using `meal_slots`. Enforce:
   - **Variety:** no venue repeats across the trip; avoid same-category back-to-back.
   - **Pacing:** slots/day from `pace` (e.g. relaxed ≈ 4, moderate ≈ 5–6,
     intense ≈ 7+); pace may also widen gaps between stops.
   - **Hours:** only schedule a venue on a day it is open.
6. **Hotel as post-step.** Build day clusters independently of the hotel. When the
   hotel is known, order each day's stops by proximity to it and/or assign clusters
   to days; until then, anchor to the city centroid. The hotel is never a
   prerequisite for assembly.
7. **Render narrative** (see below) and return in the **exact same itinerary shape**
   the LLM path produces, so the UI and persistence are path-agnostic.

## Narrative Strategy

- **Per-place copy:** use the stored `places.description` (free).
- **Transitions & day summaries:** template strings driven by computed data —
  haversine distance → `"a 7-minute walk away"`, slot → `"To start your
  afternoon…"`. Zero tokens.
- **Optional polish tier (flag-gated):** one **Gemini** pass per itinerary that
  rewrites the templated text into flowing prose. Off by default so the assembler
  path stays zero-token; turn on where narrative quality is worth a cheap call.

## Consequences

**Easier**
- Covered cities generate with zero LLM tokens and low latency.
- Results stay fresh and personalized; no trip-level cache to invalidate.
- Coverage grows simply by scouting more cities (existing Gemini pipeline).
- Deterministic output is unit-testable.

**Harder**
- Two generation paths to keep at output parity.
- New maintenance burden for `opening_hours` freshness.
- Variety/pacing/slotting logic must be carefully tuned to match perceived quality.

**To revisit**
- The inventory threshold (tune against real city inventories — Rome 122 is ample,
  Berlin 30 may not be for long trips).
- Whether to default the Gemini narrative polish on once cost is measured.
- Whether to drop the LLM fallback entirely once coverage is broad enough.

## Action Items

1. [ ] Migration: add `price_tier`, `meal_slots`, `opening_hours`; extend
       `group_suitability[]` vocabulary (`kids`/`couples`/`solo`/`groups`).
2. [ ] Extend `scout-agent.ts` (Gemini) to populate the new columns and backfill
       existing rows.
3. [ ] Implement the assembler module (filter → score → cluster → slot → hotel
       post-step) returning the standard itinerary shape.
4. [ ] Implement the inventory-threshold gate and wire it into `/api/generate`
       before the LLM call.
5. [ ] Implement the template narrative renderer; add a flag-gated Gemini polish
       pass.
6. [ ] Unit tests: variety (no repeats), pacing counts, hours compliance,
       slot-type correctness, hotel ordering, centroid fallback.
7. [ ] Shadow/parity check: run assembler and LLM on the same inputs for covered
       cities and compare output quality before enabling in production.
