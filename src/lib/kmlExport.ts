import type { Activity, DiningSpot, Itinerary } from '@/lib/types';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface KmlPlace {
  name: string;
  description: string;
  latitude?: number;
  longitude?: number;
}

function activityToPlace(activity: Activity, slot: string): KmlPlace {
  const parts = [
    slot,
    activity.description,
    activity.whyThis,
    activity.neighborhood ? `📍 ${activity.neighborhood}` : null,
    activity.estimatedCost ? `Est. cost: ${activity.estimatedCost}` : null,
  ].filter((p): p is string => !!p);
  return {
    name: activity.name,
    description: parts.join('\n'),
    latitude: activity.latitude,
    longitude: activity.longitude,
  };
}

function diningToPlace(spot: DiningSpot, meal: string): KmlPlace {
  const parts = [
    meal,
    spot.cuisine ? `Cuisine: ${spot.cuisine}` : null,
    spot.mustTry ? `Must try: ${spot.mustTry}` : null,
    spot.neighborhood ? `📍 ${spot.neighborhood}` : null,
  ].filter((p): p is string => !!p);
  return {
    name: spot.name ?? meal,
    description: parts.join('\n'),
    latitude: spot.latitude,
    longitude: spot.longitude,
  };
}

function buildPlacemark(place: KmlPlace): string {
  const point =
    place.latitude != null && place.longitude != null
      ? `\n      <Point><coordinates>${place.longitude},${place.latitude},0</coordinates></Point>`
      : '';
  return `    <Placemark>
      <name>${escapeXml(place.name)}</name>
      <description>${escapeXml(place.description)}</description>${point}
    </Placemark>`;
}

export function buildItineraryKML(itinerary: Itinerary): string {
  const folders = itinerary.days
    .map((day) => {
      const places: KmlPlace[] = [];

      for (const [slot, activity] of [
        ['Morning', day.morning],
        ['Afternoon', day.afternoon],
        ['Evening', day.evening],
      ] as [string, Activity | undefined][]) {
        if (activity?.name) places.push(activityToPlace(activity, slot));
      }

      for (const [meal, spot] of [
        ['Breakfast', day.breakfast],
        ['Lunch', day.lunch],
        ['Dinner', day.dinner],
      ] as [string, DiningSpot | undefined][]) {
        if (spot?.name) places.push(diningToPlace(spot, meal));
      }

      if (places.length === 0) return '';

      const title = day.theme ? `Day ${day.day} — ${day.theme}` : `Day ${day.day}`;
      return `  <Folder>\n    <name>${escapeXml(title)}</name>\n${places.map(buildPlacemark).join('\n')}\n  </Folder>`;
    })
    .filter(Boolean);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<kml xmlns="http://www.opengis.net/kml/2.2">\n` +
    `  <Document>\n` +
    `    <name>${escapeXml(itinerary.destination + ' Trip')}</name>\n` +
    (itinerary.strategicOverview
      ? `    <description>${escapeXml(itinerary.strategicOverview)}</description>\n`
      : '') +
    folders.join('\n') +
    `\n  </Document>\n</kml>\n`
  );
}

export function downloadItineraryKML(itinerary: Itinerary): void {
  const kml = buildItineraryKML(itinerary);
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const safeName =
    itinerary.destination
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'trip';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-places.kml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
