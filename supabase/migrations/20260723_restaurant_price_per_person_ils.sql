alter table public.restaurant_recommendations
  add column if not exists price_per_person_ils numeric;

comment on column public.restaurant_recommendations.price_per_person_ils is
  'Estimated per-person meal cost in ILS (Israeli shekels), computed by the scout at write time (Gemini''s own currency-conversion estimate). Source of truth for the panel''s 4 price tiers (cheap/mid/premium/luxury), replacing Google''s coarse 1-4 price_level for that purpose. Nullable — older/unverified rows may not have it yet.';
