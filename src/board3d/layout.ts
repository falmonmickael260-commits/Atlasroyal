import { BOARD_SIZE } from '../engine/board';

/** Géométrie du plateau, en unités monde. */
export const GEO = {
  corner: 2.9,
  tileW: 2.05,
  tileD: 2.9,
  thickness: 0.34,
  get side() { return this.corner * 2 + 9 * this.tileW; },
  get half() { return this.side / 2; },
} as const;

export interface TilePlacement {
  /** Centre de la case, au niveau du plateau. */
  pos: [number, number, number];
  /** Rotation Y : la face « intérieure » du plateau regarde le centre. */
  rot: number;
  /** Côté : 0 bas, 1 gauche, 2 haut, 3 droite. */
  side: 0 | 1 | 2 | 3;
  isCorner: boolean;
  width: number;
  depth: number;
}

const cornerCenter = GEO.half - GEO.corner / 2;
const firstEdge = cornerCenter - GEO.corner / 2 - GEO.tileW / 2;
const edgeAxis = GEO.half - GEO.tileD / 2;

/**
 * Case 0 en bas à droite ; on remonte le plateau dans le sens anti-horaire
 * vu du dessus (bas → gauche → haut → droite), comme le déplacement des pions.
 */
export const placement = (i: number): TilePlacement => {
  const k = ((i % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  const corner = (x: number, z: number, side: TilePlacement['side'], rot: number): TilePlacement =>
    ({ pos: [x, 0, z], rot, side, isCorner: true, width: GEO.corner, depth: GEO.corner });
  const edge = (x: number, z: number, side: TilePlacement['side'], rot: number): TilePlacement =>
    ({ pos: [x, 0, z], rot, side, isCorner: false, width: GEO.tileW, depth: GEO.tileD });

  if (k === 0) return corner(cornerCenter, cornerCenter, 0, 0);
  if (k < 10) return edge(firstEdge - (k - 1) * GEO.tileW, edgeAxis, 0, 0);
  if (k === 10) return corner(-cornerCenter, cornerCenter, 1, -Math.PI / 2);
  if (k < 20) return edge(-edgeAxis, firstEdge - (k - 11) * GEO.tileW, 1, -Math.PI / 2);
  if (k === 20) return corner(-cornerCenter, -cornerCenter, 2, Math.PI);
  if (k < 30) return edge(-firstEdge + (k - 21) * GEO.tileW, -edgeAxis, 2, Math.PI);
  if (k === 30) return corner(cornerCenter, -cornerCenter, 3, Math.PI / 2);
  return edge(edgeAxis, -firstEdge + (k - 31) * GEO.tileW, 3, Math.PI / 2);
};

export const PLACEMENTS = Array.from({ length: BOARD_SIZE }, (_, i) => placement(i));

/** Emplacement d'un pion sur sa case : petite grille pour éviter la superposition. */
export const tokenSlot = (tileIndex: number, slot: number): [number, number, number] => {
  const p = PLACEMENTS[tileIndex];
  const cols = 3;
  const gx = ((slot % cols) - 1) * 0.52;
  const gz = (Math.floor(slot / cols) - 0.5) * 0.52;
  // Décalage exprimé dans le repère de la case, puis ramené au repère monde.
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const offX = p.isCorner ? 0 : 0;
  const localX = gx + offX;
  const localZ = gz + (p.isCorner ? 0 : 0.62);
  return [
    p.pos[0] + localX * c + localZ * s,
    GEO.thickness / 2,
    p.pos[2] - localX * s + localZ * c,
  ];
};

/** Point situé à `dist` unités vers l'intérieur du plateau depuis une case. */
export const inwardOf = (tileIndex: number, dist: number): [number, number, number] => {
  const p = PLACEMENTS[tileIndex];
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const localZ = -dist;
  return [p.pos[0] + localZ * s, 0, p.pos[2] + localZ * c];
};

/** Point d'implantation des constructions : moitié extérieure de la case. */
export const buildSlot = (tileIndex: number): { pos: [number, number, number]; rot: number } => {
  const p = PLACEMENTS[tileIndex];
  const localZ = -0.52;
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return {
    pos: [p.pos[0] + localZ * s, GEO.thickness / 2, p.pos[2] + localZ * c],
    rot: p.rot,
  };
};
