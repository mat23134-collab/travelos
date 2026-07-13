'use client';

/**
 * CanvasErrorBoundary — isolates the decorative WebGL background so it can NEVER
 * take the whole app down.
 *
 * react-three-fiber's <Canvas> creates a WebGLRenderer during render. On devices
 * that can't/won't provide a context — old phones, battery-saver mode, GPU
 * blocklists, or simply too many live WebGL contexts — three.js throws
 * "Error creating WebGL context". Because <CanvasShell> sits in the root layout
 * with nothing catching that throw, it propagated to the React root and
 * unmounted the ENTIRE app (white screen) for those users, and flooded Sentry.
 *
 * The canvas is purely cosmetic (pointer-events:none, z-0), so on any failure we
 * render nothing and the rest of the UI keeps working normally.
 */

import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { failed: boolean }

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Decorative layer — nothing to recover or report. Swallow so the throw
    // stops here instead of unmounting the app.
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
