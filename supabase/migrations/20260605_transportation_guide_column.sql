-- Add the guide JSONB column used by upsertTransportationGuide / fetchTransportGuideForCity.
-- city_norm is already a generated column: lower(btrim(city_name)) with a unique index,
-- so no trigger is needed — Postgres computes it automatically on every insert/update.
ALTER TABLE public.transportation
  ADD COLUMN IF NOT EXISTS guide jsonb;
