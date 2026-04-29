import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing env vars — NEXT_PUBLIC_SUPABASE_URL:',
    supabaseUrl ? '✓ set' : '✗ MISSING',
    '| NEXT_PUBLIC_SUPABASE_ANON_KEY:',
    supabaseAnonKey ? '✓ set' : '✗ MISSING',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
