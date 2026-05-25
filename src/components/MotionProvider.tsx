'use client';

/**
 * MotionProvider — wraps the app with Framer Motion's MotionConfig.
 *
 * reducedMotion="user" tells Framer Motion to respect the OS-level
 * "prefers-reduced-motion" setting, collapsing spring/tween durations
 * to near-zero for users who opt out of motion.
 */

import { MotionConfig } from 'framer-motion';

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
