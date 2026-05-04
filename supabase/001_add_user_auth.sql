-- ─────────────────────────────────────────────────────────────────────────────
-- TravelOS — Stage 3: Persistence
-- Run this in your Supabase project → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add user_id column (nullable so existing anonymous itineraries still work)
ALTER TABLE itineraries
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Index for fast per-user dashboard queries
CREATE INDEX IF NOT EXISTS itineraries_user_id_idx
  ON itineraries (user_id)
  WHERE user_id IS NOT NULL;

-- 3. Enable Row Level Security
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
--    READ:   anyone with the UUID can read (URLs are effectively private links)
--    INSERT: anyone can insert (server-side API uses anon key, user_id may be null)
--    UPDATE: only the owner can update their own itinerary
--    DELETE: only the owner can delete their own itinerary

CREATE POLICY "public_read_by_id"
  ON itineraries FOR SELECT
  USING (true);

CREATE POLICY "allow_all_inserts"
  ON itineraries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "owner_update"
  ON itineraries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "owner_delete"
  ON itineraries FOR DELETE
  USING (auth.uid() = user_id);
