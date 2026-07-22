'use client';

import { useEffect } from 'react';

/**
 * No-op everywhere except inside the Capacitor native shell (Phase 2).
 * Capacitor.isNativePlatform() is false in every browser — including the
 * live sarto.tours site — so this renders nothing and does nothing there.
 * Only inside the wrapped Android/iOS app does it touch the status bar and
 * keyboard resize behavior.
 */
export function CapacitorNativeInit() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform() || cancelled) return;

      const [{ StatusBar, Style }, { Keyboard, KeyboardResize }] = await Promise.all([
        import('@capacitor/status-bar'),
        import('@capacitor/keyboard'),
      ]);

      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0a2748' });
      await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
