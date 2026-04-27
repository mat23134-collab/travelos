'use client';

import { useEffect, useRef, useState } from 'react';
import { DayPlan } from '@/lib/types';

const DAY_COLORS = [
  '#ff5a5f', '#3b82f6', '#10b981', '#8b5cf6',
  '#f59e0b', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
];

interface MarkerData {
  lat: number;
  lon: number;
  label: string;
  dayIndex: number;
  time: string;
  neighborhood: string;
}

interface Props {
  days: DayPlan[];
  destination: string;
  focusedNeighborhood?: string;
}

const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  if (geocodeCache.has(query)) return geocodeCache.get(query)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'TravelOS/1.0 (travel planning app)' } }
    );
    const data = await res.json();
    const result = data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    geocodeCache.set(query, result);
    return result;
  } catch {
    geocodeCache.set(query, null);
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ItineraryMap({ days, destination, focusedNeighborhood }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersByNeighborhood = useRef<Map<string, { marker: any; iconEl: HTMLElement }>>(new Map());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);

  // Focus a neighborhood: pan, open popup, bounce the icon
  useEffect(() => {
    if (!focusedNeighborhood || !mapInstanceRef.current) return;

    // Normalize: try exact match first, then partial
    const key = [...markersByNeighborhood.current.keys()].find(
      (k) => k.toLowerCase().includes(focusedNeighborhood.toLowerCase())
    );
    if (!key) return;

    const { marker, iconEl } = markersByNeighborhood.current.get(key)!;
    mapInstanceRef.current.flyTo(marker.getLatLng(), 15, { animate: true, duration: 0.8 });
    marker.openPopup();

    // Trigger CSS bounce animation
    iconEl.classList.remove('animate-bounce-pin');
    void iconEl.offsetWidth; // force reflow
    iconEl.classList.add('animate-bounce-pin');
    const timer = setTimeout(() => iconEl.classList.remove('animate-bounce-pin'), 800);
    return () => clearTimeout(timer);
  }, [focusedNeighborhood]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!mapRef.current || mapInstanceRef.current) return;

      try {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');

        if (cancelled || !mapRef.current) return;

        const centerResult = await geocode(destination);
        if (cancelled) return;

        const center: [number, number] = centerResult
          ? [centerResult.lat, centerResult.lon]
          : [35.6762, 139.6503];

        const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false });
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(map);

        const activitySlots: { neighborhood: string; name: string; time: string; dayIndex: number }[] = [];
        days.forEach((day, di) => {
          const slots = [
            { act: day.morning, time: 'Morning' },
            { act: day.afternoon, time: 'Afternoon' },
            { act: day.evening, time: 'Evening' },
          ];
          slots.forEach(({ act, time }) => {
            if (act?.neighborhood) {
              activitySlots.push({ neighborhood: act.neighborhood, name: act.name, time, dayIndex: di });
            }
          });
        });

        const markers: MarkerData[] = [];
        const total = activitySlots.length + 1;
        let done = 0;

        for (const slot of activitySlots) {
          if (cancelled) return;
          const query = `${slot.neighborhood}, ${destination}`;
          const coords = await geocode(query);
          done++;
          setProgress(Math.round((done / total) * 100));

          if (coords) {
            markers.push({
              lat: coords.lat,
              lon: coords.lon,
              label: slot.name,
              dayIndex: slot.dayIndex,
              time: slot.time,
              neighborhood: slot.neighborhood,
            });
          }
          await sleep(350);
        }

        if (cancelled) return;

        if (markers.length === 0) {
          map.setView(center, 12);
          setStatus('ready');
          return;
        }

        const latLngs: [number, number][] = [];
        markers.forEach((m) => {
          const color = DAY_COLORS[m.dayIndex % DAY_COLORS.length];

          // Create a wrapper so we can grab the DOM element for animation
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'width:26px;height:26px;border-radius:50%;background:' + color + ';border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:10px;';
          wrapper.textContent = String(m.dayIndex + 1);

          const icon = L.divIcon({
            className: '',
            html: wrapper.outerHTML,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const leafletMarker = L.marker([m.lat, m.lon], { icon })
            .addTo(map)
            .bindPopup(
              `<div style="font-family:sans-serif;min-width:160px">
                <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Day ${m.dayIndex + 1} · ${m.time}</div>
                <div style="font-weight:600;font-size:13px;color:#111">${m.label}</div>
                <div style="font-size:11px;color:#9ca3af;margin-top:2px">📍 ${m.neighborhood}</div>
              </div>`,
              { maxWidth: 220 }
            );

          // Store ref for focus behavior — the icon el is in the marker's _icon property
          const getIconEl = () => (leafletMarker as unknown as { _icon?: HTMLElement })._icon;
          markersByNeighborhood.current.set(m.neighborhood, {
            marker: leafletMarker,
            get iconEl() { return getIconEl() ?? wrapper; },
          });

          latLngs.push([m.lat, m.lon]);
        });

        map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 14 });
        setStatus('ready');
        setProgress(100);
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    init();
    return () => {
      cancelled = true;
      markersByNeighborhood.current.clear();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [days, destination]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[#e5e7eb] shadow-sm bg-[#f0ede4]" style={{ height: 380 }}>
      <div ref={mapRef} className="w-full h-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f8f7f2]/90 gap-3 z-[1000]">
          <div className="w-10 h-10 rounded-full border-t-[#ff5a5f] border-[#ff5a5f]/30 animate-spin" style={{ borderWidth: 3 }} />
          <p className="text-sm text-[#6b7280]">Mapping your route{progress > 0 ? ` · ${progress}%` : '...'}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f8f7f2]/90 z-[1000]">
          <p className="text-sm text-[#9ca3af]">Map unavailable — check your connection</p>
        </div>
      )}

      {status === 'ready' && (
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-1.5 max-w-xs">
          {days.map((day, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 shadow-sm text-[10px] font-semibold"
              style={{ color: DAY_COLORS[i % DAY_COLORS.length] }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
              />
              Day {i + 1}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
