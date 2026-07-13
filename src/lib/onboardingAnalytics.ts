/**
 * onboardingAnalytics — fire-and-forget step tracking for the /onboarding wizard.
 *
 * Two sinks, both best-effort and NON-BLOCKING:
 *   1. Microsoft Clarity custom tags  → segment recordings/heatmaps by step
 *      (e.g. filter sessions where onboarding_step = "hotel").
 *   2. Supabase onboarding_step_events → exact per-step funnel numbers.
 *
 * GUARANTEE: nothing in here can throw, block, or change onboarding behaviour.
 * Every call is wrapped in try/catch and DB writes are fire-and-forget. If
 * Clarity hasn't loaded yet, or the table/migration isn't applied, calls no-op.
 */

import { supabase } from './supabase';

/** Stable step keys, indexed to the wizard's STEPS array in onboarding/page.tsx. */
export const ONBOARDING_STEP_KEYS = [
  'destination', // 0
  'dates',       // 1
  'interests',   // 2
  'style',       // 3
  'hotel',       // 4  ← the "Stay" step
  'dining',      // 5
  'picks',       // 6
] as const;

export type OnboardingStepKey =
  | (typeof ONBOARDING_STEP_KEYS)[number]
  | 'generate'; // fired when the user triggers itinerary generation

type ClarityFn = (action: string, ...args: unknown[]) => void;

const SESSION_KEY = 'sarto_onboarding_session';

/**
 * One id per onboarding attempt, kept in sessionStorage so every step of the
 * same run shares it. A fresh tab / new attempt gets a new id, which is what we
 * want for funnel math (distinct attempts).
 */
export function getOnboardingSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // Private-mode / blocked storage — degrade to an ephemeral id.
    return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

function tagClarity(stepKey: OnboardingStepKey, stepIndex: number): void {
  try {
    const clarity = (window as unknown as { clarity?: ClarityFn }).clarity;
    if (typeof clarity !== 'function') return; // not loaded yet → skip silently
    // Current step (overwrites) + furthest step reached (string, sortable).
    clarity('set', 'onboarding_step', stepKey);
    clarity('set', 'onboarding_step_index', String(stepIndex).padStart(2, '0'));
  } catch {
    /* never throw from analytics */
  }
}

function logStepEvent(args: {
  stepKey: OnboardingStepKey;
  stepIndex: number;
  userId: string | null;
  destination?: string | null;
}): void {
  try {
    // Fire-and-forget: do NOT await. Swallow every outcome so a failed insert
    // (missing migration, RLS, offline) can never surface to the user.
    void supabase
      .from('onboarding_step_events')
      .insert({
        user_id: args.userId,
        session_id: getOnboardingSessionId(),
        step_index: args.stepIndex,
        step_key: args.stepKey,
        destination: args.destination ?? null,
      })
      .then(
        () => {},
        () => {},
      );
  } catch {
    /* never throw from analytics */
  }
}

/**
 * Record that the user reached a given onboarding step. Safe to call on every
 * step entry (including back/forward); funnel queries de-dupe on
 * (session_id, step_index).
 */
export function trackOnboardingStep(
  stepIndex: number,
  stepKey: OnboardingStepKey,
  ctx?: { userId?: string | null; destination?: string | null },
): void {
  if (typeof window === 'undefined') return;
  tagClarity(stepKey, stepIndex);
  logStepEvent({
    stepKey,
    stepIndex,
    userId: ctx?.userId ?? null,
    destination: ctx?.destination ?? null,
  });
}

// Funnel events AFTER onboarding — generation outcome + results/share/save — so
// the post-"generate" funnel is measurable (it was blind before). Reuses the
// same session id + sink, with high step_index values so they sort after the
// wizard steps. step_key is free text, so no migration needed.
export const FUNNEL_EVENTS = {
  generation_started:   90,
  generation_succeeded: 91,
  generation_failed:    92,
  results_viewed:       93,
  share_opened:         94,
  trip_saved:           95,
} as const;

export function trackFunnelEvent(
  eventKey: keyof typeof FUNNEL_EVENTS,
  ctx?: { userId?: string | null; destination?: string | null },
): void {
  if (typeof window === 'undefined') return;
  try {
    const clarity = (window as unknown as { clarity?: ClarityFn }).clarity;
    if (typeof clarity === 'function') clarity('set', 'funnel_event', eventKey);
  } catch { /* never throw from analytics */ }
  try {
    void supabase
      .from('onboarding_step_events')
      .insert({
        user_id: ctx?.userId ?? null,
        session_id: getOnboardingSessionId(),
        step_index: FUNNEL_EVENTS[eventKey],
        step_key: eventKey,
        destination: ctx?.destination ?? null,
      })
      .then(() => {}, () => {});
  } catch { /* never throw from analytics */ }
}
