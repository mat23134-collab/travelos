'use client';

/**
 * NeighborhoodGuide — the "Dynamic Neighborhood Profiler" surface.
 *
 * A single-column, full-width "Neighborhood Guide": match badge, the hook,
 * personal relevance, an honest-downsides warning banner (trust), insider
 * secrets as an icon-bullet list, and commute + safety. No map — the guide copy
 * carries all the value; the polygon added nothing.
 *
 * RTL-first (the guide copy is Hebrew). Pass a `profile` from
 * POST /api/neighborhood-profile; render `loading`/`error` states as needed.
 */

import type { NeighborhoodProfile } from '@/services/neighborhood/types';

// Warm "paper" palette, consistent with the rest of the app.
const INK = '#2b2622';
const INK_MUT = '#6b6358';
const ACCENT = '#b8552e';
const ACCENT_DEEP = '#8f4220';
const PAPER = '#efe3cd';
const CARD = '#fffaf1';

export function NeighborhoodGuide({
  profile,
  loading = false,
  error = null,
  variant = 'neighborhood',
}: {
  profile?: NeighborhoodProfile | null;
  loading?: boolean;
  error?: string | null;
  /** 'city' swaps the copy for the whole-trip city guide on the results page. */
  variant?: 'neighborhood' | 'city';
}) {
  if (loading) return <GuideSkeleton />;
  if (error) {
    return (
      <div className="rounded-3xl p-8 text-center text-[13px]" style={{ background: PAPER, color: INK_MUT }} dir="rtl">
        לא הצלחנו לטעון את פרופיל השכונה כרגע.
      </div>
    );
  }
  if (!profile) return null;

  const { guide, matchPercent } = profile;
  const isCity = variant === 'city';
  const kicker = isCity ? 'מדריך העיר שלכם' : 'מדריך השכונה שלכם';
  const relevanceTitle = isCity ? 'למה העיר הזו מתאימה לכם' : 'למה שיבצנו אתכם כאן היום';

  return (
    <div
      dir="rtl"
      className="overflow-hidden rounded-3xl shadow-xl"
      style={{ background: CARD, border: '1px solid rgba(43,38,34,0.10)' }}
    >
      <div className="p-6 sm:p-8 flex flex-col gap-6">
        {/* Name + match badge */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: ACCENT }}>
              {kicker}
            </p>
            <h2 className="text-[26px] font-black leading-tight mt-1" style={{ color: INK }}>
              {guide.name_hebrew}
            </h2>
            <p className="text-[12.5px] font-semibold" style={{ color: INK_MUT }}>{guide.name_english}</p>
          </div>
          {matchPercent > 0 && <MatchBadge percent={matchPercent} />}
        </div>

        {/* The Hook */}
        <p className="text-[18px] sm:text-[19px] font-bold leading-[1.5]" style={{ color: INK }}>
          “{guide.the_hook_hebrew}”
        </p>

        {/* Personal relevance */}
        {guide.personal_relevance_hebrew && (
          <Section icon="🎯" title={relevanceTitle}>
            <p className="text-[14px] leading-[1.7]" style={{ color: INK_MUT }}>
              {guide.personal_relevance_hebrew}
            </p>
          </Section>
        )}

        {/* Honest downsides — orange warning banner (builds trust) */}
        {guide.honest_downsides_hebrew.length > 0 && (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(234,140,54,0.14)', border: '1px solid rgba(234,140,54,0.4)' }}
          >
            <p className="flex items-center gap-2 text-[13.5px] font-black mb-2" style={{ color: '#a85a12' }}>
              <span className="text-[16px]">⚠️</span> האמת בלי לייפות
            </p>
            <ul className="flex flex-col gap-1.5">
              {guide.honest_downsides_hebrew.map((d, i) => (
                <li key={i} className="text-[13.5px] leading-[1.6] flex gap-2" style={{ color: '#8a4f18' }}>
                  <span aria-hidden>•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Insider secrets — icon-bullet list */}
        {guide.local_secrets_hebrew.length > 0 && (
          <Section icon="✨" title={isCity ? 'סודות מקומיים' : 'סודות מקומיים בדרך'}>
            <ul className="flex flex-col gap-2.5">
              {guide.local_secrets_hebrew.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black"
                    style={{ background: 'rgba(184,85,46,0.14)', color: ACCENT }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[14px] leading-[1.6]" style={{ color: INK }}>{s}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Commute + safety — grouped at the bottom */}
        {guide.commute_and_safety_hebrew && (
          <div className="pt-5" style={{ borderTop: '1px solid rgba(43,38,34,0.10)' }}>
            <p className="flex items-center gap-2 text-[12.5px] font-black mb-1.5" style={{ color: INK }}>
              <span className="text-[15px]">🚇</span> תחבורה ובטיחות
            </p>
            <p className="text-[13.5px] leading-[1.7]" style={{ color: INK_MUT }}>
              {guide.commute_and_safety_hebrew}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[12.5px] font-black mb-2" style={{ color: INK }}>
        <span className="text-[15px]">{icon}</span> {title}
      </p>
      {children}
    </div>
  );
}

function MatchBadge({ percent }: { percent: number }) {
  return (
    <div
      className="shrink-0 flex flex-col items-center justify-center rounded-2xl px-3.5 py-2.5"
      style={{ background: `linear-gradient(160deg, ${ACCENT}, ${ACCENT_DEEP})`, boxShadow: '0 8px 20px -8px rgba(184,85,46,0.6)' }}
    >
      <span className="text-[22px] font-black leading-none text-white">{percent}%</span>
      <span className="text-[9.5px] font-bold text-white/85 mt-0.5 whitespace-nowrap">התאמה לוייב שלכם</span>
    </div>
  );
}

function GuideSkeleton() {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: CARD, border: '1px solid rgba(43,38,34,0.10)' }}>
      <div className="p-8 flex flex-col gap-4">
        {[70, 40, 90, 80, 60].map((w, i) => (
          <div key={i} className="h-4 rounded-full animate-pulse" style={{ width: `${w}%`, background: 'rgba(43,38,34,0.08)' }} />
        ))}
      </div>
    </div>
  );
}
