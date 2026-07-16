# Migrations runbook

## Adding a column that a route/query depends on

**Never ship the schema change and the code that reads it in the same deploy.**
A deploy can reach production before its migration does; a route that `SELECT`s
or `ORDER BY`s a not-yet-existing column then errors for every request.

Use the **Expand → Backfill → Verify → Contract** sequence, as four *separate*
deploys/steps:

1. **Expand** — apply the migration *alone*. Add the column **nullable, no
   default, no `NOT NULL`** so it's inert for all existing code. Do not bundle
   any route change in this deploy.
2. **Backfill** — run a one-off maintenance **script** (not a route handler,
   never triggered by a user request) that populates the new column for every
   existing row, reusing the same functions the write path uses so backfilled
   and freshly-written rows are identical.
3. **Verify** — query production directly and confirm the backfill is complete
   (e.g. `SELECT count(*) FROM t WHERE new_col IS NULL;` returns `0`). Report
   this from an actual query result, not from the script exiting cleanly.
4. **Contract** — only now deploy the code that depends on the column. Keep a
   **permanent fallback** in the read path (order/read defensively so a missing
   column degrades instead of erroring) as a safety net for future rollouts.

### Worked example — `restaurant_recommendations.composite_score` (2026-07)

- **Expand:** `supabase/migrations/20260716_book_ahead_restaurant_engine.sql` —
  added `composite_score`, `bayes_rating`, `cuisine_genre`, `book_ahead_level`,
  etc. all nullable.
- **Backfill:** `scripts/backfill-restaurant-composite.ts` — computes
  `composite_score`/`bayes_rating` via `computeCompositeScore()` /
  `bayesRating()` (the exact functions the scout uses), per-city Bayesian mean.
- **Verify:** `SELECT count(*) FROM restaurant_recommendations WHERE
  composite_score IS NULL;` → `0`.
- **Contract:** `fetchRestaurantsForCity()` orders by `composite_score`, with a
  permanent fallback to the legacy `score` ordering if the ordered query errors.
