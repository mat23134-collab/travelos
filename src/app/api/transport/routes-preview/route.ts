import { NextRequest, NextResponse } from 'next/server';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';

type ComputeRoutesBody = {
  routes?: Array<{ duration?: string }>;
};

function parseDurationSeconds(duration: string | undefined): number | null {
  if (!duration || typeof duration !== 'string') return null;
  const m = /^(\d+)s$/.exec(duration.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * POST /api/transport/routes-preview
 * Body: { originLat: number, originLng: number, city: string }
 * Uses Google Routes API v2 (TRANSIT) from hotel anchor to a generic city-center waypoint.
 * Env: GOOGLE_ROUTES_API_KEY or GOOGLE_MAPS_API_KEY (same key if Routes API is enabled on the project).
 */
export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as {
    originLat?: unknown;
    originLng?: unknown;
    city?: string;
  } | null;

  const city = body?.city?.trim() ?? '';
  const lat = Number(body?.originLat);
  const lng = Number(body?.originLng);
  if (!city || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'city, originLat, and originLng are required' }, { status: 400 });
  }

  const apiKey =
    process.env.GOOGLE_ROUTES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    '';
  if (!apiKey) {
    return NextResponse.json({ error: 'No Google Routes API key configured' }, { status: 503 });
  }

  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: lat, longitude: lng } } },
      destination: { address: `City center, ${city}` },
      travelMode: 'TRANSIT',
      languageCode: 'en',
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.warn('[routes-preview]', res.status, text.slice(0, 400));
    return NextResponse.json(
      { error: 'Routes API error' },
      { status: res.status === 403 ? 403 : 502 },
    );
  }

  let data: ComputeRoutesBody;
  try {
    data = JSON.parse(text) as ComputeRoutesBody;
  } catch {
    return NextResponse.json({ error: 'Invalid Routes API response' }, { status: 502 });
  }

  const dur = data.routes?.[0]?.duration;
  const sec = parseDurationSeconds(dur);
  if (sec == null) {
    return NextResponse.json({ error: 'No transit route returned', rawDuration: dur ?? null }, { status: 404 });
  }

  const minutes = Math.max(1, Math.round(sec / 60));
  return NextResponse.json({
    durationSeconds: sec,
    durationMinutes: minutes,
    durationLabel: `${minutes} min`,
  });
}
