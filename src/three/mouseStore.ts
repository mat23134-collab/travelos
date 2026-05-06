/**
 * mouseStore — module-level mutable mouse position.
 *
 * Written by window.mousemove in CanvasShell (which has pointer-events:none
 * on the canvas, so we read mouse from the HTML layer instead).
 * Read in useFrame hooks inside R3F scenes to drive mouse-reactive animation.
 *
 * Plain object — no React state, no Zustand. Updates don't trigger re-renders.
 */
export const mousePos = {
  /** Normalized device x: -1 (left) → +1 (right) */
  x: 0,
  /** Normalized device y: -1 (bottom) → +1 (top) */
  y: 0,
};
