/** Pretty date range for trip hero subtitle. Expects ISO or YYYY-MM-DD strings. */
export function formatTripDateRange(
  start?: string | null,
  end?: string | null,
  locale = 'en-US',
): string | null {
  const s = start?.trim().slice(0, 10);
  const e = end?.trim().slice(0, 10);
  if (!s || !e || !/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) return null;
  const ds = new Date(`${s}T12:00:00`);
  const de = new Date(`${e}T12:00:00`);
  if (Number.isNaN(+ds) || Number.isNaN(+de)) return null;
  const y1 = ds.getFullYear();
  const y2 = de.getFullYear();
  const m1 = ds.getMonth();
  const d2 = de.getDate();
  const monthDay = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const full = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  if (y1 === y2 && m1 === de.getMonth()) return `${monthDay(ds)}–${d2}, ${y2}`;
  if (y1 === y2) return `${monthDay(ds)} – ${full(de)}`;
  return `${full(ds)} – ${full(de)}`;
}
