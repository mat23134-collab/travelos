// src/components/AssistantAvatar.tsx
// "Mika" — the itinerary assistant's little concierge character.
// Pure inline SVG (no assets), tuned to the gold/deep-green palette.

export function AssistantAvatar({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      role="img"
      aria-label="Mika, your travel assistant"
      className={`shrink-0 ${className}`}
    >
      <circle cx="22" cy="22" r="22" fill="#0d2b27" />
      {/* shoulders */}
      <path d="M9 42c1.6-6.5 6.4-9.5 13-9.5S33.4 35.5 35 42z" fill="#c4a26a" />
      {/* hair (back) */}
      <path d="M10.5 22c0-7.2 5.1-12.5 11.5-12.5S33.5 14.8 33.5 22c0 3-.9 5.4-2 7.2l-1-9.4a8.5 8.5 0 0 0-17 0l-1 9.4c-1.1-1.8-2-4.2-2-7.2z" fill="#2a2320" />
      {/* neck */}
      <rect x="19.4" y="27" width="5.2" height="6.5" rx="2.6" fill="#e8b58c" />
      {/* face */}
      <ellipse cx="22" cy="21" rx="8.6" ry="9.1" fill="#f2c9a0" />
      {/* fringe */}
      <path d="M13.3 19.2c.8-5.2 4.3-8.4 8.7-8.4s7.9 3.2 8.7 8.4c-2.3-2.1-5.1-3.3-8.7-3.3s-6.4 1.2-8.7 3.3z" fill="#2a2320" />
      {/* blush */}
      <circle cx="16.6" cy="24" r="1.5" fill="#f3a98a" opacity="0.5" />
      <circle cx="27.4" cy="24" r="1.5" fill="#f3a98a" opacity="0.5" />
      {/* eyes */}
      <circle cx="18.7" cy="21" r="1.3" fill="#1f2421" />
      <circle cx="25.3" cy="21" r="1.3" fill="#1f2421" />
      {/* smile */}
      <path d="M18.8 24.6c1.2 1.4 5.2 1.4 6.4 0" stroke="#9c5a3c" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      {/* headset band */}
      <path d="M11.6 22a10.4 10.4 0 0 1 20.8 0" stroke="#c4a26a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* earcups */}
      <rect x="10.1" y="20.4" width="3.3" height="5.6" rx="1.65" fill="#c4a26a" />
      <rect x="30.6" y="20.4" width="3.3" height="5.6" rx="1.65" fill="#c4a26a" />
      {/* mic arm + tip */}
      <path d="M11.8 26c0 4.2 2.7 6.8 6.2 7.1" stroke="#c4a26a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="18.3" cy="33.2" r="1.25" fill="#c4a26a" />
    </svg>
  );
}
