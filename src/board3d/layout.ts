import { BOARD_SIZE } from '../engine/board';

/**
 * Géométrie du plateau, en unités monde.
 *
 * Les proportions sont relevées sur l'illustration : une case de bord y fait
 * 91 pixels de large pour un anneau de 217, soit un rapport de 2,38 — très
 * au-dessus du 1,41 d'avant. Tout le reste en découle : emplacements des
 * cases, des pions, des constructions, et le cadrage de la caméra. Changer
 * d'illustration revient donc à ne corriger que ces deux nombres.
 */
export const GEO = {
  corner: 4.88,
  tileW: 2.05,
  tileD: 4.88,
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
export const tokenSlot = (
  tileIndex: number,
  slot: number,
  total = 1,
): [number, number, number] => {
  const p = PLACEMENTS[tileIndex];
  // Deux rangées de trois : à six pions sur une case, aucun n'en cache un
  // autre et chaque étiquette reste attribuable.
  const cols = total > 4 ? 3 : Math.max(1, Math.min(2, total));
  const rows = Math.ceil(total / cols);
  const gx = ((slot % cols) - (cols - 1) / 2) * 0.76;
  const gz = (Math.floor(slot / cols) - (rows - 1) / 2) * 0.62;
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
  /*
    Position des constructions sur la case.

    Le bord intérieur est occupé par la pastille du propriétaire, et juste
    en dessous vient le nom de la ville : y poser les maisons masquait les
    deux. On les recule donc sur l'illustration, seul endroit où elles ne
    cachent aucune information.

    Légèrement **en deçà** du centre, et non dessus : la caméra regarde le
    plateau de biais, si bien qu'un volume haut se couche vers l'arrière et
    vient mordre sur ce qui le précède. Ce décalage compense ce penchant
    pour l'hôtel, le plus haut de tous.
  */
  const localZ = GEO.tileD * 0.07;
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  return {
    pos: [p.pos[0] + localZ * s, GEO.thickness / 2, p.pos[2] + localZ * c],
    rot: p.rot,
  };
};
