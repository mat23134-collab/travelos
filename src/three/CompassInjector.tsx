'use client';

/**
 * CompassInjector — wraps CompassScene with the sceneContent tunnel.
 *
 * Dynamically imported with ssr:false in page.tsx so that neither
 * tunnel-rat nor R3F hooks run during server-side prerender.
 *
 * Props:
 *  locationMarker — optional hotel {lat,lng} passed down to CompassScene
 *                   so a gold marker appears on the compass face.
 *                   Ready for the hotel-location feature milestone.
 */

import { sceneContent } from './tunnel';
import { CompassScene, type LocationMarker } from './CompassScene';

export function CompassInjector({
  locationMarker,
}: {
  locationMarker?: LocationMarker | null;
}) {
  return (
    <sceneContent.In>
      <CompassScene locationMarker={locationMarker} />
    </sceneContent.In>
  );
}
