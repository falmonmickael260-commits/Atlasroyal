import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO, PLACEMENTS } from './layout';
import { BOARD } from '../engine/board';

/**
 * Le plateau continue de vivre quand personne ne joue : trafic sur le
 * périphérique, avions, reflets d'eau, poussière lumineuse. Toute la
 * géométrie est créée une seule fois puis mutée — jamais dans la boucle.
 */

const RING = PLACEMENTS.map((p) => new THREE.Vector3(p.pos[0] * 0.78, 0.06, p.pos[2] * 0.78));

/** Véhicules parcourant l'anneau intérieur du plateau. */
const Traffic = ({ count = 14 }: { count?: number }) => {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsets = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      t: i / count,
      speed: 0.021 + (i % 5) * 0.004,
      lane: (i % 2 === 0 ? 1 : -1) * 0.26,
    })),
    [count],
  );

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    offsets.forEach((o, i) => {
      o.t = (o.t + o.speed * dt) % 1;
      const f = o.t * RING.length;
      const a = RING[Math.floor(f) % RING.length];
      const b = RING[(Math.floor(f) + 1) % RING.length];
      const k = f % 1;
      dummy.position.lerpVectors(a, b, k);
      // Décalage latéral : deux voies de circulation.
      const dir = b.clone().sub(a).normalize();
      dummy.position.x += -dir.z * o.lane;
      dummy.position.z += dir.x * o.lane;
      dummy.lookAt(dummy.position.clone().add(dir));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.1, 0.06, 0.22]} />
      <meshStandardMaterial color="#FDE68A" emissive="#F59E0B" emissiveIntensity={1.4} toneMapped={false} />
    </instancedMesh>
  );
};

/** Trois appareils en approche, à des altitudes différentes. */
const Aircraft = () => {
  const g = useRef<THREE.Group>(null);
  const planes = useMemo(
    () => [
      { r: GEO.half * 1.32, y: 5.4, speed: 0.13, phase: 0 },
      { r: GEO.half * 1.05, y: 7.2, speed: -0.09, phase: 2.1 },
      { r: GEO.half * 1.55, y: 4.2, speed: 0.17, phase: 4.3 },
    ],
    [],
  );
  const refs = useRef<Array<THREE.Group | null>>([]);

  useFrame((st) => {
    planes.forEach((p, i) => {
      const o = refs.current[i];
      if (!o) return;
      const a = st.clock.elapsedTime * p.speed + p.phase;
      o.position.set(Math.cos(a) * p.r, p.y + Math.sin(a * 2) * 0.35, Math.sin(a) * p.r);
      o.rotation.y = -a + (p.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
      o.rotation.z = Math.sin(a * 2) * 0.22;
    });
  });

  return (
    <group ref={g}>
      {planes.map((p, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.1, 0.5, 6]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.05, 0, 0]}>
            <boxGeometry args={[0.12, 0.02, 0.5]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[-0.24, 0, 0]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#F87171" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/** Poussière lumineuse au-dessus du plateau. */
const Motes = ({ count = 220 }: { count?: number }) => {
  const pts = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * GEO.side * 1.5;
      arr[i * 3 + 1] = Math.random() * 7 + 0.4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * GEO.side * 1.5;
    }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [count]);

  useFrame((st) => {
    if (!pts.current) return;
    pts.current.rotation.y = st.clock.elapsedTime * 0.012;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const a = pos.array as Float32Array;
    for (let i = 1; i < a.length; i += 3) {
      a[i] += Math.sin(st.clock.elapsedTime * 0.5 + i) * 0.0016;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pts} geometry={geo}>
      <pointsMaterial size={0.055} color="#FDE68A" transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
};

/** Balises lumineuses posées sur les hubs : le plateau clignote la nuit. */
const Beacons = () => {
  const refs = useRef<Array<THREE.Mesh | null>>([]);
  const hubs = useMemo(() => BOARD.filter((t) => t.kind === 'hub' || t.kind === 'reseau').map((t) => t.i), []);
  useFrame((st) => {
    hubs.forEach((_, i) => {
      const m = refs.current[i];
      if (!m) return;
      const pulse = 0.5 + 0.5 * Math.sin(st.clock.elapsedTime * 2.2 + i * 1.7);
      m.scale.setScalar(0.6 + pulse * 0.7);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.25 + pulse * 0.5;
    });
  });
  return (
    <group>
      {hubs.map((i, n) => {
        const p = PLACEMENTS[i];
        return (
          <mesh
            key={i}
            ref={(el) => { refs.current[n] = el; }}
            position={[p.pos[0], GEO.thickness / 2 + 0.5, p.pos[2]]}
          >
            <sphereGeometry args={[0.09, 10, 10]} />
            <meshBasicMaterial color="#60A5FA" transparent opacity={0.6} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};

export const CityLife = ({ quality }: { quality: 'high' | 'low' }) => (
  <group>
    <Traffic count={quality === 'high' ? 16 : 7} />
    <Aircraft />
    <Beacons />
    {quality === 'high' && <Motes />}
  </group>
);
