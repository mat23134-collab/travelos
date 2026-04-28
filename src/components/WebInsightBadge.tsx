'use client';

import { WebInsight } from '@/lib/types';

const config = {
  tip: {
    wrapper: 'bg-emerald-50 border-emerald-200',
    icon: '💡',
    label: 'Insider Tip',
    labelColor: 'text-emerald-700',
    textColor: 'text-emerald-800',
    sourceColor: 'text-emerald-600',
    accent: 'border-l-4 border-l-emerald-400',
  },
  warning: {
    wrapper: 'bg-red-50 border-red-300 shadow-sm shadow-red-100',
    icon: '⚠️',
    label: 'HEADS UP',
    labelColor: 'text-red-700 font-extrabold tracking-wider',
    textColor: 'text-red-900 font-medium',
    sourceColor: 'text-red-500',
    accent: 'border-l-4 border-l-red-500',
  },
  trend: {
    wrapper: 'bg-violet-50 border-violet-200',
    icon: '🔥',
    label: 'Trending Now',
    labelColor: 'text-violet-700',
    textColor: 'text-violet-900',
    sourceColor: 'text-violet-500',
    accent: 'border-l-4 border-l-violet-400',
  },
};

export function WebInsightBadge({ insight }: { insight: WebInsight }) {
  const c = config[insight.type] ?? config.tip;

  return (
    <div className={`flex gap-3 px-4 py-3 rounded-xl border ${c.wrapper} ${c.accent}`}>
      <span className="text-lg flex-shrink-0 mt-0.5">{c.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] uppercase tracking-widest ${c.labelColor}`}>
            {c.label}
          </span>
          {insight.type === 'warning' && (
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">
              Action Required
            </span>
          )}
          {insight.type === 'trend' && (
            <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-semibold">
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
