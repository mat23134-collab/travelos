'use client';

import { useEffect, useState } from 'react';
import { TravelerProfile } from '@/lib/types';
import type { LogisticsData } from '@/app/api/logistics/route';
import { useAuth } from '@/lib/auth-context';

function Skeleton() {
  return <div className="h-4 rounded-lg animate-pulse w-full" style={{ background: 'var(--color-paper-sunk)' }} />;
}

function CardShell({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-display text-base font-semibold" style={{ color: 'var(--color-ink-warm)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function WeatherCard({ w }: { w: LogisticsData['weather'] }) {
  return (
    <CardShell emoji="🌤" title="Expected Weather">
      <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-ink-warm)' }}>{w.summary}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: 'var(--color-ink-warm-mut)' }}>Temperature</span>
          <span className="font-semibold" style={{ color: 'var(--color-ink-warm)' }}>{w.tempRange}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: 'var(--color-ink-warm-mut)' }}>Precipitation</span>
          <span className="font-semibold" style={{ color: 'var(--color-ink-warm)' }}>{w.rainChance}</span>
        </div>
        <div
          className="mt-2.5 px-3.5 py-2.5 rounded-xl text-xs leading-relaxed"
          style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)' }}
        >
          🧳 {w.packingNote}
        </div>
        <p className="text-[10px] mt-1.5 italic" style={{ color: 'var(--color-ink-warm-mut)' }}>{w.disclaimer}</p>
      </div>
    </CardShell>
  );
}

function CurrencyCard({ c }: { c: LogisticsData['currency'] }) {
  return (
    <CardShell emoji="💱" title="Currency">
      <div className="font-display text-3xl font-semibold mb-1" style={{ color: 'var(--color-sunrise-deep)' }}>{c.formatted}</div>
      <div className="text-xs mb-4" style={{ color: 'var(--color-ink-warm-mut)' }}>{c.localCurrency} · {c.source}</div>
      <div
        className="px-3.5 py-3 rounded-xl"
        style={{ background: 'var(--color-paper-sunk)' }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-sunrise-deep)' }}>
          Your budget in local currency
        </div>
        <div className="text-sm font-bold" style={{ color: 'var(--color-ink-warm)' }}>{c.dailyBudgetLocal}</div>
      </div>
    </CardShell>
  );
}

function SafetyCard({ s }: { s: LogisticsData['safetyVisa'] }) {
  const colorMap = {
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    yellow: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  };
  const c = colorMap[s.safetyColor];

  return (
    <CardShell emoji="🛡" title="Safety & Entry">
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${c.bg} ${c.border} border ${c.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {s.safetyLevel}
      </div>
      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--color-ink-warm)' }}>{s.visaNote}</p>
      {s.groupTip && (
        <div
          className="text-xs rounded-xl px-3.5 py-2.5 mb-2 leading-relaxed"
          style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm-mut)' }}
        >
          👥 {s.groupTip}
        </div>
      )}
      {s.healthTip && (
        <div
          className="text-xs rounded-xl px-3.5 py-2.5 leading-relaxed"
          style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm-mut)' }}
        >
          💉 {s.healthTip}
        </div>
      )}
    </CardShell>
  );
}

export function LogisticsDashboard({ profile }: { profile: TravelerProfile }) {
  const { session } = useAuth();
  const [data, setData] = useState<LogisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    setLoading(true);
    setError('');

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    fetch('/api/logistics', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        destination: profile.destination,
        startDate: profile.startDate || '',
        endDate: profile.endDate || '',
        groupType: profile.groupType,
        budget: profile.budget,
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError('Logistics unavailable — ' + d.error);
        else setData(d);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '';
        setError(msg.includes('abort') ? 'Request timed out — tap Retry.' : 'Could not load logistics data.');
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, [profile, attempt, session]);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--color-ink-warm)' }}>Before You Go</h2>
        <div className="flex-1 h-px" style={{ background: 'var(--color-paper-sunk)' }} />
      </div>

      {loading && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl p-6" style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-6 h-6 rounded-full animate-pulse" style={{ background: 'var(--color-paper-sunk)' }} />
                <div className="h-4 rounded w-24 animate-pulse" style={{ background: 'var(--color-paper-sunk)' }} />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton /><Skeleton /><Skeleton />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm" style={{ color: 'var(--color-ink-warm-mut)' }}>{error}</p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="px-4 py-2 text-xs font-semibold rounded-xl transition-colors"
            style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)', color: 'var(--color-ink-warm)' }}
          >
            Retry
          </button>
        </div>
      )}

      {data && !loading && (
        <div className="grid sm:grid-cols-3 gap-4">
          <WeatherCard w={data.weather} />
          <CurrencyCard c={data.currency} />
          <SafetyCard s={data.safetyVisa} />
        </div>
      )}
    </section>
  );
}
