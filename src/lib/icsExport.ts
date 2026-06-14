import type { Activity, DiningSpot, Itinerary, TravelerProfile } from '@/lib/types';

/** Default time blocks used when an activity has no time_slot/startTime/endTime. */
const DEFAULT_ACTIVITY_BLOCKS: Record<'morning' | 'afternoon' | 'evening', [string, string]> = {
  morning: ['09:00', '12:00'],
  afternoon: ['13:00', '17:00'],
  evening: ['19:00', '22:00'],
};

/** Default time blocks for meals when no timing info is available. */
const DEFAULT_MEAL_BLOCKS: Record<'breakfast' | 'lunch' | 'dinner', [string, string]> = {
  breakfast: ['08:00', '09:00'],
  lunch: ['13:00', '14:00'],
  dinner: ['19:30', '21:00'],
};

const MEAL_LABEL: Record<'breakfast' | 'lunch' | 'dinner', string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

/** Parses "09:00 – 11:30" / "09:00-11:30" / "09:00 to 11:30" into ["09:00","11:30"]. */
function parseTimeSlot(slot?: string | null): [string, string] | null {
  if (!slot) return null;
  const matches = slot.match(/(\d{1,2}:\d{2})/g);
  if (!matches || matches.length < 2) return null;
  return [matches[0], matches[1]];
}

function activityTimes(activity: Activity, fallback: [string, string]): [string, string] {
  const fromSlot = parseTimeSlot(activity.time_slot);
  if (fromSlot) return fromSlot;
  if (activity.startTime && activity.endTime) {
    return [activity.startTime, activity.endTime];
  }
  return fallback;
}

/** Computes the calendar date for a given day index (0-based) from the trip's ISO start date. */
function resolveDayDate(startDate: string | undefined, offset: number): Date {
  const base = startDate ? new Date(startDate) : new Date();
  const resolved = Number.isFinite(base.getTime()) ? base : new Date();
  const result = new Date(resolved);
  result.setDate(result.getDate() + offset);
  return result;
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  const result = new Date(date);
  result.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return result;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formats a Date as a floating-time iCalendar DATE-TIME value (no timezone/Z suffix). */
function formatIcsLocal(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}T${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

/** Formats a Date as a UTC iCalendar DATE-TIME value (with Z suffix), for DTSTAMP. */
function formatIcsUtc(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
}

/** Escapes text per RFC 5545 (commas, semicolons, backslashes, newlines). */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Folds a content line to 75 octets per RFC 5545 (simple char-based approximation). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    chunks.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  chunks.push(rest);
  return chunks.join('\r\n');
}

interface IcsEventInput {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
}

function buildEvent(stamp: string, event: IcsEventInput): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatIcsLocal(event.start)}`,
    `DTEND:${formatIcsLocal(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  lines.push('END:VEVENT');
  return lines.map(foldLine);
}

/**
 * Builds an RFC 5545 .ics calendar (one VEVENT per planned activity and meal)
 * from a generated itinerary. Dates are derived from `profile.startDate` + the
 * day offset (DayPlan.date is a non-ISO display string and isn't used here).
 * Times use floating local time — no timezone is embedded.
 */
export function buildItineraryICS(itinerary: Itinerary, profile: TravelerProfile | null): string {
  const stamp = formatIcsUtc(new Date());
  const events: string[] = [];
  let counter = 0;

  itinerary.days.forEach((day, index) => {
    const date = resolveDayDate(profile?.startDate, index);

    const activitySlots: Array<{ key: 'morning' | 'afternoon' | 'evening'; activity?: Activity }> = [
      { key: 'morning', activity: day.morning },
      { key: 'afternoon', activity: day.afternoon },
      { key: 'evening', activity: day.evening },
    ];

    for (const { key, activity } of activitySlots) {
      if (!activity?.name) continue;
      const [startStr, endStr] = activityTimes(activity, DEFAULT_ACTIVITY_BLOCKS[key]);
      const start = combineDateAndTime(date, startStr);
      let end = combineDateAndTime(date, endStr);
      if (end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + 60 * 60 * 1000);
      }
      const descriptionParts = [
        activity.description,
        activity.whyThis,
        activity.estimatedCost ? `Est. cost: ${activity.estimatedCost}` : null,
      ].filter((part): part is string => !!part);

      events.push(
        ...buildEvent(stamp, {
          uid: `travelos-${index}-${key}-${counter++}@travelos`,
          start,
          end,
          summary: activity.category_emoji ? `${activity.category_emoji} ${activity.name}` : activity.name,
          location: activity.neighborhood,
          description: descriptionParts.join('\n'),
        }),
      );
    }

    const mealSlots: Array<{ key: 'breakfast' | 'lunch' | 'dinner'; spot?: DiningSpot }> = [
      { key: 'breakfast', spot: day.breakfast },
      { key: 'lunch', spot: day.lunch },
      { key: 'dinner', spot: day.dinner },
    ];

    for (const { key, spot } of mealSlots) {
      if (!spot?.name) continue;
      const [startStr, endStr] = DEFAULT_MEAL_BLOCKS[key];
      const start = combineDateAndTime(date, startStr);
      const end = combineDateAndTime(date, endStr);
      const descriptionParts = [
        spot.cuisine ? `Cuisine: ${spot.cuisine}` : null,
        spot.mustTry ? `Must try: ${spot.mustTry}` : null,
      ].filter((part): part is string => !!part);

      events.push(
        ...buildEvent(stamp, {
          uid: `travelos-${index}-${key}-${counter++}@travelos`,
          start,
          end,
          summary: `🍽️ ${spot.name} (${MEAL_LABEL[key]})`,
          location: spot.neighborhood,
          description: descriptionParts.join('\n'),
        }),
      );
    }
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TravelOS//Itinerary Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcsText(`${itinerary.destination} Trip`)}`),
    ...events,
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/** Builds the .ics file and triggers a browser download — client-side only, no dependencies. */
export function downloadItineraryICS(itinerary: Itinerary, profile: TravelerProfile | null): void {
  const ics = buildItineraryICS(itinerary, profile);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = itinerary.destination.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'trip';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}-itinerary.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
