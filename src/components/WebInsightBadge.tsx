'use client';

import { WebInsight } from '@/lib/types';

const config = {
  tip: {
    wrapperStyle: {
      background: 'rgba(16,185,129,0.04)',
      border: '1px solid rgba(52,211,153,0.18)',
      borderLeft: '2px solid rgba(52,211,153,0.55)',
    },
    icon: '💡',
    label: 'Insider Tip',
    labelColor: 'text-emerald-400/80',
    textColor: 'text-white/75',
    sourceColor: 'text-emerald-400/50',
    chipStyle: { background: 'rgba(52,211,153,0.10)', color: 'rgba(110,231,183,0.85)' },
  },
  warning: {
    wrapperStyle: {
      background: 'rgba(245,158,11,0.05)',
      border: '1px solid rgba(251,191,36,0.20)',
      borderLeft: '2px solid rgba(251,191,36,0.60)',
    },
    icon: '⚠️',
    label: 'HEADS UP',
    labelColor: 'text-amber-300/90 font-extrabold tracking-wider',
    textColor: 'text-amber-100/80 font-medium',
    sourceColor: 'text-amber-400/50',
    chipStyle: { background: 'rgba(245,158,11,0.12)', color: 'rgba(252,211,77,0.85)' },
  },
  trend: {
    wrapperStyle: {
      background: 'rgba(139,92,246,0.04)',
      border: '1px solid rgba(167,139,250,0.18)',
      borderLeft: '2px solid rgba(167,139,250,0.50)',
    },
    icon: '🔥',
    label: 'Trending Now',
    labelColor: 'text-violet-400/80',
    textColor: 'text-white/75',
    sourceColor: 'text-violet-400/50',
    chipStyle: { background: 'rgba(139,92,246,0.12)', color: 'rgba(196,181,253,0.85)' },
  },
};

export function WebInsightBadge({ insight }: { insight: WebInsight }) {
  const c = config[insight.type] ?? config.tip;

  return (
    <div className="flex gap-3 px-4 py-3 rounded-xl" style={c.wrapperStyle}>
      <span className="text-base flex-shrink-0 mt-0.5">{c.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] uppercase tracking-widest ${c.labelColor}`}>
            {c.label}
          </span>
          {insight.type === 'warning' && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={c.chipStyle}
            >
              Action Required
            </span>
          )}
          {insight.type === 'trend' && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={c.chipStyle}
            >
              2026
            </span>
          )}
        </div>
        <p className={`text-sm leading-relaxed ${c.textColor}`}>{insight.text}</p>
        {insight.source && (
          <p className={`text-[11px] mt-1.5 italic ${c.sourceColor}`}>
            — {insight.source}
          </p>
        )}
      </div>
    </div>
  );
}
