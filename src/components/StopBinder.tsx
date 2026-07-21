'use client';

/**
 * StopBinder — per-stop Trip Binder controls that sit under a stop in the day
 * timeline: a booking-status chip, an inline editable note, and attachments
 * (upload + list + delete). Reads/writes through the shared useTripBinder
 * instance passed in, so all stops share one fetch.
 *
 * Card styling matches LogisticsDashboard (var(--color-paper) surfaces,
 * var(--color-paper-sunk) insets, ink-warm text). Bilingual via `he`.
 * Renders nothing when the stop has no item_id (can't anchor) or the binder is
 * disabled (guest / no trip id).
 */

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TripBinder } from '@/hooks/useTripBinder';
import { TRIP_DOC_TYPES, type TripDocType, type TripItemStatus } from '@/lib/types';

const STATUS_META: Record<TripItemStatus, { he: string; en: string; bg: string; fg: string; dot: string }> = {
  planned:   { he: 'מתוכנן',      en: 'Planned',   bg: 'rgba(107,99,88,0.12)',  fg: '#6b6358', dot: '#9a8f7e' },
  booked:    { he: 'הוזמן',       en: 'Booked',    bg: 'rgba(74,123,222,0.14)', fg: '#3b5da8', dot: '#4a7bde' },
  paid:      { he: 'שולם',        en: 'Paid',      bg: 'rgba(184,119,46,0.16)', fg: '#8f5a18', dot: '#b8772e' },
  confirmed: { he: 'מאושר',       en: 'Confirmed', bg: 'rgba(34,150,94,0.15)',  fg: '#1f7a4d', dot: '#22965e' },
  cancelled: { he: 'לא יצא לפועל', en: 'Cancelled', bg: 'rgba(120,113,108,0.14)', fg: '#78716c', dot: '#a8a29e' },
};
const STATUS_ORDER: TripItemStatus[] = ['planned', 'booked', 'paid', 'confirmed', 'cancelled'];

const DOC_LABEL: Record<TripDocType, { he: string; en: string }> = {
  flight:      { he: 'טיסה',  en: 'Flight' },
  hotel:       { he: 'מלון',  en: 'Hotel' },
  ticket:      { he: 'כרטיס', en: 'Ticket' },
  passport:    { he: 'דרכון', en: 'Passport' },
  insurance:   { he: 'ביטוח', en: 'Insurance' },
  reservation: { he: 'הזמנה', en: 'Reservation' },
  other:       { he: 'אחר',   en: 'Other' },
};

export function StopBinder({
  binder, itemId, he,
}: {
  binder: TripBinder;
  itemId: string | null | undefined;
  he: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [amountDraft, setAmountDraft] = useState<string | null>(null); // null = not editing
  const [noteDraft, setNoteDraft] = useState<string | null>(null); // null = not editing
  const [uploadType, setUploadType] = useState<TripDocType>('reservation');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!binder.enabled || !itemId) return null;

  const data = binder.forItem(itemId);
  const statusMeta = data.status ? STATUS_META[data.status] : null;
  const attachCount = data.attachments.length;
  const hasNote = data.noteText.trim().length > 0;

  const pickStatus = (next: TripItemStatus | null) => {
    setStatusOpen(false);
    if (next === data.status) return;
    // Clear a recorded amount when a stop leaves 'paid'.
    const patch: { status: TripItemStatus | null; paidAmount?: number | null } = { status: next };
    if (next !== 'paid' && data.paidAmount != null) patch.paidAmount = null;
    void binder.saveNote(itemId, patch);
  };

  const commitAmount = () => {
    if (amountDraft === null) return;
    const raw = amountDraft.trim();
    setAmountDraft(null);
    const val = raw === '' ? null : Math.round(Number(raw) * 100) / 100;
    if (val !== null && !Number.isFinite(val)) return;
    if (val !== data.paidAmount) void binder.saveNote(itemId, { paidAmount: val, paidCurrency: data.paidCurrency });
  };

  const commitNote = () => {
    if (noteDraft === null) return;
    const trimmed = noteDraft;
    setNoteDraft(null);
    if (trimmed !== data.noteText) void binder.saveNote(itemId, { noteText: trimmed });
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (list.length === 0) return;
    setBusy(true);
    await binder.uploadDocs(itemId, list, uploadType);
    setBusy(false);
  };

  return (
    <div className="mt-1.5" dir={he ? 'rtl' : 'ltr'}>
      {/* Collapsed summary row — status chip + attachment/note indicators */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status chip → opens a menu of every option (no more tap-to-cycle) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors"
            style={statusMeta
              ? { background: statusMeta.bg, color: statusMeta.fg }
              : { background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm-mut)' }}
            aria-haspopup="menu"
            aria-expanded={statusOpen}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta?.dot ?? '#c3b8a5' }} />
            {statusMeta ? (he ? statusMeta.he : statusMeta.en) : (he ? '+ סטטוס' : '+ Status')}
            <span style={{ fontSize: 8 }}>{statusOpen ? '▲' : '▼'}</span>
          </button>
          <AnimatePresence>
            {statusOpen && (
              <>
                {/* click-away */}
                <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  role="menu"
                  className="absolute z-20 mt-1 p-1 rounded-xl min-w-[140px]"
                  style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)', border: '1px solid rgba(43,38,34,0.10)', insetInlineStart: 0 }}
                >
                  {STATUS_ORDER.map((s) => {
                    const m = STATUS_META[s];
                    const active = data.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        role="menuitem"
                        onClick={() => pickStatus(s)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-start transition-colors"
                        style={{ background: active ? m.bg : 'transparent', color: active ? m.fg : 'var(--color-ink-warm)' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
                        {he ? m.he : m.en}
                        {active && <span className="ms-auto text-[11px]">✓</span>}
                      </button>
                    );
                  })}
                  {data.status && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => pickStatus(null)}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-start transition-colors"
                      style={{ color: 'var(--color-ink-warm-mut)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#c3b8a5' }} />
                      {he ? 'ניקוי סטטוס' : 'Clear status'}
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Paid → inline amount editor; folds into the Binder budget's actual total */}
        {data.status === 'paid' && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(184,119,46,0.12)' }}>
            <span className="text-[11px] font-bold" style={{ color: '#8f5a18' }}>💳</span>
            <input
              value={amountDraft ?? (data.paidAmount != null ? String(data.paidAmount) : '')}
              onChange={(e) => setAmountDraft(e.target.value.replace(/[^\d.]/g, ''))}
              onFocus={() => setAmountDraft(data.paidAmount != null ? String(data.paidAmount) : '')}
              onBlur={commitAmount}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              inputMode="decimal"
              placeholder={he ? 'סכום' : 'Amount'}
              className="w-16 bg-transparent text-[11px] font-bold outline-none text-center"
              style={{ color: '#8f5a18' }}
            />
            <span className="text-[10px] font-bold" style={{ color: '#8f5a18' }}>{data.paidCurrency}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
          style={{
            background: attachCount > 0 || hasNote ? 'rgba(184,85,46,0.10)' : 'var(--color-paper-sunk)',
            color: attachCount > 0 || hasNote ? 'var(--color-terracotta-deep, #8f4220)' : 'var(--color-ink-warm-mut)',
          }}
        >
          📎 {attachCount > 0 ? attachCount : ''}{hasNote ? ' 📝' : ''}
          <span>{he ? 'קבצים והערות' : 'Files & notes'}</span>
          <span style={{ fontSize: 9 }}>{open ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* Expanded panel */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="mt-2 p-3 rounded-xl flex flex-col gap-3"
              style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
            >
              {/* Note */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-ink-warm-mut)' }}>
                  {he ? 'הערה' : 'Note'}
                </div>
                <textarea
                  value={noteDraft ?? data.noteText}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onFocus={() => setNoteDraft(data.noteText)}
                  onBlur={commitNote}
                  placeholder={he ? 'מספר אישור, תזכורת, פרטים…' : 'Confirmation number, reminder, details…'}
                  rows={2}
                  className="w-full text-[13px] rounded-lg px-3 py-2 resize-y outline-none"
                  style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)', border: '1px solid rgba(43,38,34,0.10)' }}
                />
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-ink-warm-mut)' }}>
                    {he ? 'קבצים מצורפים' : 'Attachments'}
                  </span>
                </div>

                {attachCount > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-2">
                    {data.attachments.map((f) => (
                      <li
                        key={f.name}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                        style={{ background: 'var(--color-paper-sunk)' }}
                      >
                        <span className="text-[13px]">{docEmoji(f.docType)}</span>
                        <a
                          href={f.url ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0 truncate text-[12.5px] font-medium hover:underline"
                          style={{ color: 'var(--color-ink-warm)' }}
                        >
                          {f.label}
                        </a>
                        {f.docType && (
                          <span className="text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'rgba(184,85,46,0.10)', color: '#8f4220' }}>
                            {he ? DOC_LABEL[f.docType].he : DOC_LABEL[f.docType].en}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => void binder.deleteDoc(f.name)}
                          className="shrink-0 text-[12px] px-1.5 opacity-60 hover:opacity-100"
                          style={{ color: '#b8552e' }}
                          aria-label={he ? 'מחיקה' : 'Delete'}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Upload row — doc-type select + file picker */}
                <div className="flex items-center gap-2">
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value as TripDocType)}
                    className="text-[12px] rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                    style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)', border: '1px solid rgba(43,38,34,0.10)' }}
                  >
                    {TRIP_DOC_TYPES.map((t) => (
                      <option key={t} value={t}>{he ? DOC_LABEL[t].he : DOC_LABEL[t].en}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    style={{ background: '#f6e7df', color: '#8f4220', border: '1px solid rgba(184,85,46,0.3)' }}
                  >
                    {busy ? (he ? 'מעלה…' : 'Uploading…') : (he ? '＋ העלו קובץ' : '＋ Add file')}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="application/pdf,image/png,image/jpeg,image/webp,image/heic"
                    onChange={onPickFiles}
                    className="hidden"
                  />
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-ink-warm-mut)' }}>
                  {he ? 'PDF או תמונה · עד 15MB · פרטי, רק אתם רואים' : 'PDF or image · up to 15MB · private to you'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
