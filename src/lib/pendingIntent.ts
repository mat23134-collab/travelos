/**
 * pendingIntent — saves/restores a user's trip intent across the auth round-trip.
 *
 * Flow:
 *   1. User clicks a destination on the landing page (not logged in)
 *   2. savePendingIntent({ destination: 'Rome' }) is called
 *   3. User is sent to /auth to log in or sign up
 *   4. After successful auth, loadAndClearPendingIntent() is called
 *   5. If intent exists → redirect to /plan?destination=Rome
 *      Otherwise → redirect to /dashboard (default)
 *
 * sessionStorage is used (not localStorage) so stale intents are never
 * picked up in a new browser session.
 */

const KEY = 'sarto_pending_intent';

export interface PendingIntent {
  destination?: string;
}

export function savePendingIntent(intent: PendingIntent): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(intent));
}

export function loadAndClearPendingIntent(): PendingIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingIntent;
  } catch {
    return null;
  }
}
