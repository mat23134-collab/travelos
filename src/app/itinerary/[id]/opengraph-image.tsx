import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const alt = 'Sarto trip itinerary';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let destination = 'Your next trip';
  if (UUID_RE.test(id ?? '')) {
    try {
      const { data } = await supabase.from('itineraries').select('destination').eq('id', id).single();
      if (data?.destination) destination = data.destination;
    } catch { /* fall back to default */ }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '72px 80px',
          background: 'linear-gradient(135deg, #0d2b27 0%, #124a42 100%)',
          color: '#F5EFE6', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, border: '4px solid #63bccb', display: 'flex' }} />
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 1 }}>Sarto</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 26, color: '#63bccb', fontWeight: 600, marginBottom: 12 }}>AI TRAVEL ITINERARY</div>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05 }}>{destination}</div>
        </div>

        <div style={{ fontSize: 30, color: 'rgba(245,239,230,0.75)' }}>
          A day-by-day plan, built in minutes · sarto.tours
        </div>
      </div>
    ),
    { ...size },
  );
}
