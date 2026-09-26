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
  /** Loyer d'un hub selon le nombre possédé, de 1 à 4. */
  hubRent: [250, 500, 1000, 2000] as const,
  /** Multiplicateur appliqué à la somme des dés. */
  reseauRent: [120, 300] as const,
  maxPlayers: 6,
  minPlayers: 2,
} as const;

/**
 * Palette des groupes.
 *
 * Huit teintes franchement séparées sur la roue chromatique. La version
 * précédente alignait sable, ambre et or — trois jaunes-orangés que rien ne
 * distinguait à la taille d'une case. Ici chaque famille est identifiable
 * d'un seul coup d'œil, même sur un écran de téléphone.
 */
export const GROUPS: Record<GroupId, { name: string; color: string; glow: string }> = {
  terre:    { name: 'Terre',    color: '#8B5A3C', glow: '#C08E6B' },
  azur:     { name: 'Azur',     color: '#38BDF8', glow: '#9BDDFB' },
  fuchsia:  { name: 'Fuchsia',  color: '#E0489E', glow: '#F59DC9' },
  orange:   { name: 'Orange',   color: '#F97316', glow: '#FDBA74' },
  rubis:    { name: 'Rubis',    color: '#DC2626', glow: '#F87171' },
  safran:   { name: 'Safran',   color: '#F5C518', glow: '#FDE68A' },
  emeraude: { name: 'Émeraude', color: '#16A34A', glow: '#6EE7A0' },
  nuit:     { name: 'Nuit',     color: '#1D4ED8', glow: '#7CA0F5' },
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
 * 40 cases : 22 villes, 4 coins, 4 hubs, 2 réseaux, 6 cases carte, 2 taxes.
 *
 * Les hubs sont régulièrement répartis en 5, 15, 25 et 35 — un par côté, au
 * même rang à chaque fois. Le rythme du plateau est ainsi immédiatement
 * lisible : on sait toujours à quelle distance se trouve le prochain.
 *
 * Six groupes de trois villes, encadrés par deux groupes de deux — le moins
 * cher et le plus cher. Ces deux-là se réunissent vite, ce qui donne très tôt
 * une raison de négocier.
 */
export const BOARD: Tile[] = [
  { i: 0, kind: 'depart', name: 'Départ' },
  city(1, 'Marrakech', 'Maroc', 'terre', 900, 550, 'arch', 31.63, -7.99),
  { i: 2, kind: 'card', deck: 'destin', name: 'Destin' },
  city(3, 'Le Caire', 'Égypte', 'terre', 950, 550, 'pyramid', 30.04, 31.24),
  { i: 4, kind: 'tax', name: 'Impôt Mondial', amount: 1200 },
  { i: 5, kind: 'hub', name: 'Hub Atlantique', price: 2000 },
  city(6, 'Bangkok', 'Thaïlande', 'azur', 1200, 750, 'pagoda', 13.76, 100.5),
  { i: 7, kind: 'card', deck: 'marche', name: 'Marché' },
  city(8, 'Hanoï', 'Viêt Nam', 'azur', 1250, 750, 'pagoda', 21.03, 105.85),
  city(9, 'Bali', 'Indonésie', 'azur', 1350, 750, 'arch', -8.41, 115.19),
  { i: 10, kind: 'prison', name: 'Prison' },
  city(11, 'Lisbonne', 'Portugal', 'fuchsia', 1500, 900, 'bridge', 38.72, -9.14),
  { i: 12, kind: 'reseau', name: 'Réseau Solaire', price: 1800 },
  city(13, 'Le Cap', 'Afrique du Sud', 'fuchsia', 1550, 900, 'skyline', -33.92, 18.42),
  city(14, 'Rio de Janeiro', 'Brésil', 'fuchsia', 1650, 900, 'spire', -22.91, -43.17),
  { i: 15, kind: 'hub', name: 'Hub Pacifique', price: 2000 },
  city(16, 'Barcelone', 'Espagne', 'orange', 1800, 1100, 'spire', 41.39, 2.17),
  { i: 17, kind: 'card', deck: 'marche', name: 'Marché' },
  city(18, 'Rome', 'Italie', 'orange', 1850, 1100, 'dome', 41.9, 12.5),
  city(19, 'Istanbul', 'Turquie', 'orange', 1950, 1100, 'dome', 41.01, 28.98),
  { i: 20, kind: 'parc', name: 'Parc Gratuit' },
  city(21, 'Berlin', 'Allemagne', 'rubis', 2200, 1300, 'arch', 52.52, 13.4),
  { i: 22, kind: 'card', deck: 'destin', name: 'Destin' },
  city(23, 'Amsterdam', 'Pays-Bas', 'rubis', 2250, 1300, 'bridge', 52.37, 4.9),
  city(24, 'Séoul', 'Corée du Sud', 'rubis', 2350, 1300, 'tower', 37.57, 126.98),
  { i: 25, kind: 'hub', name: 'Hub Méditerranée', price: 2000 },
  city(26, 'Londres', 'Royaume-Uni', 'safran', 2600, 1600, 'tower', 51.51, -0.13),
  city(27, 'Sydney', 'Australie', 'safran', 2650, 1600, 'bridge', -33.87, 151.21),
  { i: 28, kind: 'reseau', name: 'Réseau Orbital', price: 1800 },
  city(29, 'Los Angeles', 'États-Unis', 'safran', 2750, 1600, 'skyline', 34.05, -118.24),
  { i: 30, kind: 'gotoprison', name: 'Allez en Prison' },
  city(31, 'Tokyo', 'Japon', 'emeraude', 3100, 1900, 'tower', 35.68, 139.69),
  city(32, 'New York', 'États-Unis', 'emeraude', 3200, 1900, 'skyline', 40.71, -74.01),
  { i: 33, kind: 'card', deck: 'marche', name: 'Marché' },
  city(34, 'Singapour', 'Singapour', 'emeraude', 3300, 1900, 'spire', 1.35, 103.82),
  { i: 35, kind: 'hub', name: 'Hub Orient', price: 2000 },
  { i: 36, kind: 'card', deck: 'destin', name: 'Destin' },
  city(37, 'Dubaï', 'É.A.U.', 'nuit', 4000, 2400, 'spire', 25.2, 55.27),
  { i: 38, kind: 'tax', name: 'Taxe de Luxe', amount: 700 },
  city(39, 'Monaco', 'Monaco', 'nuit', 4500, 2400, 'dome', 43.73, 7.42),
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
