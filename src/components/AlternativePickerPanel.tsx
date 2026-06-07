'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Activity, Itinerary, TravelerProfile } from '@/lib/types';
import type { SwapTarget } from '@/components/DayTimeline';
import type { SwapProposalAlternative } from '@/app/api/swap-proposals/route';
import { useAuth } from '@/lib/auth-context';

interface AlternativePickerPanelProps {
  target: SwapTarget;
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  onCommit: (activity: Activity, summary: string, diningField?: 'lunch' | 'dinner') => void;
  onClose: () => void;
}

type PanelState = 'loading' | 'results' | 'error';

export function AlternativePickerPanel({
  target, itinerary, profile, onCommit, onClose,
}: AlternativePickerPanelProps) {
  const { session } = useAuth();
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [alternatives, setAlternatives] = useState<SwapProposalAlternative[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [customText, setCustomText] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setPanelState('loading');

    void (async () => {
      try {
        const initHeaders: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) initHeaders.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch('/api/swap-proposals', {
          method: 'POST',
          headers: initHeaders,
          body: JSON.stringify({
            itinerary,
            dayIndex: target.dayIndex,
            slot: target.slot,
            profile: profile ?? null,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data.alternatives) || data.alternatives.length < 2) {
          setErrorMsg(data.error ?? 'No suggestions returned. Try describing what you want below.');
          setPanelState('error');
        } else {
          setAlternatives(data.alternatives);
          setSelectedIdx(0);
          setPanelState('results');
        }
      } catch {
        if (!cancelled) {
          setErrorMsg('Connection error. Try typing a custom request below.');
          setPanelState('error');
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.dayIndex, target.slot, target.diningField]);

  const handleCustomSubmit = async () => {
    if (!customText.trim() || customLoading) return;
    setCustomLoading(true);
    try {
      const customHeaders: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) customHeaders.Authorization = `Bearer ${session.access_token}`;
      const res = await fetch('/api/swap-proposals', {
        method: 'POST',
        headers: customHeaders,
        body: JSON.stringify({
          itinerary,
          dayIndex: target.dayIndex,
          slot: target.slot,
          profile: profile ?? null,
          request: customText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.alternatives) || data.alternatives.length < 2) {
        setErrorMsg(data.error ?? 'No results. Try a different description.');
        setPanelState('error');
      } else {
        setAlternatives(data.alternatives);
        setSelectedIdx(0);
        setPanelState('results');
        setCustomText('');
        setErrorMsg('');
      }
    } catch {
      setErrorMsg('Connection error. Please try again.');
    } finally {
      setCustomLoading(false);
    }
  };

  const handleConfirm = () => {
    const chosen = alternatives[selectedIdx];
    if (!chosen) return;
    onCommit(chosen.activity, `Swapped to ${chosen.activity.name}`, target.diningField);
  };

  const locationHint = target.neighborhood ?? itinerary.destination ?? '';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] overflow-hidden z-10 flex flex-col"
          style={{ background: '#fff', boxShadow: '0 32px 80px -16px rgba(0,0,0,0.4)', maxHeight: '88dvh' }}
          initial={{ y: '100%', scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: '60%', opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          {/* Handle */}
          <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
            <div className="w-10 h-1 rounded-full bg-black/15" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#5aada5] mb-1">Find Alternative</div>
                <h3 className="text-[15px] font-black text-[#222]">Replace: {target.currentName}</h3>
                {locationHint && <p className="text-[12px] text-[#888] mt-0.5">📍 {locationHint}</p>}
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.85 }}
                aria-label="Close"
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#888] text-xs"
                style={{ background: 'rgba(0,0,0,0.06)' }}
              >✕</motion.button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {panelState === 'loading' && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 px-5">
                <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(90,173,165,0.2)', borderTopColor: '#5aada5' }} />
                <p className="text-[13px] text-[#888]">Finding the best options near {locationHint || 'your location'}…</p>
              </div>
            )}

            {(panelState === 'results' || panelState === 'error') && (
              <div className="p-4 flex flex-col gap-3">
                {panelState === 'results' && alternatives.map((alt, idx) => (
                  <motion.button
                    key={`${alt.activity.name ?? 'alt'}-${idx}`}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-left rounded-2xl p-4 transition-all"
                    style={{
                      border: selectedIdx === idx ? '2px solid #5aada5' : '2px solid rgba(90,173,165,0.2)',
                      background: selectedIdx === idx ? '#e8f4f2' : 'rgba(240,250,249,0.4)',
                    }}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-[22px] flex-shrink-0">{alt.activity.category_emoji ?? '🏙️'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-black text-[#222] mb-0.5">{alt.activity.name}</div>
                        <div className="text-[11px] text-[#888]">
                          {[alt.activity.neighborhood, alt.activity.estimatedCost].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {selectedIdx === idx && <span className="text-[#5aada5] text-base flex-shrink-0">✓</span>}
                    </div>
                    <div className="flex items-start gap-2 rounded-xl px-3 py-2" style={{ background: 'rgba(90,173,165,0.08)', border: '1px solid rgba(90,173,165,0.15)' }}>
                      <span className="text-[12px] flex-shrink-0">💡</span>
                      <p className="text-[11px] text-[#3a8a82] leading-relaxed">{alt.whyItFitsYou}</p>
                    </div>
                  </motion.button>
                ))}

                {panelState === 'error' && errorMsg && (
                  <div className="rounded-xl p-3 text-[12px] text-[#888]" style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                  <span className="text-[11px] text-[#aaa] font-semibold whitespace-nowrap">
                    {panelState === 'results' ? 'Neither works?' : 'Describe what you want'}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                </div>

                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleCustomSubmit(); } }}
                    rows={2}
                    placeholder="e.g. vegetarian-friendly, under €15, closer to the hotel…"
                    className="flex-1 rounded-xl px-3 py-2 text-[13px] text-[#333] outline-none resize-none"
                    style={{ border: '1px solid rgba(90,173,165,0.35)', background: '#fafffe', fontFamily: 'inherit' }}
                  />
                  <motion.button
                    type="button"
                    onClick={() => void handleCustomSubmit()}
                    disabled={!customText.trim() || customLoading}
                    whileTap={{ scale: 0.9 }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40"
                    style={{ background: '#5aada5' }}
                  >
                    {customLoading
                      ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                      : '→'}
                  </motion.button>
                </div>
              </div>
            )}
          </div>

          {/* Confirm footer */}
          {panelState === 'results' && (
            <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
              <motion.button
                type="button"
                onClick={handleConfirm}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl text-[14px] font-black text-white"
                style={{ background: '#5aada5', boxShadow: '0 4px 14px rgba(90,173,165,0.45)' }}
              >
                ✓ Use {alternatives[selectedIdx]?.activity.name ?? 'selected option'}
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
