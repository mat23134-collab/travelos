-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-05-27 (g) — Curated Top Sights for the Step 7 onboarding card.
--
-- Adds two columns to `places`:
--   • top_pick_category — 'sightseeing' | 'history' | 'food' | NULL
--   • popularity_rank   — INT, lower = more popular (1 is top of its city/category)
--
-- Plus a composite index to make the (city, category, rank) lookup cheap.
--
-- Seeds 4 marquee destinations from the landing page with 4 picks per
-- category × 3 categories = 12 picks per city = 48 rows total. Real names
-- only — descriptions are short and copyright-safe paraphrases. Photo URLs
-- are left NULL; the /api/landmarks endpoint resolves them via Google
-- Places on first read and writes the result back to the photo_url column
-- so subsequent reads are free.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS top_pick_category text,
  ADD COLUMN IF NOT EXISTS popularity_rank   int;

ALTER TABLE public.places
  DROP CONSTRAINT IF EXISTS places_top_pick_category_check;

ALTER TABLE public.places
  ADD CONSTRAINT places_top_pick_category_check
  CHECK (top_pick_category IS NULL OR top_pick_category IN ('sightseeing', 'history', 'food'));

CREATE INDEX IF NOT EXISTS places_top_picks_idx
  ON public.places (lower(city), top_pick_category, popularity_rank)
  WHERE top_pick_category IS NOT NULL;

COMMENT ON COLUMN public.places.top_pick_category IS
  'Curated bucket for the Step 7 onboarding card: sightseeing | history | food. NULL = not a curated top sight.';
COMMENT ON COLUMN public.places.popularity_rank IS
  'Editorial popularity within (city, top_pick_category). Lower = more popular.';

-- ── Seed data ────────────────────────────────────────────────────────────────
-- Upsert pattern: INSERT … ON CONFLICT(lower(name),lower(city)) DO UPDATE.
-- The places_name_city_norm_key index from migration (f) handles conflict.

INSERT INTO public.places
  (name, city, category, description, category_emoji, vibe_label,
   top_pick_category, popularity_rank)
VALUES
  -- ── Rome ──────────────────────────────────────────────────────────────────
  ('Colosseum',          'Rome', 'attraction', 'Iconic ancient amphitheatre — book a timed entry to skip the queue.', '🏟️', 'classic', 'sightseeing', 1),
  ('Trevi Fountain',     'Rome', 'attraction', 'Baroque masterpiece best visited at dawn or after midnight.',         '⛲', 'classic', 'sightseeing', 2),
  ('Spanish Steps',      'Rome', 'attraction', 'The 18th-century stairway from Piazza di Spagna to Trinità dei Monti.', '🪜', 'classic', 'sightseeing', 3),
  ('Piazza Navona',      'Rome', 'attraction', 'Elegant baroque square anchored by Bernini''s Four Rivers fountain.',  '🏛️', 'classic', 'sightseeing', 4),
  ('Pantheon',           'Rome', 'attraction', '2,000-year-old temple with the world''s largest unreinforced dome.',   '🏛️', 'classic', 'history',     1),
  ('Roman Forum',        'Rome', 'attraction', 'Heart of ancient Rome — political, religious, and civic ruins.',       '🗺️', 'classic', 'history',     2),
  ('Vatican Museums',    'Rome', 'attraction', 'Sistine Chapel and centuries of papal collections — pre-book mornings.', '🖼️', 'classic', 'history',    3),
  ('Catacombs of San Callisto', 'Rome', 'attraction', 'Early-Christian underground burial galleries on the Appian Way.','🕯️', 'hidden-gem', 'history', 4),
  ('Felice a Testaccio', 'Rome', 'restaurant', 'Cacio e pepe institution — reservations essential for dinner.',        '🍝', 'local-favorite', 'food', 1),
  ('Roscioli',           'Rome', 'restaurant', 'Deli, salumeria, and wine bar serving an iconic carbonara.',           '🍷', 'local-favorite', 'food', 2),
  ('Pizzarium',          'Rome', 'restaurant', 'Bonci''s legendary pizza al taglio near the Vatican.',                 '🍕', 'viral-trend',    'food', 3),
  ('Gelateria del Teatro','Rome','restaurant', 'Artisan gelato tucked off Via dei Coronari.',                          '🍨', 'local-favorite', 'food', 4),

  -- ── Paris ─────────────────────────────────────────────────────────────────
  ('Eiffel Tower',       'Paris', 'attraction', 'Iron landmark with a top-deck view — sunset slots sell out weeks ahead.', '🗼', 'classic', 'sightseeing', 1),
  ('Louvre Museum',      'Paris', 'attraction', 'World''s most-visited museum — pre-book and target one wing per visit.',  '🏛️', 'classic', 'sightseeing', 2),
  ('Arc de Triomphe',    'Paris', 'attraction', 'Climb the roof for an axial view straight down the Champs-Élysées.',      '🏛️', 'classic', 'sightseeing', 3),
  ('Sacré-Cœur',         'Paris', 'attraction', 'White-domed basilica crowning Montmartre — go early for stillness.',      '⛪', 'classic', 'sightseeing', 4),
  ('Notre-Dame de Paris','Paris', 'attraction', 'Gothic cathedral on Île de la Cité, reopened after restoration.',         '⛪', 'classic', 'history',     1),
  ('Palace of Versailles','Paris','attraction', 'Day-trip to Louis XIV''s palace and gardens — train from RER C.',         '🏰', 'classic', 'history',     2),
  ('Sainte-Chapelle',    'Paris', 'attraction', 'Stained-glass chapel inside the medieval Conciergerie complex.',          '⛪', 'classic', 'history',     3),
  ('Musée d''Orsay',     'Paris', 'attraction', 'Impressionist masterpieces inside a Beaux-Arts railway station.',         '🖼️', 'classic', 'history',     4),
  ('Du Pain et des Idées','Paris','restaurant', 'Canal Saint-Martin bakery famous for its pain des amis loaf.',            '🥐', 'local-favorite', 'food', 1),
  ('Bouillon Chartier',  'Paris', 'restaurant', 'Historic 1896 brasserie serving classic French staples at fair prices.',  '🍽️', 'classic',        'food', 2),
  ('Pierre Hermé',       'Paris', 'restaurant', 'Macarons by the patissier behind every fashion-week dessert.',            '🍫', 'luxury-pick',    'food', 3),
  ('L''As du Fallafel',  'Paris', 'restaurant', 'Le Marais falafel queue — worth every minute.',                           '🥙', 'viral-trend',    'food', 4),

  -- ── London ────────────────────────────────────────────────────────────────
  ('Big Ben',            'London', 'attraction', 'Westminster''s clock tower restored to its original Victorian colours.', '🕰️', 'classic', 'sightseeing', 1),
  ('London Eye',         'London', 'attraction', 'Slow-rotating Thames-side observation wheel — 30-minute revolution.',    '🎡', 'classic', 'sightseeing', 2),
  ('Buckingham Palace',  'London', 'attraction', 'Royal residence — State Rooms open during late summer only.',           '👑', 'classic', 'sightseeing', 3),
  ('Tower Bridge',       'London', 'attraction', 'Victorian bascule bridge with a walkable glass-floor upper deck.',       '🌉', 'classic', 'sightseeing', 4),
  ('Tower of London',    'London', 'attraction', '1,000-year-old fortress holding the Crown Jewels.',                      '🏰', 'classic', 'history',     1),
  ('British Museum',     'London', 'attraction', 'Rosetta Stone, Parthenon Marbles, and millennia of artefacts — free.',   '🏛️', 'classic', 'history',     2),
  ('Westminster Abbey',  'London', 'attraction', 'Gothic abbey where every English monarch has been crowned since 1066.',  '⛪', 'classic', 'history',     3),
  ('St Paul''s Cathedral','London','attraction', 'Wren''s domed masterpiece — climb to the Whispering Gallery.',           '⛪', 'classic', 'history',     4),
  ('Borough Market',     'London', 'restaurant', 'South-bank food market — go on a Wednesday to avoid weekend crowds.',    '🛍️', 'local-favorite', 'food', 1),
  ('Dishoom',            'London', 'restaurant', 'Bombay-café homage — bacon naan rolls are the breakfast move.',          '🍛', 'viral-trend',    'food', 2),
  ('Padella',            'London', 'restaurant', 'Borough Market pasta queue — pici cacio e pepe is the order.',           '🍝', 'viral-trend',    'food', 3),
  ('The Wolseley',       'London', 'restaurant', 'Piccadilly café-restaurant in a 1920s former car showroom.',             '☕', 'classic',         'food', 4),

  -- ── Vienna ────────────────────────────────────────────────────────────────
  ('Schönbrunn Palace',  'Vienna', 'attraction', 'Habsburg summer palace and the famous gardens — book the Grand Tour.',   '🏰', 'classic', 'sightseeing', 1),
  ('Belvedere Palace',   'Vienna', 'attraction', 'Baroque palace holding Klimt''s "The Kiss" and an Austrian art trove.',  '🖼️', 'classic', 'sightseeing', 2),
  ('Vienna State Opera', 'Vienna', 'attraction', 'See a same-day standing-room ticket for under €15 from the side door.',  '🎭', 'classic', 'sightseeing', 3),
  ('Prater & Riesenrad', 'Vienna', 'attraction', 'Public park crowned by the 1897 Ferris wheel from "The Third Man".',     '🎡', 'classic', 'sightseeing', 4),
  ('St Stephen''s Cathedral', 'Vienna', 'attraction', 'Gothic cathedral with a multi-colored tiled roof — climb the tower.','⛪', 'classic', 'history',    1),
  ('Hofburg',            'Vienna', 'attraction', 'Imperial winter palace — Sisi Museum and the Spanish Riding School.',    '🏛️', 'classic', 'history',     2),
  ('Albertina',          'Vienna', 'attraction', 'Hapsburg palace turned modern museum — strong Monet to Picasso wing.',   '🖼️', 'classic', 'history',     3),
  ('Karlskirche',        'Vienna', 'attraction', 'Baroque church with an elevator climbing into its painted dome.',        '⛪', 'classic', 'history',     4),
  ('Café Central',       'Vienna', 'restaurant', 'Imperial-era coffee house once frequented by Trotsky and Freud.',        '☕', 'classic',        'food', 1),
  ('Demel',              'Vienna', 'restaurant', 'Old-world pastry house known for Sachertorte and candied violets.',      '🍰', 'classic',        'food', 2),
  ('Figlmüller',         'Vienna', 'restaurant', 'Plate-sized Wiener schnitzel since 1905 — Wollzeile is the original.',   '🍽️', 'classic',        'food', 3),
  ('Trzesniewski',       'Vienna', 'restaurant', 'Hundred-year-old finger-sandwich counter — order six and a Pfiff beer.', '🥪', 'local-favorite', 'food', 4)

ON CONFLICT (lower(name), lower(city)) DO UPDATE
  SET top_pick_category = EXCLUDED.top_pick_category,
      popularity_rank   = EXCLUDED.popularity_rank,
      description       = COALESCE(EXCLUDED.description, public.places.description),
      category_emoji    = COALESCE(EXCLUDED.category_emoji, public.places.category_emoji),
      vibe_label        = COALESCE(EXCLUDED.vibe_label,   public.places.vibe_label);
