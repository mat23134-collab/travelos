'use client';

/**
 * InteractiveMap — Mapbox GL dark-v11 with neon vibe markers
 *
 * Key fix (v1.10.1):
 *   – Import from 'react-map-gl' (main entry), NOT 'react-map-gl/mapbox'.
 *     Railway's webpack cannot resolve the /mapbox subpath export.
 *   – Pass `mapLib={MAPBOX_LIB}` so react-map-gl v8 uses mapbox-gl
 *     instead of its default maplibre-gl renderer.
 *
 * Features:
 *   • Auto-fit bounding box on load / when places array changes
 *   • flyToId prop → smooth flyTo animation to that marker
 *   • Neon pin markers with vibe-based accent colours
 *   • Hover popup showing emoji + name
 *   • "Fit all" re-centring button
 *   • Fully memoised to prevent spurious map re-renders
 *
 * Always loaded via dynamic import (ssr:false) from DayCard so mapbox-gl
 * never touches `window` during SSR.
 */

import { useRef, useCallback, useMemo, useState, useEffect, memo } from 'react';
import Map, { Marker, Popup, NavigationControl, type MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ── Mapbox binding ────────────────────────────────────────────────────────────
// Evaluated once at module level (not inside the component) so the Promise is
// stable and react-map-gl only resolves it once across the app lifetime.
// This is what tells react-map-gl v8 to use mapbox-gl instead of maplibre-gl.
const MAPBOX_LIB = import('mapbox-gl');

// ── Public types ──────────────────────────────────────────────────────────────

export interface MapPlace {
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
  vibeLabel: string;
}

interface InteractiveMapProps {
  places: MapPlace[];
  /** Changing this triggers a smooth flyTo + popup on that marker. */
  flyToId?: string | null;
  height?: number;
  className?: string;
}

// ── Vibe → neon accent ────────────────────────────────────────────────────────

const VIBE_ACCENT: Record<string, string> = {
  'viral-trend':    '#a855f7',
  'hidden-gem':     '#22c55e',
  'local-favorite': '#f97316',
  'classic':        '#3b82f6',
  'luxury-pick':    '#eab308',
  'budget-pick':    '#06b6d4',
};
const FALLBACK_ACCENT = 'rgba(255,255,255,0.6)';

function accent(vibeLabel: string) {
  return VIBE_ACCENT[vibeLabel] ?? FALLBACK_ACCENT;
}

// ── NeonPin ───────────────────────────────────────────────────────────────────

const NeonPin = memo(function NeonPin({
  place,
  active,
}: {
  place: MapPlace;
  active: boolean;
}) {
  const c = accent(place.vibeLabel);

  return (
    <div className="flex flex-col items-center select-none" style={{ width: 36 }}>
      {/* Pulse ring when active */}
      {active && (
        <span
          className="absolute rounded-full animate-ping pointer-events-none"
          style={{
            width: 48, height: 48,
            top: -6, left: -6,
            background: `${c}22`,
            border: `1px solid ${c}55`,
          }}
        />
      )}

      {/* Pin face */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-transform duration-200 hover:scale-110 cursor-pointer"
        style={{
          background: `radial-gradient(circle at 38% 32%, ${c}38 0%, rgba(10,12,20,0.94) 80%)`,
          border: `2px solid ${c}`,
          boxShadow: active
            ? `0 0 0 3px ${c}30, 0 0 20px ${c}90, 0 3px 12px rgba(0,0,0,0.75)`
            : `0 0 14px ${c}70, 0 3px 10px rgba(0,0,0,0.7)`,
        }}
      >
        {place.emoji}
      </div>

      {/* Pin tail */}
      <div
        style={{
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `8px solid ${c}`,
          filter: `drop-shadow(0 2px 4px ${c}55)`,
          marginTop: -1,
        }}
      />
    </div>
  );
});

// ── Popup ─────────────────────────────────────────────────────────────────────

function PlacePopup({ place }: { place: MapPlace }) {
  const c = accent(place.vibeLabel);
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs font-semibold text-white whitespace-nowrap flex items-center gap-2 relative"
      style={{
        background: 'rgba(8,10,18,0.96)',
        border: `1px solid ${c}50`,
        boxShadow: `0 0 18px ${c}30, 0 6px 24px rgba(0,0,0,0.7)`,
        backdropFilter: 'blur(14px)',
      }}
    >
      <span>{place.emoji}</span>
      <span>{place.name}</span>
      {/* Neon underline */}
      <div
        className="absolute -bottom-px inset-x-3 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }}
      />
    </div>
  );
}

// ── Empty / no-token state ────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl flex flex-col items-center justify-center gap-2.5"
      style={{
        minHeight: 220,
        background: 'rgba(255,255,255,0.025)',
        border: '1px dashed rgba(255,255,255,0.08)',
      }}
    >
      <span className="text-3xl opacity-25 select-none">🗺️</span>
      <p className="text-[11px] text-white/22 text-center px-6 leading-relaxed max-w-[220px]">
        {message}
      </p>
    </div>
  );
}

// ── InteractiveMap ────────────────────────────────────────────────────────────

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

function InteractiveMapInner({
  places,
  flyToId,
  height = 280,
  className = '',
}: InteractiveMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Only plot places that have real GPS coordinates
  const validPlaces = useMemo(
    () => places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [places],
  );

  // ── Fit all markers into view ──────────────────────────────────────────────
  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || validPlaces.length === 0) return;

    if (validPlaces.length === 1) {
      map.flyTo({ center: [validPlaces[0].lng, validPlaces[0].lat], zoom: 14, duration: 1100 });
      return;
    }

    const lngs = validPlaces.map((p) => p.lng);
    const lats  = validPlaces.map((p) => p.lat);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 64, duration: 1100, maxZoom: 15 },
    );
  }, [validPlaces]);

  const handleLoad = useCallback(() => fitAll(), [fitAll]);

  // ── Fly-to a specific place (triggered by flyToId prop change) ────────────
  useEffect(() => {
    if (!flyToId) return;
    const map    = mapRef.current;
    const target = validPlaces.find((p) => p.id === flyToId);
    if (!map || !target) return;

    map.flyTo({
      center: [target.lng, target.lat],
      zoom: 15,
      duration: 1400,
      essential: true,
      offset: [0, -40],  // shift marker up so popup stays in frame
    });
    setHoveredId(target.id);
  }, [flyToId, validPlaces]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!TOKEN) {
    return (
      <EmptyState message="Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your Railway env vars to enable the map." />
    );
  }
  if (validPlaces.length === 0) {
    return (
      <EmptyState message="Map unavailable — this day's activities have no GPS coordinates yet." />
    );
  }

  const hoveredPlace = hoveredId
    ? validPlaces.find((p) => p.id === hoveredId) ?? null
    : null;

  // Centroid as default camera centre
  const initLng = validPlaces.reduce((s, p) => s + p.lng, 0) / validPlaces.length;
  const initLat  = validPlaces.reduce((s, p) => s + p.lat, 0) / validPlaces.length;

  return (
    <div
      className={`rounded-2xl overflow-hidden relative ${className}`}
      style={{ height }}
    >
      {/*
       * mapLib tells react-map-gl v8 to use mapbox-gl instead of maplibre-gl.
       * MAPBOX_LIB is a module-level Promise so it is stable across renders.
       */}
      <Map
        ref={mapRef}
        mapLib={MAPBOX_LIB}
        mapboxAccessToken={TOKEN}
        initialViewState={{ longitude: initLng, latitude: initLat, zoom: 12 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onLoad={handleLoad}
        attributionControl
        cooperativeGestures={false}
      >
        {/* Zoom controls */}
        <NavigationControl position="top-right" showCompass={false} />

        {/* Neon markers */}
        {validPlaces.map((place) => (
          <Marker
            key={place.id}
            latitude={place.lat}
            longitude={place.lng}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setHoveredId((prev) => (prev === place.id ? null : place.id));
            }}
          >
            <NeonPin
              place={place}
              active={place.id === flyToId || place.id === hoveredId}
            />
          </Marker>
        ))}

        {/* Hover popup */}
        {hoveredPlace && (
          <Popup
            latitude={hoveredPlace.lat}
            longitude={hoveredPlace.lng}
            anchor="bottom"
            offset={58}
            closeButton={false}
            closeOnClick={false}
            onClose={() => setHoveredId(null)}
          >
            <PlacePopup place={hoveredPlace} />
          </Popup>
        )}
      </Map>

      {/* Fit-all button overlay */}
      <button
        onClick={fitAll}
        className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all hover:text-white/80"
        style={{
          background: 'rgba(8,10,18,0.82)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path
            d="M1 4V1H4M7 1H10V4M10 7V10H7M4 10H1V7"
            stroke="currentColor" strokeWidth="1.3"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        Fit all
      </button>
    </div>
  );
}

export const InteractiveMap = memo(InteractiveMapInner);
