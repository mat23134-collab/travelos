'use client';

/**
 * TripBinderOverview — the Stage 3 "one screen" for a trip's Binder: a budget
 * tracker (planned vs. actual, per currency) plus a day-by-day organizer that
 * rolls up every stop's booking status, note, and attachment count in one place,
 * with trip-level documents (flights, insurance…) at the top.
 *
 * Reads/writes through the shared useTripBinder instance, so opening this while a
 * day panel is open keeps both in sync. Styling matches StopBinder /
 * LogisticsDashboard (var(--color-paper) surfaces, ink-warm text). Bilingual.
 *
 * The itinerary's interactive map already lives on the overview screen; this
 * screen is the organizer/ledger companion to it rather than a second map.
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Itinerary, TripBudgetCategory, TripBudgetStatus, TripItemStatus } from '@/lib/types';
import { TRIP_BUDGET_CATEGORIES } from '@/lib/types';
import type { TripBinder } from '@/hooks/useTripBinder';
import { listAllStops } from '@/lib/confirmationMatch';

const TERRA = '#b8552e';

const CAT_META: Record<TripBudgetCategory, { he: string; en: string; emoji: string }> = {
  flights:       { he: 'טיסות',   en: 'Flights',       emoji: '✈️' },
  accommodation: { he: 'לינה',    en: 'Accommodation', emoji: '🏨' },
  food:          { he: 'אוכל',    en: 'Food',          emoji: '🍽️' },
  transport:     { he: 'תחבורה',  en: 'Transport',     emoji: '🚆' },
  activities:    { he: 'פעילויות', en: 'Activities',    emoji: '🎟️' },
  shopping:      { he: 'קניות',   en: 'Shopping',      emoji: '🛍️' },
  other:         { he: 'אחר',     en: 'Other',         emoji: '📦' },
};

const BUDGET_STATUS_META: Record<TripBudgetStatus, { he: string; en: string; bg: string; fg: string }> = {
  planned:   { he: 'מתוכנן',      en: 'Planned',   bg: 'rgba(107,99,88,0.12)',  fg: '#6b6358' },
  booked:    { he: 'הוזמן',       en: 'Booked',    bg: 'rgba(74,123,222,0.14)', fg: '#3b5da8' },
  paid:      { he: 'שולם',        en: 'Paid',      bg: 'rgba(184,119,46,0.16)', fg: '#8f5a18' },
  cancelled: { he: 'לא יצא לפועל', en: 'Cancelled', bg: 'rgba(120,113,108,0.14)', fg: '#78716c' },
};

const STOP_STATUS_META: Record<TripItemStatus, { he: string; en: string; bg: string; fg: string; dot: string }> = {
  planned:   { he: 'מתוכנן',      en: 'Planned',   bg: 'rgba(107,99,88,0.12)',  fg: '#6b6358', dot: '#9a8f7e' },
  booked:    { he: 'הוזמן',       en: 'Booked',    bg: 'rgba(74,123,222,0.14)', fg: '#3b5da8', dot: '#4a7bde' },
  paid:      { he: 'שולם',        en: 'Paid',      bg: 'rgba(184,119,46,0.16)', fg: '#8f5a18', dot: '#b8772e' },
  confirmed: { he: 'מאושר',       en: 'Confirmed', bg: 'rgba(34,150,94,0.15)',  fg: '#1f7a4d', dot: '#22965e' },
  cancelled: { he: 'לא יצא לפועל', en: 'Cancelled', bg: 'rgba(120,113,108,0.14)', fg: '#78716c', dot: '#a8a29e' },
};

const SLOT_LABEL: Record<string, { he: string; en: string }> = {
  breakfast: { he: 'ארוחת בוקר', en: 'Breakfast' },
  morning:   { he: 'בוקר',       en: 'Morning' },
  lunch:     { he: 'צהריים',     en: 'Lunch' },
  afternoon: { he: 'אחה״צ',      en: 'Afternoon' },
  dinner:    { he: 'ערב',        en: 'Dinner' },
  evening:   { he: 'לילה',       en: 'Evening' },
};

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
}

export function TripBinderOverview({
  itinerary, startDate, binder, he, onClose,
}: {
  itinerary: Itinerary;
  startDate: string | null;
  binder: TripBinder;
  he: boolean;
  onClose: () => void;
}) {
  const stops = useMemo(() => listAllStops(itinerary, startDate), [itinerary, startDate]);
  const stopName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of stops) m.set(s.itemId, s.name);
    return m;
  }, [stops]);

  // Group stops by day for the organizer.
  const days = useMemo(() => {
    const byDay = new Map<number, typeof stops>();
    for (const s of stops) {
      const arr = byDay.get(s.dayNumber) ?? [];
      arr.push(s);
      byDay.set(s.dayNumber, arr);
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
  }, [stops]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto py-6 px-3" dir={he ? 'rtl' : 'ltr'}>
      <div className="fixed inset-0 bg-[#1a130c]/55 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-3xl rounded-3xl overflow-hidden"
        style={{ background: 'var(--color-paper)', boxShadow: '0 24px 70px -20px rgba(26,19,12,0.55)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(43,38,34,0.10)' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">📔</span>
            <div>
              <h2 className="text-[17px] font-black" style={{ color: 'var(--color-ink-warm)' }}>
                {he ? 'קלסר הטיול' : 'Trip Binder'}
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--color-ink-warm-mut)' }}>
                {itinerary.destination}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={he ? 'סגירה' : 'Close'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] transition-colors"
            style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)' }}
          >
            ✕
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-5 flex flex-col gap-6">
          <BudgetSection binder={binder} he={he} stopName={stopName} />
          <OrganizerSection binder={binder} days={days} he={he} startDate={startDate} />
        </div>
      </motion.div>
    </div>
  );
}

/* ── Budget tracker ────────────────────────────────────────────────────────── */

function BudgetSection({ binder, he, stopName }: { binder: TripBinder; he: boolean; stopName: Map<string, string> }) {
  const [adding, setAdding] = useState(false);
  const totals = binder.budgetTotals;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">💰</span>
          <h3 className="text-[13px] font-black uppercase tracking-wide" style={{ color: 'var(--color-ink-warm)' }}>
            {he ? 'תקציב' : 'Budget'}
          </h3>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: '#f6e7df', color: '#8f4220', border: '1px solid rgba(184,85,46,0.3)' }}
          >
            {he ? '＋ שורת הוצאה' : '＋ Add line'}
          </button>
        )}
      </div>

      {/* Planned vs. actual totals, per currency */}
      {totals.length > 0 ? (
        <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${Math.min(totals.length, 2)}, minmax(0,1fr))` }}>
          {totals.map((t) => {
            const diff = t.actual - t.planned;
            return (
              <div key={t.currency} className="rounded-xl p-3" style={{ background: 'var(--color-paper-sunk)' }}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-ink-warm-mut)' }}>
                    {he ? 'מתוכנן' : 'Planned'}
                  </span>
                  <span className="text-[15px] font-black" style={{ color: 'var(--color-ink-warm)' }}>{fmtMoney(t.planned, t.currency)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-ink-warm-mut)' }}>
                    {he ? 'בפועל' : 'Actual'}
                  </span>
                  <span className="text-[15px] font-black" style={{ color: TERRA }}>{fmtMoney(t.actual, t.currency)}</span>
                </div>
                {(t.planned > 0 || t.actual > 0) && (
                  <div className="mt-1.5 pt-1.5 text-[11px] font-semibold text-right border-t" style={{ borderColor: 'rgba(43,38,34,0.08)', color: diff > 0 ? '#b3452e' : '#1f7a4d' }}>
                    {diff === 0 ? (he ? 'בול בתקציב' : 'On budget')
                      : diff > 0 ? `${he ? 'חריגה' : 'Over'} ${fmtMoney(Math.abs(diff), t.currency)}`
                      : `${he ? 'מתחת' : 'Under'} ${fmtMoney(Math.abs(diff), t.currency)}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !adding && (
          <p className="text-[12.5px] mb-3" style={{ color: 'var(--color-ink-warm-mut)' }}>
            {he ? 'עדיין אין שורות תקציב. הוסיפו טיסות, לינה, אוכל — ונעקוב אחרי מתוכנן מול בפועל.' : 'No budget lines yet. Add flights, lodging, food — and track planned vs. actual.'}
          </p>
        )
      )}

      {/* New-line form */}
      <AnimatePresence>
        {adding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
            <BudgetLineForm
              he={he}
              onCancel={() => setAdding(false)}
              onSave={async (input) => { const ok = await binder.saveBudgetItem(input); if (ok) setAdding(false); return ok; }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lines */}
      {binder.budgetItems.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {binder.budgetItems.map((b) => (
            <BudgetLineRow key={b.id} binder={binder} item={b} he={he} stopName={stopName} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BudgetLineRow({
  binder, item, he, stopName,
}: {
  binder: TripBinder;
  item: import('@/lib/types').TripBudgetItem;
  he: boolean;
  stopName: Map<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const cat = CAT_META[item.category] ?? CAT_META.other;
  const st = BUDGET_STATUS_META[item.status] ?? BUDGET_STATUS_META.planned;
  const anchored = item.itemId ? stopName.get(item.itemId) : null;

  if (editing) {
    return (
      <li>
        <BudgetLineForm
          he={he}
          initial={item}
          onCancel={() => setEditing(false)}
          onSave={async (input) => { const ok = await binder.saveBudgetItem({ ...input, id: item.id }); if (ok) setEditing(false); return ok; }}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'var(--color-paper-sunk)' }}>
      <span className="text-[15px]">{cat.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold truncate" style={{ color: 'var(--color-ink-warm)' }}>{item.label}</span>
          <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ background: st.bg, color: st.fg }}>
            {he ? st.he : st.en}
          </span>
        </div>
        <div className="text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: 'var(--color-ink-warm-mut)' }}>
          <span>{he ? cat.he : cat.en}</span>
          {anchored && <span>· {anchored}</span>}
          {item.paidBy && <span>· {he ? 'שילם/ה' : 'paid by'} {item.paidBy}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-black" style={{ color: item.actualCost != null ? TERRA : 'var(--color-ink-warm)' }}>
          {item.actualCost != null ? fmtMoney(item.actualCost, item.currency)
            : item.plannedCost != null ? fmtMoney(item.plannedCost, item.currency)
            : '—'}
        </div>
        {item.actualCost != null && item.plannedCost != null && (
          <div className="text-[10px]" style={{ color: 'var(--color-ink-warm-mut)' }}>
            {he ? 'מתוכנן' : 'plan'} {fmtMoney(item.plannedCost, item.currency)}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button type="button" onClick={() => setEditing(true)} className="text-[12px] px-1 opacity-60 hover:opacity-100" aria-label={he ? 'עריכה' : 'Edit'} style={{ color: 'var(--color-ink-warm)' }}>✎</button>
        <button type="button" onClick={() => void binder.deleteBudgetItem(item.id)} className="text-[12px] px-1 opacity-60 hover:opacity-100" aria-label={he ? 'מחיקה' : 'Delete'} style={{ color: '#b8552e' }}>✕</button>
      </div>
    </li>
  );
}

function BudgetLineForm({
  he, initial, onSave, onCancel,
}: {
  he: boolean;
  initial?: import('@/lib/types').TripBudgetItem;
  onSave: (input: import('@/lib/types').TripBudgetItemInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [category, setCategory] = useState<TripBudgetCategory>(initial?.category ?? 'other');
  const [status, setStatus] = useState<TripBudgetStatus>(initial?.status ?? 'planned');
  const [currency, setCurrency] = useState(initial?.currency ?? 'ILS');
  const [planned, setPlanned] = useState(initial?.plannedCost != null ? String(initial.plannedCost) : '');
  const [actual, setActual] = useState(initial?.actualCost != null ? String(initial.actualCost) : '');
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? '');
  const [busy, setBusy] = useState(false);

  const inputStyle = { background: 'var(--color-paper)', color: 'var(--color-ink-warm)', border: '1px solid rgba(43,38,34,0.14)' };

  const submit = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    const ok = await onSave({
      label: label.trim(),
      category,
      status,
      currency: currency.trim() || 'ILS',
      plannedCost: planned.trim() === '' ? null : Number(planned),
      actualCost: actual.trim() === '' ? null : Number(actual),
      paidBy: paidBy.trim() || null,
    });
    setBusy(false);
    if (!ok) return;
  };

  return (
    <div className="p-3 rounded-xl flex flex-col gap-2.5" style={{ background: 'var(--color-paper-sunk)', border: '1px solid rgba(184,85,46,0.20)' }}>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={he ? 'תיאור (למשל: טיסות TLV→נאריטה)' : 'Description (e.g. Flights TLV→Narita)'}
        className="w-full text-[13px] rounded-lg px-3 py-2 outline-none"
        style={inputStyle}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value as TripBudgetCategory)} className="text-[12.5px] rounded-lg px-2 py-2 outline-none cursor-pointer" style={inputStyle}>
          {TRIP_BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{CAT_META[c].emoji} {he ? CAT_META[c].he : CAT_META[c].en}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as TripBudgetStatus)} className="text-[12.5px] rounded-lg px-2 py-2 outline-none cursor-pointer" style={inputStyle}>
          {(['planned', 'booked', 'paid', 'cancelled'] as TripBudgetStatus[]).map((s) => <option key={s} value={s}>{he ? BUDGET_STATUS_META[s].he : BUDGET_STATUS_META[s].en}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input value={planned} onChange={(e) => setPlanned(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={he ? 'מתוכנן' : 'Planned'} className="text-[12.5px] rounded-lg px-2 py-2 outline-none" style={inputStyle} />
        <input value={actual} onChange={(e) => setActual(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={he ? 'בפועל' : 'Actual'} className="text-[12.5px] rounded-lg px-2 py-2 outline-none" style={inputStyle} />
        <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 4))} placeholder="ILS" className="text-[12.5px] rounded-lg px-2 py-2 outline-none uppercase" style={inputStyle} />
      </div>
      <input value={paidBy} onChange={(e) => setPaidBy(e.target.value)} placeholder={he ? 'מי שילם? (אופציונלי)' : 'Paid by? (optional)'} className="w-full text-[12.5px] rounded-lg px-3 py-2 outline-none" style={inputStyle} />
      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-ink-warm-mut)' }}>
          {he ? 'ביטול' : 'Cancel'}
        </button>
        <button type="button" onClick={submit} disabled={!label.trim() || busy} className="text-[12px] font-bold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50" style={{ background: TERRA, color: '#fff' }}>
          {busy ? (he ? 'שומר…' : 'Saving…') : (he ? 'שמירה' : 'Save')}
        </button>
      </div>
    </div>
  );
}

/* ── Day-by-day organizer ──────────────────────────────────────────────────── */

function OrganizerSection({
  binder, days, he, startDate,
}: {
  binder: TripBinder;
  days: Array<[number, ReturnType<typeof listAllStops>]>;
  he: boolean;
  startDate: string | null;
}) {
  const tripDocs = binder.tripDocs;

  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm">🗓️</span>
        <h3 className="text-[13px] font-black uppercase tracking-wide" style={{ color: 'var(--color-ink-warm)' }}>
          {he ? 'סדר יום ומסמכים' : 'Days & documents'}
        </h3>
      </div>

      {/* Trip-level documents (not tied to a stop) */}
      {tripDocs.length > 0 && (
        <div className="mb-4 rounded-xl p-3" style={{ background: 'var(--color-paper-sunk)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--color-ink-warm-mut)' }}>
            {he ? 'מסמכי הטיול' : 'Trip documents'}
          </div>
          <ul className="flex flex-col gap-1.5">
            {tripDocs.map((f) => (
              <li key={f.name} className="flex items-center gap-2">
                <span className="text-[13px]">{docEmoji(f.docType)}</span>
                <a href={f.url ?? '#'} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-[12.5px] font-medium hover:underline" style={{ color: 'var(--color-ink-warm)' }}>
                  {f.label}
                </a>
                <button type="button" onClick={() => void binder.deleteDoc(f.name)} className="text-[12px] px-1 opacity-60 hover:opacity-100" style={{ color: '#b8552e' }} aria-label={he ? 'מחיקה' : 'Delete'}>✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {days.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: 'var(--color-ink-warm-mut)' }}>
          {he ? 'אין עדיין עצירות עם מזהה לשיוך מסמכים.' : 'No stops yet to attach documents to.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map(([dayNumber, dayStops]) => (
            <div key={dayNumber}>
              <div className="text-[11px] font-black mb-1.5" style={{ color: TERRA }}>
                {he ? `יום ${dayNumber}` : `Day ${dayNumber}`}
                {dayStops[0]?.dayDateISO && (
                  <span className="font-medium ms-2" style={{ color: 'var(--color-ink-warm-mut)' }}>{dayStops[0].dayDateISO}</span>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {dayStops.map((s) => {
                  const data = binder.forItem(s.itemId);
                  const st = data.status ? STOP_STATUS_META[data.status] : null;
                  const attach = data.attachments.length;
                  const hasNote = data.noteText.trim().length > 0;
                  const cancelled = data.status === 'cancelled';
                  const bare = !st && attach === 0 && !hasNote;
                  return (
                    <li key={s.itemId} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: bare ? 'transparent' : 'var(--color-paper-sunk)', opacity: cancelled ? 0.6 : 1 }}>
                      <span className="text-[10px] font-bold uppercase w-16 shrink-0" style={{ color: 'var(--color-ink-warm-mut)' }}>
                        {he ? SLOT_LABEL[s.slot]?.he : SLOT_LABEL[s.slot]?.en}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-[12.5px] font-semibold" style={{ color: 'var(--color-ink-warm)', textDecoration: cancelled ? 'line-through' : 'none' }}>{s.name}</span>
                      {data.status === 'paid' && data.paidAmount != null && (
                        <span className="text-[11px] font-bold shrink-0" style={{ color: '#8f5a18' }}>{fmtMoney(data.paidAmount, data.paidCurrency)}</span>
                      )}
                      {st && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: st.bg, color: st.fg }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: st.dot }} />
                          {he ? st.he : st.en}
                        </span>
                      )}
                      {attach > 0 && <span className="text-[11px] shrink-0" style={{ color: 'var(--color-ink-warm-mut)' }}>📎{attach}</span>}
                      {hasNote && <span className="text-[11px] shrink-0" title={data.noteText}>📝</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function docEmoji(t: string | null): string {
  switch (t) {
    case 'flight': return '✈️';
    case 'hotel': return '🏨';
    case 'ticket': return '🎫';
    case 'passport': return '🛂';
    case 'insurance': return '🛡️';
    case 'reservation': return '📋';
    default: return '📄';
  }
}
