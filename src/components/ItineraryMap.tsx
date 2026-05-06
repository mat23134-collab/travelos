'use client';

/**
 * ItineraryMap — full-trip overview map (Mapbox GL, dark-v11)
 *
 * Migrated from Leaflet + Nominatim geocoding to react-map-gl + mapbox-gl.
 * Uses lat/lng already embedded on Activity objects — no external geocoding call.
 * Same public interface as the old Leaflet version so ItineraryClient.tsx is unchanged.
 */

import { useRef, useState, useEffect, useCallback, memo } from 'react';
import Map, { Marker, Popup, NavigationControl, type MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { DayPlan } from '@/lib/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  label: string;
  dayIndex: number;
  time: string;
  neighborhood: string;
}

interface DistanceStats {
  airKm: number;
  walkKm: number | null;
  walkMin: number | null;
  driveKm: number | null;
  driveMin: number | null;
}

export interface Props {
  days: DayPlan[];
  destination: string;
  focusedNeighborhood?: string;
  basecampMarker?: {
    lat: number;
    lng: number;
    label?: string;
  } | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_COLORS = [
  '#ff5a5f', '#3b82f6', '#10b981', '#8b5cf6',
  '#f59e0b', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
];

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

async function fetchRouteStats(
  profile: 'walking' | 'driving',
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<{ km: number; min: number } | null> {
  if (!TOKEN) return null;
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}` +
    `?overview=false&alternatives=false&steps=false&access_token=${TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { routes?: Array<{ distance: number; duration: number }> };
    const route = data.routes?.[0];
    if (!route) return null;
    return {
      km: route.distance / 1000,
      min: route.duration / 60,
    };
  } catch {
    return null;
  }
}

// ── Build marker list from DayPlan array ─────────────────────────────────────

function buildMarkers(days: DayPlan[]): MarkerData[] {
  const out: MarkerData[] = [];
  days.forEach((day, di) => {
    const slots = [
      { act: day.morning,   time: 'Morning'   },
      { act: day.afternoon, time: 'Afternoon' },
      { act: day.evening,   time: 'Evening'   },
    ] as const;

    slots.forEach(({ act, time }) => {
      const lat = act ? Number(act.latitude) : NaN;
      const lng = act ? Number(act.longitude) : NaN;
      if (
        act &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        out.push({
          id:           `day${di}-${time.toLowerCase()}-${(act.name ?? '').replace(/\s+/g, '-').toLowerCase()}`,
          lat,
          lng,
          label:        act.name ?? time,
          dayIndex:     di,
          time,
          neighborhood: act.neighborhood ?? '',
        });
      }
    });
  });
  return out;
}

// ── Day-number pin ───────────────────────────────────────────────────────────

const DayPin = memo(function DayPin({
  marker,
  active,
}: {
  marker: MarkerData;
  active: boolean;
}) {
  const color = DAY_COLORS[marker.dayIndex % DAY_COLORS.length];
  return (
    <div
      style={{
        width: 26, height: 26,
        borderRadius: '50%',
        background: color,
        border: `2.5px solid ${active ? '#fff' : 'rgba(255,255,255,0.7)'}`,
        boxShadow: active
          ? `0 0 0 3px ${color}55, 0 2px 8px rgba(0,0,0,0.4)`
          : '0 2px 8px rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 700, fontSize: 10,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
    >
      {marker.dayIndex + 1}
    </div>
  );
});

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="w-full rounded-2xl flex flex-col items-center justify-center gap-2"
      style={{
        height: 380,
        background: 'rgba(255,255,255,0.03)',
        border: '1px dashed rgba(255,255,255,0.10)',
      }}
    >
      <span className="text-3xl opacity-20 select-none">🗺️</span>
      <p className="text-xs text-white/25 text-center px-8 max-w-xs leading-relaxed">{message}</p>
    </div>
  );
}

// ── ItineraryMap ─────────────────────────────────────────────────────────────

function ItineraryMapInner({ days, destination, focusedNeighborhood, basecampMarker }: Props) {
  const mapRef = useRef<MapRef>(null);
  const markers = buildMarkers(days);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeBasecamp, setActiveBasecamp] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState<Array<{ id: string; lat: number; lng: number; label: string }>>([]);
  const [distanceStats, setDistanceStats] = useState<DistanceStats | null>(null);
  const [isComputingDistance, setIsComputingDistance] = useState(false);

  // ── Fit all markers on first load ────────────────────────────────────────
  const handleLoad = useCallback(() => {
    const map = mapRef.current;
    const allPoints = [
      ...markers.map((m) => ({ lng: m.lng, lat: m.lat })),
      ...(basecampMarker ? [{ lng: basecampMarker.lng, lat: basecampMarker.lat }] : []),
    ];
    if (!map || allPoints.length === 0) return;
    if (allPoints.length === 1) {
      map.flyTo({ center: [allPoints[0].lng, allPoints[0].lat], zoom: 13, duration: 800 });
      return;
    }
    const lngs = allPoints.map((m) => m.lng);
    const lats  = allPoints.map((m) => m.lat);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 48, duration: 900, maxZoom: 14 },
    );
  }, [markers, basecampMarker]);

  // ── focusedNeighborhood → flyTo + open popup ─────────────────────────────
  useEffect(() => {
    if (!focusedNeighborhood) return;
    const map = mapRef.current;
    const target = markers.find((m) =>
      m.neighborhood.toLowerCase().includes(focusedNeighborhood.toLowerCase()),
    );
    if (!map || !target) return;
    map.flyTo({ center: [target.lng, target.lat], zoom: 15, duration: 800 });
    setActiveId(target.id);
  }, [focusedNeighborhood, markers]);

  useEffect(() => {
    const run = async () => {
      if (selectedPoints.length !== 2) {
        setDistanceStats(null);
        return;
      }
      setIsComputingDistance(true);
      const [from, to] = selectedPoints;
      const airKm = haversineKm(from, to);
      const [walking, driving] = await Promise.all([
        fetchRouteStats('walking', from, to),
        fetchRouteStats('driving', from, to),
      ]);
      setDistanceStats({
        airKm,
        walkKm: walking?.km ?? null,
        walkMin: walking?.min ?? null,
        driveKm: driving?.km ?? null,
        driveMin: driving?.min ?? null,
      });
      setIsComputingDistance(false);
    };
    void run();
  }, [selectedPoints]);

  // ── Guards ───────────────────────────────────────────────────────────────
  if (!TOKEN) {
    return <EmptyState message="Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the trip map." />;
  }
  if (markers.length === 0 && !basecampMarker) {
    return (
      <EmptyState message="Trip map will appear once activities have GPS coordinates. Expand a day card to see the per-day map." />
    );
  }

  const allPoints = [
    ...markers.map((m) => ({ lng: m.lng, lat: m.lat })),
    ...(basecampMarker ? [{ lng: basecampMarker.lng, lat: basecampMarker.lat }] : []),
  ];
  const initLng = allPoints.reduce((s, m) => s + m.lng, 0) / allPoints.length;
  const initLat  = allPoints.reduce((s, m) => s + m.lat, 0) / allPoints.length;

  const activeMarker = activeId ? markers.find((m) => m.id === activeId) ?? null : null;
  const activeColor  = activeMarker
    ? DAY_COLORS[activeMarker.dayIndex % DAY_COLORS.length]
    : '#fff';

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-white/8 shadow-sm"
      style={{ height: 380 }}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        initialViewState={{ longitude: initLng, latitude: initLat, zoom: 11 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onLoad={handleLoad}
        cooperativeGestures={false}
        attributionControl
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Day markers */}
        {markers.map((m) => (
          <Marker
            key={m.id}
            latitude={m.lat}
            longitude={m.lng}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setActiveId((prev) => (prev === m.id ? null : m.id));
              setActiveBasecamp(false);
              setSelectedPoints((prev) => {
                if (prev.some((p) => p.id === m.id)) return prev.filter((p) => p.id !== m.id);
                if (prev.length < 2) return [...prev, { id: m.id, lat: m.lat, lng: m.lng, label: m.label }];
                return [prev[1], { id: m.id, lat: m.lat, lng: m.lng, label: m.label }];
              });
            }}
          >
            <DayPin marker={m} active={m.id === activeId} />
          </Marker>
        ))}

        {/* Base camp marker (from onboarding hotel anchor) */}
        {basecampMarker && (
          <Marker
            latitude={basecampMarker.lat}
            longitude={basecampMarker.lng}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setActiveBasecamp((prev) => !prev);
              setActiveId(null);
              setSelectedPoints((prev) => {
                const id = 'basecamp';
                if (prev.some((p) => p.id === id)) return prev.filter((p) => p.id !== id);
                const point = {
                  id,
                  lat: basecampMarker.lat,
                  lng: basecampMarker.lng,
                  label: basecampMarker.label || 'Base Camp',
                };
                if (prev.length < 2) return [...prev, point];
                return [prev[1], point];
              });
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
              title={basecampMarker.label || 'Base Camp'}
            >
              <div
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#111827',
                  background: '#fbbf24',
                  border: '1px solid rgba(255,255,255,0.8)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
                }}
              >
                BASE CAMP
              </div>
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fbbf24',
                  border: '2px solid white',
                  boxShadow: '0 0 0 4px rgba(251,191,36,0.25)',
                }}
              />
            </div>
          </Marker>
        )}

        {basecampMarker && activeBasecamp && (
          <Popup
            latitude={basecampMarker.lat}
            longitude={basecampMarker.lng}
            anchor="bottom"
            offset={26}
            closeButton={false}
            closeOnClick={false}
            onClose={() => setActiveBasecamp(false)}
          >
            <div
              className="px-3 py-2 rounded-xl text-xs text-white min-w-[160px]"
              style={{
                background: 'rgba(8,10,18,0.97)',
                border: '1px solid rgba(251,191,36,0.45)',
                boxShadow: '0 0 16px rgba(251,191,36,0.25)',
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: '#fbbf24' }}
              >
                Base Camp
              </div>
              <div className="font-semibold text-white/90 text-[13px] leading-tight">
                {basecampMarker.label || 'Your hotel'}
              </div>
            </div>
          </Popup>
        )}

        {/* Active popup */}
        {activeMarker && (
          <Popup
            latitude={activeMarker.lat}
            longitude={activeMarker.lng}
            anchor="bottom"
            offset={20}
            closeButton={false}
            closeOnClick={false}
            onClose={() => setActiveId(null)}
          >
            <div
              className="px-3 py-2 rounded-xl text-xs text-white min-w-[160px]"
              style={{
                background: 'rgba(8,10,18,0.97)',
                border: `1px solid ${activeColor}45`,
                boxShadow: `0 0 16px ${activeColor}25`,
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: activeColor }}
              >
                Day {activeMarker.dayIndex + 1} · {activeMarker.time}
              </div>
              <div className="font-semibold text-white/90 text-[13px] leading-tight">
                {activeMarker.label}
              </div>
              {activeMarker.neighborhood && (
                <div className="text-[11px] text-white/40 mt-0.5">
                  📍 {activeMarker.neighborhood}
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Day legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5 max-w-xs">
        {days.map((day, i) => (
          <div
            key={i}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'rgba(8,10,18,0.82)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${DAY_COLORS[i % DAY_COLORS.length]}40`,
              color: DAY_COLORS[i % DAY_COLORS.length],
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
            />
            Day {i + 1}
          </div>
        ))}
      </div>

      {(selectedPoints.length > 0 || distanceStats || isComputingDistance) && (
        <div
          className="absolute top-3 left-3 z-10 rounded-xl px-3 py-2"
          style={{
            background: 'rgba(8,10,18,0.86)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(10px)',
            maxWidth: 280,
          }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/65 mb-1">
            Distance Tool
          </div>
          {selectedPoints.length < 2 ? (
            <div className="text-[11px] text-white/60">
              Select {2 - selectedPoints.length} more point{2 - selectedPoints.length === 1 ? '' : 's'}.
            </div>
          ) : isComputingDistance ? (
            <div className="text-[11px] text-white/60">Calculating walking and driving routes...</div>
          ) : distanceStats ? (
            <div className="text-[11px] text-white/75 leading-relaxed">
              <div>Between: <span className="text-white/90">{selectedPoints[0].label}</span> ↔ <span className="text-white/90">{selectedPoints[1].label}</span></div>
              <div>Direct: <span className="text-white">{distanceStats.airKm.toFixed(1)} km</span></div>
              <div>
                Walking:{' '}
                <span className="text-white">
                  {distanceStats.walkKm != null && distanceStats.walkMin != null
                    ? `${distanceStats.walkKm.toFixed(1)} km · ${Math.round(distanceStats.walkMin)} min`
                    : 'N/A'}
                </span>
              </div>
              <div>
                Driving:{' '}
                <span className="text-white">
                  {distanceStats.driveKm != null && distanceStats.driveMin != null
                    ? `${distanceStats.driveKm.toFixed(1)} km · ${Math.round(distanceStats.driveMin)} min`
                    : 'N/A'}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export const ItineraryMap = memo(ItineraryMapInner);
