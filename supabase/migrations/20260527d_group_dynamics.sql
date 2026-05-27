-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-05-27 (d) — Add group_dynamics JSONB to user_trip_choices.
--
-- group_type alone ('couple', 'family', etc.) is too coarse to produce
-- cinema-level personalisation. This new JSONB field stores the sub-segment
-- the user selects in the VibeSection's second question:
--
--   Solo   → { "subType": "digital-nomad" | "deep-recharge" | "adventure" }
--   Couple → { "subType": "romantic" | "parent-child" | "reconnecting" }
--   Family → { "subType": "young-kids" | "mixed-ages" | "teens" }
--              (derived from FamilyKidsByAge, not a direct user pick)
--   Group  → { "subType": "best-friends" | "mixed-ages" | "work-crew" }
--
-- Nullable — old rows have no dynamics and fall back to existing logic.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_trip_choices
  ADD COLUMN IF NOT EXISTS group_dynamics jsonb DEFAULT NULL;
