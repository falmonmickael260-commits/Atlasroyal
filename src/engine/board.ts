import type { Tile, GroupId, CityTile, OwnableTile, TileIndex } from './types';

/** Règles économiques — une seule source de vérité. */
export const RULES = {
  startingCash: 35_000,
  passGo: 200,
  exactGo: 400,
  jailFine: 50,
  jailMaxAttempts: 3,
  /** Les achats sont interdits pendant le premier tour de table. */
  purchasesFromRound: 2,
  mortgageRate: 0.5,
  /** Intérêt payé au remboursement d'une hypothèque. */
  unmortgageRate: 1.1,
  /** Remboursement à la revente d'un niveau de construction. */
  sellBuildingRate: 0.5,
  hubRent: [250, 500, 1000, 2000] as const,
  /** Multiplicateur appliqué à la somme des dés. */
  reseauRent: [120, 300] as const,
  maxPlayers: 6,
  minPlayers: 2,
} as const;

export const GROUPS: Record<GroupId, { name: string; color: string; glow: string }> = {
  sable:   { name: 'Sable',   color: '#C9A227', glow: '#F5D97B' },
  jade:    { name: 'Jade',    color: '#1F9E7A', glow: '#5FE3BC' },
  corail:  { name: 'Corail',  color: '#E2614A', glow: '#FF9C86' },
  ambre:   { name: 'Ambre',   color: '#D97706', glow: '#FFB24D' },
  cobalt:  { name: 'Cobalt',  color: '#2563EB', glow: '#7BA6FF' },
  pourpre: { name: 'Pourpre', color: '#8B2FB8', glow: '#D183F5' },
  argent:  { name: 'Argent',  color: '#94A3B8', glow: '#E2E8F0' },
  or:      { name: 'Or',      color: '#EAB308', glow: '#FFE27A' },
};

const city = (
  i: number, name: string, country: string, group: GroupId, price: number,
  buildCost: number, landmark: CityTile['landmark'], lat: number, lon: number,
): CityTile => {
  const base = Math.round(price / 15 / 10) * 10;
  return {
    i, kind: 'city', name, country, group, price, buildCost, landmark, lat, lon,
    rent: [base, base * 5, base * 14, base * 26],
  };
};

/**
 * 40 cases : 24 villes (8 groupes × 3), 4 coins, 4 hubs, 2 réseaux,
 * 4 cases carte, 2 taxes.
 */
export const BOARD: Tile[] = [
  { i: 0, kind: 'depart', name: 'Départ' },
  city(1, 'Marrakech', 'Maroc', 'sable', 900, 550, 'arch', 31.63, -7.99),
  city(2, 'Le Caire', 'Égypte', 'sable', 950, 550, 'pyramid', 30.04, 31.24),
  { i: 3, kind: 'card', deck: 'destin', name: 'Destin' },
  city(4, 'Carthagène', 'Colombie', 'sable', 1000, 550, 'dome', 10.39, -75.51),
  { i: 5, kind: 'tax', name: 'Impôt Mondial', amount: 1200 },
  city(6, 'Bangkok', 'Thaïlande', 'jade', 1200, 750, 'pagoda', 13.76, 100.5),
  { i: 7, kind: 'hub', name: 'Hub Atlantique', price: 2000 },
  city(8, 'Hanoï', 'Viêt Nam', 'jade', 1250, 750, 'pagoda', 21.03, 105.85),
  city(9, 'Bali', 'Indonésie', 'jade', 1350, 750, 'arch', -8.41, 115.19),
  { i: 10, kind: 'prison', name: 'Prison' },
  city(11, 'Lisbonne', 'Portugal', 'corail', 1500, 900, 'bridge', 38.72, -9.14),
  { i: 12, kind: 'reseau', name: 'Réseau Solaire', price: 1800 },
  city(13, 'Le Cap', 'Afrique du Sud', 'corail', 1550, 900, 'skyline', -33.92, 18.42),
  city(14, 'Rio de Janeiro', 'Brésil', 'corail', 1650, 900, 'spire', -22.91, -43.17),
  { i: 15, kind: 'hub', name: 'Hub Pacifique', price: 2000 },
  city(16, 'Barcelone', 'Espagne', 'ambre', 1800, 1100, 'spire', 41.39, 2.17),
  { i: 17, kind: 'card', deck: 'marche', name: 'Marché' },
  city(18, 'Rome', 'Italie', 'ambre', 1850, 1100, 'dome', 41.9, 12.5),
  city(19, 'Istanbul', 'Turquie', 'ambre', 1950, 1100, 'dome', 41.01, 28.98),
  { i: 20, kind: 'parc', name: 'Parc Gratuit' },
  city(21, 'Berlin', 'Allemagne', 'cobalt', 2200, 1300, 'arch', 52.52, 13.4),
  { i: 22, kind: 'card', deck: 'destin', name: 'Destin' },
  city(23, 'Amsterdam', 'Pays-Bas', 'cobalt', 2250, 1300, 'bridge', 52.37, 4.9),
  city(24, 'Séoul', 'Corée du Sud', 'cobalt', 2350, 1300, 'tower', 37.57, 126.98),
  { i: 25, kind: 'hub', name: 'Hub Méditerranée', price: 2000 },
  city(26, 'Londres', 'Royaume-Uni', 'pourpre', 2600, 1600, 'tower', 51.51, -0.13),
  city(27, 'Sydney', 'Australie', 'pourpre', 2650, 1600, 'bridge', -33.87, 151.21),
  { i: 28, kind: 'reseau', name: 'Réseau Orbital', price: 1800 },
  city(29, 'Los Angeles', 'États-Unis', 'pourpre', 2750, 1600, 'skyline', 34.05, -118.24),
  { i: 30, kind: 'gotoprison', name: 'Allez en Prison' },
  city(31, 'Tokyo', 'Japon', 'argent', 3100, 1900, 'tower', 35.68, 139.69),
  city(32, 'New York', 'États-Unis', 'argent', 3200, 1900, 'skyline', 40.71, -74.01),
  { i: 33, kind: 'card', deck: 'marche', name: 'Marché' },
  city(34, 'Singapour', 'Singapour', 'argent', 3300, 1900, 'spire', 1.35, 103.82),
  { i: 35, kind: 'hub', name: 'Hub Orient', price: 2000 },
  city(36, 'Hong Kong', 'Chine', 'or', 3800, 2400, 'skyline', 22.32, 114.17),
  city(37, 'Dubaï', 'É.A.U.', 'or', 4000, 2400, 'spire', 25.2, 55.27),
  { i: 38, kind: 'tax', name: 'Taxe de Luxe', amount: 700 },
  city(39, 'Monaco', 'Monaco', 'or', 4500, 2400, 'dome', 43.73, 7.42),
];

export const BOARD_SIZE = BOARD.length;
export const JAIL_TILE = 10;
export const GO_TILE = 0;

export const isOwnable = (t: Tile): t is OwnableTile =>
  t.kind === 'city' || t.kind === 'hub' || t.kind === 'reseau';

export const tileAt = (i: TileIndex): Tile => BOARD[((i % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];

export const groupTiles = (g: GroupId): CityTile[] =>
  BOARD.filter((t): t is CityTile => t.kind === 'city' && t.group === g);

/** Cases d'un même groupe, indexées pour les vérifications de monopole. */
export const GROUP_INDEX: Record<GroupId, TileIndex[]> = Object.fromEntries(
  (Object.keys(GROUPS) as GroupId[]).map((g) => [g, groupTiles(g).map((t) => t.i)]),
) as Record<GroupId, TileIndex[]>;

export const HUB_TILES = BOARD.filter((t) => t.kind === 'hub').map((t) => t.i);
export const RESEAU_TILES = BOARD.filter((t) => t.kind === 'reseau').map((t) => t.i);

export const LEVEL_NAMES = ['Terrain', 'Maison', 'Villa', 'Grand Hôtel'] as const;
