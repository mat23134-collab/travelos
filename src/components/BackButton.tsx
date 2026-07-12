'use client';

import { useRouter } from 'next/navigation';

/**
 * BackButton — returns to the previous page (e.g. the itinerary the user came
 * from), not a hard-coded route. Falls back to `fallback` when there's no
 * history to go back to (direct load / new tab). The arrow slides on hover.
 */
export function BackButton({
  label = 'Back',
  fallback = '/',
  className = '',
  color = '#8f4220',
}: {
  label?: string;
  fallback?: string;
  className?: string;
  color?: string;
}) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(fallback);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={`group inline-flex items-center gap-2 text-sm font-semibold transition-colors ${className}`}
      style={{ color }}
    >
      <span
        aria-hidden="true"
        className="inline-block transition-transform duration-200 group-hover:-translate-x-1"
        style={{ fontSize: '20px', lineHeight: 1 }}
      >
        ←
      </span>
      {label}
    </button>
  );
}
