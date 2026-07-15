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
import { DayPlan, DiningSpot } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

/** Strings for the distance / transit overlay — pass `Pick` from `itineraryUi(...)`. */
export type ItineraryMapLabels = Pick<
  ItineraryUiStrings,
  | 'mapDistanceTool'
  | 'mapSelectMoreHint'
  | 'mapComputingRoutes'
  | 'mapBetween'
  | 'mapDirect'
  | 'mapWalking'
  | 'mapDriving'
  | 'mapNa'
  | 'mapOpenGoogleTransit'
  | 'mapClearSelection'
  | 'cityTransportGoogleRoutesDoc'
  | 'cityTransportGoogleRoutesDocUrl'
>;

// ── Types ────────────────────────────────────────────────────────────────────

type MarkerKind = 'attraction' | 'restaurant';

interface MarkerData {
  id: string;
  lat: number;
  lng: number;
  label: string;
  dayIndex: number;
  /**
   * 1-based position within its own day AND kind — attractions number
   * Morning=1/Afternoon=2/Evening=3; restaurants number Breakfast=1/Lunch=2/
   * Dinner=3, independently, since the two kinds are distinguished by color.
   */
  order: number;
  time: string;
  neighborhood: string;
  kind: MarkerKind;
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
  labels: ItineraryMapLabels;
  /** Restaurants clutter the full-trip overview map — daily maps (per-day
   *  detail view) keep them, but the weekly/full-trip map shows attractions
   *  only. Defaults to true for callers that want both kinds. */
  showRestaurants?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Pins are colored by TYPE, not by day — attractions always red, restaurants
 *  always amber, so the whole trip reads at a glance regardless of day count. */
const KIND_COLOR: Record<MarkerKind, string> = {
  attraction: '#ef4444', // red
  restaurant: '#f59e0b', // amber
};
const KIND_ICON: Record<MarkerKind, string> = {
  attraction: '📍',
  restaurant: '🍽️',
};

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

/** True when both coordinates are present, finite, and not null-island (0,0). */
function hasGps(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

function buildMarkers(days: DayPlan[]): MarkerData[] {
  const out: MarkerData[] = [];
  days.forEach((day, di) => {
    // ── Attractions — sightseeing slots, numbered 1/2/3 = Morning/Afternoon/Evening
    const attractionSlots = [
      { act: day.morning,   time: 'Morning'   },
      { act: day.afternoon, time: 'Afternoon' },
      { act: day.evening,   time: 'Evening'   },
    ] as const;

    let order = 0;
    attractionSlots.forEach(({ act, time }) => {
      const lat = act ? Number(act.latitude) : NaN;
      const lng = act ? Number(act.longitude) : NaN;
      if (act && hasGps(lat, lng)) {
        order += 1;
        out.push({
          id:           `day${di}-${time.toLowerCase()}-${(act.name ?? '').replace(/\s+/g, '-').toLowerCase()}`,
          lat,
          lng,
          label:        act.name ?? time,
          dayIndex:     di,
          order,
          time,
          neighborhood: act.neighborhood ?? '',
          kind:         'attraction',
        });
      }
    });

    // ── Restaurants — dining slots, numbered 1/2/3 = Breakfast/Lunch/Dinner,
    // independently of the attraction numbering above (distinguished by color).
    const mealSlots: readonly { spot: DiningSpot | undefined; time: string }[] = [
      { spot: day.breakfast, time: 'Breakfast' },
      { spot: day.lunch,     time: 'Lunch'     },
      { spot: day.dinner,    time: 'Dinner'    },
    ];

    let mealOrder = 0;
    mealSlots.forEach(({ spot, time }) => {
      const lat = spot ? Number(spot.latitude) : NaN;
      const lng = spot ? Number(spot.longitude) : NaN;
      if (spot && hasGps(lat, lng)) {
        mealOrder += 1;
        out.push({
          id:           `day${di}-${time.toLowerCase()}-${(spot.name ?? '').replace(/\s+/g, '-').toLowerCase()}`,
          lat,
          lng,
          label:        spot.name ?? time,
          dayIndex:     di,
          order:        mealOrder,
          time,
          neighborhood: spot.neighborhood ?? '',
          kind:         'restaurant',
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
  const color = KIND_COLOR[marker.kind];
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
      {marker.order}
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

function googleMapsTransitDirUrl(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const origin = encodeURIComponent(`${a.lat},${a.lng}`);
  const dest = encodeURIComponent(`${b.lat},${b.lng}`);
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=transit`;
}

function ItineraryMapInner({ days, destination, focusedNeighborhood, basecampMarker, labels, showRestaurants = true }: Props) {
  const mapRef = useRef<MapRef>(null);
  const markers = showRestaurants
    ? buildMarkers(days)
    : buildMarkers(days).filter((m) => m.kind !== 'restaurant');
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
  const activeColor  = activeMarker ? KIND_COLOR[activeMarker.kind] : '#fff';

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
                {KIND_ICON[activeMarker.kind]} Day {activeMarker.dayIndex + 1} · {activeMarker.time}
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

      {/* Kind legend — pins are colored by type (attraction vs restaurant), not
          by day, so the whole trip reads at a glance regardless of day count. */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-1.5 max-w-xs">
        {(showRestaurants ? (['attraction', 'restaurant'] as const) : (['attraction'] as const)).map((kind) => (
          <div
            key={kind}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{
              background: 'rgba(8,10,18,0.82)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${KIND_COLOR[kind]}40`,
              color: KIND_COLOR[kind],
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: KIND_COLOR[kind] }}
            />
            {KIND_ICON[kind]} {kind === 'attraction' ? 'Attractions' : 'Restaurants'}
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
            maxWidth: 300,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/65">
              {labels.mapDistanceTool}
            </div>
            {selectedPoints.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPoints([]);
                  setDistanceStats(null);
                }}
                className="text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-md border border-white/15 text-white/70 hover:text-white hover:bg-white/5"
              >
                {labels.mapClearSelection}
              </button>
            )}
          </div>
          {selectedPoints.length < 2 ? (
            <div className="text-[11px] text-white/60">
              {labels.mapSelectMoreHint(2 - selectedPoints.length)}
            </div>
          ) : isComputingDistance ? (
            <div className="text-[11px] text-white/60">{labels.mapComputingRoutes}</div>
          ) : distanceStats ? (
            <div className="text-[11px] text-white/75 leading-relaxed space-y-1.5">
              <div>
                {labels.mapBetween}:{' '}
                <span className="text-white/90">{selectedPoints[0].label}</span> ↔{' '}
                <span className="text-white/90">{selectedPoints[1].label}</span>
              </div>
              <div>
                {labels.mapDirect}: <span className="text-white">{distanceStats.airKm.toFixed(1)} km</span>
              </div>
              <div>
                {labels.mapWalking}:{' '}
                <span className="text-white">
                  {distanceStats.walkKm != null && distanceStats.walkMin != null
                    ? `${distanceStats.walkKm.toFixed(1)} km · ${Math.round(distanceStats.walkMin)} min`
                    : labels.mapNa}
                </span>
              </div>
              <div>
                {labels.mapDriving}:{' '}
                <span className="text-white">
                  {distanceStats.driveKm != null && distanceStats.driveMin != null
                    ? `${distanceStats.driveKm.toFixed(1)} km · ${Math.round(distanceStats.driveMin)} min`
                    : labels.mapNa}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
                <a
                  href={googleMapsTransitDirUrl(selectedPoints[0], selectedPoints[1])}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center text-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border border-sky-400/35 bg-sky-500/15 text-sky-100 hover:bg-sky-500/25"
                >
                  {labels.mapOpenGoogleTransit} ↗
                </a>
                <a
                  href={labels.cityTransportGoogleRoutesDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-white/45 hover:text-sky-200/90 underline-offset-2 hover:underline"
                >
                  {labels.cityTransportGoogleRoutesDoc}
                </a>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export const ItineraryMap = memo(ItineraryMapInner);
