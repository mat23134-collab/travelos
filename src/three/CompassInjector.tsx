'use client';

/**
 * CompassInjector — wraps CompassScene with the sceneContent tunnel.
 *
 * Dynamically imported with ssr:false in page.tsx so that neither
 * tunnel-rat nor R3F hooks run during server-side prerender.
 */

import { sceneContent } from './tunnel';
import { CompassScene } from './CompassScene';

export function CompassInjector() {
  return (
    <sceneContent.In>
      <CompassScene />
    </sceneContent.In>
  );
}
