import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');
  const next  = searchParams.get('next') ?? '/dashboard';

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth?error=${encodeURIComponent('Google sign-in was cancelled or failed.')}`,
    );
  }

  if (code) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key  = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? '';
    const redirectResponse = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll:  () => cookies().getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            redirectResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeErr) {
      // Ensure profile row exists (same path as email/password signup)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch(`${origin}/api/auth/ensure-profile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }
      return redirectResponse;
    }
  }

  return NextResponse.redirect(
    `${origin}/auth?error=${encodeURIComponent('Google sign-in failed. Please try again.')}`,
  );
}
