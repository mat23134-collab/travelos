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
}

/**
 * Shows who's on a shared trip (owner + everyone who joined via the link),
 * and — for signed-in visitors who aren't part of it yet — a "Join trip"
 * CTA that adds them as a collaborator (via /api/trips/join). Joining adds
 * the trip to their dashboard and grants edit access that syncs for everyone.
 */
export function TripCollaborators({ itineraryId, ownerUserId, ownerUsername, collaborators, session }: Props) {
  const [joinState, setJoinState] = useState<'idle' | 'joining' | 'joined' | 'error'>('idle');

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
          <span className="text-white/90 font-medium" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
            🧑‍🤝‍🧑 On this trip:
          </span>
          {people.map((p, i) => (
            <span
              key={p.userId ?? i}
              className="px-2.5 py-1 rounded-full text-white font-medium"
              style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              @{p.username}{p.isOwner ? ' · owner' : ''}
            </span>
          ))}
        </div>
      )}

      {canJoin && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(74,123,222,0.18)', border: '1px solid rgba(74,123,222,0.35)' }}
        >
          <p className="text-sm text-white/85">
            {joinState === 'joined'
              ? "You're in! This trip is now in your dashboard — edits sync for everyone."
              : 'Join this trip to add it to your dashboard and edit it together.'}
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
              {joinState === 'joining' ? 'Joining…' : joinState === 'error' ? 'Try again' : 'Join trip'}
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
