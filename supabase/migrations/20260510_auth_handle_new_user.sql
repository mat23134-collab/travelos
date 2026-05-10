-- Fix "Database error saving new user" on sign-up.
--
-- Typical causes after adding public.profiles.username (NOT NULL + RLS):
--   1. Legacy handle_new_user() inserts columns that no longer match the schema.
--   2. Trigger runs without SECURITY DEFINER / wrong owner so RLS blocks INSERT
--      (auth.uid() is NULL inside the trigger — profiles_insert_own fails).
--
-- This replaces the profile bootstrap with a SECURITY DEFINER function owned by
-- postgres (bypasses RLS) and reads username from auth.users.raw_user_meta_data.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  un text;
  fallback text;
BEGIN
  un := NULLIF(trim(lower(COALESCE(NEW.raw_user_meta_data->>'username', ''))), '');
  IF un IS NULL OR char_length(un) < 3 THEN
    fallback := 'u' || substring(replace(NEW.id::text, '-', '') FROM 1 FOR 23);
    un := fallback;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, un)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      -- Rare: chosen username taken between availability check and insert.
      fallback := 'u' || substring(replace(NEW.id::text, '-', '') FROM 1 FOR 23);
      INSERT INTO public.profiles (id, username)
      VALUES (NEW.id, fallback)
      ON CONFLICT (id) DO NOTHING;
  END;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- Single canonical trigger (dashboard duplicates often cause double-insert failures).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
