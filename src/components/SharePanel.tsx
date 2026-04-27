'use client';

import { useState } from 'react';
import { Itinerary, TravelerProfile } from '@/lib/types';

function buildWhatsAppText(itinerary: Itinerary, profile: TravelerProfile | null): string {
  const header = `✈️ *${itinerary.destination}* — ${itinerary.totalDays}-day itinerary`;
  const meta = profile
    ? `👥 ${profile.groupType} · 💰 ${profile.budget} · ⚡ ${profile.pace}`
    : '';
  const overview = `📋 ${itinerary.strategicOverview}`;
  const budget = itinerary.budgetSummary
    ? `💵 Est. total: ${itinerary.budgetSummary.totalEstimate}`
    : '';

  const dayLines = itinerary.days
    .slice(0, 5) // limit to 5 days to keep message short
    .map(
      (d) =>
        `*Day ${d.day} — ${d.theme}*\n🌅 ${d.morning?.name ?? ''}\n☀️ ${d.afternoon?.name ?? ''}\n🌙 ${d.evening?.name ?? ''}`
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
  const [open, setOpen] = useState(false);
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
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <div className="relative print:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e5e7eb] bg-white text-[#374151] text-sm font-medium hover:border-[#ff5a5f] hover:text-[#ff5a5f] hover:bg-[#fff0f0] transition-all duration-150"
      >
        <span>↗</span> Share
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-40 w-52 bg-white rounded-2xl shadow-xl border border-[#e5e7eb] overflow-hidden">
            <button
              onClick={handlePrint}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#374151] hover:bg-[#f8f7f2] transition-colors text-left"
            >
              <span className="text-base">🖨️</span>
              Download PDF
            </button>
            <div className="h-px bg-[#f3f4f6]" />
            <button
              onClick={handleWhatsApp}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#374151] hover:bg-[#f8f7f2] transition-colors text-left"
            >
              <span className="text-base">💬</span>
              Share to WhatsApp
            </button>
            <div className="h-px bg-[#f3f4f6]" />
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#374151] hover:bg-[#f8f7f2] transition-colors text-left"
            >
              <span className="text-base">🔗</span>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
