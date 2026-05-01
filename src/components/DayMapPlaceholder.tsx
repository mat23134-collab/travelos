'use client';

import { DayPlan, Activity } from '@/lib/types';

interface Pin {
  name: string;
  lat: number;
  lng: number;
  emoji: string;
  slot: string;
}

function extractPins(day: DayPlan): Pin[] {
  const slotMap: { slot: string; activity: Activity | undefined }[] = [
    { slot: 'Morning',   activity: day.morning   },
    { slot: 'Afternoon', activity: day.afternoon },
    { slot: 'Evening',   activity: day.evening   },
  ];

  return slotMap
    .filter((s): s is { slot: string; activity: Activity } =>
      !!s.activity &&
      typeof s.activity.latitude  === 'number' &&
      typeof s.activity.longitude === 'number',
    )
    .map(({ slot, activity }) => ({
      name:  activity.name,
      lat:   activity.latitude!,
      lng:   activity.longitude!,
      emoji: activity.category_emoji ?? '📍',
      slot,
    }));
}

export function DayMapPlaceholder({ day }: { day: DayPlan }) {
  const pins = extractPins(day);
  const hasPins = pins.length > 0;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        minHeight: 72,
      }}
    >
      {hasPins ? (
        <div className="p-3">
          {/* Pin cards */}
          <div className="flex flex-col gap-2">
            {pins.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                }}
              >
                {/* Index number */}
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                  style={{ background: 'rgba(255,90,95,0.35)' }}
                >
                  {i + 1}
                </div>

                {/* Emoji */}
                <span className="text-base flex-shrink-0">{p.emoji}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-white/80 truncate">{p.name}</div>
                  <div className="text-[9px] font-mono text-white/28 mt-0.5">
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                  </div>
                </div>

                {/* Slot label */}
                <span className="text-[9px] text-white/25 flex-shrink-0">{p.slot}</span>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: '#00d4ff', boxShadow: '0 0 6px #00d4ff' }}
            />
            <span className="text-[9px] text-white/20">
              Interactive map rendering · coming soon
            </span>
          </div>
        </div>
      ) : (
        /* No coordinates yet — show a placeholder skeleton */
        <div className="flex flex-col items-center justify-center gap-1.5 py-5 text-center">
          <span className="text-xl">🗺</span>
          <div className="text-[10px] text-white/25">GPS coordinates loading</div>
          <div className="text-[9px] text-white/15">
            Will render once the itinerary includes lat/lng fields
          </div>
        </div>
      )}
    </div>
  );
}
