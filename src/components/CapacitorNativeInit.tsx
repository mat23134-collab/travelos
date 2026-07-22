'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Renders nothing. On web this is a complete no-op — every native import stays
 * unused unless Capacitor.isNativePlatform() is true, so this never touches
 * native APIs (or their plugins' web shims) during a normal browser/SSR render.
 */
export function CapacitorNativeInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backButtonHandle: { remove: () => void } | undefined;

    (async () => {
      const [{ App }, { Keyboard, KeyboardResize }, { StatusBar, Style }] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/keyboard'),
        import('@capacitor/status-bar'),
      ]);

      try {
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // Not fatal — status bar styling is cosmetic.
      }

      try {
        await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
      } catch {
        // Not every platform supports every resize mode.
      }

      const listener = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
      backButtonHandle = listener;
    })();

    return () => {
      backButtonHandle?.remove();
    };
  }, []);

  return null;
}
