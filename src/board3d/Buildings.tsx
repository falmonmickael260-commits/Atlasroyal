import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD, GROUPS } from '../engine/board';
import { buildSlot } from './layout';
import type { CityTile, GameState } from '../engine/types';

/**
 * Constructions en relief. La montée est animée (ressort amorti) :
 * un bâtiment ne « pop » jamais, il sort du sol.
 */
const WINDOW_MAT = new THREE.MeshStandardMaterial({
  color: '#FDE68A', emissive: '#F59E0B', emissiveIntensity: 1.6, roughness: 0.3,
});

/**
 * Couronnement du Grand Hôtel, dessiné d'après le repère de la ville
 * (`landmark`) : à plein développement, Le Caire, Rome ou Bangkok ne se
 * ressemblent pas.
 */
const Crown = ({ landmark, mat }: { landmark: CityTile['landmark']; mat: THREE.Material }) => {
  switch (landmark) {
    case 'pyramid':
      return (
        <mesh castShadow material={mat} position={[0, 1.08, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.32, 0.42, 4]} />
        </mesh>
      );
    case 'dome':
      return (
        <mesh castShadow material={mat} position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.24, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      );
    case 'pagoda':
      return (
        <group position={[0, 0.98, 0]}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} castShadow material={mat} position={[0, i * 0.16, 0]}>
              <coneGeometry args={[0.3 - i * 0.07, 0.1, 4]} />
            </mesh>
          ))}
        </group>
      );
    case 'arch':
      return (
        <mesh castShadow material={mat} position={[0, 1.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.05, 6, 16, Math.PI]} />
        </mesh>
      );
    case 'bridge':
      return (
        <group position={[0, 1.02, 0]}>
          <mesh castShadow material={mat} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.22, 0.035, 6, 16, Math.PI]} />
          </mesh>
          <mesh castShadow material={mat} position={[0, -0.1, 0]}>
            <boxGeometry args={[0.56, 0.04, 0.1]} />
          </mesh>
        </group>
      );
    case 'skyline':
      return (
        <group position={[0, 1.0, 0]}>
          {[-0.16, 0, 0.16].map((x, i) => (
            <mesh key={x} castShadow material={mat} position={[x, [0.1, 0.22, 0.06][i], 0]}>
              <boxGeometry args={[0.12, [0.26, 0.5, 0.18][i], 0.12]} />
            </mesh>
          ))}
        </group>
      );
    case 'tower':
      return (
        <mesh castShadow material={mat} position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.05, 0.2, 0.46, 6]} />
        </mesh>
      );
    default: // spire
      return (
        <mesh castShadow material={mat} position={[0, 1.14, 0]}>
          <coneGeometry args={[0.15, 0.56, 8]} />
        </mesh>
      );
  }
};

const Structure = ({
  level, color, landmark,
}: { level: number; color: string; landmark: CityTile['landmark'] }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color, roughness: 0.45, metalness: 0.25,
  }), [color]);

  if (level === 1) {
    return (
      <group>
        <mesh castShadow material={mat} position={[0, 0.17, 0]}>
          <boxGeometry args={[0.52, 0.34, 0.46]} />
        </mesh>
        <mesh castShadow position={[0, 0.42, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.42, 0.24, 4]} />
          <meshStandardMaterial color="#0F172A" roughness={0.6} />
        </mesh>
        <mesh material={WINDOW_MAT} position={[0, 0.16, 0.235]}>
          <planeGeometry args={[0.16, 0.12]} />
        </mesh>
      </group>
    );
  }
  if (level === 2) {
    return (
      <group>
        <mesh castShadow material={mat} position={[0, 0.24, 0]}>
          <boxGeometry args={[0.66, 0.48, 0.5]} />
        </mesh>
        <mesh castShadow material={mat} position={[0.16, 0.62, 0]}>
          <boxGeometry args={[0.34, 0.3, 0.42]} />
        </mesh>
        <mesh castShadow position={[0, 0.5, 0.3]}>
          <boxGeometry args={[0.7, 0.03, 0.12]} />
          <meshStandardMaterial color="#EAB308" emissive="#D97706" emissiveIntensity={0.6} />
        </mesh>
        {[-0.18, 0.02].map((x) => (
          <mesh key={x} material={WINDOW_MAT} position={[x, 0.25, 0.252]}>
            <planeGeometry args={[0.13, 0.16]} />
          </mesh>
        ))}
      </group>
    );
  }
  // Grand Hôtel : tour + enseigne + couronne lumineuse
  return (
    <group>
      <mesh castShadow material={mat} position={[0, 0.34, 0]}>
        <boxGeometry args={[0.62, 0.68, 0.52]} />
      </mesh>
      <mesh castShadow material={mat} position={[0, 0.84, 0]}>
        <boxGeometry args={[0.44, 0.34, 0.4]} />
      </mesh>
      <Crown landmark={landmark} mat={mat} />
      <mesh position={[0, 1.52, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color="#FDE68A" emissive="#FDE68A" emissiveIntensity={3} />
      </mesh>
      {[0.12, 0.34, 0.56].map((y) => (
        <mesh key={y} material={WINDOW_MAT} position={[0, y, 0.262]}>
          <planeGeometry args={[0.42, 0.1]} />
        </mesh>
      ))}
      <mesh material={WINDOW_MAT} position={[0, 0.84, 0.205]}>
        <planeGeometry args={[0.3, 0.08]} />
      </mesh>
    </group>
  );
};

const Plot = ({ tile, level }: { tile: CityTile; level: number }) => {
  const slot = useMemo(() => buildSlot(tile.i), [tile.i]);
  const group = useRef<THREE.Group>(null);
  const grow = useRef(level > 0 ? 1 : 0);
  const target = useRef(level > 0 ? 1 : 0);
  const spin = useRef(0);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const first = previous.current === null;
    const raised = !first && level > (previous.current ?? 0);
    previous.current = level;
    target.current = level > 0 ? 1 : 0;
    if (raised) {
      // Construction nouvelle : on repart de zéro pour jouer la montée.
      grow.current = 0;
      spin.current = 1;
    } else if (first && level > 0) {
      // Bâtiment déjà là (arrivée en cours de partie, reconnexion, onglet
      // resté en arrière-plan) : il doit être debout dès la première image,
      // sans rejouer une animation qui a déjà eu lieu.
      grow.current = 1;
    }
  }, [level]);

  // Applique l'échelle immédiatement : la première image peinte est correcte
  // même si la boucle d'animation n'a pas encore tourné.
  useLayoutEffect(() => {
    if (!group.current) return;
    const g = grow.current;
    group.current.scale.set(1, Math.max(0.0001, g), 1);
    group.current.visible = g > 0.005;
  });

  useFrame((_, dt) => {
    if (!group.current) return;
    // Vingt-quatre parcelles tournent ce rappel à chaque image. Quand la
    // parcelle est nue et stable, il n'y a rien à interpoler : on sort tout
    // de suite plutôt que de recalculer une échelle inchangée soixante fois
    // par seconde.
    if (target.current === grow.current && spin.current <= 0) return;
    const k = Math.min(1, dt * 3.4);
    grow.current += (target.current - grow.current) * k;
    const g = grow.current;
    // Léger dépassement : la structure « s'installe » au lieu d'arriver plat.
    const overshoot = 1 + Math.sin(Math.min(1, g) * Math.PI) * 0.12;
    group.current.scale.set(overshoot, Math.max(0.0001, g * overshoot), overshoot);
    if (spin.current > 0) {
      spin.current = Math.max(0, spin.current - dt * 1.2);
      group.current.rotation.y = slot.rot + spin.current * Math.PI * 0.9;
    } else {
      group.current.rotation.y = slot.rot;
    }
    group.current.visible = g > 0.005;
  });

  if (level === 0) return null;
  return (
    <group ref={group} position={slot.pos} rotation={[0, slot.rot, 0]}>
      <Structure level={level} color={GROUPS[tile.group].color} landmark={tile.landmark} />
    </group>
  );
};

export const Buildings = ({ state }: { state: GameState }) => (
  <group>
    {BOARD.filter((t): t is CityTile => t.kind === 'city').map((t) => (
      <Plot key={t.i} tile={t} level={state.tiles[t.i]?.level ?? 0} />
    ))}
  </group>
);
