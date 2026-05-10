-- Sign-up fails with "Database error saving new user" when a trigger on
-- auth.users tries to INSERT into public.profiles but hits RLS (auth.uid() is
-- NULL inside triggers), duplicate triggers, or a legacy schema mismatch.
--
-- We disable profile bootstrap triggers and create rows idempotently from the
-- app via POST /api/auth/ensure-profile using the user's JWT (RLS: insert own row).

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
