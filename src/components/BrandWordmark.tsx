'use client';

/**
 * BrandWordmark — the Sarto logo: a line-art globe with an orbit and a journey
 * arrow, next to the "Sarto" wordmark. Recreated as scalable SVG so it stays
 * crisp at every size and adapts to the background via the `tone` prop.
 *
 * Variants:
 *   "wordmark" (default) — emblem + "Sarto" side-by-side  (nav, back links)
 *   "full"               — emblem stacked above "Sarto" + tagline  (hero, auth)
 *   "emblem"             — just the globe mark  (icon-only spots)
 *
 * tone:
 *   "dark"  (default) — for dark backgrounds: the mark + wordmark render light.
 *   "light"           — for light backgrounds: they render in brand navy.
 * The teal orbit/arrow accent stays constant on both.
 *
 * `accent` still colours the "full" tagline divider/text (default amber).
 */

const NAVY = '#17233f';
const LIGHT = '#F5EFE6';
const TEAL = '#63bccb';

export function BrandWordmark({
  accent = '#D4784A',
  className = '',
  variant = 'wordmark',
  tone = 'dark',
}: {
  accent?: string;
  className?: string;
  variant?: 'wordmark' | 'full' | 'emblem';
  tone?: 'dark' | 'light';
}) {
  const ink = tone === 'light' ? NAVY : LIGHT;

  // ── Emblem SVG ────────────────────────────────────────────────────────────────
  // Globe (ink) + teal orbit with a node + a dashed journey arrow leaving the
  // globe toward the top-right.
  const Emblem = () => (
    <svg
      viewBox="0 0 96 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      {/* Globe */}
      <circle cx="44" cy="54" r="30" stroke={ink} strokeWidth="3" fill="none" />
      {/* Meridians */}
      <line x1="44" y1="24" x2="44" y2="84" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M44 24 C 25 38 25 70 44 84" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M44 24 C 63 38 63 70 44 84" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.85" />

      {/* Orbit ring + node (teal) */}
      <ellipse
        cx="44" cy="62" rx="37" ry="13"
        transform="rotate(-22 44 62)"
        stroke={TEAL} strokeWidth="2.6" fill="none"
      />
      <circle cx="11" cy="71" r="3.6" fill={TEAL} />

      {/* Journey arrow (teal, dashed) leaving toward the top-right */}
      <line
        x1="46" y1="56" x2="79" y2="26"
        stroke={TEAL} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="3.5 4.5"
      />
      <path
        d="M81 23 L 71 25 M81 23 L 79 33"
        stroke={TEAL} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </svg>
  );

  const Wordmark = ({ size }: { size: string }) => (
    <span
      className="font-brand"
      style={{ color: ink, fontWeight: 700, fontSize: size, letterSpacing: '0.01em', lineHeight: 1 }}
    >
      Sarto
    </span>
  );

  // ── Variants ──────────────────────────────────────────────────────────────────

  if (variant === 'emblem') {
    return (
      <span className={className} style={{ display: 'inline-block', lineHeight: 0 }}>
        <Emblem />
      </span>
    );
  }

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center ${className}`} style={{ gap: '0.7em' }}>
        <div style={{ width: '5em', height: '5em' }}>
          <Emblem />
        </div>

        <div className="flex flex-col items-center" style={{ gap: '0.35em' }}>
          <Wordmark size="2em" />

          {/* Divider + tagline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em' }}>
            <span style={{ display: 'block', width: '2.8em', height: '1px', background: accent, opacity: 0.55 }} />
            <span className="font-medium tracking-[0.22em]" style={{ color: accent, fontSize: '0.44em' }}>
              BESPOKE TRAVEL
            </span>
            <span style={{ display: 'block', width: '2.8em', height: '1px', background: accent, opacity: 0.55 }} />
          </div>
        </div>
      </div>
    );
  }

  // Default: wordmark — emblem + "Sarto" side-by-side
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} style={{ lineHeight: 1 }}>
      <span style={{ width: '1.75em', height: '1.75em', display: 'inline-block', flexShrink: 0 }}>
        <Emblem />
      </span>
      <Wordmark size="1.35em" />
    </span>
  );
}
