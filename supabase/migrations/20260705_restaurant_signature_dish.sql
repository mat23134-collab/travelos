-- Add the "signature dish" field to restaurant recommendations.
-- The one dish a first-timer must order, surfaced on the Smart Toolbar card.
alter table public.restaurant_recommendations
  add column if not exists signature_dish text;
