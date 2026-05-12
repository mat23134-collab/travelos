'use client';

import { useState, useRef, useEffect } from 'react';
import { Itinerary, DayPlan } from '@/lib/types';

const SUGGESTIONS = [
  'Make Day 1 more budget-friendly',
  'Add more coffee shops and cafés',
  'Swap the evening activity on Day 2 for something outdoors',
  'Find a hidden gem restaurant for dinner on Day 3',
  'Make the itinerary more family-friendly',
];

interface Props {
  itinerary: Itinerary;
  onUpdate: (updated: Itinerary, summary: string) => void;
}

export function QuickEdit({ itinerary, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itinerary, message: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Edit failed');

      const { changedDays, summary } = data as { changedDays: DayPlan[]; summary: string };

      const updatedDays = itinerary.days.map((day) => {
        const replacement = changedDays.find((c) => c.day === day.day);
        return replacement ?? day;
      });

      const updatedItinerary: Itinerary = { ...itinerary, days: updatedDays };
      onUpdate(updatedItinerary, summary);
      setMessage('');
      setOpen(false);
      setToast(`✓ ${summary}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-white text-sm px-5 py-3 rounded-full shadow-xl animate-fade-in max-w-sm text-center border"
          style={{
            background: 'rgba(18,52,59,0.94)',
            borderColor: 'rgba(201,168,76,0.25)',
            boxShadow: '0 12px 40px -8px rgba(0,0,0,0.45)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Floating trigger — matches itinerary teal / luxury gold (not coral FAB) */}
      <button
        onClick={() => setOpen(true)}
        type="button"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 print:hidden"
        style={{
          color: 'rgba(255,255,255,0.88)',
          background: 'rgba(18,52,59,0.88)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 28px -6px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        aria-label="Quick Edit itinerary"
      >
        <span className="text-sm opacity-90" aria-hidden>
          ✏️
        </span>
        Quick Edit
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
          onClick={() => !loading && setOpen(false)}
        />
      )}

      {/* Drawer panel — same world as itinerary results */}
      <div
        className={`fixed bottom-0 right-0 z-50 h-full max-h-screen w-full sm:w-[420px] shadow-2xl flex flex-col transition-transform duration-300 ease-out border-l print:hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, #153a42 0%, #12343b 55%, #0f2d33 100%)',
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div>
            <h2 className="font-semibold text-white text-base tracking-tight">Quick Edit</h2>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Tell us what to change — AI will update the itinerary
            </p>
          </div>
          <button
            onClick={() => !loading && setOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Suggestion chips */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(201,168,76,0.75)' }}>
            Quick suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full transition-all duration-150"
                style={{
                  color: 'rgba(255,255,255,0.72)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.45)';
                  (e.currentTarget as HTMLElement).style.color = '#d4c8a8';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.72)';
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div className="flex-1 px-5 py-4 flex flex-col gap-4">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => { setMessage(e.target.value); setError(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={'e.g. "Make day 2 more budget-friendly"\nor "Add a sunset activity on day 1"'}
            rows={4}
            className="w-full px-4 py-3 rounded-xl text-sm resize-none transition-colors focus:outline-none focus:ring-1 placeholder:text-white/25"
            style={{
              background: 'rgba(0,0,0,0.22)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(255,255,255,0.92)',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(201,168,76,0.45)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(201,168,76,0.15)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          />

          {error && (
            <div
              className="px-3 py-2 rounded-lg text-xs border"
              style={{
                background: 'rgba(239,68,68,0.12)',
                borderColor: 'rgba(248,113,113,0.35)',
                color: 'rgba(254,202,202,0.95)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={!message.trim() || loading}
            className="w-full py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #a89254 0%, #C9A84C 48%, #8f7a42 100%)',
              boxShadow: '0 6px 22px rgba(201,168,76,0.28)',
            }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Updating itinerary...
              </>
            ) : (
              'Apply Change →'
            )}
          </button>

          <p className="text-[11px] text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Press Enter to send · Shift+Enter for new line
            <br />
            Only the affected days will be regenerated
          </p>
        </div>
      </div>
    </>
  );
}
