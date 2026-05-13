import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Server-only service-role client (bypasses RLS). Returns null if env is incomplete. */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}
