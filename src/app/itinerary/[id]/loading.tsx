/**
 * Instant route-level loading UI for /itinerary/[id].
 *
 * Next's App Router streams this the moment navigation starts (while the page's
 * server component is fetching its data), then swaps in the real page when it's
 * ready. Unlike a manual full-screen overlay on the previous page, this is the
 * actual route's loading state: it can never get "stuck" over the dashboard, and
 * the browser Back button behaves normally. Gives the user immediate feedback
 * that the tap registered instead of a frozen screen.
 */
export default function ItineraryLoading() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{
        background:
          'linear-gradient(180deg, #f2e7d2 0%, #e9dcc2 52%, #efe3cd 100%)',
      }}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="rounded-full animate-spin"
        style={{
          width: 46,
          height: 46,
          border: '3px solid rgba(184,85,46,0.20)',
          borderTopColor: '#b8552e',
        }}
      />
      <p className="text-sm font-bold tracking-wide" style={{ color: '#8f4220' }}>
        Loading your trip…
      </p>
    </main>
  );
}
