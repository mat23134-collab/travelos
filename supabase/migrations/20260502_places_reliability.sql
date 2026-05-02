-- Reliability columns for the Janitor verification workflow
ALTER TABLE places ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
ALTER TABLE places ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unverified'
  CHECK (status IN ('open', 'closed', 'renovating', 'unverified'));

-- Index for efficient janitor queries (finds stale places fast)
CREATE INDEX IF NOT EXISTS idx_places_last_verified_at ON places (last_verified_at ASC NULLS FIRST);
