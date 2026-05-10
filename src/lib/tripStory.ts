import type { Activity, DayPlan, DiningSpot, Itinerary } from '@/lib/types';
import type { TripUiLang } from '@/lib/tripUiCopy';

function spotName(slot?: Activity | DiningSpot | null): string | null {
  if (!slot || typeof slot !== 'object') return null;
  const n = 'name' in slot && typeof slot.name === 'string' ? slot.name.trim() : '';
  return n || null;
}

export interface TripStoryDayBlock {
  dayNum: number;
  sentences: string[];
}

/** Short, friendly sentences per day — venue names stay as returned (usually English). */
export function buildTripStoryDays(itinerary: Itinerary, lang: TripUiLang): TripStoryDayBlock[] {
  const days = itinerary.days ?? [];
  return days.map((day, i) => {
    const dayNum = day.day ?? i + 1;
    return { dayNum, sentences: summarizeDay(day, dayNum, lang) };
  });
}

function summarizeDay(day: DayPlan, dayNum: number, lang: TripUiLang): string[] {
  const he = lang === 'he';
  const chunks: string[] = [];

  const b = spotName(day.breakfast);
  const m = spotName(day.morning);
  const l = spotName(day.lunch);
  const a = spotName(day.afternoon);
  const d = spotName(day.dinner);
  const e = spotName(day.evening);

  if (he) {
    if (b) chunks.push(`ארוחת בוקר ב־${b}`);
    if (m) chunks.push(`בוקר ב־${m}`);
    if (l) chunks.push(`צהריים ב־${l}`);
    if (a) chunks.push(`אחר הצהריים — ${a}`);
    if (d) chunks.push(`ארוחת ערב ב־${d}`);
    if (e) chunks.push(`ערב ב־${e}`);
  } else {
    if (b) chunks.push(`Breakfast at ${b}`);
    if (m) chunks.push(`Morning — ${m}`);
    if (l) chunks.push(`Lunch at ${l}`);
    if (a) chunks.push(`Afternoon — ${a}`);
    if (d) chunks.push(`Dinner at ${d}`);
    if (e) chunks.push(`Evening — ${e}`);
  }

  const sentences: string[] = [];

  if (day.theme?.trim()) {
    sentences.push(
      he
        ? `הקו של היום: «${day.theme.trim()}».`
        : `Today's through-line: "${day.theme.trim()}".`,
    );
  }

  if (chunks.length === 0) {
    sentences.push(
      he
        ? `יום ${dayNum} פנוי לקצב שלכם — מצוין לאלתור ולזרימה ✨`
        : `Day ${dayNum} stays flexible — perfect for wandering and happy surprises.`,
    );
    return sentences.slice(0, 3);
  }

  const mid = Math.ceil(chunks.length / 2);
  const first = chunks.slice(0, mid).join(he ? ' · ' : ' · ');
  const rest = chunks.slice(mid).join(he ? ' · ' : ' · ');

  if (first) sentences.push(he ? `${first}.` : `${first}.`);
  if (rest) sentences.push(he ? `${rest}.` : `${rest}.`);

  if (sentences.length === 0) {
    sentences.push(
      he
        ? `יום ${dayNum} מחכה לכם — תעשו את זה בקצב שנוח לכם.`
        : `Day ${dayNum} is yours — take it at your pace.`,
    );
  }

  return sentences.slice(0, 3);
}
