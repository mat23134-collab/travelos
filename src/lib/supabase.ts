import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Strip any accidental trailing slash — Supabase SDK appends /rest/v1/... itself
const supabaseUrl = rawUrl.replace(/\/+$/, '');

console.log(
  '[supabase] init — URL:',
  supabaseUrl ? supabaseUrl.replace(/^(https:\/\/[^.]+).*/, '$1…supabase.co') : '✗ MISSING',
  '| KEY:', supabaseAnonKey ? '✓ set (' + supabaseAnonKey.slice(0, 6) + '…)' : '✗ MISSING',
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
