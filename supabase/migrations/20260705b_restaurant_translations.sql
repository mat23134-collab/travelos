-- Localized restaurant text per site language (currently en + he).
-- Keyed by language code:
--   { "en": { "description": ..., "cuisineStyle": ..., "signatureDish": ... },
--     "he": { ... } }
-- The scalar description/cuisine_style/signature_dish columns remain the
-- English fallback for older rows and non-localized reads.
alter table public.restaurant_recommendations
  add column if not exists translations jsonb;
