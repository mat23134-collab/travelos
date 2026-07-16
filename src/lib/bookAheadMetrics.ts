/**
 * bookAheadMetrics — lightweight, fire-and-forget instrumentation for the
 * book-ahead panel (§12 north star: % of trips where a traveler clicks ≥1
 * reservation CTA).
 *
 * Sink is Microsoft Clarity custom tags (already loaded, consent-gated), same
 * approach as onboardingAnalytics — so sessions can be segmented by whether a
 * reservation CTA was clicked and which platform. GUARANTEE: nothing here can
 * throw or block; it no-ops on SSR or when Clarity hasn't loaded.
 */

type ClarityFn = (action: string, ...args: unknown[]) => void;

function clarity(): ClarityFn | null {
  if (typeof window === 'undefined') return null;
  const c = (window as unknown as { clarity?: ClarityFn }).clarity;
  return typeof c === 'function' ? c : null;
}

/** Tag the session when a reservation CTA is clicked (north-star numerator). */
export function trackReservationCtaClick(platform: string | null | undefined): void {
  try {
    const c = clarity();
    if (!c) return;
    c('set', 'book_ahead_reservation_click', 'yes');
    if (platform) c('set', 'book_ahead_reservation_platform', platform);
  } catch {
    /* best-effort */
  }
}

/** Tag the session when the book-ahead panel renders picks (north-star denom). */
export function trackBookAheadPanelShown(pickCount: number): void {
  try {
    const c = clarity();
    if (!c) return;
    c('set', 'book_ahead_panel_shown', 'yes');
    c('set', 'book_ahead_pick_count', String(pickCount));
  } catch {
    /* best-effort */
  }
}
