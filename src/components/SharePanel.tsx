'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Itinerary, TravelerProfile } from '@/lib/types';

function buildWhatsAppText(itinerary: Itinerary, profile: TravelerProfile | null): string {
  const header = `✈️ *${itinerary.destination}* — ${itinerary.totalDays}-day squad plan`;
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
}

export function SharePanel({ itinerary, profile }: Props) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);

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

  const OPTIONS = [
    {
      id: 'whatsapp',
      icon: '💬',
      label: 'Share to WhatsApp',
      sub: 'Send to your squad instantly',
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

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              className="relative w-full max-w-sm rounded-3xl overflow-hidden"
              style={{
                background: 'rgba(15,17,23,0.96)',
                backdropFilter: 'blur(28px)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 32px 80px -12px rgba(0,0,0,0.7)',
              }}
              initial={{ y: 60, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              {/* Coral orb */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#ff5a5f]/12 rounded-full blur-[70px] pointer-events-none" />
              {/* Cyan orb */}
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00d4ff]/8 rounded-full blur-[50px] pointer-events-none" />

              <div className="relative z-10 p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-white text-base tracking-tight">
                      Share the Squad Plan
                    </h3>
                    <p className="text-white/35 text-xs mt-0.5">
                      {itinerary.destination} · {itinerary.totalDays} days
                    </p>
                  </div>
                  <motion.button
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
