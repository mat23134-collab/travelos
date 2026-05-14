import type { CityTransportGuide, CityTransportLink, CityTransportOption, CityTransportApp } from '@/lib/types';

function safeHttps(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!/^https:\/\//i.test(t)) return null;
  try {
    return new URL(t).protocol === 'https:' ? t : null;
  } catch {
    return null;
  }
}

/** True when the guide has enough to render the transport card (not only empty defaults). */
export function hasTransportContent(g: CityTransportGuide | null | undefined): boolean {
  if (!g) return false;
  if (g.intro?.trim()) return true;
  if (g.scoutTipPayment?.trim()) return true;
  if (g.officialTicketsUrl?.trim()) return true;
  if (g.priceSingle?.trim() || g.priceDayPass?.trim() || g.priceWeekPass?.trim()) return true;
  if (g.transportApp?.name?.trim()) return true;
  if ((g.options?.length ?? 0) > 0) return true;
  if ((g.links?.length ?? 0) > 0) return true;
  return false;
}

/** Parse JSON from DB or scout — tolerates partial shapes. */
export function parseTransportGuideJson(data: unknown): CityTransportGuide | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;

  const options: CityTransportOption[] = [];
  if (Array.isArray(o.options)) {
    for (const raw of o.options) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const mode = typeof r.mode === 'string' ? r.mode.trim() : '';
      const summary = typeof r.summary === 'string' ? r.summary.trim() : '';
      const typicalPrice = typeof r.typicalPrice === 'string' ? r.typicalPrice.trim() : '';
      const dailyAverage = typeof r.dailyAverage === 'string' ? r.dailyAverage.trim() : null;
      const tripTotalEstimate = typeof r.tripTotalEstimate === 'string' ? r.tripTotalEstimate.trim() : null;
      const optionUrlRaw = typeof r.optionUrl === 'string' ? r.optionUrl.trim() : '';
      const optionLinkLabel = typeof r.optionLinkLabel === 'string' ? r.optionLinkLabel.trim() : null;
      if (!mode || !summary) continue;
      const optionUrl = safeHttps(optionUrlRaw);
      options.push({
        mode,
        summary,
        typicalPrice: typicalPrice || dailyAverage || '—',
        dailyAverage: dailyAverage || null,
        tripTotalEstimate: tripTotalEstimate || null,
        optionUrl,
        optionLinkLabel: optionLinkLabel || null,
        tip: typeof r.tip === 'string' ? r.tip.trim() : null,
      });
    }
  }

  const links: CityTransportLink[] = [];
  if (Array.isArray(o.links)) {
    for (const raw of o.links) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const label = typeof r.label === 'string' ? r.label.trim() : '';
      const url = typeof r.url === 'string' ? r.url.trim() : '';
      if (!label || !url) continue;
      links.push({
        label,
        url,
        description: typeof r.description === 'string' ? r.description.trim() : null,
      });
    }
  }

  const intro = typeof o.intro === 'string' ? o.intro.trim() : null;
  const priceSingle = typeof o.priceSingle === 'string' ? o.priceSingle.trim() : null;
  const priceDayPass = typeof o.priceDayPass === 'string' ? o.priceDayPass.trim() : null;
  const priceWeekPass = typeof o.priceWeekPass === 'string' ? o.priceWeekPass.trim() : null;
  const officialTicketsUrl = safeHttps(typeof o.officialTicketsUrl === 'string' ? o.officialTicketsUrl : null);
  const scoutTipPayment = typeof o.scoutTipPayment === 'string' ? o.scoutTipPayment.trim() : null;

  let transportApp: CityTransportApp | null = null;
  if (o.transportApp && typeof o.transportApp === 'object') {
    const a = o.transportApp as Record<string, unknown>;
    const name = typeof a.name === 'string' ? a.name.trim() : '';
    if (name) {
      transportApp = {
        name,
        iosUrl: safeHttps(typeof a.iosUrl === 'string' ? a.iosUrl : null),
        androidUrl: safeHttps(typeof a.androidUrl === 'string' ? a.androidUrl : null),
      };
    }
  }

  if (
    !intro &&
    options.length === 0 &&
    links.length === 0 &&
    !priceSingle &&
    !priceDayPass &&
    !priceWeekPass &&
    !officialTicketsUrl &&
    !scoutTipPayment &&
    !transportApp
  ) {
    return null;
  }

  return {
    intro: intro || null,
    priceSingle: priceSingle || null,
    priceDayPass: priceDayPass || null,
    priceWeekPass: priceWeekPass || null,
    officialTicketsUrl,
    scoutTipPayment: scoutTipPayment || null,
    transportApp,
    options,
    links,
  };
}
