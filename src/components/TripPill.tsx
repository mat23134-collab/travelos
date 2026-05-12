'use client';

/**
 * Unified trip “chip” — same radius, weight, and border language for
 * vibe, meal slot, squad, live, and neutral time-slot labels.
 */

const VIBE_SHELL: Record<string, { icon: string; border: string; bg: string; text: string }> = {
  'viral-trend': { icon: '🔥', border: 'rgba(168,85,247,0.42)', bg: 'rgba(168,85,247,0.12)', text: '#d8b4fe' },
  'hidden-gem': { icon: '💎', border: 'rgba(34,197,94,0.40)', bg: 'rgba(34,197,94,0.12)', text: '#86efac' },
  'local-favorite': { icon: '🏘️', border: 'rgba(249,115,22,0.40)', bg: 'rgba(249,115,22,0.12)', text: '#fdba74' },
  classic: { icon: '🏛️', border: 'rgba(59,130,246,0.40)', bg: 'rgba(59,130,246,0.12)', text: '#93c5fd' },
  'luxury-pick': { icon: '✨', border: 'rgba(201,168,76,0.45)', bg: 'rgba(201,168,76,0.14)', text: '#e8dcc4' },
  'budget-pick': { icon: '💰', border: 'rgba(6,182,212,0.40)', bg: 'rgba(6,182,212,0.12)', text: '#67e8f9' },
};

const ACCENT: Record<'emerald' | 'gold', { border: string; bg: string; text: string; pulse: string }> = {
  emerald: {
    border: 'rgba(34,197,94,0.35)',
    bg: 'rgba(34,197,94,0.10)',
    text: '#86efac',
    pulse: '#4ade80',
  },
  gold: {
    border: 'rgba(168,146,84,0.38)',
    bg: 'rgba(201,168,76,0.12)',
    text: '#C9A84C',
    pulse: '#a89254',
  },
};

const NEUTRAL = {
  border: 'rgba(255,255,255,0.14)',
  bg: 'rgba(15,17,23,0.55)',
  text: 'rgba(255,255,255,0.78)',
  icon: '📍',
};

export type TripPillSize = 'sm' | 'md';

export type TripPillProps =
  | { variant: 'vibe'; vibeKey: string; label: string; size?: TripPillSize }
  | {
      variant: 'meal';
      icon: string;
      label: string;
      /** Hex-ish accent, e.g. #f97316 */
      accentColor: string;
      size?: TripPillSize;
    }
  | {
      variant: 'accent';
      icon: string;
      label: string;
      tint: 'emerald' | 'gold';
      pulse?: boolean;
      size?: TripPillSize;
    }
  | { variant: 'slot'; icon: string; label: string; size?: TripPillSize };

function sizeClasses(size: TripPillSize | undefined) {
  return size === 'sm' ? 'text-[9px] px-2 py-0.5 gap-0.5' : 'text-[10px] px-2.5 py-1 gap-1';
}

export function TripPill(props: TripPillProps) {
  const sz = sizeClasses(props.size);
  const base = `inline-flex items-center rounded-full border font-semibold tracking-wide backdrop-blur-sm ${sz}`;

  if (props.variant === 'vibe') {
    const s = VIBE_SHELL[props.vibeKey] ?? { ...NEUTRAL, icon: NEUTRAL.icon };
    return (
      <span
        className={base}
        style={{
          background: s.bg,
          borderColor: s.border,
          color: s.text,
          boxShadow: `0 0 12px ${s.border}22`,
        }}
      >
        <span aria-hidden>{s.icon}</span>
        {props.label}
      </span>
    );
  }

  if (props.variant === 'meal') {
    const c = props.accentColor;
    return (
      <span
        className={base}
        style={{
          background: `${c}14`,
          borderColor: `${c}44`,
          color: c,
          boxShadow: `0 0 10px ${c}24`,
        }}
      >
        <span aria-hidden>{props.icon}</span>
        {props.label}
      </span>
    );
  }

  if (props.variant === 'slot') {
    return (
      <span
        className={base}
        style={{
          background: NEUTRAL.bg,
          borderColor: NEUTRAL.border,
          color: NEUTRAL.text,
        }}
      >
        <span aria-hidden>{props.icon}</span>
        {props.label}
      </span>
    );
  }

  const a = ACCENT[props.tint];
  return (
    <span
      className={base}
      style={{
        background: a.bg,
        borderColor: a.border,
        color: a.text,
      }}
    >
      {props.pulse && (
        <span
          className="w-1 h-1 rounded-full shrink-0 animate-pulse"
          style={{ background: a.pulse }}
        />
      )}
      <span aria-hidden>{props.icon}</span>
      {props.label}
    </span>
  );
}
