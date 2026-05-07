import { NextRequest, NextResponse } from 'next/server';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAW_RAPIDAPI_BOOKING_HOST = process.env.RAPIDAPI_BOOKING_HOST ?? '';
const RAPIDAPI_BOOKING_HOST = RAW_RAPIDAPI_BOOKING_HOST
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');
const BOOKING_URL = RAPIDAPI_BOOKING_HOST
  ? `https://${RAPIDAPI_BOOKING_HOST}/v1/hotels/search-by-coordinates`
  : '';

interface BookingHotel {
  name?: string;
  hotel_name?: string;
  cityName?: string;
  city?: string;
  address?: {
    addressLine1?: string;
    line1?: string;
  };
  address_line?: string;
  location?: {
    latitude?: number | string;
    longitude?: number | string;
  };
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fallbackHotels(lat: number, lng: number) {
  return [
    { id: 'fallback-1', name: 'Anchor Grand Hotel', address: 'Central District', lat: lat + 0.0042, lng: lng + 0.0035 },
    { id: 'fallback-2', name: 'Urban Nest Suites', address: 'Old Town Area', lat: lat - 0.0038, lng: lng + 0.0024 },
    { id: 'fallback-3', name: 'Skyline Boutique Stay', address: 'Riverside Quarter', lat: lat + 0.0021, lng: lng - 0.0041 },
  ];
}

export async function GET(req: NextRequest) {
  const lat = toNum(req.nextUrl.searchParams.get('lat'));
  const lng = toNum(req.nextUrl.searchParams.get('lng'));
  const radius = toNum(req.nextUrl.searchParams.get('radius')) ?? 25;

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }
  if (!RAPIDAPI_KEY || !RAPIDAPI_BOOKING_HOST) {
    return NextResponse.json({
      hotels: fallbackHotels(lat, lng),
      fallback: true,
      reason: 'RapidAPI configuration missing',
    });
  }

  const url = `${BOOKING_URL}?lat=${lat}&lng=${lng}&radius=${radius}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_BOOKING_HOST,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          hotels: fallbackHotels(lat, lng),
          fallback: true,
          reason: `Booking.com request failed (${response.status})`,
        },
      );
    }

    const payload = await response.json();
    const rawHotels: BookingHotel[] = Array.isArray(payload)
      ? payload
      : payload?.hotels ?? payload?.results ?? payload?.data ?? [];
    const hotels = rawHotels
      .map((hotel, idx) => {
        const latitude = toNum(hotel.location?.latitude ?? hotel.latitude ?? hotel.lat);
        const longitude = toNum(hotel.location?.longitude ?? hotel.longitude ?? hotel.lng);
        return {
          id: `${hotel.name ?? hotel.hotel_name ?? 'hotel'}-${idx}`,
          name: hotel.name ?? hotel.hotel_name ?? 'Unnamed hotel',
          address:
            hotel.address?.addressLine1 ??
            hotel.address?.line1 ??
            hotel.address_line ??
            hotel.cityName ??
            hotel.city ??
            'No address available',
          lat: latitude,
          lng: longitude,
        };
      })
      .filter((h) => h.lat != null && h.lng != null);

    return NextResponse.json({ hotels, fallback: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Booking.com proxy error';
    return NextResponse.json({
      hotels: fallbackHotels(lat, lng),
      fallback: true,
      reason: message,
    });
  }
}

