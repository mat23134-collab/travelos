// src/components/AssistantChat.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Star, ArrowLeftRight } from 'lucide-react';
import type { Itinerary, TravelerProfile, Activity } from '@/lib/types';
import type { AssistantPlaceCard, AssistantChatTurn, SwapTarget } from '@/lib/assistantTypes';
import { buildAssistantContext, anchorSlotForDining } from '@/lib/assistantContext';
import { AssistantAvatar } from '@/components/AssistantAvatar';

interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
  cards?: AssistantPlaceCard[];
}

interface Props {
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  onCommitSwap: (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    replacementActivity: Activity,
    proposalSummary: string,
    diningField?: 'breakfast' | 'lunch' | 'dinner',
  ) => Promise<void>;
  sessionAccessToken?: string;
}

/** Read the current occupant of a target slot from the itinerary (the place being replaced). */
function currentOccupant(itinerary: Itinerary, target: SwapTarget): Activity | null {
  const field = target.diningField ?? target.slot;
  const day = itinerary.days?.[target.dayIndex] as unknown as Record<string, Activity | undefined> | undefined;
  return day?.[field] ?? null;
}

export function AssistantChat({ itinerary, profile, onCommitSwap, sessionAccessToken }: Props) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [bankPrompt, setBankPrompt] = useState<{ oldPlace: Activity; targetField: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, loading, bankPrompt]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const nextTurns: AssistantTurn[] = [...turns, { role: 'user', text }];
    setTurns(nextTurns);
    setInput('');
    setLoading(true);

    const apiMessages: AssistantChatTurn[] = nextTurns.map((t) => ({ role: t.role, content: t.text }));
    const context = buildAssistantContext(itinerary, profile);

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (sessionAccessToken) headers.Authorization = `Bearer ${sessionAccessToken}`;
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: apiMessages, context }),
      });
      const data: { reply?: string; cards?: AssistantPlaceCard[]; error?: string } = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Assistant failed');
      setTurns((prev) => [...prev, { role: 'assistant', text: data.reply ?? '', cards: data.cards ?? [] }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setTurns((prev) => [...prev, { role: 'assistant', text: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function doSwap(card: AssistantPlaceCard) {
    if (swappingId) return;
    setSwappingId(card.placeId);
    const old = currentOccupant(itinerary, card.target);
    const slot = card.target.diningField ? anchorSlotForDining(card.target.diningField) : card.target.slot;
    try {
      await onCommitSwap(
        card.target.dayIndex,
        slot,
        card.activity,
        `Swapped to ${card.name}`,
        card.target.diningField,
      );
      setTurns((prev) => [...prev, { role: 'assistant', text: `✓ Swapped in ${card.name}.` }]);
      // Only offer the bank when we both know the old place and have an itinerary
      // id to attach it to (the bank insert requires itinerary_id).
      if (old?.name && itinerary._id) {
        setBankPrompt({ oldPlace: old, targetField: card.target.diningField ?? card.target.slot });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Swap failed';
      setTurns((prev) => [...prev, { role: 'assistant', text: `⚠️ ${msg}` }]);
    } finally {
      setSwappingId(null);
    }
  }

  async function keepInBank() {
    if (!bankPrompt) return;
    const old = bankPrompt.oldPlace;
    setBankPrompt(null);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (sessionAccessToken) headers.Authorization = `Bearer ${sessionAccessToken}`;
      const res = await fetch('/api/bank', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          itinerary_id: itinerary._id ?? '',
          name: old.name,
          description: old.description,
          category_emoji: old.category_emoji,
          lat: old.latitude,
          lng: old.longitude,
          website_url: old.website_url,
        }),
      });
      if (!res.ok) throw new Error('bank insert failed');
      setTurns((prev) => [...prev, { role: 'assistant', text: `Kept ${old.name} in your attraction bank.` }]);
    } catch {
      setTurns((prev) => [...prev, { role: 'assistant', text: `Couldn't save ${old.name} to the bank.` }]);
    }
  }

  return (
    <>
      {/* Floating bubble */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open itinerary assistant"
        className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: '#0d2b27', color: '#FDFCF9' }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed z-[60] flex flex-col overflow-hidden bg-white shadow-2xl
                       inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[380px] sm:h-[70vh] sm:rounded-2xl"
            style={{ border: '1px solid #E8E5DC' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: '#0d2b27', color: '#FDFCF9' }}>
              <div className="flex items-center gap-2">
                <AssistantAvatar size={30} />
                <div className="leading-tight">
                  <div className="text-sm font-bold">Mika</div>
                  <div className="text-[10px] opacity-70">Your itinerary assistant</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3" style={{ background: '#FDFCF9' }}>
              {turns.length === 0 && (
                <div className="flex flex-col items-center text-center mt-6 gap-2">
                  <AssistantAvatar size={52} />
                  <p className="text-xs" style={{ color: '#5a908a' }}>
                    Hi, I&rsquo;m Mika. Ask me to swap something — e.g. &ldquo;replace my lunch on day 2&rdquo;.
                  </p>
                </div>
              )}
              {turns.map((t, idx) => (
                <div key={idx} className={t.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[92%]'}>
                  {t.text && (t.role === 'assistant' ? (
                    <div className="flex items-end gap-1.5">
                      <AssistantAvatar size={22} className="mb-0.5" />
                      <div
                        className="px-3 py-2 rounded-2xl text-[13px] leading-snug"
                        style={{ background: '#FFFFFF', color: '#1a4a44', border: '1px solid #E8E5DC' }}
                      >
                        {t.text}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="px-3 py-2 rounded-2xl text-[13px] leading-snug"
                      style={{ background: '#0d2b27', color: '#FDFCF9' }}
                    >
                      {t.text}
                    </div>
                  ))}
                  {t.cards && t.cards.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      {t.cards.map((card) => (
                        <div
                          key={card.placeId}
                          className="rounded-xl p-3"
                          style={{
                            background: card.isTopPick ? '#FAF6EE' : '#FFFFFF',
                            border: `1px solid ${card.isTopPick ? '#c4a26a' : '#E8E5DC'}`,
                          }}
                        >
                          {card.isTopPick && (
                            <div className="flex items-center gap-1 text-[10px] font-bold mb-1" style={{ color: '#c4a26a' }}>
                              <Star size={11} /> WINNING PICK
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold" style={{ color: '#0d2b27' }}>
                              {card.categoryEmoji ? `${card.categoryEmoji} ` : ''}{card.name}
                            </span>
                            {card.googleRating != null && (
                              <span className="text-[11px] shrink-0" style={{ color: '#3a7068' }}>★ {card.googleRating}</span>
                            )}
                          </div>
                          {card.description && (
                            <p className="text-[11px] mt-0.5" style={{ color: '#3a7068' }}>{card.description}</p>
                          )}
                          <p className="text-[11px] mt-1.5 leading-snug" style={{ color: '#1a4a44' }}>✦ {card.reasoning}</p>
                          <button
                            onClick={() => doSwap(card)}
                            disabled={swappingId === card.placeId}
                            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                            style={{ background: '#c4a26a', color: '#1f2421' }}
                          >
                            <ArrowLeftRight size={13} />
                            {swappingId === card.placeId
                              ? 'Swapping…'
                              : `Swap into ${card.target.diningField ?? card.target.slot} (day ${card.target.dayIndex + 1})`}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && <div className="self-start text-xs" style={{ color: '#5a908a' }}>Thinking…</div>}

              {bankPrompt && (
                <div className="self-start max-w-[92%] rounded-xl p-3" style={{ background: '#FFFFFF', border: '1px solid #E8E5DC' }}>
                  <p className="text-[12px]" style={{ color: '#1a4a44' }}>
                    Keep <b>{bankPrompt.oldPlace.name}</b> in your attraction bank?
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={keepInBank} className="flex-1 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#0d2b27', color: '#FDFCF9' }}>Keep</button>
                    <button onClick={() => setBankPrompt(null)} className="flex-1 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#FFFFFF', color: '#3a7068', border: '1px solid #E8E5DC' }}>Discard</button>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-3 shrink-0" style={{ borderTop: '1px solid #E8E5DC', background: '#FFFFFF' }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Ask to swap something…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#1a4a44' }}
              />
              <button onClick={send} disabled={loading || !input.trim()} aria-label="Send" className="disabled:opacity-40" style={{ color: '#c4a26a' }}>
                <Send size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
