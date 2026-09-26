import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BOARD, GROUPS } from '../engine/board';
import { GEO, PLACEMENTS } from './layout';
import { centerTexture, tileTexture } from './textures';
import type { GameState } from '../engine/types';

const SLAB = new THREE.MeshStandardMaterial({ color: '#223149', roughness: 0.8, metalness: 0.08 });

/** Une case : dalle en relief + face imprimée + liseré propriétaire. */
const Tile = ({ index, owner }: { index: number; owner: string | null }) => {
  const p = PLACEMENTS[index];
  const tile = BOARD[index];
  const map = useMemo(() => tileTexture(tile, p.width, p.depth), [tile, p.width, p.depth]);

  return (
    <group position={p.pos} rotation={[0, p.rot, 0]}>
      <mesh castShadow receiveShadow material={SLAB} position={[0, 0, 0]}>
        <boxGeometry args={[p.width - 0.04, GEO.thickness, p.depth - 0.04]} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GEO.thickness / 2 + 0.012, 0]} receiveShadow>
        <planeGeometry args={[p.width - 0.04, p.depth - 0.04]} />
        <meshStandardMaterial map={map} roughness={0.7} metalness={0.05} toneMapped={false} />
      </mesh>

      {/* Liseré de propriété : lisible d'un coup d'œil depuis la vue d'ensemble. */}
      {owner && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GEO.thickness / 2 + 0.018, p.depth / 2 - 0.12]}>
          <planeGeometry args={[p.width - 0.12, 0.13]} />
          <meshBasicMaterial color={owner} toneMapped={false} />
        </mesh>
      )}

    </group>
  );
};

/**
 * Éclat d'acquisition : un anneau s'ouvre sur la case et s'efface.
 * Court et net — l'achat doit se voir sans ralentir le tour, et tous les
 * clients le jouent puisqu'il découle du même évènement serveur.
 */
const PurchaseFlash = ({
  purchase,
}: { purchase: { tile: number; color: string; key: number } | null }) => {
  const ring = useRef<THREE.Mesh>(null);
  const t = useRef(99);

  useEffect(() => {
    t.current = 0;
  }, [purchase?.key]);

  useFrame((_, dt) => {
    const m = ring.current;
    if (!m || !purchase) return;
    t.current += dt;
    const p = Math.min(1, t.current / 0.85);
    const eased = 1 - Math.pow(1 - p, 3);
    m.scale.setScalar(0.35 + eased * 1.5);
    (m.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.85;
    m.visible = p < 1;
  });

  if (!purchase) return null;
  const pl = PLACEMENTS[purchase.tile];
  return (
    <mesh
      ref={ring}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[pl.pos[0], GEO.thickness / 2 + 0.03, pl.pos[2]]}
    >
      <ringGeometry args={[0.55, 0.95, 40]} />
      <meshBasicMaterial color={purchase.color} transparent opacity={0} toneMapped={false} />
    </mesh>
  );
};

/**
 * Le plateau : socle, tapis central et quarante cases.
 *
 * Volontairement dépourvu de tout effet animé. Les halos, éclats et mises en
 * évidence vivent dans `Board.Overlays`, une couche séparée : ainsi un pas de
 * pion ne fait pas traverser les quarante cases à React.
 */
export const Board = ({ state }: { state: GameState }) => {
  const center = useMemo(() => centerTexture(GEO.side - GEO.tileD * 2), []);
  const inner = GEO.side - GEO.tileD * 2;

  return (
    <group>
      {/* Socle : donne l'épaisseur et reçoit les ombres. */}
      <mesh position={[0, -0.34, 0]} receiveShadow>
        <boxGeometry args={[GEO.side + 0.7, 0.42, GEO.side + 0.7]} />
        <meshStandardMaterial color="#162031" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.56, 0]}>
        <boxGeometry args={[GEO.side + 1.5, 0.12, GEO.side + 1.5]} />
        <meshStandardMaterial color="#D97706" emissive="#D97706" emissiveIntensity={0.5} roughness={0.4} />
      </mesh>

      {/* Écart franc avec le socle : 1 centième d'unité ne suffit pas à
          départager deux surfaces à cette distance de caméra. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]} receiveShadow>
        <planeGeometry args={[inner, inner]} />
        <meshStandardMaterial map={center} roughness={0.85} toneMapped={false} />
      </mesh>

      {BOARD.map((t) => (
        <Tile
          key={t.i}
          index={t.i}
          owner={state.tiles[t.i]?.owner ? state.players[state.tiles[t.i].owner!]?.color ?? null : null}
        />
      ))}
    </group>
  );
};

export const GROUP_COLOR = (g: keyof typeof GROUPS) => GROUPS[g].color;

/** Halo pulsant : signale la case d'arrivée pendant le déplacement. */
const DestinationHalo = ({ tile }: { tile: number | null }) => {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    const m = mesh.current;
    if (!m) return;
    const pulse = 0.5 + 0.5 * Math.sin(st.clock.elapsedTime * 3.4);
    m.scale.setScalar(1 + pulse * 0.08);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.3 + pulse * 0.35;
  });
  if (tile === null) return null;
  const p = PLACEMENTS[tile];
  return (
    <mesh
      ref={mesh}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[p.pos[0], GEO.thickness / 2 + 0.02, p.pos[2]]}
    >
      <ringGeometry args={[p.width * 0.4, p.width * 0.5, 36]} />
      <meshBasicMaterial color="#FDE68A" transparent opacity={0.4} toneMapped={false} />
    </mesh>
  );
};

/** Mise en évidence de la case où le pion vient de s'arrêter. */
const LandingGlow = ({ tile }: { tile: number | null }) => {
  if (tile === null) return null;
  const p = PLACEMENTS[tile];
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[p.pos[0], GEO.thickness / 2 + 0.014, p.pos[2]]}
    >
      <planeGeometry args={[p.width + 0.05, p.depth + 0.05]} />
      <meshBasicMaterial color="#EAB308" transparent opacity={0.2} toneMapped={false} />
    </mesh>
  );
};

/**
 * Couche d'effets du plateau.
 *
 * Séparée des cases pour que les animations d'un tour ne provoquent jamais la
 * reconstruction du plateau lui-même.
 */
const Overlays = ({
  highlight,
  destination,
  purchase,
}: {
  highlight: number | null;
  destination: number | null;
  purchase: { tile: number; color: string; key: number } | null;
}) => (
  <group>
    <DestinationHalo tile={destination} />
    <LandingGlow tile={highlight} />
    <PurchaseFlash purchase={purchase} />
  </group>
);

Board.Overlays = Overlays;
