'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Itinerary, TravelerProfile } from '@/lib/types';
import { audienceNounPlural, audienceTitle } from '@/lib/audienceCopy';
import { normalizeUsername, validateUsernameShape } from '@/lib/username';

function buildWhatsAppText(itinerary: Itinerary, profile: TravelerProfile | null): string {
  const header = `✈️ *${itinerary.destination}* — ${itinerary.totalDays}-day ${audienceTitle(profile?.groupType).toLowerCase()} plan`;
  const meta = profile
    ? `👥 ${profile.groupType} · 💰 ${profile.budget} · ⚡ ${profile.pace}`
    : '';
  const overview = `📋 ${itinerary.strategicOverview}`;
  const budget = itinerary.budgetSummary
    ? `💵 Est. total: ${itinerary.budgetSummary.totalEstimate}`
    : '';

  const dayLines = itinerary.days
    .slice(0, 5)
    .map(
      (d) =>
        `*Day ${d.day} — ${d.theme}*\n🌅 ${d.morning?.name ?? ''}\n☀️ ${d.afternoon?.name ?? ''}\n🌙 ${d.evening?.name ?? ''}`,
    )
    .join('\n\n');

  const footer = itinerary.days.length > 5
    ? `\n_(+ ${itinerary.days.length - 5} more days)_`
    : '';

  const parts = [header, meta, overview, budget, '', dayLines + footer, '', '🗺 Planned with TravelOS'].filter(Boolean);
  return parts.join('\n');
}

interface Props {
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  /** Saved trip id in Supabase — required to share with another TravelOS user */
  itineraryDbId?: string | null;
  accessToken?: string | null;
}

export function SharePanel({ itinerary, profile, itineraryDbId, accessToken }: Props) {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const canShareInApp = !!itineraryDbId && !!accessToken;

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  const handlePrint = () => {
    setOpen(false);
    setTimeout(() => window.print(), 150);
  };

  const handleWhatsApp = () => {
    const text = buildWhatsAppText(itinerary, profile);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  const handleShareWithUser = async () => {
    setShareMsg(null);
    if (!canShareInApp) return;
    const err = validateUsernameShape(shareUsername);
    if (err) {
      setShareMsg({ type: 'err', text: err });
      return;
    }
    const u = normalizeUsername(shareUsername);
    setShareBusy(true);
    try {
      const res = await fetch('/api/trips/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ itineraryId: itineraryDbId, username: u }),
      });
      const data = (await res.json()) as { error?: string; message?: string; ok?: boolean; alreadyShared?: boolean };
      if (!res.ok) {
        setShareMsg({ type: 'err', text: data.error ?? 'Could not share.' });
        return;
      }
      setShareMsg({
        type: 'ok',
        text: data.alreadyShared
          ? (data.message ?? 'Already shared with this user.')
          : `Trip added to @${u}'s dashboard.`,
      });
      setShareUsername('');
    } catch {
      setShareMsg({ type: 'err', text: 'Network error. Try again.' });
    } finally {
      setShareBusy(false);
    }
  };

  const OPTIONS = [
    {
      id: 'whatsapp',
      icon: '💬',
      label: 'Share to WhatsApp',
      sub: profile ? `Send to ${audienceNounPlural(profile.groupType)} instantly` : 'Send to your squad instantly',
      gradient: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
      action: () => { handleWhatsApp(); setOpen(false); },
    },
    {
      id: 'link',
      icon: copied ? '✓' : '🔗',
      label: copied ? 'Link copied!' : 'Copy link',
      sub: 'Share your master plan anywhere',
      gradient: 'linear-gradient(135deg, #00d4ff 0%, #0066cc 100%)',
      action: handleCopyLink,
    },
    {
      id: 'pdf',
      icon: '📄',
      label: 'Download PDF',
      sub: 'Branded itinerary for offline use',
      gradient: 'linear-gradient(135deg, #ff5a5f 0%, #ff8c5a 100%)',
      action: handlePrint,
    },
  ] as const;

  return (
    <div className="relative print:hidden">
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e5e7eb] bg-white text-[#374151] text-sm font-medium hover:border-[#ff5a5f] hover:text-[#ff5a5f] hover:bg-[#fff0f0] transition-all"
      >
        <span>↗</span> Share
      </motion.button>

      {portalEl &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="share-panel-title"
                className="fixed inset-0 z-[300] flex min-h-0 items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Backdrop */}
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setOpen(false)}
                />

                {/* Panel — viewport-centered (portal escapes nav backdrop-filter containing block) */}
                <motion.div
                  className="relative z-10 w-full max-w-sm max-h-[min(90dvh,720px)] my-auto overflow-y-auto rounded-3xl overscroll-contain shadow-2xl"
                  style={{
                    background: 'rgba(15,17,23,0.96)',
                    backdropFilter: 'blur(28px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 32px 80px -12px rgba(0,0,0,0.7)',
                  }}
                  initial={{ y: 24, opacity: 0, scale: 0.96 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 16, opacity: 0, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                >
                  {/* Coral orb */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-[#ff5a5f]/12 rounded-full blur-[70px] pointer-events-none" />
                  {/* Cyan orb */}
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00d4ff]/8 rounded-full blur-[50px] pointer-events-none" />

                  <div className="relative z-10 p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h3 id="share-panel-title" className="font-bold text-white text-base tracking-tight">
                          Share the {audienceTitle(profile?.groupType)} Plan
                        </h3>
                        <p className="text-white/35 text-xs mt-0.5">
                          {itinerary.destination} · {itinerary.totalDays} days
                        </p>
                      </div>
                      <motion.button
                        type="button"
                        onClick={() => setOpen(false)}
                        whileTap={{ scale: 0.85 }}
                        className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/15 transition-colors text-xs"
                      >
                        ✕
                      </motion.button>
                    </div>

                    {/* Option cards */}
                    <div className="flex flex-col gap-2.5">
                      {OPTIONS.map(({ id, icon, label, sub, gradient, action }) => (
                        <motion.button
                          key={id}
                          type="button"
                          onClick={action}
                          whileHover={{ scale: 1.02, x: 3 }}
                          whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
                          className="flex items-center gap-4 p-4 rounded-2xl border border-white/8 bg-white/5 hover:bg-white/8 transition-colors text-left group"
                        >
                          {/* Icon bubble */}
                          <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg"
                            style={{ background: gradient }}
                          >
                            {icon}
                          </div>

                          {/* Text */}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-white text-sm group-hover:text-[#ff8c8f] transition-colors">
                              {label}
                            </div>
                            <div className="text-white/35 text-xs mt-0.5 leading-snug">{sub}</div>
                          </div>

                          <span className="text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0">
                            →
                          </span>
                        </motion.button>
                      ))}
                    </div>

                    <div className="mt-5 pt-5 border-t border-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#e1b382] mb-2">TravelOS users</p>
                      <p className="text-white/40 text-xs mb-3 leading-relaxed">
                        Send this saved trip to someone&apos;s dashboard by username. They&apos;ll see it under &quot;Shared with you&quot;. Or use Copy link for anyone.
                      </p>
                      {canShareInApp ? (
                        <>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={shareUsername}
                              onChange={(e) => setShareUsername(e.target.value)}
                              placeholder="friend_username"
                              className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/25 outline-none"
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.10)',
                              }}
                            />
                            <motion.button
                              type="button"
                              disabled={shareBusy}
                              onClick={handleShareWithUser}
                              whileTap={{ scale: 0.95 }}
                              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white shrink-0 disabled:opacity-50"
                              style={{
                                background: 'linear-gradient(135deg, #4a7bde 0%, #6b93ee 100%)',
                                boxShadow: '0 4px 20px -4px rgba(74,123,222,0.45)',
                              }}
                            >
                              {shareBusy ? '…' : 'Send'}
                            </motion.button>
                          </div>
                          {shareMsg && (
                            <p
                              className="text-xs mt-2 leading-relaxed"
                              style={{ color: shareMsg.type === 'ok' ? 'rgba(52,211,153,0.95)' : 'rgba(255,140,143,0.95)' }}
                            >
                              {shareMsg.text}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-white/25 text-[11px] leading-relaxed">
                          Save the trip to your account first (finish generating), then open Share again to send by username.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          portalEl,
        )}
    </div>
  );
}
