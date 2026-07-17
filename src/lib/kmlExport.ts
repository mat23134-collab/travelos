import type { Activity, DiningSpot, Itinerary } from '@/lib/types';

/** Escapes text for safe use inside KML XML elements. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hasCoords(point: { latitude?: number | null; longitude?: number | null }): point is { latitude: number; longitude: number } {
  return typeof point.latitude === 'number'
    && typeof point.longitude === 'number'
    && Number.isFinite(point.latitude)
    && Number.isFinite(point.longitude)
    && !(point.latitude === 0 && point.longitude === 0);
}

function buildPlacemark(name: string, point: { latitude?: number | null; longitude?: number | null }, description?: string): string | null {
  if (!hasCoords(point)) return null;
  const lines = [
    '<Placemark>',
    `<name>${escapeXml(name)}</name>`,
  ];
  if (description) {
    lines.push(`<description>${escapeXml(description)}</description>`);
  }
  // KML coordinate order is lon,lat[,alt]
  lines.push(`<Point><coordinates>${point.longitude},${point.latitude},0</coordinates></Point>`);
  lines.push('</Placemark>');
  return lines.join('');
}

const SLOT_LABEL: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

const MEAL_LABEL: Record<'breakfast' | 'lunch' | 'dinner', string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

/**
 * Builds a KML document with one folder per itinerary day, each containing
 * placemarks for the day's activities and meals that have valid GPS
 * coordinates. Importable at mymaps.google.com or any KML-aware map app.
 */
export function buildItineraryKML(itinerary: Itinerary): string {
  const folders: string[] = [];

  itinerary.days.forEach((day) => {
    const placemarks: string[] = [];

    const activitySlots: Array<{ key: 'morning' | 'afternoon' | 'evening'; activity?: Activity }> = [
      { key: 'morning', activity: day.morning },
      { key: 'afternoon', activity: day.afternoon },
      { key: 'evening', activity: day.evening },
    ];

    for (const { key, activity } of activitySlots) {
      if (!activity?.name) continue;
      const descriptionParts = [
        `${SLOT_LABEL[key]}${activity.time_slot ? ` · ${activity.time_slot}` : ''}`,
        activity.description,
      ].filter((part): part is string => !!part);
      const placemark = buildPlacemark(activity.name, activity, descriptionParts.join('\n'));
      if (placemark) placemarks.push(placemark);
    }

    const mealSlots: Array<{ key: 'breakfast' | 'lunch' | 'dinner'; spot?: DiningSpot }> = [
      { key: 'breakfast', spot: day.breakfast },
      { key: 'lunch', spot: day.lunch },
      { key: 'dinner', spot: day.dinner },
    ];

    for (const { key, spot } of mealSlots) {
      if (!spot?.name) continue;
      const descriptionParts = [
        MEAL_LABEL[key],
        spot.cuisine ? `Cuisine: ${spot.cuisine}` : null,
        spot.mustTry ? `Must try: ${spot.mustTry}` : null,
      ].filter((part): part is string => !!part);
      const placemark = buildPlacemark(`🍽️ ${spot.name}`, spot, descriptionParts.join('\n'));
      if (placemark) placemarks.push(placemark);
    }

    if (placemarks.length === 0) return;

    const folderName = `Day ${day.day}${day.theme ? ` — ${day.theme}` : ''}`;
    folders.push(`<Folder><name>${escapeXml(folderName)}</name>${placemarks.join('')}</Folder>`);
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    `<name>${escapeXml(`${itinerary.destination} Trip`)}</name>`,
    ...folders,
    '</Document>',
    '</kml>',
  ].join('');
}

/** Builds the .kml file and triggers a browser download — client-side only, no dependencies. */
export function downloadItineraryKML(itinerary: Itinerary): void {
  const kml = buildItineraryKML(itinerary);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const safeName = itinerary.destination.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trip';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-itinerary.kml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens all itinerary stops directly in Google Maps as a multi-stop route.
 * Uses coordinates when available (precise), falls back to "Place Name, City".
 * Capped at 10 waypoints — the most Google Maps handles cleanly in one URL.
 */
export function openItineraryInGoogleMaps(itinerary: Itinerary): void {
  const dest = itinerary.destination;
  const stops: string[] = [];

  for (const day of itinerary.days) {
    for (const slot of ['morning', 'afternoon', 'evening'] as const) {
      const a = day[slot];
      if (!a?.name) continue;
      if (hasCoords(a)) {
        stops.push(`${a.latitude},${a.longitude}`);
      } else {
        stops.push(`${a.name}, ${dest}`);
      }
    }
    // Include dining spots that have coords
    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      const s = day[meal];
      if (!s?.name) continue;
      if (hasCoords(s)) {
        stops.push(`${s.latitude},${s.longitude}`);
      }
    }
  }

  if (stops.length === 0) return;

  const MAX = 10;
  const used = stops.slice(0, MAX);
  const path = used.map((s) => encodeURIComponent(s)).join('/');
  window.open(`https://www.google.com/maps/dir/${path}`, '_blank', 'noopener,noreferrer');
}
