'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { mousePos } from './mouseStore';

export interface LocationMarker {
  lat: number;
  lng: number;
  label?: string;
}

export function CompassScene({
  locationMarker,
}: {
  locationMarker?: LocationMarker | null;
}) {
  const { viewport, invalidate } = useThree();
  const compassRef = useRef<THREE.Group>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const texture = useTexture('/compass-cute.svg');

  const posX = viewport.width > 7.5 ? 2.5 : viewport.width > 5 ? 1.5 : 0.1;
  const scale = viewport.width > 7.5 ? 1.9 : viewport.width > 5 ? 1.45 : 1.1;

  const markerOffset = useMemo<[number, number, number]>(() => [0.78, 0.62, 0.03], []);

  useFrame(({ clock }) => {
    invalidate();
    if (!compassRef.current) return;

    const t = clock.elapsedTime;
    const targetX = mousePos.y * 0.08;
    const targetY = mousePos.x * 0.08;

    compassRef.current.rotation.x = THREE.MathUtils.lerp(compassRef.current.rotation.x, targetX, 0.06);
    compassRef.current.rotation.y = THREE.MathUtils.lerp(compassRef.current.rotation.y, targetY, 0.06);
    compassRef.current.rotation.z = Math.sin(t * 0.28) * 0.03;
    compassRef.current.position.y = Math.sin(t * 0.75) * 0.08;

    if (markerRef.current) {
      const pulse = 1 + Math.sin(t * 2.3) * 0.14;
      markerRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[posX, -0.1, 0]} scale={scale}>
      <ambientLight intensity={0.8} />
      <pointLight position={[0, 0, 3]} intensity={1.2} color="#8bc7ff" />
      <pointLight position={[1.4, 1.4, 2]} intensity={0.9} color="#ffffff" />

      <group ref={compassRef}>
        <mesh>
          <planeGeometry args={[2.8, 2.8]} />
          <meshBasicMaterial map={texture} transparent />
        </mesh>

        {/* small upgrade: pulsing base-camp dot if hotel anchor exists */}
        {locationMarker && (
          <mesh ref={markerRef} position={markerOffset}>
            <circleGeometry args={[0.08, 20]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        )}
      </group>
    </group>
  );
}
