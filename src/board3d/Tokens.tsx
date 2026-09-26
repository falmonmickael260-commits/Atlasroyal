import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GEO, tokenSlot } from './layout';
import type { GameState, PlayerId } from '../engine/types';

/** Silhouettes de pions : chacune doit être reconnaissable en vue d'ensemble. */
const Shape = ({ token, mat }: { token: string; mat: THREE.Material }) => {
  switch (token) {
    case 't2': // Dirigeable
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1.5, 1]}>
            <capsuleGeometry args={[0.13, 0.16, 6, 12]} />
          </mesh>
          <mesh material={mat} position={[0, 0.12, 0]}>
            <boxGeometry args={[0.12, 0.08, 0.08]} />
          </mesh>
        </group>
      );
    case 't3': // Cargo
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.12, 0]}>
            <boxGeometry args={[0.38, 0.14, 0.2]} />
          </mesh>
          <mesh castShadow material={mat} position={[-0.06, 0.26, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
          </mesh>
        </group>
      );
    case 't4': // Monolithe
      return (
        <mesh castShadow material={mat} position={[0, 0.26, 0]}>
          <boxGeometry args={[0.2, 0.52, 0.12]} />
        </mesh>
      );
    case 't5': // Satellite
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.3, 0]}>
            <icosahedronGeometry args={[0.14, 0]} />
          </mesh>
          <mesh material={mat} position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.24, 0.018, 6, 24]} />
          </mesh>
          <mesh material={mat} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.03, 0.06, 0.2, 8]} />
          </mesh>
        </group>
      );
    case 't6': // Phare
      return (
        <group>
          <mesh castShadow material={mat} position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.09, 0.16, 0.44, 10]} />
          </mesh>
          <mesh material={mat} position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.08, 10, 10]} />
          </mesh>
        </group>
      );
    default: // Obélisque
      return (
        <group>
          <mesh castShadow position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.03, 0.14, 0.52, 4]} />
          </mesh>
          <mesh material={mat} position={[0, 0.06, 0]}>
            <boxGeometry args={[0.3, 0.1, 0.3]} />
          </mesh>
        </group>
      );
  }
};

/** Taille des pions : assez gros pour se repérer d'un coup d'œil. */
const PAWN_SCALE = 1.42;

const Pawn = ({
  color, token, target, bankrupt, active, labels, id, slot,
}: {
  color: string;
  token: string;
  target: [number, number, number];
  bankrupt: boolean;
  active: boolean;
  /**
   * Étiquettes DOM des prénoms. On résout l'élément à chaque image plutôt
   * qu'au rendu : au premier rendu de la scène, le DOM des étiquettes n'existe
   * pas encore, et une référence capturée resterait nulle pour toujours.
   */
  labels: React.RefObject<Map<PlayerId, HTMLElement | null>>;
  id: PlayerId;
  /** Rang du pion sur sa case : sert à étager les prénoms. */
  slot: number;
}) => {
  const g = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(...target));
  const vec = useMemo(() => new THREE.Vector3(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color, roughness: 0.28, metalness: 0.65,
    emissive: new THREE.Color(color).multiplyScalar(0.25),
  }), [color]);

  useFrame((st, dt) => {
    if (!g.current) return;
    vec.set(...target);
    const d = pos.current.distanceTo(vec);
    // Lerp cadré sur le delta-temps : identique quel que soit le framerate.
    pos.current.lerp(vec, 1 - Math.pow(0.0009, dt));
    // Le pion saute d'autant plus haut qu'il lui reste du chemin : c'est le pas.
    const hop = Math.min(0.42, d * 0.85);
    g.current.position.set(pos.current.x, pos.current.y + hop, pos.current.z);
    g.current.rotation.y += dt * (d > 0.02 ? 6 : 0.45);
    const bob = active ? Math.sin(st.clock.elapsedTime * 2.6) * 0.03 : 0;
    g.current.position.y += bob;
    const s = bankrupt ? 0.001 : PAWN_SCALE;
    g.current.scale.lerp(vec.set(s, s, s), 1 - Math.pow(0.02, dt));

    // Le prénom suit le pion : on projette sa position dans le repère écran
    // et on déplace l'étiquette DOM. Passer par le DOM garde le texte net,
    // là où une texture 3D le rendrait flou de biais.
    const label = labels.current?.get(id) ?? null;
    if (label) {
      if (bankrupt) {
        label.style.opacity = '0';
      } else {
        vec.set(g.current.position.x, g.current.position.y + 0.95, g.current.position.z);
        vec.project(st.camera);
        const x = (vec.x * 0.5 + 0.5) * st.size.width;
        const y = (-vec.y * 0.5 + 0.5) * st.size.height;
        // Les prénoms s'étagent verticalement quand plusieurs pions partagent
        // une case : deux étiquettes côte à côte se recouvriraient.
        const etage = slot * 19;
        label.style.transform =
          `translate3d(${Math.round(x)}px, ${Math.round(y - etage)}px, 0) translate(-50%, -100%)`;
        label.style.opacity = vec.z < 1 ? '1' : '0';
      }
    }
  });

  return (
    <group ref={g}>
      <Shape token={token} mat={mat} />
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[0.3, 0.38, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.75} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
};

export const Tokens = ({
  state, tokenTile, activePlayer, labels,
}: {
  state: GameState;
  tokenTile: Record<PlayerId, number>;
  activePlayer: PlayerId | null;
  labels: React.RefObject<Map<PlayerId, HTMLElement | null>>;
}) => {
  // Deux pions sur la même case occupent deux emplacements distincts.
  const slots: Record<PlayerId, number> = {};
  const perTile: Record<number, number> = {};
  const totalOnTile: Record<number, number> = {};
  for (const id of state.order) {
    const t = tokenTile[id] ?? state.players[id].position;
    totalOnTile[t] = (totalOnTile[t] ?? 0) + 1;
  }
  for (const id of state.order) {
    const t = tokenTile[id] ?? state.players[id].position;
    slots[id] = perTile[t] ?? 0;
    perTile[t] = slots[id] + 1;
  }

  return (
    <group>
      {state.order.map((id) => {
        const p = state.players[id];
        const tile = tokenTile[id] ?? p.position;
        const [x, , z] = tokenSlot(tile, slots[id], totalOnTile[tile] ?? 1);
        return (
          <Pawn
            key={id}
            color={p.color}
            token={p.token}
            target={[x, GEO.thickness / 2 + 0.02, z]}
            bankrupt={p.bankrupt}
            active={activePlayer === id}
            labels={labels}
            id={id}
            slot={slots[id]}
          />
        );
      })}
    </group>
  );
};
