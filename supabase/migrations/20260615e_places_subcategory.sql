-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-06-15 (e) — Fine-grained subcategory for intra-day variety (ADR-001).
--
-- category is too coarse for the assembler's variety rule ("don't put 3 museums
-- in one day"). subcategory gives a finer type derived FREE from the venue name
-- (authoritative), with a conservative description fallback for leftovers.
--
-- Buckets: museum, gallery, religious, park, palace, historic_site, square,
-- bridge, viewpoint, landmark, market, beach, nature, district, entertainment,
-- sight_other; food/hotel rows mirror their coarse category.
--
-- Lesson baked in: matching on description text mis-tags venues (a place whose
-- blurb mentions a nearby church, "ancient", or "villa"), so NAME is matched
-- first and description is only a fallback for rows still 'sight_other'.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.places ADD COLUMN IF NOT EXISTS subcategory text;

-- Pass 1: classify by NAME.
WITH base AS (
  SELECT id, lower(coalesce(name,'')) AS t
  FROM public.places
  WHERE lower(category) IN ('attraction','tourism_site','nature','market','shopping')
)
UPDATE public.places p SET subcategory = CASE
  WHEN b.t ~* '(museum|museo|mus[eé]e)' THEN 'museum'
  WHEN b.t ~* '(gallery|galleria|galerie)' THEN 'gallery'
  WHEN b.t ~* '(cathedral|basilica|duomo|\ychurch\y|chiesa|chapel|abbey|monaster|mosque|\ytemple\y|synagog|shrine|sanctuar)' THEN 'religious'
  WHEN b.t ~* '(\ygarden\y|gardens|giardini|botanical|\ypark\y|parco)' THEN 'park'
  WHEN b.t ~* '(palace|palazzo|castle|castello|fortress|citadel|chateau|\yvilla\y|\ycastel\y)' THEN 'palace'
  WHEN b.t ~* '(\yforum\y|\yforo\y|ruins|archaeolog|catacomb|amphitheat|colosseo|colosseum|necropolis|palatine|\yterme\y|baths of|circus maximus)' THEN 'historic_site'
  WHEN b.t ~* '(piazza|\ysquare\y|plaza|\ylargo\y|\ycampo\y)' THEN 'square'
  WHEN b.t ~* '(bridge|ponte)' THEN 'bridge'
  WHEN b.t ~* '(\ytower\y|viewpoint|observation|panoram|belvedere|lookout|terrazza)' THEN 'viewpoint'
  WHEN b.t ~* '(fountain|fontana|\ysteps\y|scalinata|\ygate\y|\yarch\y|\yarco\y|obelisk|statue|monument|memorial)' THEN 'landmark'
  WHEN b.t ~* '(market|bazaar|mercato)' THEN 'market'
  WHEN b.t ~* '(beach|spiaggia|seaside|\ylido\y)' THEN 'beach'
  WHEN b.t ~* '(mountain|\ylake\y|forest|waterfall|\yfalls\y|\ycave\y|cliff|volcano)' THEN 'nature'
  WHEN b.t ~* '(neighbo|quarter|quartiere|district|street art)' THEN 'district'
  WHEN b.t ~* '(theat|stadium|arena|\yzoo\y|aquarium|amusement|ferris|opera house)' THEN 'entertainment'
  ELSE 'sight_other'
END
FROM base b WHERE p.id = b.id;

-- Pass 2: conservative description fallback for still-unclassified rows.
WITH base2 AS (
  SELECT id, lower(coalesce(description,'')) AS d
  FROM public.places
  WHERE lower(category) IN ('attraction','tourism_site','nature','market','shopping')
    AND subcategory = 'sight_other'
)
UPDATE public.places p SET subcategory = CASE
  WHEN b.d ~* '(\ymuseum\y)' THEN 'museum'
  WHEN b.d ~* '(cathedral|basilica|\ychurch\y|chapel|mosque|\ytemple\y|shrine)' THEN 'religious'
  WHEN b.d ~* '(\ygarden\y|gardens|\ypark\y)' THEN 'park'
  WHEN b.d ~* '(ruins|archaeolog|\yancient\y|amphitheat|catacomb)' THEN 'historic_site'
  WHEN b.d ~* '(panoram|viewpoint|observation deck)' THEN 'viewpoint'
  ELSE 'sight_other'
END
FROM base2 b WHERE p.id = b.id;

-- Food + hotel rows mirror their coarse category.
UPDATE public.places SET subcategory = lower(category)
WHERE lower(category) IN ('restaurant','cafe','bar','nightlife','hotel') AND subcategory IS NULL;
