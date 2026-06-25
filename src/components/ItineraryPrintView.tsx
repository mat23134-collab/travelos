'use client';

/**
 * ItineraryPrintView — a clean, light, linear layout of the full itinerary
 * meant for browser "Print -> Save as PDF" (offline-friendly export, #24).
 *
 * Rendered at /itinerary/[id]/print. Kept deliberately dependency-free
 * (no jsPDF/html2canvas) — the browser's native print pipeline produces a
 * crisp, text-selectable PDF and works fully offline once the page loads.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Activity, DiningSpot, Itinerary } from '@/lib/types';

const SLOT_META: { key: 'morning' | 'afternoon' | 'evening'; label: string; icon: string }[] = [
  { key: 'morning',   label: 'Morning',   icon: '🌅' },
  { key: 'afternoon', label: 'Afternoon', icon: '☀️' },
  { key: 'evening',   label: 'Evening',   icon: '🌙' },
];

const MEAL_META: { key: 'breakfast' | 'lunch' | 'dinner'; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: '☕' },
  { key: 'lunch',     label: 'Lunch',     icon: '🥪' },
  { key: 'dinner',    label: 'Dinner',    icon: '🍽️' },
];

function ActivityBlock({ activity, icon, label }: { activity: Activity; icon: string; label: string }) {
  return (
    <div className="print-activity">
      <div className="print-activity-head">
        <span className="print-activity-icon" aria-hidden>{icon}</span>
        <span className="print-activity-label">{label}</span>
        {activity.time_slot && <span className="print-activity-time">{activity.time_slot}</span>}
      </div>
      <p className="print-activity-name">{activity.name}</p>
      {activity.description && <p className="print-activity-desc">{activity.description}</p>}
      <p className="print-activity-meta">
        {activity.neighborhood && <span>📍 {activity.neighborhood}</span>}
        {activity.duration && <span>⏱ {activity.duration}</span>}
        {activity.estimatedCost && <span>💰 {activity.estimatedCost}</span>}
      </p>
      {activity.whyThis && <p className="print-activity-why">“{activity.whyThis}”</p>}
    </div>
  );
}

function DiningBlock({ spot, icon, label }: { spot: DiningSpot; icon: string; label: string }) {
  return (
    <div className="print-activity print-dining">
      <div className="print-activity-head">
        <span className="print-activity-icon" aria-hidden>{icon}</span>
        <span className="print-activity-label">{label}</span>
      </div>
      <p className="print-activity-name">{spot.name}</p>
      <p className="print-activity-meta">
        {spot.cuisine && <span>🍴 {spot.cuisine}</span>}
        {spot.neighborhood && <span>📍 {spot.neighborhood}</span>}
        {spot.priceRange && <span>💰 {spot.priceRange}</span>}
      </p>
      {spot.mustTry && <p className="print-activity-why">Try: {spot.mustTry}</p>}
    </div>
  );
}

export function ItineraryPrintView({ itinerary }: { itinerary: Itinerary }) {
  const [printedAt, setPrintedAt] = useState('');

  useEffect(() => {
    setPrintedAt(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }));
    // Give the page a moment to render, then open the print dialog automatically.
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, []);

  const hotelName = itinerary.basecamp?.type === 'booked'
    ? itinerary.basecamp.booked?.name
    : itinerary.basecamp?.recommendations?.[0]?.name;

  return (
    <div className="itinerary-print">
      {/* ── On-screen-only toolbar ───────────────────────────────────────── */}
      <div className="print-toolbar print-hide">
        <Link href={itinerary._id ? `/itinerary/${itinerary._id}` : '/'} className="print-toolbar-link">
          ← Back to trip
        </Link>
        <button type="button" className="print-toolbar-btn" onClick={() => window.print()}>
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* ── Cover / overview ─────────────────────────────────────────────── */}
      <header className="print-header">
        <p className="print-kicker">TravelOS Itinerary</p>
        <h1 className="print-title">{itinerary.destination}</h1>
        <p className="print-subtitle">{itinerary.totalDays}-day trip{hotelName ? ` · Staying at ${hotelName}` : ''}</p>
        {itinerary.strategicOverview && <p className="print-overview">{itinerary.strategicOverview}</p>}

        {itinerary.budgetSummary && (
          <div className="print-budget">
            {itinerary.budgetSummary.dailyAverage && (
              <div><strong>Daily average:</strong> {itinerary.budgetSummary.dailyAverage}</div>
            )}
            {itinerary.budgetSummary.totalEstimate && (
              <div><strong>Trip estimate:</strong> {itinerary.budgetSummary.totalEstimate}</div>
            )}
            {itinerary.budgetSummary.includes && (
              <div className="print-budget-includes">{itinerary.budgetSummary.includes}</div>
            )}
          </div>
        )}
      </header>

      {/* ── Days ──────────────────────────────────────────────────────────── */}
      {(itinerary.days ?? []).map((day) => (
        <section className="print-day" key={day.day}>
          <h2 className="print-day-title">
            Day {day.day}
            {day.date && <span className="print-day-date"> · {day.date}</span>}
            {day.theme && <span className="print-day-theme"> — {day.theme}</span>}
          </h2>

          <div className="print-day-grid">
            {SLOT_META.map(({ key, label, icon }) => {
              const activity = day[key];
              return activity ? (
                <ActivityBlock key={key} activity={activity} icon={icon} label={label} />
              ) : null;
            })}
            {MEAL_META.map(({ key, label, icon }) => {
              const spot = day[key];
              return spot?.name ? (
                <DiningBlock key={key} spot={spot} icon={icon} label={label} />
              ) : null;
            })}
          </div>

          {(day.transportTip || day.estimatedDailyCost) && (
            <p className="print-day-footer">
              {day.transportTip && <span>🚇 {day.transportTip}</span>}
              {day.estimatedDailyCost && <span>💵 Est. day cost: {day.estimatedDailyCost}</span>}
            </p>
          )}
        </section>
      ))}

      {/* ── Tips ──────────────────────────────────────────────────────────── */}
      {(itinerary.packingTips?.length || itinerary.bestLocalTips?.length) ? (
        <section className="print-tips">
          {itinerary.packingTips && itinerary.packingTips.length > 0 && (
            <div className="print-tips-col">
              <h3>🎒 Packing tips</h3>
              <ul>
                {itinerary.packingTips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          )}
          {itinerary.bestLocalTips && itinerary.bestLocalTips.length > 0 && (
            <div className="print-tips-col">
              <h3>💡 Local tips</h3>
              <ul>
                {itinerary.bestLocalTips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          )}
        </section>
      ) : null}

      {/* ── City transport ───────────────────────────────────────────────── */}
      {itinerary.cityTransport && (
        <section className="print-transport">
          <h3>🚉 Getting around {itinerary.destination}</h3>
          {itinerary.cityTransport.intro && <p>{itinerary.cityTransport.intro}</p>}
          <ul>
            {itinerary.cityTransport.priceSingle && <li>Single ride: {itinerary.cityTransport.priceSingle}</li>}
            {itinerary.cityTransport.priceDayPass && <li>Day pass: {itinerary.cityTransport.priceDayPass}</li>}
            {itinerary.cityTransport.priceWeekPass && <li>Weekly pass: {itinerary.cityTransport.priceWeekPass}</li>}
            {itinerary.cityTransport.scoutTipPayment && <li>{itinerary.cityTransport.scoutTipPayment}</li>}
          </ul>
        </section>
      )}

      <footer className="print-footer">
        Generated by TravelOS{printedAt ? ` · ${printedAt}` : ''}
      </footer>
    </div>
  );
}
