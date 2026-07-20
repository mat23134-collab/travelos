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
  planned:   { he: 'מתוכנן', en: 'Planned',   bg: 'rgba(107,99,88,0.12)',  fg: '#6b6358', dot: '#9a8f7e' },
  booked:    { he: 'הוזמן',  en: 'Booked',    bg: 'rgba(74,123,222,0.14)', fg: '#3b5da8', dot: '#4a7bde' },
  paid:      { he: 'שולם',   en: 'Paid',      bg: 'rgba(184,119,46,0.16)', fg: '#8f5a18', dot: '#b8772e' },
  confirmed: { he: 'מאושר',  en: 'Confirmed', bg: 'rgba(34,150,94,0.15)',  fg: '#1f7a4d', dot: '#22965e' },
};
const STATUS_ORDER: TripItemStatus[] = ['planned', 'booked', 'paid', 'confirmed'];

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
  const [noteDraft, setNoteDraft] = useState<string | null>(null); // null = not editing
  const [uploadType, setUploadType] = useState<TripDocType>('reservation');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!binder.enabled || !itemId) return null;

  const data = binder.forItem(itemId);
  const statusMeta = data.status ? STATUS_META[data.status] : null;
  const attachCount = data.attachments.length;
  const hasNote = data.noteText.trim().length > 0;

  const cycleStatus = () => {
    const cur = data.status;
    const next = cur === null
      ? STATUS_ORDER[0]
      : STATUS_ORDER[(STATUS_ORDER.indexOf(cur) + 1) % (STATUS_ORDER.length + 1)] ?? null;
    void binder.saveNote(itemId, { status: next });
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
        <button
          type="button"
          onClick={cycleStatus}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors"
          style={statusMeta
            ? { background: statusMeta.bg, color: statusMeta.fg }
            : { background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm-mut)' }}
          title={he ? 'הקישו לשינוי סטטוס' : 'Tap to change status'}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusMeta?.dot ?? '#c3b8a5' }} />
          {statusMeta ? (he ? statusMeta.he : statusMeta.en) : (he ? '+ סטטוס' : '+ Status')}
        </button>

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
