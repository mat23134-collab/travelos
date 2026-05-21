'use client';

/**
 * BrandWordmark — SARTO logo component
 *
 * Variants:
 *   "wordmark" (default) — emblem + "SARTO" side-by-side  (nav, back links)
 *   "full"               — emblem stacked above SARTO + BESPOKE TRAVEL tagline (hero, auth)
 *   "emblem"             — just the diamond-S icon  (icon-only spots)
 *
 * The accent prop colours the tagline text and divider dots (default: amber #D4784A).
 * Existing callers that pass accent="#9e363a" are unaffected — it will simply tint
 * those decorative elements in the site's red instead of amber.
 */
export function BrandWordmark({
  accent = '#D4784A',
  className = '',
  variant = 'wordmark',
}: {
  accent?: string;
  className?: string;
  variant?: 'wordmark' | 'full' | 'emblem';
}) {
  // ── Emblem SVG ────────────────────────────────────────────────────────────────
  // 100×100 viewBox so it scales perfectly at any size.
  // Uses CSS drop-shadow instead of SVG <filter> to avoid id collisions when
  // multiple instances are rendered on the same page.
  const Emblem = () => (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      {/* ── Outer diamond ── */}
      <polygon
        points="50,2 98,50 50,98 2,50"
        stroke="#7B68C8"
        strokeWidth="0.9"
        strokeOpacity="0.55"
        fill="none"
      />

      {/* ── Inner diamond ── */}
      <polygon
        points="50,15 85,50 50,85 15,50"
        stroke="#7B68C8"
        strokeWidth="0.7"
        strokeOpacity="0.42"
        fill="none"
      />

      {/* ── Horizontal grid lines (clipped to inner diamond shape) ── */}
      <line x1="33" y1="32" x2="67" y2="32" stroke="#8BB4D8" strokeOpacity="0.18" strokeWidth="0.5"/>
      <line x1="24" y1="41" x2="76" y2="41" stroke="#8BB4D8" strokeOpacity="0.18" strokeWidth="0.5"/>
      <line x1="15" y1="50" x2="85" y2="50" stroke="#8BB4D8" strokeOpacity="0.15" strokeWidth="0.5"/>
      <line x1="24" y1="59" x2="76" y2="59" stroke="#8BB4D8" strokeOpacity="0.18" strokeWidth="0.5"/>
      <line x1="33" y1="68" x2="67" y2="68" stroke="#8BB4D8" strokeOpacity="0.18" strokeWidth="0.5"/>

      {/* ── S-curve — outer glow ── */}
      <path
        d="M 50,15 C 83,15 83,50 50,50 C 17,50 17,85 50,85"
        stroke="#00ccee"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        style={{
          filter:
            'drop-shadow(0 0 4px #00d4ff) drop-shadow(0 0 10px #0099cc)',
        }}
      />

      {/* ── S-curve — bright inner core ── */}
      <path
        d="M 50,15 C 83,15 83,50 50,50 C 17,50 17,85 50,85"
        stroke="#b8f4ff"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Orange anchor dots ── */}
      <circle
        cx="50" cy="15" r="3.2"
        fill="#E07840"
        style={{ filter: 'drop-shadow(0 0 2.5px #E07840)' }}
      />
      <circle
        cx="50" cy="50" r="2.6"
        fill="#E07840"
        style={{ filter: 'drop-shadow(0 0 2px #E07840)' }}
      />
      <circle
        cx="50" cy="85" r="3.2"
        fill="#E07840"
        style={{ filter: 'drop-shadow(0 0 2.5px #E07840)' }}
      />
    </svg>
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
      <div
        className={`flex flex-col items-center ${className}`}
        style={{ gap: '0.7em' }}
      >
        {/* Emblem */}
        <div style={{ width: '4.8em', height: '4.8em' }}>
          <Emblem />
        </div>

        {/* SARTO + tagline */}
        <div className="flex flex-col items-center" style={{ gap: '0.3em' }}>
          <span
            className="font-brand tracking-[0.3em]"
            style={{
              color:      '#F5EFE6',
              fontWeight: 700,
              fontSize:   '1.9em',
              lineHeight: 1,
            }}
          >
            SARTO
          </span>

          {/* Divider + tagline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6em' }}>
            <span
              style={{
                display:    'block',
                width:      '2.8em',
                height:     '1px',
                background: accent,
                opacity:    0.55,
              }}
            />
            <span
              className="font-medium tracking-[0.22em]"
              style={{
                color:    accent,
                fontSize: '0.44em',
              }}
            >
              BESPOKE TRAVEL
            </span>
            <span
              style={{
                display:    'block',
                width:      '2.8em',
                height:     '1px',
                background: accent,
                opacity:    0.55,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Default: wordmark — emblem + SARTO side-by-side
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      style={{ lineHeight: 1 }}
    >
      <span
        style={{
          width:      '1.6em',
          height:     '1.6em',
          display:    'inline-block',
          flexShrink: 0,
        }}
      >
        <Emblem />
      </span>
      <span
        className="font-brand tracking-[0.2em]"
        style={{ color: '#F5EFE6', fontWeight: 700 }}
      >
        SARTO
      </span>
    </span>
  );
}
