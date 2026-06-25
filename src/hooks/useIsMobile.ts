'use client';

import { useEffect, useState } from 'react';

/**
 * True on phone-class devices (where tapping an Instagram/TikTok link is
 * intercepted by the installed app). SSR-safe: starts false, resolves after
 * mount from the user agent.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    setMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(ua));
  }, []);
  return mobile;
}
