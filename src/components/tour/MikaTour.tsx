'use client';

/**
 * MikaTour — Mika's guided product tour, built on driver.js.
 *
 * driver.js is imperative and tiny, and renders `popover.description` as HTML,
 * which lets us drop Mika's avatar straight into the bubble. We only ever load
 * it inside a browser effect (dynamic import), so it never runs on the server.
 *
 * Two entry points:
 *   <WizardMikaTour wizardStep={n} />  — per-step spotlights in /onboarding
 *   <ResultsMikaTour ready={loaded} /> — the 2-step tour on the results page
 *
 * Styling lives in globals.css under `.mika-popover` (see the driver.css import
 * below for the base layout it extends).
 */

import { useEffect, useRef } from 'react';
import 'driver.js/dist/driver.css';
import type { Side } from 'driver.js';
import {
  TOUR_COPY,
  type TourLang,
  hasSeenTip,
  markTipSeen,
  isResultsTourArmed,
  disarmResultsTour,
  tourForced,
} from '@/lib/mikaTour';
import { readTripLanguagePref } from '@/lib/tripLanguagePref';

interface RunStep {
  element: string;
  body: string;
  side?: Side;
  align?: 'start' | 'center' | 'end';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mikaPopoverHtml(body: string, lang: TourLang): string {
  const name = TOUR_COPY[lang].name;
  return (
    `<div class="mika-tip">` +
    `<img class="mika-tip__face" src="/mika/idle.webp" alt="${name}" />` +
    `<div class="mika-tip__body">` +
    `<span class="mika-tip__name">${name}</span>` +
    `<p class="mika-tip__text">${escapeHtml(body)}</p>` +
    `</div></div>`
  );
}

/** Drive a set of steps; skips silently if no target is on the page yet. */
async function runTour(
  steps: RunStep[],
  lang: TourLang,
  opts: { nextText: string; doneText: string; onDone?: () => void },
): Promise<void> {
  if (typeof window === 'undefined') return;
  const present = steps.filter((s) => document.querySelector(s.element));
  if (present.length === 0) { opts.onDone?.(); return; }

  const { driver } = await import('driver.js');
  const d = driver({
    showProgress: false,
    showButtons: ['next'],
    allowClose: true,
    smoothScroll: true,
    overlayColor: '#0a1412',
    overlayOpacity: 0.72,
    stagePadding: 6,
    stageRadius: 18,
    popoverClass: lang === 'he' ? 'mika-popover mika-rtl' : 'mika-popover',
    nextBtnText: opts.nextText,
    doneBtnText: opts.doneText,
    onDestroyed: () => { opts.onDone?.(); },
    steps: present.map((s) => ({
      element: s.element,
      popover: { description: mikaPopoverHtml(s.body, lang), side: s.side ?? 'bottom', align: s.align ?? 'center' },
    })),
  });
  d.drive();
}

function detectLang(): TourLang {
  return readTripLanguagePref() === 'he' ? 'he' : 'en';
}

// ─── Phase 1: onboarding wizard ────────────────────────────────────────────────

export function WizardMikaTour({ wizardStep }: { wizardStep: number }) {
  useEffect(() => {
    const lang = detectLang();
    const c = TOUR_COPY[lang];
    // One spotlight per wizard screen that needs explaining (destination, the
    // style/pace step, the hotel base step, and the final top-sights picker).
    const byStep: Record<number, { id: string; element: string; body: string; side: Side }> = {
      0: { id: 'destination', element: '[data-tour="destination"]', body: c.destination, side: 'bottom' },
      3: { id: 'vibe',        element: '[data-tour="vibe"]',        body: c.vibe,        side: 'bottom' },
      4: { id: 'hotel',       element: '[data-tour="hotel"]',       body: c.hotel,       side: 'bottom' },
      6: { id: 'topsights',   element: '[data-tour="topsights"]',   body: c.topsights,   side: 'top'    },
    };
    const tip = byStep[wizardStep];
    if (!tip || (hasSeenTip(tip.id) && !tourForced())) return;

    let cancelled = false;
    // Let the step's mount + entrance animation settle before spotlighting.
    const timer = setTimeout(() => {
      if (cancelled || !document.querySelector(tip.element)) return;
      void runTour(
        [{ element: tip.element, body: tip.body, side: tip.side, align: 'center' }],
        lang,
        { nextText: TOUR_COPY[lang].gotIt, doneText: TOUR_COPY[lang].gotIt, onDone: () => markTipSeen(tip.id) },
      );
    }, 650);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [wizardStep]);

  return null;
}

// ─── Phase 2: results page ─────────────────────────────────────────────────────

export function ResultsMikaTour({ ready, lang }: { ready: boolean; lang: TourLang }) {
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    if ((!isResultsTourArmed() || hasSeenTip('results')) && !tourForced()) return;
    started.current = true;

    const timer = setTimeout(() => {
      void runTour(
        [
          { element: '[data-tour="days"]', body: TOUR_COPY[lang].daysMap, side: 'top', align: 'center' },
          { element: '[data-tour="sidepanel"]', body: TOUR_COPY[lang].sidePanel, side: lang === 'he' ? 'right' : 'left', align: 'center' },
        ],
        lang,
        {
          nextText: TOUR_COPY[lang].next,
          doneText: TOUR_COPY[lang].start,
          onDone: () => { markTipSeen('results'); disarmResultsTour(); },
        },
      );
    }, 900);
    return () => clearTimeout(timer);
  }, [ready, lang]);

  return null;
}
