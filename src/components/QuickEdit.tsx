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
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#111827] text-white text-sm px-5 py-3 rounded-full shadow-xl animate-fade-in max-w-sm text-center">
          {toast}
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3 rounded-full bg-[#ff5a5f] hover:bg-[#e04a4f] text-white font-semibold text-sm shadow-lg shadow-[#ff5a5f]/30 hover:-translate-y-0.5 transition-all duration-150"
        aria-label="Quick Edit itinerary"
      >
        <span className="text-base">✏️</span>
        Quick Edit
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={() => !loading && setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed bottom-0 right-0 z-50 h-full max-h-screen w-full sm:w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e7eb]">
          <div>
            <h2 className="font-bold text-[#111827] text-base">Quick Edit</h2>
            <p className="text-xs text-[#9ca3af] mt-0.5">Tell us what to change — AI will update the itinerary</p>
          </div>
          <button
            onClick={() => !loading && setOpen(false)}
            className="w-8 h-8 rounded-full hover:bg-[#f3f4f6] flex items-center justify-center text-[#6b7280] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Suggestion chips */}
        <div className="px-5 py-4 border-b border-[#f3f4f6]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af] mb-3">
            Quick suggestions
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setMessage(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#e5e7eb] text-[#374151] hover:border-[#ff5a5f] hover:text-[#ff5a5f] hover:bg-[#fff0f0] transition-all duration-150"
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
            className="w-full px-4 py-3 rounded-xl border-2 border-[#e5e7eb] focus:border-[#ff5a5f] focus:outline-none text-[#111827] text-sm resize-none placeholder:text-[#9ca3af] transition-colors"
          />

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={!message.trim() || loading}
            className="w-full py-3 rounded-xl bg-[#ff5a5f] hover:bg-[#e04a4f] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-2"
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

          <p className="text-[11px] text-[#9ca3af] text-center leading-relaxed">
            Press Enter to send · Shift+Enter for new line
            <br />
            Only the affected days will be regenerated
          </p>
        </div>
      </div>
    </>
  );
}
