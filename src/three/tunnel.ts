/**
 * tunnel.ts — singleton tunnel-rat channel.
 *
 * Any page component can inject 3D scene content into the persistent
 * R3F Canvas via <sceneContent.In>. The canvas renders it via <sceneContent.Out>.
 *
 * Usage:
 *   // Inside a page/step component (anywhere in the tree):
 *   import { sceneContent } from '@/three/tunnel';
 *   <sceneContent.In>
 *     <mesh>...</mesh>
 *   </sceneContent.In>
 *
 *   // Inside CanvasShell (once, inside <Canvas>):
 *   <sceneContent.Out />
 */
import tunnel from 'tunnel-rat';

export const sceneContent = tunnel();
