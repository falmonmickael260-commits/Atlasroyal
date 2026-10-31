import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GEO, PLACEMENTS } from './layout';
import { texturePlateau } from './plateauImage';
import { PASTILLES, PLATEAU_PX } from './plateauRects';
import type { GameState } from '../engine/types';

/**
 * Conversion image → monde.
 *
 * L'illustration couvre exactement la surface du plateau : un pixel de
 * l'image correspond donc toujours au même point du jeu, quelle que soit sa
 * définition. Remplacer le fichier par un export plus fin ne demande aucun
 * ajustement ici.
 */
const versMonde = (pixels: number) => (pixels / PLATEAU_PX) * GEO.side;
const centreMonde = (pixels: number) => versMonde(pixels) - GEO.half;

const CADRE = new THREE.MeshPhysicalMaterial({
  color: '#30251B', roughness: 0.36, metalness: 0.58, clearcoat: 0.72, clearcoatRoughness: 0.22,
});
const LAITON = new THREE.MeshPhysicalMaterial({
  color: '#D6A94E', roughness: 0.24, metalness: 0.88, clearcoat: 0.7, clearcoatRoughness: 0.16,
});

/** Chant métallique et filets de laiton autour du plateau illustré. */
const BoardRim = () => {
  const edge = GEO.half + 0.17;
  const railLength = GEO.side + 0.34;
  const y = GEO.thickness / 2 + 0.045;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[0, y, side * edge]} castShadow receiveShadow material={CADRE}>
            <boxGeometry args={[railLength, 0.16, 0.28]} />
          </mesh>
          <mesh position={[0, y + 0.083, side * edge]} material={LAITON}>
            <boxGeometry args={[railLength - 0.18, 0.018, 0.035]} />
          </mesh>
          <mesh position={[side * edge, y, 0]} castShadow receiveShadow material={CADRE}>
            <boxGeometry args={[0.28, 0.16, railLength]} />
          </mesh>
          <mesh position={[side * edge, y + 0.083, 0]} material={LAITON}>
            <boxGeometry args={[0.035, 0.018, railLength - 0.18]} />
          </mesh>
        </group>
      ))}
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}:${z}`} position={[x * edge, y + 0.095, z * edge]} castShadow material={LAITON}>
          <cylinderGeometry args={[0.11, 0.11, 0.035, 20]} />
        </mesh>
      )))}
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
  const image = texturePlateau();

  /*
    Pastilles de propriété.

    Une par case vendue, posée dans le rectangle réservé par l'illustration.
    C'est le seul élément de couleur ajouté au dessin : tout le reste — noms,
    prix, bandeaux de groupe, décor — vient de l'image.
  */
  const pastilles = useMemo(
    () => Object.entries(PASTILLES).map(([cle, [x, y, w, h]]) => ({
      tile: Number(cle),
      pos: [centreMonde(x + w / 2), centreMonde(y + h / 2)] as const,
      taille: [versMonde(w), versMonde(h)] as const,
    })),
    [],
  );

  return (
    <group>
      {/* Socle : donne l'épaisseur et reçoit les ombres. */}
      <mesh position={[0, -0.34, 0]} receiveShadow>
        <boxGeometry args={[GEO.side + 0.7, 0.42, GEO.side + 0.7]} />
        <meshStandardMaterial color="#162031" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.56, 0]}>
        <boxGeometry args={[GEO.side + 1.5, 0.12, GEO.side + 1.5]} />
        <meshPhysicalMaterial color="#A97832" emissive="#7B4F18" emissiveIntensity={0.18} roughness={0.28} metalness={0.82} clearcoat={0.7} />
      </mesh>

      {/* Illustration continue des quarante cases et du tapis central. */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[GEO.side, GEO.thickness, GEO.side]} />
        <meshStandardMaterial color="#1A2436" roughness={0.85} />
      </mesh>
      {image && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GEO.thickness / 2 + 0.012, 0]} receiveShadow>
          <planeGeometry args={[GEO.side, GEO.side]} />
          <meshStandardMaterial map={image} roughness={0.72} metalness={0.04} toneMapped={false} />
        </mesh>
      )}
      <BoardRim />

      {pastilles.map((p) => {
        const owner = state.tiles[p.tile]?.owner;
        const couleur = owner ? state.players[owner]?.color : null;
        if (!couleur) return null;
        return (
          <mesh
            key={p.tile}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[p.pos[0], GEO.thickness / 2 + 0.018, p.pos[1]]}
          >
            <planeGeometry args={[p.taille[0], p.taille[1]]} />
            <meshBasicMaterial color={couleur} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
};


/** Halo pulsant : signale la case d'arrivée pendant le déplacement. */
const DestinationHalo = ({ tile }: { tile: number | null }) => {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    const m = mesh.current;
    if (!m) return;
    const pulse = 0.5 + 0.5 * Math.sin(st.clock.elapsedTime * 3.4);
    // Battement d'opacité seul : agrandir la case d'arrivée la ferait
    // déborder sur ses voisines, qui ne sont qu'à six centièmes d'unité.
    (m.material as THREE.MeshBasicMaterial).opacity = 0.18 + pulse * 0.32;
  });
  if (tile === null) return null;
  const p = PLACEMENTS[tile];
  return (
    <mesh
      ref={mesh}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[p.pos[0], GEO.thickness / 2 + 0.02, p.pos[2]]}
    >
      {/*
        La case entière, et non un anneau.

        L'anneau était calibré sur une case presque carrée. Depuis que le
        plateau est illustré, une case fait 2,05 de large pour 4,88 de
        profondeur : un cercle au milieu ne désignait plus rien de net, il
        flottait au centre d'un long rectangle. La forme de la case, elle,
        reste juste quelle que soit la géométrie.
      */}
      <planeGeometry args={[p.width - 0.06, p.depth - 0.06]} />
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
