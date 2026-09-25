import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { diceFaceTexture } from './textures';

/**
 * Dés 3D. Pas de moteur physique : une trajectoire scriptée (arc + rotation
 * amortie + rebond) donne la sensation de poids pour une fraction du coût.
 * Faces opposées : 1/6, 2/5, 3/4 — comme un vrai dé.
 */
const FACE_ORDER = [1, 6, 2, 5, 3, 4]; // +x, -x, +y, -y, +z, -z

/** Rotation amenant la valeur demandée vers le haut. */
const restFor = (value: number): [number, number, number] => {
  switch (value) {
    case 1:
      return [0, 0, -Math.PI / 2];
    case 6:
      return [0, 0, Math.PI / 2];
    case 2:
      return [0, 0, 0];
    case 5:
      return [Math.PI, 0, 0];
    case 3:
      return [-Math.PI / 2, 0, 0];
    default:
      return [Math.PI / 2, 0, 0];
  }
};

const Die = ({
  value,
  rolling,
  seed,
  home,
}: {
  value: number;
  rolling: boolean;
  seed: number;
  home: [number, number, number];
}) => {
  const ref = useRef<THREE.Mesh>(null);
  const t = useRef(0);
  const spin = useRef(new THREE.Vector3());
  const homeVec = useMemo(() => new THREE.Vector3(...home), [home]);

  const materials = useMemo(
    () =>
      FACE_ORDER.map(
        (v) =>
          new THREE.MeshStandardMaterial({
            map: diceFaceTexture(v),
            roughness: 0.28,
            metalness: 0.05,
            toneMapped: false,
          }),
      ),
    [],
  );

  useEffect(() => {
    t.current = 0;
    spin.current.set(
      6 + Math.sin(seed * 12.9898) * 5,
      7 + Math.cos(seed * 78.233) * 5,
      5 + Math.sin(seed * 39.425) * 4,
    );
  }, [seed, rolling]);

  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    t.current += dt;

    if (rolling) {
      const p = t.current;
      // Deux rebonds amortis pendant la chute.
      const bounce = Math.abs(Math.sin(p * 5.2)) * Math.max(0, 1 - p * 0.75);
      m.position.set(
        home[0] + Math.sin(p * 3.1 + seed) * 0.5,
        home[1] + 1.5 * Math.max(0, 1 - p * 0.8) + bounce * 0.9,
        home[2] + Math.cos(p * 2.7 + seed) * 0.5,
      );
      m.rotation.x += spin.current.x * dt;
      m.rotation.y += spin.current.y * dt;
      m.rotation.z += spin.current.z * dt;
      return;
    }

    // Repos : on rejoint la face demandée et la position d'assise.
    const [rx, ry, rz] = restFor(value);
    const k = 1 - Math.pow(0.0006, dt);
    m.rotation.x += (rx - m.rotation.x) * k;
    m.rotation.y += (ry - m.rotation.y) * k;
    m.rotation.z += (rz - m.rotation.z) * k;
    m.position.lerp(homeVec, k);
  });

  return (
    <mesh ref={ref} castShadow material={materials} position={home}>
      <boxGeometry args={[0.86, 0.86, 0.86]} />
    </mesh>
  );
};

/** Les dés roulent à côté du pion actif, là où la caméra regarde déjà. */
export const Dice = ({
  dice,
  at,
}: {
  dice: { values: [number, number]; rolling: boolean; key: number } | null;
  at: [number, number, number];
}) => {
  if (!dice) return null;
  return (
    <group position={[at[0], 0.45, at[2]]}>
      <Die value={dice.values[0]} rolling={dice.rolling} seed={dice.key} home={[-0.75, 0.2, 0]} />
      <Die
        value={dice.values[1]}
        rolling={dice.rolling}
        seed={dice.key + 0.5}
        home={[0.75, 0.2, 0]}
      />
      <pointLight
        position={[0, 2, 0]}
        intensity={dice.rolling ? 22 : 12}
        distance={7}
        color="#FDE68A"
      />
    </group>
  );
};
