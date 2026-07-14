/**
 * Instant route-level loading UI for /onboarding.
 *
 * Shown the moment "New Trip" is tapped, while the onboarding wizard's chunk
 * loads — immediate feedback instead of a frozen dashboard, without a manual
 * overlay that could get stuck. Replaced automatically once the wizard mounts.
 */
export default function OnboardingLoading() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ backgroundColor: '#fdfcf9' }}
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
        Loading…
      </p>
    </main>
  );
}
