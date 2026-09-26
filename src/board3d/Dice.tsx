import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { diceFaceTexture } from './textures';
import { FACE_ORDER, restFor } from './diceFaces';
import { roundedBoxGeometry } from './roundedBox';

/** Arête du dé, en unités monde. */
const DIE_SIZE = 0.92;

/**
 * Dés 3D. Pas de moteur physique : une trajectoire scriptée (arc + rotation
 * amortie + rebond) donne la sensation de poids pour une fraction du coût.
 *
 * La table d'orientation vit dans `diceFaces.ts` et est vérifiée par un test :
 * un dé qui n'affiche pas le chiffre tiré est un bug silencieux.
 */
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

  // Résine polie : un vernis net sur un corps mat, comme un dé de casino.
  const materials = useMemo(
    () =>
      FACE_ORDER.map(
        (v) =>
          new THREE.MeshPhysicalMaterial({
            map: diceFaceTexture(v),
            roughness: 0.22,
            metalness: 0.0,
            clearcoat: 0.85,
            clearcoatRoughness: 0.12,
            reflectivity: 0.4,
          }),
      ),
    [],
  );

  const geometry = useMemo(() => roundedBoxGeometry(DIE_SIZE, DIE_SIZE * 0.17, 6), []);

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
      const bounce = Math.abs(Math.sin(p * 6.4)) * Math.max(0, 1 - p * 1.05);
      m.position.set(
        home[0] + Math.sin(p * 3.1 + seed) * 0.5,
        home[1] + 1.7 * Math.max(0, 1 - p * 1.1) + bounce * 0.85,
        home[2] + Math.cos(p * 2.7 + seed) * 0.5,
      );
      m.rotation.x += spin.current.x * dt;
      m.rotation.y += spin.current.y * dt;
      m.rotation.z += spin.current.z * dt;
      return;
    }

    // Repos : le dé se cale franchement sur sa face. Une convergence molle
    // laisse un doute sur le chiffre au moment où on le lit.
    const [rx, ry, rz] = restFor(value);
    const k = 1 - Math.pow(0.00002, dt);
    m.rotation.x += (rx - m.rotation.x) * k;
    m.rotation.y += (ry - m.rotation.y) * k;
    m.rotation.z += (rz - m.rotation.z) * k;
    m.position.lerp(homeVec, k);
  });

  return (
    <mesh ref={ref} castShadow receiveShadow material={materials} geometry={geometry} position={home} />
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
    </group>
  );
};
