'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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
          style={{
            minHeight: 280,
            background: 'linear-gradient(145deg, rgba(45,84,94,0.5) 0%, rgba(18,52,59,0.95) 55%, #0f2a30 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="p-6 sm:p-8 space-y-4">
            <div className="h-3 w-28 rounded bg-white/10" />
            <div className="h-6 w-[min(100%,24rem)] rounded bg-white/15" />
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="h-16 rounded-2xl bg-white/5" />
              <div className="h-16 rounded-2xl bg-white/5" />
              <div className="h-16 rounded-2xl bg-white/5" />
            </div>
            <div className="h-20 rounded-2xl bg-white/5" />
            <p className="text-xs text-white/35">{ui.transportLoadingCard}</p>
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
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(45,84,94,0.48) 0%, rgba(18,52,59,0.94) 52%, #12343b 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 20px 56px -12px rgba(0,0,0,0.45)',
        }}
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-[#2d545e]/28 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#C9A84C]/10 rounded-full blur-[70px] pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#a89254] mb-1">🚌 {ui.cityTransportTitle}</p>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                {ui.cityTransportSubtitle(city)}
              </h2>
            </div>
          </div>

          {!rich && (
            <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {ui.cityTransportFallbackBody(city)}
              </p>
            </div>
          )}

          {rich && (
            <>
              {guide?.intro?.trim() && (
                <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.78)' }}>
                  {guide.intro.trim()}
                </p>
              )}

              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-2">
                {ui.cityTransportPriceLabel}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                {priceGrid.map((cell) => (
                  <div
                    key={cell.key}
                    className="rounded-2xl px-4 py-3"
                    style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.42)' }}>
                      {cell.label}
                    </p>
                    <p className="text-base font-bold tabular-nums tracking-tight" style={{ color: '#C9A84C' }}>
                      {cell.value}
                    </p>
                  </div>
                ))}
              </div>

              {guide?.scoutTipPayment?.trim() && (
                <div
                  className="rounded-2xl px-4 py-3 mb-5"
                  style={{
                    background: 'rgba(127,29,29,0.12)',
                    border: '1px solid rgba(248,113,113,0.38)',
                    boxShadow: 'inset 0 0 0 1px rgba(248,113,113,0.12)',
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'rgba(252,165,165,0.95)' }}>
                    {ui.transportScoutTipEyebrow}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,237,237,0.92)' }}>
                    {guide.scoutTipPayment.trim()}
                  </p>
                </div>
              )}

              {guide?.transportApp?.name?.trim() && (
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-2">{ui.transportOfficialApp}</p>
                  <p className="text-sm font-semibold text-white/90 mb-2">{guide.transportApp.name.trim()}</p>
                  <div className="flex flex-wrap gap-2">
                    {guide.transportApp.iosUrl && (
                      <a
                        href={guide.transportApp.iosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
                      >
                        {ui.transportIos} ↗
                      </a>
                    )}
                    {guide.transportApp.androidUrl && (
                      <a
                        href={guide.transportApp.androidUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/15 bg-white/5 text-white/85 hover:bg-white/10"
                      >
                        {ui.transportAndroid} ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {(guide?.options?.length ?? 0) > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-3">{ui.cityTransportOptionsHeading}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(guide!.options ?? []).map((opt, i) => {
                      const daily = opt.dailyAverage?.trim() || opt.typicalPrice?.trim() || '—';
                      const tripTotal = opt.tripTotalEstimate?.trim();
                      const optLink = safeHttpsUrl(opt.optionUrl ?? undefined);
                      return (
                        <div
                          key={`${opt.mode}-${i}`}
                          className="rounded-xl p-3"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        >
                          <p className="font-semibold text-white text-xs mb-0.5">{opt.mode}</p>
                          <p className="text-[11px] leading-snug mb-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
                            {opt.summary}
                          </p>
                          <div className="flex flex-wrap gap-2 text-[10px]">
                            <span className="text-[#C9A84C] font-semibold tabular-nums">{ui.cityTransportDailyAvgLabel}: {daily}</span>
                            <span className="text-[#e8d9b4]/90 font-semibold tabular-nums">{ui.cityTransportTripTotalLabel(tripDayCount)}: {tripTotal ?? '—'}</span>
                          </div>
                          {optLink && (
                            <a
                              href={optLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-1.5 text-[11px] font-semibold underline-offset-2 hover:underline"
                              style={{ color: '#93c5d8' }}
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
                href={ticketsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold border transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.88)',
                }}
              >
                {ui.transportSearchOfficialTickets} ↗
              </a>
              <a
                href={transitHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-3 rounded-xl text-sm font-semibold border transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.88)',
                }}
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
