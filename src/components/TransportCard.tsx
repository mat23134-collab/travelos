'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import type { CityTransportGuide } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';
import { hasTransportContent } from '@/lib/transportGuideParse';

export { hasTransportContent } from '@/lib/transportGuideParse';

function safeHttpsUrl(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!/^https:\/\//i.test(t)) return null;
  try {
    return new URL(t).protocol === 'https:' ? t : null;
  } catch {
    return null;
  }
}

function officialTicketsHref(guide: CityTransportGuide | null | undefined, city: string): string {
  const direct = safeHttpsUrl(guide?.officialTicketsUrl ?? undefined);
  if (direct) return direct;
  for (const l of guide?.links ?? []) {
    const u = safeHttpsUrl(l.url);
    if (u) return u;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${city} public transport tickets official`)}`;
}

function mapsTransitToCityUrl(city: string) {
  return `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${encodeURIComponent(city)}`;
}

export function TransportCard({
  destination,
  guide,
  ui,
  totalDays = 0,
  isLoading = false,
  hotelAnchor,
}: {
  destination: string;
  guide: CityTransportGuide | null | undefined;
  ui: ItineraryUiStrings;
  totalDays?: number;
  isLoading?: boolean;
  hotelAnchor?: { lat: number; lng: number } | null;
}) {
  const city = destination.trim() || (ui.lang === 'he' ? 'היעד' : 'your destination');
  const tripDayCount = Math.max(1, Math.round(Number(totalDays)) || 1);
  const ticketsHref = officialTicketsHref(guide ?? null, city);
  const transitHref = mapsTransitToCityUrl(city);

  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [routeLabel, setRouteLabel] = useState<string | null>(null);

  const rich = hasTransportContent(guide);
  const safeLinks = (guide?.links ?? [])
    .map((l) => ({ ...l, href: safeHttpsUrl(l.url) }))
    .filter((l) => l.href);

  useEffect(() => {
    if (!hotelAnchor || !Number.isFinite(hotelAnchor.lat) || !Number.isFinite(hotelAnchor.lng) || !destination.trim()) {
      setRouteStatus('idle');
      setRouteLabel(null);
      return;
    }
    let cancelled = false;
    setRouteStatus('loading');
    setRouteLabel(null);
    fetch('/api/transport/routes-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originLat: hotelAnchor.lat,
        originLng: hotelAnchor.lng,
        city: destination.trim(),
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setRouteStatus('err');
          return;
        }
        const j = (await res.json()) as { durationMinutes?: number };
        const m = typeof j.durationMinutes === 'number' && Number.isFinite(j.durationMinutes) ? j.durationMinutes : null;
        if (m == null) {
          setRouteStatus('err');
          return;
        }
        setRouteLabel(ui.transportRoutesResult(String(m)));
        setRouteStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setRouteStatus('err');
      });
    return () => {
      cancelled = true;
    };
  }, [hotelAnchor?.lat, hotelAnchor?.lng, destination, ui]);

  const priceGrid = useMemo(
    () => [
      { key: 'single', label: ui.transportFareSingle, value: guide?.priceSingle?.trim() || '—' },
      { key: 'day', label: ui.transportFareDay, value: guide?.priceDayPass?.trim() || '—' },
      { key: 'week', label: ui.transportFareWeek, value: guide?.priceWeekPass?.trim() || '—' },
    ],
    [guide?.priceSingle, guide?.priceDayPass, guide?.priceWeekPass, ui],
  );

  if (isLoading) {
    return (
      <section className="mb-8 print:hidden" dir={ui.dir} lang={ui.htmlLang}>
        <div
          className="relative rounded-3xl overflow-hidden animate-pulse"
          style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="h-[180px] w-full bg-[#1a1d26]" />
          <div className="p-5 sm:p-7 space-y-4">
            <div className="h-3 w-28 rounded" style={{ background: 'var(--color-paper-sunk)' }} />
            <div className="h-6 w-[min(100%,24rem)] rounded" style={{ background: 'var(--color-paper-sunk)' }} />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="h-16 rounded-2xl" style={{ background: 'var(--color-paper-sunk)' }} />
              <div className="h-16 rounded-2xl" style={{ background: 'var(--color-paper-sunk)' }} />
              <div className="h-16 rounded-2xl" style={{ background: 'var(--color-paper-sunk)' }} />
            </div>
            <div className="h-20 rounded-2xl" style={{ background: 'var(--color-paper-sunk)' }} />
            <p className="text-xs" style={{ color: 'var(--color-ink-warm-mut)' }}>{ui.transportLoadingCard}</p>
          </div>
        </div>
      </section>
    );
  }

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
        className="relative rounded-3xl overflow-hidden group"
        style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
      >
        {/* Editorial photo header with serif overlay title */}
        <div className="relative h-[200px] sm:h-[224px] overflow-hidden">
          <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
            <DayPhoto query={`${city} metro public transport`} alt={city} height={224} dark />
          </div>

          {/* Eyebrow pill (start) */}
          <div className="absolute top-3 inset-x-3 flex items-start justify-between">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
              style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)' }}
            >
              <span aria-hidden="true">🚌</span>{ui.cityTransportTitle}
            </span>
          </div>

          {/* Serif title over the scrim */}
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <h2 className="font-display text-white text-xl sm:text-2xl leading-tight drop-shadow">
              {ui.cityTransportSubtitle(city)}
            </h2>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {!rich && (
            <div
              className="rounded-2xl p-4 mb-5"
              style={{ background: 'var(--color-paper-sunk)' }}
            >
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-warm)' }}>
                {ui.cityTransportFallbackBody(city)}
              </p>
            </div>
          )}

          {rich && (
            <>
              {guide?.intro?.trim() && (
                <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--color-ink-warm)' }}>
                  {guide.intro.trim()}
                </p>
              )}

              <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--color-sunrise-deep)' }}>
                {ui.cityTransportPriceLabel}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {priceGrid.map((cell) => (
                  <div
                    key={cell.key}
                    className="rounded-2xl px-4 py-3.5"
                    style={{ background: 'var(--color-paper-sunk)' }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-ink-warm-mut)' }}>
                      {cell.label}
                    </p>
                    <p className="text-lg font-bold tabular-nums tracking-tight" style={{ color: 'var(--color-ink-warm)' }}>
                      {cell.value}
                    </p>
                  </div>
                ))}
              </div>

              {guide?.scoutTipPayment?.trim() && (
                <div
                  className="rounded-2xl px-4 py-3.5 mb-6"
                  style={{
                    background: 'rgba(184,119,46,0.10)',
                    boxShadow: 'inset 0 0 0 1px rgba(184,119,46,0.28)',
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--color-sunrise-deep)' }}>
                    {ui.transportScoutTipEyebrow}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-ink-warm)' }}>
                    {guide.scoutTipPayment.trim()}
                  </p>
                </div>
              )}

              {guide?.transportApp?.name?.trim() && (
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--color-sunrise-deep)' }}>{ui.transportOfficialApp}</p>
                  <p className="text-base font-bold mb-2.5" style={{ color: 'var(--color-ink-warm)' }}>{guide.transportApp.name.trim()}</p>
                  <div className="flex flex-wrap gap-2">
                    {guide.transportApp.iosUrl && (
                      <a
                        href={guide.transportApp.iosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex px-3.5 py-2 rounded-full text-xs font-semibold transition-colors hover:opacity-90"
                        style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)' }}
                      >
                        {ui.transportIos} ↗
                      </a>
                    )}
                    {guide.transportApp.androidUrl && (
                      <a
                        href={guide.transportApp.androidUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex px-3.5 py-2 rounded-full text-xs font-semibold transition-colors hover:opacity-90"
                        style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)' }}
                      >
                        {ui.transportAndroid} ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {(guide?.options?.length ?? 0) > 0 && (
                <div className="mb-6">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-sunrise-deep)' }}>{ui.cityTransportOptionsHeading}</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {(guide!.options ?? []).map((opt, i) => {
                      const daily = opt.dailyAverage?.trim() || opt.typicalPrice?.trim() || '—';
                      const tripTotal = opt.tripTotalEstimate?.trim();
                      const optLink = safeHttpsUrl(opt.optionUrl ?? undefined);
                      return (
                        <div
                          key={`${opt.mode}-${i}`}
                          className="rounded-2xl p-3.5"
                          style={{ background: 'var(--color-paper-sunk)' }}
                        >
                          <p className="font-bold text-sm mb-1" style={{ color: 'var(--color-ink-warm)' }}>{opt.mode}</p>
                          <p className="text-[12px] leading-snug mb-2.5" style={{ color: 'var(--color-ink-warm-mut)' }}>
                            {opt.summary}
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                            <span className="font-bold tabular-nums" style={{ color: 'var(--color-sunrise-deep)' }}>{ui.cityTransportDailyAvgLabel}: {daily}</span>
                            <span className="font-bold tabular-nums" style={{ color: 'var(--color-ink-warm)' }}>{ui.cityTransportTripTotalLabel(tripDayCount)}: {tripTotal ?? '—'}</span>
                          </div>
                          {optLink && (
                            <a
                              href={optLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-2 text-[11px] font-bold underline-offset-2 hover:underline"
                              style={{ color: 'var(--color-sunrise-deep)' }}
                            >
                              {opt.optionLinkLabel?.trim() || ui.cityTransportOptionSite} ↗
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-sunrise-deep)' }}>
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
                    className="inline-flex flex-col sm:flex-1 min-w-0 px-4 py-3 rounded-2xl text-sm font-bold transition-colors hover:opacity-90"
                    style={{ background: 'var(--color-ink-warm)', color: 'var(--color-paper)' }}
                  >
                    <span className="truncate">{link.label} ↗</span>
                    {link.description?.trim() && (
                      <span className="text-[11px] font-normal mt-1 leading-snug opacity-80">{link.description.trim()}</span>
                    )}
                  </a>
                ))}

              <a
                href={ticketsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-3 rounded-full text-sm font-bold transition-colors hover:opacity-90"
                style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)' }}
              >
                {ui.transportSearchOfficialTickets} ↗
              </a>
              <a
                href={transitHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-3 rounded-full text-sm font-bold transition-colors hover:opacity-90"
                style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)' }}
              >
                {ui.transportTransitToCity} ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
