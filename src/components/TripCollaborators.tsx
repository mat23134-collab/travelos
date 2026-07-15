'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';

export interface TripCollaborator {
  userId: string;
  username: string;
}

interface Props {
  itineraryId: string | null;
  ownerUserId?: string | null;
  ownerUsername?: string | null;
  collaborators: TripCollaborator[];
  session: Session | null;
  lang: 'he' | 'en';
}

const COPY = {
  he: {
    onThisTrip: 'בטיול הזה:',
    owner: 'בעלים',
    usernameLabel: 'שם משתמש',
    joinedMsg: 'הצטרפתם! הטיול נוסף ללוח שלכם — עריכות מסתנכרנות לכולם.',
    joinPrompt: 'הצטרפו לטיול כדי להוסיף אותו ללוח שלכם ולערוך אותו יחד.',
    joining: 'מצטרפים…',
    tryAgain: 'נסו שוב',
    join: 'הצטרפו לטיול',
  },
  en: {
    onThisTrip: 'On this trip:',
    owner: 'owner',
    usernameLabel: 'Username',
    joinedMsg: "You're in! This trip is now in your dashboard — edits sync for everyone.",
    joinPrompt: 'Join this trip to add it to your dashboard and edit it together.',
    joining: 'Joining…',
    tryAgain: 'Try again',
    join: 'Join trip',
  },
} as const;

/**
 * Shows who's on a shared trip (owner + everyone who joined via the link),
 * and — for signed-in visitors who aren't part of it yet — a "Join trip"
 * CTA that adds them as a collaborator (via /api/trips/join). Joining adds
 * the trip to their dashboard and grants edit access that syncs for everyone.
 */
export function TripCollaborators({ itineraryId, ownerUserId, ownerUsername, collaborators, session, lang }: Props) {
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'joined' | 'error'>('idle');
  const t = COPY[lang];

  const myId = session?.user?.id ?? null;
  const isOwner = !!myId && myId === ownerUserId;
  const isCollaborator = collaborators.some((c) => c.userId === myId);
  const canJoin = !!myId && !!itineraryId && !!ownerUserId && !isOwner && !isCollaborator;

  const people: { userId: string | null | undefined; username: string; isOwner: boolean }[] = [
    ...(ownerUsername ? [{ userId: ownerUserId, username: ownerUsername, isOwner: true }] : []),
    ...collaborators.map((c) => ({ ...c, isOwner: false })),
  ];

  const handleJoin = async () => {
    if (!itineraryId || !session?.access_token) return;
    setJoinState('joining');
    try {
      const res = await fetch('/api/trips/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ itineraryId }),
      });
      if (!res.ok) {
        setJoinState('error');
        return;
      }
      setJoinState('joined');
    } catch {
      setJoinState('error');
    }
  };

  if (!canJoin && people.length === 0) return null;

  return (
    <div className="px-4 sm:px-6 max-w-5xl mx-auto mt-3 flex flex-col gap-2 print:hidden">
      {people.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold" style={{ color: 'var(--color-ink-warm)' }}>
            🧑‍🤝‍🧑 {t.onThisTrip}
          </span>
          {people.map((p, i) => (
            <span
              key={p.userId ?? i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold"
              style={{
                background: 'rgba(255,251,245,0.72)',
                border: '1px solid rgba(143,66,32,0.16)',
                color: 'var(--color-ink-warm)',
                boxShadow: '0 2px 8px rgba(43,38,34,0.07), inset 0 1px 0 rgba(255,255,255,0.5)',
              }}
              title={`${t.usernameLabel}: ${p.username}`}
            >
              {/* Username is always Latin script; isolate it as an explicit LTR
                  run so "@" and "·" don't get bidi-reordered to the wrong edge
                  inside this RTL row (they'd otherwise land at the end, e.g.
                  "matancohen · owner@" instead of "@matancohen · owner"). */}
              <bdi dir="ltr" className="font-mono text-[11px]" style={{ color: 'var(--color-terracotta-deep)' }}>
                @{p.username}
              </bdi>
              {p.isOwner && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(184,85,46,0.16)', color: 'var(--color-terracotta-deep)' }}
                >
                  {t.owner}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {canJoin && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(74,123,222,0.14)', border: '1px solid rgba(74,123,222,0.30)' }}
        >
          <p className="text-sm" style={{ color: 'var(--color-ink-warm)' }}>
            {joinState === 'joined' ? t.joinedMsg : t.joinPrompt}
          </p>
          {joinState !== 'joined' && (
            <motion.button
              type="button"
              onClick={handleJoin}
              disabled={joinState === 'joining'}
              whileTap={{ scale: 0.97 }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white whitespace-nowrap disabled:opacity-60"
              style={{ background: '#4a7bde' }}
            >
              {joinState === 'joining' ? t.joining : joinState === 'error' ? t.tryAgain : t.join}
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
