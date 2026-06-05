-- Allow public (anon) reads on the transportation table.
-- Transportation data is city-level, non-sensitive, and must be readable
-- by the anon Supabase client used in GET /api/transportation.
CREATE POLICY "transportation_select_public"
  ON public.transportation
  FOR SELECT
  USING (true);
