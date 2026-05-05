'use client';

/**
 * InteractiveMap — Mapbox GL dark-v11, react-map-gl v7
 *
 * Pins are colour-coded by activity category to match the GenreCube palette:
 *   sightseeing → blue   (#3b82f6)
 *   food        → orange (#f97316)
 *   shopping    → pink   (#ec4899)
 *   nightlife   → purple (#8b5cf6)
 *   default     → white  (rgba(255,255,255,0.6))
 *
 * Loaded via dynamic import (ssr:false) in DayCard to avoid
 * mapbox-gl touching window during SSR.
 *
 * Exports:
 *   default export  → for Next.js dynamic()
 *   named export    → import type { MapPlace } from '@/components/InteractiveMap'
 */

import { useRef, useCallback, useMemo, useState, useEffect, memo } from 'react';
import Map, {
  Marker,
  Popup,
  NavigationControl,
  type MapRef,
} from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ── Public interface ──────────────────────────────────────────────────────────

export interface MapPlace {
  id: string;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
  vibeLabel: string;
  /** GenreCube category key — drives pin colour */
  category?: 'sightseeing' | 'food' | 'shopping' | 'nightlife' | string;
  /** Human-readable slot label shown in popups, e.g. "Morning · Sightseeing" */
  slotLabel?: string;
}

interface Props {
  places: MapPlace[];
  /** Change to trigger a smooth camera flyTo on that marker. */
  flyToId?: string | null;
  height?: number;
  className?: string;
}

// ── Category → accent colour (mirrors GenreCube GENRE_CONFIG accents) ─────────

const CATEGORY_ACCENT: Record<string, string> = {
  sightseeing: '#3b82f6',  // blue
  food:        '#f97316',  // orange
  shopping:    '#ec4899',  // pink
  nightlife:   '#8b5cf6',  // purple
};

/** Resolve pin colour: category first, vibeLabel fallback */
function pinAccent(category?: string, vibeLabel?: string): string {
  if (category && CATEGORY_ACCENT[category]) return CATEGORY_ACCENT[category];
  // vibeLabel fallback palette
  const VIBE_ACCENT: Record<string, string> = {
    'viral-trend':    '#a855f7',
    'hidden-gem':     '#22c55e',
    'local-favorite': '#f97316',
    'classic':        '#3b82f6',
    'luxury-pick':    '#eab308',
    'budget-pick':    '#06b6d4',
  };
  return VIBE_ACCENT[vibeLabel ?? ''] ?? 'rgba(255,255,255,0.6)';
}

// ── Category human labels ─────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  sightseeing: 'Sightseeing',
  food:        'Food & Dining',
  shopping:    'Shopping',
  nightlife:   'Nightlife',
};

// ── NeonPin marker ────────────────────────────────────────────────────────────

const NeonPin = memo(function NeonPin({
  place,
  active,
}: {
  place: MapPlace;
  active: boolean;
}) {
  const c = pinAccent(place.category, place.vibeLabel);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36 }}>
      {active && (
        <span
          style={{
            position: 'absolute',
            width: 48, height: 48,
            top: -6, left: -6,
            borderRadius: '50%',
            background: `${c}22`,
            border: `1px solid ${c}55`,
            animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite',
          }}
        />
      )}
      <div
        style={{
          width: 36, height: 36,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
          cursor: 'pointer',
          background: `radial-gradient(circle at 38% 32%, ${c}38 0%, rgba(10,12,20,0.94) 80%)`,
          border: `2px solid ${c}`,
          boxShadow: active
            ? `0 0 0 3px ${c}30, 0 0 20px ${c}90, 0 3px 12px rgba(0,0,0,0.75)`
            : `0 0 14px ${c}70, 0 3px 10px rgba(0,0,0,0.7)`,
          transition: 'transform 0.2s',
        }}
      >
        {place.emoji}
      </div>
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

// ── Popup content ─────────────────────────────────────────────────────────────

function PlacePopup({ place }: { place: MapPlace }) {
  const c = pinAccent(place.category, place.vibeLabel);
  const catLabel = place.slotLabel
    ?? (place.category ? CATEGORY_LABEL[place.category] ?? place.category : null);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&ll=${place.lat},${place.lng}`;
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 12,
        background: 'rgba(8,10,18,0.96)',
        border: `1px solid ${c}50`,
        boxShadow: `0 0 18px ${c}30, 0 6px 24px rgba(0,0,0,0.7)`,
        backdropFilter: 'blur(14px)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        position: 'relative',
        minWidth: 160,
      }}
    >
      {catLabel && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: c,
            opacity: 0.85,
          }}
        >
          {catLabel}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{place.emoji}</span>
        <span>{place.name}</span>
      </div>
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 2,
          fontSize: 10,
          fontWeight: 600,
          color: c,
          opacity: 0.8,
          textDecoration: 'none',
          borderTop: `1px solid ${c}22`,
          paddingTop: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Open in Google Maps
      </a>
    </div>
  );
}

// ── Category legend pill ──────────────────────────────────────────────────────

function LegendPill({ category, color, count }: { category: string; color: string; count: number }) {
  const label = CATEGORY_LABEL[category] ?? category;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 999,
        background: 'rgba(8,10,18,0.82)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${color}40`,
        color,
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label} ({count})
    </div>
  );
}

// ── Empty / no-token fallback ─────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: 220,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.025)',
        border: '1px dashed rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 24,
      }}
    >
      <span style={{ fontSize: 28, opacity: 0.25 }}>🗺️</span>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', textAlign: 'center', maxWidth: 220, lineHeight: 1.5, margin: 0 }}>
        {message}
      </p>
    </div>
  );
}

// ── Token ─────────────────────────────────────────────────────────────────────

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

// ── Main component ────────────────────────────────────────────────────────────

function InteractiveMapInner({ places, flyToId, height = 280, className = '' }: Props) {
  const mapRef   = useRef<MapRef>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const validPlaces = useMemo(
    () => places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [places],
  );

  // Build legend: unique categories present in this day's places
  const legendItems = useMemo(() => {
    const counts: Record<string, number> = {};
    validPlaces.forEach((p) => {
      const key = p.category ?? 'sightseeing';
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).map(([cat, count]) => ({
      category: cat,
      color: CATEGORY_ACCENT[cat] ?? 'rgba(255,255,255,0.5)',
      count,
    }));
  }, [validPlaces]);

  // Fit all markers into view
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

  const onLoad = useCallback(() => fitAll(), [fitAll]);

  // flyToId prop → smooth camera move to that marker
  useEffect(() => {
    if (!flyToId) return;
    const map    = mapRef.current;
    const target = validPlaces.find((p) => p.id === flyToId);
    if (!map || !target) return;
    map.flyTo({
      center: [target.lng, target.lat],
      zoom: 15, duration: 1400, essential: true,
      offset: [0, -40],
    });
    setHoveredId(target.id);
  }, [flyToId, validPlaces]);

  // Guards
  if (!TOKEN) {
    return <EmptyState message="Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in Railway env vars to enable the map." />;
  }
  if (validPlaces.length === 0) {
    return <EmptyState message="Map unavailable — activities for this day have no GPS coordinates yet." />;
  }

  const hoveredPlace = hoveredId ? validPlaces.find((p) => p.id === hoveredId) ?? null : null;
  const initLng = validPlaces.reduce((s, p) => s + p.lng, 0) / validPlaces.length;
  const initLat  = validPlaces.reduce((s, p) => s + p.lat, 0) / validPlaces.length;

  return (
    <div
      className={className}
      style={{ height, borderRadius: 16, overflow: 'hidden', position: 'relative' }}
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        initialViewState={{ longitude: initLng, latitude: initLat, zoom: 12 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onLoad={onLoad}
        cooperativeGestures={false}
        attributionControl
      >
        <NavigationControl position="top-right" showCompass={false} />

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

      {/* Category legend */}
      {legendItems.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            maxWidth: 300,
          }}
        >
          {legendItems.map(({ category, color, count }) => (
            <LegendPill key={category} category={category} color={color} count={count} />
          ))}
        </div>
      )}

      {/* Fit-all button */}
      <button
        onClick={fitAll}
        style={{
          position: 'absolute', bottom: 12, right: 12, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', borderRadius: 12,
          background: 'rgba(8,10,18,0.82)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 4V1H4M7 1H10V4M10 7V10H7M4 10H1V7"
            stroke="currentColor" strokeWidth="1.3"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Fit all
      </button>
    </div>
  );
}

// Named export (used by DayCard dynamic import wrapper + type imports)
export const InteractiveMap = memo(InteractiveMapInner);

// Default export (required by user spec + Next.js dynamic())
export default InteractiveMap;
