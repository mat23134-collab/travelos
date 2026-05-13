'use client';

import { motion } from 'framer-motion';
import type { CityTransportGuide } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

function safeHttpsUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!/^https:\/\//i.test(t)) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

export function hasTransportContent(g: CityTransportGuide | null | undefined): boolean {
  if (!g) return false;
  if (g.intro?.trim()) return true;
  if ((g.options?.length ?? 0) > 0) return true;
  if ((g.links?.length ?? 0) > 0) return true;
  return false;
}

export function CityTransportSection({
  destination,
  guide,
  ui,
  totalDays = 0,
}: {
  destination: string;
  guide: CityTransportGuide | null | undefined;
  ui: ItineraryUiStrings;
  /** Trip length — used for trip-total labels when estimates are trip-scoped. */
  totalDays?: number;
}) {
  const city = destination.trim() || (ui.lang === 'he' ? 'היעד' : 'your destination');
  const tripDayCount = Math.max(1, Math.round(Number(totalDays)) || 1);
  const ticketsSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${city} public transport tickets`)}`;
  const mapsTransitUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(city)}&travelmode=transit`;

  const rich = hasTransportContent(guide);
  const safeLinks = (guide?.links ?? [])
    .map((l) => ({ ...l, href: safeHttpsUrl(l.url) }))
    .filter((l) => l.href);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      className="mb-8 print:hidden"
      dir={ui.dir}
      lang={ui.htmlLang}
    >
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(45,84,94,0.45) 0%, rgba(18,52,59,0.92) 55%, #12343b 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 20px 56px -12px rgba(0,0,0,0.45)',
        }}
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#2d545e]/30 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#C9A84C]/10 rounded-full blur-[70px] pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#a89254] mb-1">🚌 {ui.cityTransportTitle}</p>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{ui.cityTransportSubtitle(city)}</h2>
            </div>
          </div>

          {!rich && (
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {ui.cityTransportFallbackBody(city)}
              </p>
            </div>
          )}

          {rich && guide?.intro?.trim() && (
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.78)' }}>
              {guide.intro.trim()}
            </p>
          )}

          {rich && (guide?.options?.length ?? 0) > 0 && (
            <div className="mb-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">{ui.cityTransportOptionsHeading}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(guide!.options ?? []).map((opt, i) => {
                  const daily = opt.dailyAverage?.trim() || opt.typicalPrice?.trim() || '—';
                  const tripTotal = opt.tripTotalEstimate?.trim();
                  const safeOpt = safeHttpsUrl(opt.optionUrl);
                  return (
                  <div
                    key={`${opt.mode}-${i}`}
                    className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <p className="font-bold text-white text-sm tracking-tight mb-1">{opt.mode}</p>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.62)' }}>
                      {opt.summary}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                          {ui.cityTransportDailyAvgLabel}
                        </p>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: '#C9A84C' }}>
                          {daily}
                        </p>
                      </div>
                      <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                          {ui.cityTransportTripTotalLabel(tripDayCount)}
                        </p>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: '#e8d9b4' }}>
                          {tripTotal ?? '—'}
                        </p>
                      </div>
                    </div>
                    {safeOpt && (
                      <a
                        href={safeOpt}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-xs font-semibold mb-2 underline-offset-2 hover:underline"
                        style={{ color: '#93c5d8' }}
                      >
                        {opt.optionLinkLabel?.trim() || ui.cityTransportOptionSite} ↗
                      </a>
                    )}
                    {opt.tip?.trim() && (
                      <p className="text-[11px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        💡 {opt.tip.trim()}
                      </p>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">
              {rich && safeLinks.length > 0 ? ui.cityTransportLinksHeading : ui.cityTransportFallbackTitle}
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              {rich &&
                safeLinks.map((link, i) => (
                  <a
                    key={`${link.label}-${i}`}
                    href={link.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-col sm:flex-1 min-w-0 px-4 py-3 rounded-xl text-sm font-semibold transition-colors border"
                    style={{
                      background: 'rgba(201,168,76,0.10)',
                      borderColor: 'rgba(201,168,76,0.28)',
                      color: '#f0e6d4',
                    }}
                  >
                    <span className="truncate">{link.label} ↗</span>
                    {link.description?.trim() && (
                      <span className="text-[11px] font-normal mt-1 leading-snug opacity-80">{link.description.trim()}</span>
                    )}
                  </a>
                ))}

              <a
                href={ticketsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold border transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                {ui.cityTransportSearchTickets} ↗
              </a>
              <a
                href={mapsTransitUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold border transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.85)',
                }}
              >
                {ui.cityTransportOpenMapsTransit} ↗
              </a>
              <a
                href={ui.cityTransportGoogleRoutesDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold border transition-colors"
                style={{
                  background: 'rgba(56,189,248,0.08)',
                  borderColor: 'rgba(56,189,248,0.25)',
                  color: 'rgba(186,230,253,0.95)',
                }}
              >
                {ui.cityTransportGoogleRoutesDoc} ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/** Alias for product copy / data mapping — same component as `CityTransportSection`. */
export { CityTransportSection as TransportCard };
