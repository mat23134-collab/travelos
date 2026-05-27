import { NextRequest, NextResponse } from 'next/server';
import { searchAccommodations, type Hotel } from '@/services/accommodation/router';

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fallbackHotels(lat: number, lng: number): Hotel[] {
  return [
    { id: 'fallback-1', provider: 'booking', name: 'Anchor Grand Hotel', address: 'Central District', lat: lat + 0.0042, lng: lng + 0.0035 },
    { id: 'fallback-2', provider: 'booking', name: 'Urban Nest Suites', address: 'Old Town Area', lat: lat - 0.0038, lng: lng + 0.0024 },
    { id: 'fallback-3', provider: 'booking', name: 'Skyline Boutique Stay', address: 'Riverside Quarter', lat: lat + 0.0021, lng: lng - 0.0041 },
  ];
}

export async function GET(req: NextRequest) {
  const lat = toNum(req.nextUrl.searchParams.get('lat'));
  const lng = toNum(req.nextUrl.searchParams.get('lng'));
  const radius = toNum(req.nextUrl.searchParams.get('radius')) ?? 25;
  const destination = req.nextUrl.searchParams.get('destination')?.trim() ?? '';
  const accommodation = req.nextUrl.searchParams.get('accommodation')?.trim() ?? null;
  const startDate = req.nextUrl.searchParams.get('startDate')?.trim() ?? undefined;
  const endDate = req.nextUrl.searchParams.get('endDate')?.trim() ?? undefined;
  const adults = toNum(req.nextUrl.searchParams.get('adults')) ?? 2;

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  try {
    const result = await searchAccommodations({
      destination: destination || 'nearby',
      lat,
      lng,
      radiusKm: radius,
      accommodation,
      startDate,
      endDate,
      adults,
    });

    if (result.hotels.length === 0) {
      return NextResponse.json({
        hotels: fallbackHotels(lat, lng),
        fallback: true,
        provider: null,
        attempts: result.attempts,
        reason: 'All accommodation providers failed or returned empty results',
      });
    }

    return NextResponse.json({
      hotels: result.hotels,
      fallback: result.fallback,
      provider: result.provider,
      attempts: result.attempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown accommodation router error';
    return NextResponse.json({
      hotels: fallbackHotels(lat, lng),
      fallback: true,
      reason: message,
    });
  }
}

