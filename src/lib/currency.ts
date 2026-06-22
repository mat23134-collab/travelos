// Display-time conversion of free-text shekel (₪) budgets to US dollars.
// The itinerary budget strings are AI-generated free text (e.g.
// "סביבות 4,500₪–6,000 לשלושה אנשים"); we convert only the amounts that sit
// next to a shekel marker, so plain numbers like "5 ימים" are left alone.

const ILS_TO_USD = 0.27; // approximate; display only

function usd(numStr: string): string {
  const v = Number(numStr.replace(/,/g, ''));
  if (!Number.isFinite(v)) return `$${numStr}`;
  const d = v * ILS_TO_USD;
  const rounded = d >= 500 ? Math.round(d / 50) * 50 : d >= 100 ? Math.round(d / 10) * 10 : Math.round(d / 5) * 5;
  return `$${rounded.toLocaleString('en-US')}`;
}

const MARK = `(?:₪|ש"?ח|שקל\\w*|NIS|ILS)`;
const NUM = `(\\d[\\d,]*)`;
const DASH = `\\s*[-–—]\\s*`;

/** Convert shekel amounts in a free-text budget string to US dollars. */
export function budgetToUsd(text?: string | null): string {
  if (!text) return text ?? '';
  let s = text;
  // Order matters: handle ranges (which carry the marker once) before singles.
  s = s.replace(new RegExp(`${NUM}\\s*${MARK}${DASH}${NUM}`, 'g'), (_m, a, b) => `${usd(a)}–${usd(b)}`); // 4,500₪–6,000
  s = s.replace(new RegExp(`${MARK}\\s*${NUM}${DASH}${NUM}`, 'g'), (_m, a, b) => `${usd(a)}–${usd(b)}`);   // ₪4,500–6,000
  s = s.replace(new RegExp(`${NUM}${DASH}${NUM}\\s*${MARK}`, 'g'), (_m, a, b) => `${usd(a)}–${usd(b)}`);   // 4,500–6,000₪
  s = s.replace(new RegExp(`${NUM}\\s*${MARK}`, 'g'), (_m, a) => usd(a));                                   // 300₪
  s = s.replace(new RegExp(`${MARK}\\s*${NUM}`, 'g'), (_m, a) => usd(a));                                   // ₪300
  return s;
}
