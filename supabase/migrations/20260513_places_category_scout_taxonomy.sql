-- Scout agent category labels (see scripts/scout-agent.ts generateScoutCategoryQueries / extraction).
-- Column stays plain text — legacy rows may still use older labels (cafe, market, nightlife, …).
COMMENT ON COLUMN public.places.category IS
  'Venue type. Scout writes: tourism_site | attraction | restaurant | bar. Older rows may use other text.';
