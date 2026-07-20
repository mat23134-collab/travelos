'use client';

/**
 * ScanBookingModal — Stage 2 smart intake. Photograph a flight/hotel/ticket
 * confirmation; we parse it (scan-notes mode=confirmation), PROPOSE the day+stop
 * it belongs to (rankStopCandidates), and let the traveler confirm or override
 * before filing. Nothing is filed until "File it" is pressed — never silent.
 *
 * On confirm: the original image is attached to the chosen stop (or the whole
 * trip) via the shared binder, and — for a stop — the confirmation number is
 * added as a note with status "booked" (never downgrading an existing status).
 */

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Itinerary, TripDocType } from '@/lib/types';
import type { ParsedConfirmation } from '@/app/api/scan-notes/route';
import type { TripBinder } from '@/hooks/useTripBinder';
import { rankStopCandidates, listAllStops, type StopCandidate } from '@/lib/confirmationMatch';

type Step = 'pick' | 'scanning' | 'review' | 'filing' | 'done' | 'error';

const DOC_TYPES: TripDocType[] = ['flight', 'hotel', 'ticket', 'reservation', 'passport', 'insurance', 'other'];
const DOC_LABEL: Record<TripDocType, { he: string; en: string }> = {
  flight: { he: 'טיסה', en: 'Flight' }, hotel: { he: 'מלון', en: 'Hotel' },
  ticket: { he: 'כרטיס', en: 'Ticket' }, reservation: { he: 'הזמנה', en: 'Reservation' },
  passport: { he: 'דרכון', en: 'Passport' }, insurance: { he: 'ביטוח', en: 'Insurance' },
  other: { he: 'אחר', en: 'Other' },
};

const SLOT_LABEL: Record<string, { he: string; en: string }> = {
  breakfast: { he: 'בוקר', en: 'Breakfast' }, morning: { he: 'בוקר', en: 'Morning' },
  lunch: { he: 'צהריים', en: 'Lunch' }, afternoon: { he: 'צהריים', en: 'Afternoon' },
  dinner: { he: 'ערב', en: 'Dinner' }, evening: { he: 'ערב', en: 'Evening' },
};

const TERRA = '#b8552e';

export function ScanBookingModal({
  itinerary, startDate, binder, he, initialDayIndex, onClose,
}: {
  itinerary: Itinerary;
  startDate: string | null;
  binder: TripBinder;
  he: boolean;
  initialDayIndex?: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('pick');
  const [errorMsg, setErrorMsg] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedConfirmation | null>(null);
  const [docType, setDocType] = useState<TripDocType>('reservation');
  // selection: item_id string, or '' for whole-trip.
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const candidates = useMemo(
    () => (parsed ? rankStopCandidates(itinerary, startDate, parsed) : []),
    [parsed, itinerary, startDate],
  );
  const allStops = useMemo(() => listAllStops(itinerary, startDate), [itinerary, startDate]);
  const stopById = useMemo(() => new Map(allStops.map((s) => [s.itemId, s])), [allStops]);

  const readAsDataUrl = (f: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error('read failed'));
      r.readAsDataURL(f);
    });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    setStep('scanning');
    setErrorMsg('');
    try {
      const dataUrl = await readAsDataUrl(f);
      const res = await fetch('/api/scan-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mode: 'confirmation' }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error || 'Scan failed');
      }
      const { confirmation } = (await res.json()) as { confirmation: ParsedConfirmation };
      setParsed(confirmation);
      setDocType((DOC_TYPES.includes(confirmation.docType as TripDocType) ? confirmation.docType : 'reservation') as TripDocType);
      const best = rankStopCandidates(itinerary, startDate, confirmation)[0];
      setSelectedItemId(best?.itemId ?? '');
      setStep('review');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Scan failed');
      setStep('error');
    }
  };

  const fileIt = async () => {
    if (!file || !parsed) return;
    setStep('filing');
    try {
      let ok: boolean;
      if (selectedItemId) {
        ok = await binder.uploadDocs(selectedItemId, [file], docType);
        // Add the confirmation number as a note + mark booked (don't downgrade).
        if (ok && parsed.confirmationNumber) {
          const cur = binder.forItem(selectedItemId);
          const line = `📋 ${he ? 'אישור' : 'Confirmation'}: ${parsed.confirmationNumber}${parsed.vendor ? ` · ${parsed.vendor}` : ''}`;
          const noteText = cur.noteText.includes(parsed.confirmationNumber)
            ? cur.noteText
            : [line, cur.noteText].filter(Boolean).join('\n');
          const status = cur.status ?? 'booked';
          await binder.saveNote(selectedItemId, { noteText, status });
        }
      } else {
        // Whole-trip: direct upload (binder mutators are stop-scoped), then refresh.
        const form = new FormData();
        form.append('itineraryId', binder.itineraryId ?? '');
        form.append('docType', docType);
        form.append('file', file);
        const res = await fetch('/api/trip-documents', {
          method: 'POST',
          headers: { Authorization: `Bearer ${binder.accessToken}` },
          body: form,
        });
        ok = res.ok;
        if (ok) await binder.refresh();
      }
      if (!ok) throw new Error('File failed');
      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not file it');
      setStep('error');
    }
  };

  const selected = selectedItemId ? stopById.get(selectedItemId) : null;

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      dir={he ? 'rtl' : 'ltr'}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col z-10"
        style={{ background: 'var(--color-paper)', maxHeight: '92dvh', boxShadow: '0 30px 80px -20px rgba(0,0,0,0.5)' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '60%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(43,38,34,0.08)' }}>
          <h3 className="font-display text-base font-bold" style={{ color: 'var(--color-ink-warm)' }}>
            {he ? 'סריקת אישור הזמנה' : 'Scan a booking'}
          </h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm-mut)' }}>✕</button>
        </div>

        <div className="overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {step === 'pick' && (
            <>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-warm-mut)' }}>
                {he
                  ? 'צלמו או העלו צילום מסך של אישור טיסה, מלון, כרטיס או הזמנה — ונציע לאיזה יום ועצירה לשייך אותו.'
                  : 'Photograph or upload a screenshot of a flight, hotel, ticket, or reservation confirmation — we’ll suggest which day & stop it belongs to.'}
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full py-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: TERRA, boxShadow: '0 4px 18px rgba(184,85,46,0.28)' }}
              >
                📸 {he ? 'בחרו תמונה' : 'Choose a photo'}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onPick} className="hidden" />
              <p className="text-[11px] text-center" style={{ color: 'var(--color-ink-warm-mut)' }}>
                {he ? 'תמונה בלבד · פרטי, רק אתם רואים' : 'Image only · private to you'}
              </p>
            </>
          )}

          {step === 'scanning' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(184,85,46,0.25)', borderTopColor: TERRA }} />
              <p className="text-sm" style={{ color: 'var(--color-ink-warm-mut)' }}>{he ? 'קורא את האישור…' : 'Reading the confirmation…'}</p>
            </div>
          )}

          {step === 'review' && parsed && (
            <>
              {/* Parsed fields — editable */}
              <div className="flex flex-col gap-2.5">
                <Field label={he ? 'סוג' : 'Type'} he={he}>
                  <select value={docType} onChange={(e) => setDocType(e.target.value as TripDocType)} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none" style={inputStyle}>
                    {DOC_TYPES.map((t) => <option key={t} value={t}>{he ? DOC_LABEL[t].he : DOC_LABEL[t].en}</option>)}
                  </select>
                </Field>
                <Field label={he ? 'כותרת' : 'Title'} he={he}>
                  <input value={parsed.title} onChange={(e) => setParsed({ ...parsed, title: e.target.value })} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                </Field>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label={he ? 'תאריך' : 'Date'} he={he}>
                    <input type="date" value={parsed.date ?? ''} onChange={(e) => setParsed({ ...parsed, date: e.target.value || null })} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  </Field>
                  <Field label={he ? 'מס׳ אישור' : 'Conf. #'} he={he}>
                    <input value={parsed.confirmationNumber ?? ''} onChange={(e) => setParsed({ ...parsed, confirmationNumber: e.target.value || null })} className="w-full text-[13px] rounded-lg px-3 py-2 outline-none" style={inputStyle} />
                  </Field>
                </div>
              </div>

              {/* Suggested / chosen destination */}
              <div className="rounded-xl p-3" style={{ background: 'var(--color-paper-sunk)' }}>
                <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: TERRA }}>
                  {candidates.length > 0 && selected && (selected.dateMatch || selected.nameMatch)
                    ? (he ? 'הצעה לשיוך' : 'Suggested match')
                    : (he ? 'לאן לשייך' : 'File it to')}
                </div>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full text-[13px] rounded-lg px-3 py-2 outline-none"
                  style={inputStyle}
                >
                  <option value="">{he ? '— כל הטיול (לא עצירה מסוימת) —' : '— Whole trip (no specific stop) —'}</option>
                  {allStops.map((s) => (
                    <option key={s.itemId} value={s.itemId}>{stopOptionLabel(s, he)}</option>
                  ))}
                </select>
                {selected && (selected.dateMatch || selected.nameMatch) && (
                  <p className="text-[11px] mt-2" style={{ color: 'var(--color-ink-warm-mut)' }}>
                    {he ? 'התאמה לפי ' : 'Matched by '}
                    {[selected.dateMatch ? (he ? 'תאריך' : 'date') : null, selected.nameMatch ? (he ? 'שם' : 'name') : null].filter(Boolean).join(he ? ' ו' : ' + ')}
                  </p>
                )}
              </div>

              <button type="button" onClick={fileIt} className="w-full py-3.5 rounded-2xl font-bold text-sm text-white" style={{ background: TERRA, boxShadow: '0 4px 18px rgba(184,85,46,0.28)' }}>
                {he ? 'תייקו את האישור' : 'File it'}
              </button>
              <button type="button" onClick={() => setStep('pick')} className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-warm-mut)' }}>
                {he ? '← תמונה אחרת' : '← Different photo'}
              </button>
            </>
          )}

          {step === 'filing' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(184,85,46,0.25)', borderTopColor: TERRA }} />
              <p className="text-sm" style={{ color: 'var(--color-ink-warm-mut)' }}>{he ? 'מתייק…' : 'Filing…'}</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div className="text-4xl">✅</div>
              <p className="text-sm font-bold" style={{ color: 'var(--color-ink-warm)' }}>
                {selected
                  ? (he ? `תויק ל${stopOptionLabel(selected, he)}` : `Filed to ${stopOptionLabel(selected, he)}`)
                  : (he ? 'תויק לטיול' : 'Filed to your trip')}
              </p>
              <button onClick={onClose} className="mt-1 px-5 py-2.5 rounded-xl text-[13px] font-bold text-white" style={{ background: TERRA }}>
                {he ? 'סגירה' : 'Done'}
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div className="text-3xl">😕</div>
              <p className="text-sm" style={{ color: 'var(--color-ink-warm-mut)' }}>{errorMsg || (he ? 'משהו השתבש.' : 'Something went wrong.')}</p>
              <button onClick={() => setStep('pick')} className="px-5 py-2.5 rounded-xl text-[13px] font-bold" style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)' }}>
                {he ? 'נסו שוב' : 'Try again'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#fffdf7',
  color: 'var(--color-ink-warm)',
  border: '1px solid rgba(43,38,34,0.12)',
};

function Field({ label, he, children }: { label: string; he: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--color-ink-warm-mut)' }}>{label}</span>
      {children}
    </label>
  );
}

function stopOptionLabel(s: StopCandidate, he: boolean): string {
  const dayLabel = he ? `יום ${s.dayNumber}` : `Day ${s.dayNumber}`;
  const slot = SLOT_LABEL[s.slot] ? (he ? SLOT_LABEL[s.slot].he : SLOT_LABEL[s.slot].en) : s.slot;
  return `${dayLabel} · ${slot} · ${s.name}`;
}
