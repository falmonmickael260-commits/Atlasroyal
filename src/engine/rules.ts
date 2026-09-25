import { BOARD, GROUP_INDEX, HUB_TILES, RESEAU_TILES, RULES, isOwnable, tileAt } from './board';
import type { BuildLevel, GameState, PlayerId, TileIndex, OwnableTile } from './types';

export const ownedBy = (s: GameState, p: PlayerId): TileIndex[] =>
  Object.entries(s.tiles)
    .filter(([, st]) => st.owner === p)
    .map(([i]) => Number(i));

/** Le joueur détient-il les 3 villes du groupe (condition de construction) ? */
export const ownsFullGroup = (s: GameState, p: PlayerId, tile: TileIndex): boolean => {
  const t = tileAt(tile);
  if (t.kind !== 'city') return false;
  return GROUP_INDEX[t.group].every((i) => s.tiles[i].owner === p);
};

export const countOwnedIn = (s: GameState, p: PlayerId, list: readonly TileIndex[]): number =>
  list.filter((i) => s.tiles[i].owner === p).length;

/**
 * Loyer dû pour une case possédée.
 * `diceSum` n'est utilisé que pour les réseaux.
 */
export const rentFor = (s: GameState, tile: TileIndex, diceSum: number): number => {
  const t = tileAt(tile);
  const st = s.tiles[tile];
  if (!isOwnable(t) || !st.owner || st.mortgaged) return 0;

  if (t.kind === 'hub') {
    const n = countOwnedIn(s, st.owner, HUB_TILES);
    return RULES.hubRent[Math.max(0, n - 1)] ?? 0;
  }
  if (t.kind === 'reseau') {
    const n = countOwnedIn(s, st.owner, RESEAU_TILES);
    return diceSum * (RULES.reseauRent[Math.max(0, n - 1)] ?? RULES.reseauRent[0]);
  }
  // Ville : terrain nu doublé si le groupe est complet, sinon barème du niveau.
  if (st.level === 0) {
    return ownsFullGroup(s, st.owner, tile) ? t.rent[0] * 2 : t.rent[0];
  }
  return t.rent[st.level];
};

export const buildCostFor = (tile: TileIndex): number => {
  const t = tileAt(tile);
  return t.kind === 'city' ? t.buildCost : 0;
};

export const priceOf = (tile: TileIndex): number => {
  const t = tileAt(tile);
  return isOwnable(t) ? t.price : 0;
};

export const mortgageValue = (tile: TileIndex): number =>
  Math.round(priceOf(tile) * RULES.mortgageRate);

export const unmortgageCost = (tile: TileIndex): number =>
  Math.round(mortgageValue(tile) * RULES.unmortgageRate);

/** Raison du refus, ou `null` si la construction est légale. */
export const canBuild = (s: GameState, p: PlayerId, tile: TileIndex): string | null => {
  const t = tileAt(tile);
  const st = s.tiles[tile];
  if (t.kind !== 'city') return 'Seules les villes se construisent.';
  if (st.owner !== p) return 'Cette ville ne vous appartient pas.';
  if (st.mortgaged) return 'Ville hypothéquée.';
  if (st.level >= 3) return 'Grand Hôtel déjà construit.';
  if (!ownsFullGroup(s, p, tile)) return 'Il faut posséder les 3 villes du groupe.';
  if (GROUP_INDEX[t.group].some((i) => s.tiles[i].mortgaged)) {
    return 'Une ville du groupe est hypothéquée.';
  }
  // Construction homogène : on ne peut pas dépasser de plus d'un niveau.
  const min = Math.min(...GROUP_INDEX[t.group].map((i) => s.tiles[i].level));
  if (st.level > min) return 'Construisez d’abord sur les autres villes du groupe.';
  if (s.players[p].cash < t.buildCost) return 'Fonds insuffisants.';
  return null;
};

export const canMortgage = (s: GameState, p: PlayerId, tile: TileIndex): string | null => {
  const st = s.tiles[tile];
  if (!st || st.owner !== p) return 'Propriété inconnue.';
  if (st.mortgaged) return 'Déjà hypothéquée.';
  if (st.level > 0) return 'Revendez les constructions d’abord.';
  return null;
};

/** Valeur de liquidation : ce que le joueur peut encore mobiliser. */
export const liquidationValue = (s: GameState, p: PlayerId): number => {
  let total = s.players[p].cash;
  for (const i of ownedBy(s, p)) {
    const st = s.tiles[i];
    if (st.level > 0) {
      total += Math.round(buildCostFor(i) * RULES.sellBuildingRate) * st.level;
    }
    if (!st.mortgaged) total += mortgageValue(i);
  }
  return total;
};

/** Patrimoine total, utilisé pour le classement et l'écran de victoire. */
export const netWorth = (s: GameState, p: PlayerId): number => {
  let total = s.players[p].cash;
  for (const i of ownedBy(s, p)) {
    const st = s.tiles[i];
    total += st.mortgaged ? mortgageValue(i) : priceOf(i);
    total += buildCostFor(i) * st.level;
  }
  return total;
};

export const activePlayers = (s: GameState): PlayerId[] =>
  s.order.filter((id) => !s.players[id].bankrupt);

export const ownableTiles = (): OwnableTile[] => BOARD.filter(isOwnable);

export const levelName = (l: BuildLevel): string =>
  (['Terrain', 'Maison', 'Villa', 'Grand Hôtel'] as const)[l];
