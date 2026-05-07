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
  const needleRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const texture = useTexture('/travelos-logo-future.svg');

  const posX = viewport.width > 7.5 ? 2.85 : viewport.width > 5 ? 2.0 : 0.85;
  const posY = viewport.width > 7.5 ? 0.35 : viewport.width > 5 ? 0.2 : -0.05;
  const scale = viewport.width > 7.5 ? 0.98 : viewport.width > 5 ? 0.8 : 0.58;

  const markerOffset = useMemo<[number, number, number]>(() => [0.0, -0.98, 0.03], []);

  useFrame(({ clock }) => {
    invalidate();
    if (!compassRef.current) return;

    const t = clock.elapsedTime;
    const targetX = mousePos.y * 0.08;
    const targetY = mousePos.x * 0.08;

    compassRef.current.rotation.x = THREE.MathUtils.lerp(compassRef.current.rotation.x, targetX, 0.06);
    compassRef.current.rotation.y = THREE.MathUtils.lerp(compassRef.current.rotation.y, targetY, 0.06);
    compassRef.current.rotation.z = Math.sin(t * 0.2) * 0.015;
    compassRef.current.position.y = Math.sin(t * 0.6) * 0.06;

    if (markerRef.current) {
      const pulse = 1 + Math.sin(t * 2.3) * 0.14;
      markerRef.current.scale.setScalar(pulse);
    }

    if (needleRef.current && locationMarker) {
      const raw = Math.atan2(locationMarker.lng, locationMarker.lat);
      const overshoot = raw * 1.06;
      needleRef.current.rotation.z = THREE.MathUtils.lerp(
        needleRef.current.rotation.z,
        overshoot,
        0.09,
      );
    }
  });

  return (
    <group position={[posX, posY, 0]} scale={scale}>
      <ambientLight intensity={0.8} />
      <pointLight position={[0, 0, 3]} intensity={1.2} color="#8bc7ff" />
      <pointLight position={[1.4, 1.4, 2]} intensity={0.9} color="#ffffff" />

      <group ref={compassRef}>
        {/* soft futuristic halo */}
        <mesh position={[0, 0, -0.02]}>
          <circleGeometry args={[1.45, 40]} />
          <meshBasicMaterial color="#4cc9ff" transparent opacity={0.1} />
        </mesh>
        <mesh position={[0, 0, -0.015]}>
          <ringGeometry args={[1.2, 1.38, 72]} />
          <meshBasicMaterial color="#9edfff" transparent opacity={0.18} />
        </mesh>
        <mesh>
          <planeGeometry args={[2.8, 2.8]} />
          <meshBasicMaterial map={texture} transparent opacity={0.92} />
        </mesh>

        {/* heading needle with subtle 1.06x overshoot */}
        {locationMarker && (
          <mesh ref={needleRef} position={[0, 0, 0.04]}>
            <planeGeometry args={[0.12, 1.2]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
          </mesh>
        )}

        {/* subtle base-camp pulse marker */}
        {locationMarker && (
          <mesh ref={markerRef} position={markerOffset}>
            <circleGeometry args={[0.065, 20]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        )}
      </group>
    </group>
  );
}
