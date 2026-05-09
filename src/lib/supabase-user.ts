import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseUrl = rawUrl.replace(/\/+$/, '');

/**
 * Supabase REST client scoped to the signed-in user (JWT in Authorization).
 * Use in API routes when the browser sends `Bearer <access_token>`.
 */
export function createUserSupabase(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    db: { schema: 'public' },
  });
}
