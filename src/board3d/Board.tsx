import { useMemo } from 'react';
import * as THREE from 'three';
import { BOARD, GROUPS } from '../engine/board';
import { GEO, PLACEMENTS } from './layout';
import { centerTexture, tileTexture } from './textures';
import type { GameState } from '../engine/types';

const SLAB = new THREE.MeshStandardMaterial({ color: '#223149', roughness: 0.8, metalness: 0.08 });

/** Une case : dalle en relief + face imprimée + liseré propriétaire. */
const Tile = ({
  index, owner, highlight,
}: { index: number; owner: string | null; highlight: boolean }) => {
  const p = PLACEMENTS[index];
  const tile = BOARD[index];
  const map = useMemo(() => tileTexture(tile, p.width, p.depth), [tile, p.width, p.depth]);

  return (
    <group position={p.pos} rotation={[0, p.rot, 0]}>
      <mesh castShadow receiveShadow material={SLAB} position={[0, 0, 0]}>
        <boxGeometry args={[p.width - 0.04, GEO.thickness, p.depth - 0.04]} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GEO.thickness / 2 + 0.004, 0]} receiveShadow>
        <planeGeometry args={[p.width - 0.04, p.depth - 0.04]} />
        <meshStandardMaterial map={map} roughness={0.7} metalness={0.05} toneMapped={false} />
      </mesh>

      {/* Liseré de propriété : lisible d'un coup d'œil depuis la vue d'ensemble. */}
      {owner && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GEO.thickness / 2 + 0.008, p.depth / 2 - 0.12]}>
          <planeGeometry args={[p.width - 0.12, 0.13]} />
          <meshBasicMaterial color={owner} toneMapped={false} />
        </mesh>
      )}

      {highlight && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GEO.thickness / 2 + 0.012, 0]}>
          <planeGeometry args={[p.width + 0.06, p.depth + 0.06]} />
          <meshBasicMaterial color="#EAB308" transparent opacity={0.22} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
};

export const Board = ({ state, highlight }: { state: GameState; highlight: number | null }) => {
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[inner, inner]} />
        <meshStandardMaterial map={center} roughness={0.85} toneMapped={false} />
      </mesh>

      {BOARD.map((t) => (
        <Tile
          key={t.i}
          index={t.i}
          owner={state.tiles[t.i]?.owner ? state.players[state.tiles[t.i].owner!]?.color ?? null : null}
          highlight={highlight === t.i}
        />
      ))}
    </group>
  );
};

export const GROUP_COLOR = (g: keyof typeof GROUPS) => GROUPS[g].color;
