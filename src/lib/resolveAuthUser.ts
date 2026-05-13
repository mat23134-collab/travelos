import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ResolvedTraveler = {
  userId: string | null;
  username: string | null;
};

/**
 * Prefer Supabase Auth from `Authorization: Bearer <access_token>`.
 * Falls back to `bodyUserId` and loads `profiles.username` with the service client.
 */
export async function resolveAuthenticatedTraveler(
  req: NextRequest,
  dbService: SupabaseClient,
  bodyUserId: string | null | undefined,
): Promise<ResolvedTraveler> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();

  const loadUsername = async (uid: string): Promise<string | null> => {
    const { data, error } = await dbService.from('profiles').select('username').eq('id', uid).maybeSingle();
    if (error) {
      console.warn('[resolveAuthUser] profiles select:', error.message);
      return null;
    }
    const u = data?.username;
    return typeof u === 'string' && u.trim() ? u.trim() : null;
  };

  if (token && url && anon) {
    const authClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await authClient.auth.getUser(token);
    if (!error && user?.id) {
      const username = await loadUsername(user.id);
      return { userId: user.id, username };
    }
  }

  const fallback = typeof bodyUserId === 'string' ? bodyUserId.trim() : '';
  if (fallback) {
    const username = await loadUsername(fallback);
    return { userId: fallback, username };
  }

  return { userId: null, username: null };
}
