'use client';

/**
 * NeighborhoodGuide — the "Dynamic Neighborhood Profiler" surface.
 *
 * A split-view (Airbnb-style): a map panel on one side highlighting the active
 * neighborhood polygon, and a beautifully organized "Neighborhood Guide" on the
 * other — match badge, the hook, personal relevance, an honest-downsides warning
 * banner (trust), insider secrets as an icon-bullet list, and commute + safety.
 *
 * RTL-first (the guide copy is Hebrew). Pass a `profile` from
 * POST /api/neighborhood-profile; render `loading`/`error` states as needed.
 */

import { useMemo } from 'react';
import type { NeighborhoodProfile, ProfilerPoi } from '@/services/neighborhood/types';

// Warm "paper" palette, consistent with the rest of the app.
const INK = '#2b2622';
const INK_MUT = '#6b6358';
const ACCENT = '#b8552e';
const ACCENT_DEEP = '#8f4220';
const PAPER = '#efe3cd';
const CARD = '#fffaf1';

export function NeighborhoodGuide({
  profile,
  pois = [],
  loading = false,
  error = null,
}: {
  profile?: NeighborhoodProfile | null;
  /** The day's stops — plotted as pins on the map so it reads as a real area. */
  pois?: ProfilerPoi[];
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) return <GuideSkeleton />;
  if (error) {
    return (
      <div className="rounded-3xl p-8 text-center text-[13px]" style={{ background: PAPER, color: INK_MUT }} dir="rtl">
        לא הצלחנו לטעון את פרופיל השכונה כרגע.
      </div>
    );
  }
  if (!profile) return null;

  const { guide, neighborhood, matchPercent } = profile;

  return (
    <div
      dir="rtl"
      className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] overflow-hidden rounded-3xl shadow-xl"
      style={{ background: CARD, border: '1px solid rgba(43,38,34,0.10)' }}
    >
      {/* ── Map panel (highlights the active neighborhood polygon) ───────────── */}
      <div className="relative min-h-[280px] lg:min-h-full order-first lg:order-last">
        <MapPanel
          geoJson={neighborhood.boundaryGeoJson}
          pois={pois}
          nameHebrew={guide.name_hebrew}
          nameEnglish={guide.name_english}
        />
      </div>

      {/* ── Guide panel ──────────────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 flex flex-col gap-6">
        {/* Name + match badge */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
              מדריך השכונה שלכם
            </p>
            <h2 className="text-[26px] font-black leading-tight mt-1" style={{ color: INK }}>
              {guide.name_hebrew}
            </h2>
            <p className="text-[12.5px] font-semibold" style={{ color: INK_MUT }}>{guide.name_english}</p>
          </div>
          <MatchBadge percent={matchPercent} />
        </div>

        {/* The Hook */}
        <p className="text-[18px] sm:text-[19px] font-bold leading-[1.5]" style={{ color: INK }}>
          “{guide.the_hook_hebrew}”
        </p>

        {/* Personal relevance */}
        {guide.personal_relevance_hebrew && (
          <Section icon="🎯" title="למה שיבצנו אתכם כאן היום">
            <p className="text-[14px] leading-[1.7]" style={{ color: INK_MUT }}>
              {guide.personal_relevance_hebrew}
            </p>
          </Section>
        )}

        {/* Honest downsides — orange warning banner (builds trust) */}
        {guide.honest_downsides_hebrew.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(234,140,54,0.14)', border: '1px solid rgba(234,140,54,0.4)' }}
          >
            <p className="flex items-center gap-2 text-[13.5px] font-black mb-2" style={{ color: '#a85a12' }}>
              <span className="text-[16px]">⚠️</span> האמת בלי לייפות
            </p>
            <ul className="flex flex-col gap-1.5">
              {guide.honest_downsides_hebrew.map((d, i) => (
                <li key={i} className="text-[13.5px] leading-[1.6] flex gap-2" style={{ color: '#8a4f18' }}>
                  <span aria-hidden>•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Insider secrets — icon-bullet list */}
        {guide.local_secrets_hebrew.length > 0 && (
          <Section icon="✨" title="סודות מקומיים בדרך">
            <ul className="flex flex-col gap-2.5">
              {guide.local_secrets_hebrew.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black"
                    style={{ background: 'rgba(184,85,46,0.14)', color: ACCENT }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[14px] leading-[1.6]" style={{ color: INK }}>{s}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Commute + safety — grouped at the bottom */}
        {guide.commute_and_safety_hebrew && (
          <div className="mt-auto pt-5" style={{ borderTop: '1px solid rgba(43,38,34,0.10)' }}>
            <p className="flex items-center gap-2 text-[12.5px] font-black mb-1.5" style={{ color: INK }}>
              <span className="text-[15px]">🚇</span> תחבורה ובטיחות
            </p>
            <p className="text-[13.5px] leading-[1.7]" style={{ color: INK_MUT }}>
              {guide.commute_and_safety_hebrew}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[12.5px] font-black mb-2" style={{ color: INK }}>
        <span className="text-[15px]">{icon}</span> {title}
      </p>
      {children}
    </div>
  );
}

function MatchBadge({ percent }: { percent: number }) {
  return (
    <div
      className="shrink-0 flex flex-col items-center justify-center rounded-2xl px-3.5 py-2.5"
      style={{ background: `linear-gradient(160deg, ${ACCENT}, ${ACCENT_DEEP})`, boxShadow: '0 8px 20px -8px rgba(184,85,46,0.6)' }}
    >
      <span className="text-[22px] font-black leading-none text-white">{percent}%</span>
      <span className="text-[9.5px] font-bold text-white/85 mt-0.5 whitespace-nowrap">התאמה לוייב שלכם</span>
    </div>
  );
}

/**
 * The map panel. Draws the neighborhood polygon (from the PostGIS GeoJSON) AND
 * the day's stops as numbered pins — both normalized to a shared bounding box so
 * you actually see your route sitting inside the area, not an empty box.
 */
function MapPanel({
  geoJson, pois, nameHebrew, nameEnglish,
}: {
  geoJson: string | null;
  pois: ProfilerPoi[];
  nameHebrew: string;
  nameEnglish: string;
}) {
  const scene = useMemo(() => buildScene(geoJson, pois), [geoJson, pois]);
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'radial-gradient(120% 120% at 30% 20%, #eaf0ec 0%, #dde7e0 55%, #cfdbd3 100%)' }}
      data-testid="neighborhood-map"
    >
      {/* faint street grid */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(43,38,34,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(43,38,34,0.06) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />
      {scene ? (
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="relative w-[88%] h-[82%]">
          {scene.path && (
            <path
              d={scene.path}
              fill="rgba(184,85,46,0.16)"
              stroke={ACCENT}
              strokeWidth={1.1}
              strokeLinejoin="round"
              strokeDasharray="2.4 1.6"
            />
          )}
          {/* connecting walk line between the day's stops */}
          {scene.pins.length > 1 && (
            <polyline
              points={scene.pins.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="rgba(43,38,34,0.35)"
              strokeWidth={0.8}
              strokeDasharray="1.5 1.5"
              strokeLinecap="round"
            />
          )}
          {scene.pins.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={2.9} fill={p.color} stroke="#fff" strokeWidth={0.8} />
              <text x={p.x} y={p.y + 1.05} textAnchor="middle" fontSize={3} fontWeight={800} fill="#fff">
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <div className="relative text-[13px] font-semibold" style={{ color: INK_MUT }}>אזור השכונה</div>
      )}
      {/* Name pill */}
      <div
        className="absolute bottom-4 rounded-full px-4 py-2 text-[13px] font-black shadow-lg"
        style={{ background: CARD, color: INK, border: '1px solid rgba(43,38,34,0.12)' }}
      >
        📍 {nameHebrew} · {nameEnglish}
      </div>
    </div>
  );
}

function GuideSkeleton() {
  return (
    <div className="rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-2" style={{ background: CARD, border: '1px solid rgba(43,38,34,0.10)' }}>
      <div className="min-h-[280px]" style={{ background: '#dce6e0' }} />
      <div className="p-8 flex flex-col gap-4">
        {[70, 40, 90, 80, 60].map((w, i) => (
          <div key={i} className="h-4 rounded-full animate-pulse" style={{ width: `${w}%`, background: 'rgba(43,38,34,0.08)' }} />
        ))}
      </div>
    </div>
  );
}

// ── Project polygon + POIs into a shared 0..100 viewbox (y-flipped) ───────────

interface Scene {
  path: string | null;
  pins: { x: number; y: number; color: string }[];
}

const PIN_COLORS: Record<string, string> = {
  restaurant: '#e0913a', // warm gold
  attraction: '#c0453f', // terracotta red
};

/**
 * Build the map scene: the polygon path and the day's POI pins, both normalized
 * to the SAME bounding box (polygon ring ∪ POIs) so their relative positions are
 * true — you see your stops clustered inside the neighborhood.
 */
function buildScene(geoJson: string | null, pois: ProfilerPoi[]): Scene | null {
  let ring: number[][] | null = null;
  if (geoJson) {
    try {
      const parsed = JSON.parse(geoJson) as { coordinates?: number[][][] };
      const r = parsed?.coordinates?.[0];
      if (r && r.length >= 3) ring = r;
    } catch { /* ignore */ }
  }

  const geoPois = pois.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const all: [number, number][] = [
    ...(ring ? ring.map((c) => [c[0], c[1]] as [number, number]) : []),
    ...geoPois.map((p) => [p.lng, p.lat] as [number, number]),
  ];
  if (all.length === 0) return null;

  const lngs = all.map((c) => c[0]);
  const lats = all.map((c) => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const spanLng = maxLng - minLng || 1e-6;
  const spanLat = maxLat - minLat || 1e-6;
  const pad = 12;
  const scale = 100 - pad * 2;
  const project = (lng: number, lat: number): [number, number] => [
    pad + ((lng - minLng) / spanLng) * scale,
    pad + (1 - (lat - minLat) / spanLat) * scale, // flip Y for screen space
  ];

  const path = ring
    ? `M ${ring.map(([lng, lat]) => project(lng, lat).map((n) => n.toFixed(2)).join(',')).join(' L ')} Z`
    : null;

  const pins = geoPois.map((p) => {
    const [x, y] = project(p.lng, p.lat);
    return { x, y, color: PIN_COLORS[(p.category ?? '').toLowerCase()] ?? ACCENT };
  });

  return { path, pins };
}
