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

export interface Props {
  days: DayPlan[];
  destination: string;
  focusedNeighborhood?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_COLORS = [
  '#ff5a5f', '#3b82f6', '#10b981', '#8b5cf6',
  '#f59e0b', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
];

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

// Module-level Promise — tells react-map-gl v8 to use mapbox-gl (not maplibre)
const MAPBOX_LIB = import('mapbox-gl');

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
      if (
        act &&
        Number.isFinite(act.latitude) &&
        Number.isFinite(act.longitude)
      ) {
        out.push({
          id:           `day${di}-${time.toLowerCase()}-${(act.name ?? '').replace(/\s+/g, '-').toLowerCase()}`,
          lat:          act.latitude!,
          lng:          act.longitude!,
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

function ItineraryMapInner({ days, destination, focusedNeighborhood }: Props) {
  const mapRef = useRef<MapRef>(null);
  const markers = buildMarkers(days);
  const [activeId, setActiveId] = useState<string | null>(null);

  // ── Fit all markers on first load ────────────────────────────────────────
  const handleLoad = useCallback(() => {
    const map = mapRef.current;
    if (!map || markers.length === 0) return;
    if (markers.length === 1) {
      map.flyTo({ center: [markers[0].lng, markers[0].lat], zoom: 13, duration: 800 });
      return;
    }
    const lngs = markers.map((m) => m.lng);
    const lats  = markers.map((m) => m.lat);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 48, duration: 900, maxZoom: 14 },
    );
  }, [markers]);

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

  // ── Guards ───────────────────────────────────────────────────────────────
  if (!TOKEN) {
    return <EmptyState message="Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the trip map." />;
  }
  if (markers.length === 0) {
    return (
      <EmptyState message="Trip map will appear once activities have GPS coordinates. Expand a day card to see the per-day map." />
    );
  }

  const initLng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
  const initLat  = markers.reduce((s, m) => s + m.lat, 0) / markers.length;

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
        mapLib={MAPBOX_LIB}
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
            }}
          >
            <DayPin marker={m} active={m.id === activeId} />
          </Marker>
        ))}

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
    </div>
  );
}

export const ItineraryMap = memo(ItineraryMapInner);
