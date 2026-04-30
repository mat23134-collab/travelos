'use client';

import { APP_VERSION } from '@/lib/version';

export function VersionStamp() {
  return (
    <div className="fixed bottom-3 right-3 z-[9999] pointer-events-none select-none print:hidden">
      <span
        className="text-[9px] font-mono tracking-widest px-2 py-0.5 rounded-full"
        style={{
          background: 'rgba(0,0,0,0.06)',
          color: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(0,0,0,0.07)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {APP_VERSION}
      </span>
    </div>
  );
}
