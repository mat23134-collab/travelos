'use client';

import { useEffect, useState } from 'react';
import { TravelerProfile } from '@/lib/types';
import type { LogisticsData } from '@/app/api/logistics/route';

function Skeleton() {
  return <div className="h-4 bg-[#f0ede4] rounded-lg animate-pulse w-full" />;
}

function WeatherCard({ w }: { w: LogisticsData['weather'] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🌤</span>
        <h3 className="font-bold text-[#111827] text-sm">Expected Weather</h3>
      </div>
      <p className="text-sm text-[#374151] leading-relaxed mb-3">{w.summary}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#9ca3af]">Temperature</span>
          <span className="font-medium text-[#111827]">{w.tempRange}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#9ca3af]">Precipitation</span>
          <span className="font-medium text-[#111827]">{w.rainChance}</span>
        </div>
        <div className="mt-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700 leading-relaxed">
          🧳 {w.packingNote}
        </div>
        <p className="text-[10px] text-[#9ca3af] mt-1 italic">{w.disclaimer}</p>
      </div>
    </div>
  );
}

function CurrencyCard({ c }: { c: LogisticsData['currency'] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">💱</span>
        <h3 className="font-bold text-[#111827] text-sm">Currency</h3>
      </div>
      <div className="text-2xl font-bold text-[#ff5a5f] mb-1">{c.formatted}</div>
      <div className="text-xs text-[#9ca3af] mb-3">{c.localCurrency} · {c.source}</div>
      <div className="px-3 py-2.5 rounded-xl bg-[#fff0f0] border border-[#fecaca]">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#ff5a5f] mb-0.5">
          Your budget in local currency
        </div>
        <div className="text-sm font-bold text-[#111827]">{c.dailyBudgetLocal}</div>
      </div>
    </div>
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
    <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🛡</span>
        <h3 className="font-bold text-[#111827] text-sm">Safety & Entry</h3>
      </div>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${c.bg} ${c.border} border ${c.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        {s.safetyLevel}
      </div>
      <p className="text-sm text-[#374151] leading-relaxed mb-3">{s.visaNote}</p>
      {s.groupTip && (
        <div className="text-xs text-[#6b7280] bg-[#f8f7f2] rounded-lg px-3 py-2 mb-2 leading-relaxed">
          👥 {s.groupTip}
        </div>
      )}
      {s.healthTip && (
        <div className="text-xs text-[#6b7280] bg-[#f8f7f2] rounded-lg px-3 py-2 leading-relaxed">
          💉 {s.healthTip}
        </div>
      )}
    </div>
  );
}

export function LogisticsDashboard({ profile }: { profile: TravelerProfile }) {
  const [data, setData] = useState<LogisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/logistics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: profile.destination,
        startDate: profile.startDate,
        endDate: profile.endDate,
        groupType: profile.groupType,
        budget: profile.budget,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Could not load logistics data.'))
      .finally(() => setLoading(false));
  }, [profile]);

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xl font-bold text-[#111827]">Before You Go</h2>
        <div className="flex-1 h-px bg-[#e5e7eb]" />
      </div>

      {loading && (
        <div className="grid sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-[#f0ede4] rounded-full animate-pulse" />
                <div className="h-4 bg-[#f0ede4] rounded w-24 animate-pulse" />
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton /><Skeleton /><Skeleton />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="text-sm text-[#9ca3af] py-4 text-center">
          Could not load logistics data — check your API key.
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
