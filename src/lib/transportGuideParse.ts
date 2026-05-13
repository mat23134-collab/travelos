import type { CityTransportGuide, CityTransportLink, CityTransportOption } from '@/lib/types';

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
      let optionUrl: string | null = null;
      if (/^https:\/\//i.test(optionUrlRaw)) {
        try {
          if (new URL(optionUrlRaw).protocol === 'https:') optionUrl = optionUrlRaw;
        } catch {
          optionUrl = null;
        }
      }
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
  if (!intro && options.length === 0 && links.length === 0) return null;
  return { intro: intro || null, options, links };
}
