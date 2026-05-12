'use client';

import { VERSION_LABEL } from '@/lib/version';

export function VersionStamp() {
  const full =
    typeof process.env.NEXT_PUBLIC_BUILT_AT === 'string' && process.env.NEXT_PUBLIC_BUILT_AT
      ? `${VERSION_LABEL} (${process.env.NEXT_PUBLIC_BUILT_AT})`
      : VERSION_LABEL;

  return (
    <div className="fixed bottom-3 right-3 z-[9999] pointer-events-none select-none print:hidden">
      <span
        title={full}
        className="text-[9px] font-mono tracking-widest px-2 py-0.5 rounded-full"
        style={{
          background: 'rgba(15, 23, 42, 0.45)',
          color: 'rgba(255, 255, 255, 0.42)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {VERSION_LABEL}
      </span>
    </div>
  );
}
