import { describe, expect, it } from 'vitest';
import { applyCommand, createGame } from '../engine';
import { BOARD, GROUP_INDEX, JAIL_TILE, RULES, tileAt } from '../board';
import { netWorth, ownsFullGroup, rentFor } from '../rules';
import { CARDS } from '../cards';
import { current, newGame, rollAs, SEATS } from './helpers';
import type { GameState } from '../types';

/** Place un joueur sur une case sans passer par les dés. */
const put = (s: GameState, p: string, tile: number): GameState =>
  ({ ...s, players: { ...s.players, [p]: { ...s.players[p], position: tile } } });

const give = (s: GameState, p: string, tiles: number[], level = 0): GameState => {
  const t = { ...s.tiles };
  for (const i of tiles) t[i] = { owner: p, level: level as 0, mortgaged: false };
  return { ...s, tiles: t };
};

const cash = (s: GameState, p: string, amount: number): GameState =>
  ({ ...s, players: { ...s.players, [p]: { ...s.players[p], cash: amount } } });

const atRound = (s: GameState, r: number): GameState => ({ ...s, round: r });

describe('plateau', () => {
  it('compte 40 cases dont 24 villes réparties en 8 groupes de 3', () => {
    expect(BOARD).toHaveLength(40);
    const cities = BOARD.filter((t) => t.kind === 'city');
    expect(cities).toHaveLength(24);
    for (const [g, idx] of Object.entries(GROUP_INDEX)) {
      expect(idx, `groupe ${g}`).toHaveLength(3);
    }
  });

  it('a des index cohérents et des coins aux bons endroits', () => {
    BOARD.forEach((t, i) => expect(t.i).toBe(i));
    expect(BOARD[0].kind).toBe('depart');
    expect(BOARD[10].kind).toBe('prison');
    expect(BOARD[20].kind).toBe('parc');
    expect(BOARD[30].kind).toBe('gotoprison');
  });

  it('n’a aucune carte au barème incohérent', () => {
    for (const t of BOARD) {
      if (t.kind !== 'city') continue;
      expect(t.rent[0]).toBeLessThan(t.rent[1]);
      expect(t.rent[1]).toBeLessThan(t.rent[2]);
      expect(t.rent[2]).toBeLessThan(t.rent[3]);
    }
  });
});

describe('création de partie', () => {
  it.each([2, 3, 4, 5, 6])('démarre à %i joueurs avec 15 000 € chacun', (n) => {
    const s = newGame(n);
    expect(s.order).toHaveLength(n);
    for (const id of s.order) {
      expect(s.players[id].cash).toBe(15_000);
      expect(s.players[id].position).toBe(0);
    }
    expect(s.phase).toBe('ROLL_DICE');
    expect(s.round).toBe(1);
  });

  it('est déterministe à seed égal et divergent à seed différent', () => {
    const a = createGame('ROOM', SEATS(4), 'x');
    const b = createGame('ROOM', SEATS(4), 'x');
    const c = createGame('ROOM', SEATS(4), 'y');
    expect(a.order).toEqual(b.order);
    expect(a.decks).toEqual(b.decks);
    expect([a.order, a.decks]).not.toEqual([c.order, c.decks]);
  });

  it('rejoue une même suite de commandes à l’identique', () => {
    const play = () => {
      let s = newGame(3);
      for (let i = 0; i < 12; i++) s = applyCommand(s, { t: 'ROLL_DICE', by: current(s) }).state;
      return s;
    };
    // `startedAt` est un horodatage de création, pas une sortie du moteur.
    const strip = ({ startedAt, ...rest }: GameState) => JSON.stringify(rest);
    expect(strip(play())).toBe(strip(play()));
  });
});

describe('dés et déplacement', () => {
  it('avance case par case et émet un évènement par pas', () => {
    const s = newGame(2);
    const { state, events } = rollAs(s, 'p1', 3, 4);
    expect(state.players.p1.position).toBe(7);
    const steps = events.filter((e) => e.e === 'MOVE_STEP');
    expect(steps).toHaveLength(7);
    expect(steps.map((e) => (e as { to: number }).to)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('rejoue après un double', () => {
    const s = newGame(2);
    const { state } = rollAs(s, 'p1', 4, 4);
    expect(state.players.p1.position).toBe(8);
    expect(state.doubles).toBe(1);
    expect(current(state)).toBe('p1');
    expect(state.phase).toBe('ROLL_DICE');
  });

  it('envoie en prison au troisième double, sans quatrième lancer', () => {
    let s = newGame(2);
    s = rollAs(s, 'p1', 2, 2).state;
    s = rollAs(s, 'p1', 3, 3).state;
    const { state, events } = rollAs(s, 'p1', 5, 5);
    expect(events.some((e) => e.e === 'THREE_DOUBLES')).toBe(true);
    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.position).toBe(JAIL_TILE);
    expect(current(state)).toBe('p2');
    // Le troisième lancer ne déplace pas : 4+6 = position 10 par la prison, pas par les dés.
    expect(state.players.p1.position).not.toBe(4 + 6 + 10);
  });

  it('verse 200 € au passage du Départ et 400 € sur le Départ exact', () => {
    let s = put(newGame(2), 'p1', 36);
    const passed = rollAs(s, 'p1', 3, 3).state; // 36 -> 2, passe le Départ
    expect(passed.players.p1.cash).toBe(15_000 + RULES.passGo);

    s = put(newGame(2), 'p1', 36);
    const exact = rollAs(s, 'p1', 2, 2).state; // 36 -> 0 pile
    expect(exact.players.p1.position).toBe(0);
    expect(exact.players.p1.cash).toBe(15_000 + RULES.exactGo);
  });
});

describe('premier tour', () => {
  it('n’offre aucune acquisition au tour 1', () => {
    const s = newGame(2);
    const { state, events } = rollAs(s, 'p1', 1, 1); // case 2 : Le Caire, libre
    expect(tileAt(2).kind).toBe('city');
    expect(events.some((e) => e.e === 'PROPERTY_OFFERED')).toBe(false);
    expect(state.pending).toBeNull();
  });

  it('offre l’acquisition dès le tour 2', () => {
    const s = atRound(newGame(2), 2);
    const { state, events } = rollAs(s, 'p1', 1, 1);
    expect(events.some((e) => e.e === 'PROPERTY_OFFERED')).toBe(true);
    expect(state.phase).toBe('PROPERTY_DECISION');
    expect(state.pending).toMatchObject({ type: 'PROPERTY_DECISION', tile: 2 });
  });

  it('incrémente le tour quand la main revient au premier joueur', () => {
    let s = newGame(2);
    expect(s.round).toBe(1);
    s = rollAs(s, 'p1', 1, 2).state;
    expect(current(s)).toBe('p2');
    expect(s.round).toBe(1);
    s = rollAs(s, 'p2', 1, 2).state;
    expect(current(s)).toBe('p1');
    expect(s.round).toBe(2);
  });
});

describe('acquisition', () => {
  const setup = () => {
    const s = atRound(newGame(2), 2);
    // 1+3 : ni double (sinon le joueur rejoue), arrivée sur Carthagène.
    return rollAs(s, 'p1', 1, 3).state;
  };

  it('débite et attribue la propriété à l’achat', () => {
    const s = setup();
    const price = (tileAt(4) as { price: number }).price;
    const after = applyCommand(s, { t: 'BUY_PROPERTY', by: 'p1' }).state;
    expect(after.tiles[4].owner).toBe('p1');
    expect(after.players.p1.cash).toBe(15_000 - price);
    expect(after.pending).toBeNull();
  });

  it('laisse la propriété libre en cas de refus', () => {
    const after = applyCommand(setup(), { t: 'DECLINE_PROPERTY', by: 'p1' }).state;
    expect(after.tiles[4].owner).toBeNull();
    expect(current(after)).toBe('p2');
  });

  it('refuse l’achat par un autre joueur', () => {
    const r = applyCommand(setup(), { t: 'BUY_PROPERTY', by: 'p2' });
    expect(r.rejected).toBeTruthy();
    expect(r.state.tiles[4].owner).toBeNull();
  });
});

describe('loyers', () => {
  it('prélève automatiquement le loyer du propriétaire', () => {
    let s = atRound(newGame(2), 2);
    s = give(s, 'p2', [2]);
    const before = s.players.p2.cash;
    const { state, events } = rollAs(s, 'p1', 1, 1);
    const rent = (tileAt(2) as { rent: number[] }).rent[0];
    expect(events.some((e) => e.e === 'RENT_PAID')).toBe(true);
    expect(state.players.p1.cash).toBe(15_000 - rent);
    expect(state.players.p2.cash).toBe(before + rent);
  });

  it('double le loyer du terrain nu quand le groupe est complet', () => {
    const base = newGame(2);
    const sable = GROUP_INDEX.sable;
    const partial = give(base, 'p2', [sable[0]]);
    const full = give(base, 'p2', sable);
    expect(rentFor(full, sable[0], 0)).toBe(rentFor(partial, sable[0], 0) * 2);
    expect(ownsFullGroup(full, 'p2', sable[0])).toBe(true);
  });

  it('ne prélève rien sur une propriété hypothéquée', () => {
    let s = atRound(newGame(2), 2);
    s = give(s, 'p2', [2]);
    s = { ...s, tiles: { ...s.tiles, 2: { ...s.tiles[2], mortgaged: true } } };
    const { state } = rollAs(s, 'p1', 1, 1);
    expect(state.players.p1.cash).toBe(15_000);
  });

  it('escalade le loyer des hubs avec le nombre possédés', () => {
    const base = newGame(2);
    const hubs = BOARD.filter((t) => t.kind === 'hub').map((t) => t.i);
    const rents = hubs.map((_, n) => rentFor(give(base, 'p2', hubs.slice(0, n + 1)), hubs[0], 0));
    expect(rents).toEqual([...RULES.hubRent]);
  });

  it('calcule le loyer des réseaux sur la somme des dés', () => {
    const base = newGame(2);
    const res = BOARD.filter((t) => t.kind === 'reseau').map((t) => t.i);
    expect(rentFor(give(base, 'p2', [res[0]]), res[0], 8)).toBe(8 * RULES.reseauRent[0]);
    expect(rentFor(give(base, 'p2', res), res[0], 8)).toBe(8 * RULES.reseauRent[1]);
  });
});

describe('constructions', () => {
  const sable = GROUP_INDEX.sable;

  it('refuse de construire sans les 3 villes du groupe', () => {
    const s = give(newGame(2), 'p1', [sable[0], sable[1]]);
    const r = applyCommand(s, { t: 'BUILD', by: 'p1', tile: sable[0] });
    expect(r.rejected).toMatch(/3 villes/);
  });

  it('monte Terrain → Maison → Villa → Grand Hôtel', () => {
    let s = give(newGame(2), 'p1', sable);
    const cost = (tileAt(sable[0]) as { buildCost: number }).buildCost;
    for (let lvl = 1; lvl <= 3; lvl++) {
      // Construction homogène : il faut monter tout le groupe d'un cran.
      for (const t of sable) {
        const r = applyCommand(s, { t: 'BUILD', by: 'p1', tile: t });
        expect(r.rejected).toBeUndefined();
        s = r.state;
      }
      expect(sable.map((t) => s.tiles[t].level)).toEqual([lvl, lvl, lvl]);
    }
    expect(s.players.p1.cash).toBe(15_000 - cost * 9);
    expect(applyCommand(s, { t: 'BUILD', by: 'p1', tile: sable[0] }).rejected).toMatch(/Hôtel/);
  });

  it('impose une construction homogène dans le groupe', () => {
    let s = give(newGame(2), 'p1', sable);
    s = applyCommand(s, { t: 'BUILD', by: 'p1', tile: sable[0] }).state;
    const r = applyCommand(s, { t: 'BUILD', by: 'p1', tile: sable[0] });
    expect(r.rejected).toMatch(/d’abord/);
  });

  it('augmente le loyer à chaque niveau', () => {
    let s = give(newGame(2), 'p1', sable);
    const rents = [rentFor(s, sable[0], 0)];
    for (let lvl = 1; lvl <= 3; lvl++) {
      for (const t of sable) s = applyCommand(s, { t: 'BUILD', by: 'p1', tile: t }).state;
      rents.push(rentFor(s, sable[0], 0));
    }
    for (let i = 1; i < rents.length; i++) expect(rents[i]).toBeGreaterThan(rents[i - 1]);
  });

  it('rembourse la moitié à la revente', () => {
    let s = give(newGame(2), 'p1', sable);
    for (const t of sable) s = applyCommand(s, { t: 'BUILD', by: 'p1', tile: t }).state;
    const before = s.players.p1.cash;
    const cost = (tileAt(sable[0]) as { buildCost: number }).buildCost;
    const r = applyCommand(s, { t: 'SELL_BUILDING', by: 'p1', tile: sable[0] });
    expect(r.state.tiles[sable[0]].level).toBe(0);
    expect(r.state.players.p1.cash).toBe(before + cost / 2);
  });

  it('interdit de construire sur un groupe partiellement hypothéqué', () => {
    let s = give(newGame(2), 'p1', sable);
    s = { ...s, tiles: { ...s.tiles, [sable[2]]: { ...s.tiles[sable[2]], mortgaged: true } } };
    expect(applyCommand(s, { t: 'BUILD', by: 'p1', tile: sable[0] }).rejected).toMatch(/hypothéquée/);
  });
});

describe('hypothèques', () => {
  it('verse la moitié du prix puis coûte 10 % de plus à lever', () => {
    const tile = GROUP_INDEX.sable[0];
    const price = (tileAt(tile) as { price: number }).price;
    let s = give(newGame(2), 'p1', [tile]);
    s = applyCommand(s, { t: 'MORTGAGE', by: 'p1', tile }).state;
    expect(s.tiles[tile].mortgaged).toBe(true);
    expect(s.players.p1.cash).toBe(15_000 + price / 2);
    s = applyCommand(s, { t: 'UNMORTGAGE', by: 'p1', tile }).state;
    expect(s.tiles[tile].mortgaged).toBe(false);
    expect(s.players.p1.cash).toBe(15_000 + price / 2 - Math.round((price / 2) * 1.1));
  });

  it('refuse d’hypothéquer une ville construite', () => {
    const sable = GROUP_INDEX.sable;
    let s = give(newGame(2), 'p1', sable);
    for (const t of sable) s = applyCommand(s, { t: 'BUILD', by: 'p1', tile: t }).state;
    expect(applyCommand(s, { t: 'MORTGAGE', by: 'p1', tile: sable[0] }).rejected).toMatch(/constructions/);
  });
});

describe('prison', () => {
  const jailed = () => {
    let s = newGame(2);
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, inJail: true, position: JAIL_TILE } } };
    return { ...s, phase: 'JAIL' as const, pending: { type: 'JAIL_CHOICE' as const, player: 'p1' } };
  };

  it('envoie en prison depuis la case Allez en Prison', () => {
    const s = put(newGame(2), 'p1', 25);
    const { state } = rollAs(s, 'p1', 2, 3); // 25 -> 30
    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.position).toBe(JAIL_TILE);
  });

  it('libère immédiatement contre 50 €', () => {
    const s = applyCommand(jailed(), { t: 'PAY_JAIL_FINE', by: 'p1' }).state;
    expect(s.players.p1.inJail).toBe(false);
    expect(s.players.p1.cash).toBe(15_000 - RULES.jailFine);
    expect(s.pot).toBe(RULES.jailFine);
    expect(s.phase).toBe('ROLL_DICE');
  });

  it('libère sur un double et déplace du lancer, sans rejouer', () => {
    const { state, events } = rollAs(jailed(), 'p1', 3, 3, 'ATTEMPT_JAIL_ROLL');
    expect(events.some((e) => e.e === 'JAIL_RELEASED')).toBe(true);
    expect(state.players.p1.inJail).toBe(false);
    expect(state.players.p1.position).toBe(JAIL_TILE + 6);
    expect(current(state)).toBe('p2');
  });

  it('compte 3 tentatives puis impose la caution', () => {
    let s = jailed();
    for (let i = 1; i <= 2; i++) {
      const r = rollAs(s, 'p1', 3, 5, 'ATTEMPT_JAIL_ROLL');
      expect(r.state.players.p1.jailAttempts).toBe(i);
      expect(r.state.players.p1.inJail).toBe(true);
      // La main passe, on la rend à p1 pour la tentative suivante.
      s = { ...r.state, currentIndex: 0, phase: 'JAIL', pending: { type: 'JAIL_CHOICE', player: 'p1' } };
    }
    const third = rollAs(s, 'p1', 3, 5, 'ATTEMPT_JAIL_ROLL').state;
    expect(third.players.p1.inJail).toBe(false);
    expect(third.players.p1.cash).toBe(15_000 - RULES.jailFine);
    expect(third.players.p1.position).toBe(JAIL_TILE + 8);
  });

  it('accepte un laissez-passer', () => {
    let s = jailed();
    s = { ...s, players: { ...s.players, p1: { ...s.players.p1, jailFreeCards: 1 } } };
    const after = applyCommand(s, { t: 'USE_JAIL_CARD', by: 'p1' }).state;
    expect(after.players.p1.inJail).toBe(false);
    expect(after.players.p1.jailFreeCards).toBe(0);
  });
});

describe('taxes, cagnotte et Parc Gratuit', () => {
  it('verse les taxes dans la cagnotte', () => {
    const s = put(atRound(newGame(2), 2), 'p1', 0);
    const { state } = rollAs(s, 'p1', 2, 3); // case 5 : Impôt Mondial
    expect(state.pot).toBe(1200);
    expect(state.players.p1.cash).toBe(15_000 - 1200);
  });

  it('reverse 100 % de la cagnotte au joueur qui atteint le Parc', () => {
    let s = put(atRound(newGame(2), 2), 'p1', 14);
    s = { ...s, pot: 2500 };
    const { state, events } = rollAs(s, 'p1', 3, 3); // 14 -> 20
    expect(state.players.p1.cash).toBe(15_000 + 2500);
    expect(state.pot).toBe(0);
    expect(events.some((e) => e.e === 'POT_WON')).toBe(true);
  });
});

describe('cartes', () => {
  it('définit des effets valides et des identifiants uniques', () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CARDS.filter((c) => c.deck === 'destin').length).toBeGreaterThanOrEqual(20);
    expect(CARDS.filter((c) => c.deck === 'marche').length).toBeGreaterThanOrEqual(20);
    expect(CARDS.some((c) => c.rarity === 'legendaire')).toBe(true);
  });

  it('tire une carte et applique son effet en arrivant sur la case', () => {
    const s = put(atRound(newGame(2), 2), 'p1', 0);
    const { state, events } = rollAs(s, 'p1', 1, 2); // case 3 : Destin
    expect(events.some((e) => e.e === 'CARD_DRAWN')).toBe(true);
    expect(state.discard.destin).toHaveLength(1);
  });

  it('remélange la défausse quand la pioche est vide', () => {
    let s = put(atRound(newGame(2), 2), 'p1', 0);
    s = { ...s, decks: { ...s.decks, destin: [] }, discard: { ...s.discard, destin: ['d_alizes', 'd_mecene'] } };
    const { state } = rollAs(s, 'p1', 1, 2);
    expect(state.decks.destin.length + state.discard.destin.length).toBe(2);
  });

  it('applique chaque effet sans planter, quel que soit le contexte', () => {
    for (const card of CARDS) {
      let s = atRound(newGame(3), 3);
      s = give(s, 'p1', [1, 2, 4, 7]);
      s = { ...s, pot: 1000 };
      s = { ...s, decks: { ...s.decks, [card.deck]: [card.id] } };
      s = put(s, 'p1', card.deck === 'destin' ? 2 : 16);
      const r = rollAs(s, 'p1', 1, 0 + 1, 'ROLL_DICE');
      expect(r.state.version, card.id).toBeGreaterThan(s.version);
      for (const id of r.state.order) {
        expect(r.state.players[id].cash, `${card.id}/${id}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('échanges', () => {
  const setup = () => {
    let s = give(newGame(2), 'p1', [1]);
    s = give(s, 'p2', [2]);
    return s;
  };

  it('échange propriété contre propriété + argent', () => {
    let s = setup();
    s = applyCommand(s, {
      t: 'PROPOSE_TRADE', by: 'p1',
      offer: { to: 'p2', giveTiles: [1], giveCash: 500, getTiles: [2], getCash: 0 },
    }).state;
    expect(s.trades).toHaveLength(1);
    const after = applyCommand(s, { t: 'ACCEPT_TRADE', by: 'p2', id: s.trades[0].id }).state;
    expect(after.tiles[1].owner).toBe('p2');
    expect(after.tiles[2].owner).toBe('p1');
    expect(after.players.p1.cash).toBe(15_000 - 500);
    expect(after.players.p2.cash).toBe(15_000 + 500);
    expect(after.trades).toHaveLength(0);
  });

  it('annule l’offre au refus', () => {
    let s = setup();
    s = applyCommand(s, {
      t: 'PROPOSE_TRADE', by: 'p1',
      offer: { to: 'p2', giveTiles: [1], giveCash: 0, getTiles: [2], getCash: 0 },
    }).state;
    const after = applyCommand(s, { t: 'DECLINE_TRADE', by: 'p2', id: s.trades[0].id }).state;
    expect(after.trades).toHaveLength(0);
    expect(after.tiles[1].owner).toBe('p1');
  });

  it('refuse d’échanger une propriété construite ou non possédée', () => {
    const s = setup();
    expect(applyCommand(s, {
      t: 'PROPOSE_TRADE', by: 'p1',
      offer: { to: 'p2', giveTiles: [3], giveCash: 0, getTiles: [], getCash: 0 },
    }).rejected).toBeTruthy();
  });

  it('n’autorise que le destinataire à accepter', () => {
    let s = setup();
    s = applyCommand(s, {
      t: 'PROPOSE_TRADE', by: 'p1',
      offer: { to: 'p2', giveTiles: [1], giveCash: 0, getTiles: [2], getCash: 0 },
    }).state;
    expect(applyCommand(s, { t: 'ACCEPT_TRADE', by: 'p1', id: s.trades[0].id }).rejected).toBeTruthy();
  });
});

describe('dettes et faillite', () => {
  const inDebt = () => {
    let s = atRound(newGame(2), 2);
    s = give(s, 'p2', GROUP_INDEX.or);
    for (let i = 0; i < 3; i++) {
      for (const t of GROUP_INDEX.or) s = applyCommand(s, { t: 'BUILD', by: 'p2', tile: t }).state;
    }
    s = cash(s, 'p1', 100);
    s = put(s, 'p1', 35);
    return rollAs(s, 'p1', 1, 1).state; // 35 -> 37 Dubaï, hôtel
  };

  it('ouvre une dette quand le joueur ne peut pas payer', () => {
    const s = inDebt();
    expect(s.phase).toBe('DEBT_RESOLUTION');
    expect(s.pending).toMatchObject({ type: 'DEBT' });
    expect(s.players.p1.cash).toBe(100);
  });

  it('permet d’hypothéquer puis de régler la dette', () => {
    let s = inDebt();
    s = give(s, 'p1', [1, 2, 4, 6, 8, 9, 11, 13, 14, 16]);
    for (const t of [1, 2, 4, 6, 8, 9, 11, 13, 14, 16]) {
      s = applyCommand(s, { t: 'MORTGAGE', by: 'p1', tile: t }).state;
    }
    const r = applyCommand(s, { t: 'SETTLE_DEBT', by: 'p1' });
    expect(r.rejected).toBeUndefined();
    expect(r.state.pending).toBeNull();
    expect(r.state.phase).not.toBe('DEBT_RESOLUTION');
  });

  it('transfère tout au créancier à la faillite et élimine le joueur', () => {
    let s = inDebt();
    s = give(s, 'p1', [1, 2]);
    const creditorCash = s.players.p2.cash;
    const { state, events } = applyCommand(s, { t: 'DECLARE_BANKRUPTCY', by: 'p1' });
    expect(state.players.p1.bankrupt).toBe(true);
    expect(state.tiles[1].owner).toBe('p2');
    expect(state.tiles[2].owner).toBe('p2');
    expect(state.players.p2.cash).toBe(creditorCash + 100);
    expect(events.some((e) => e.e === 'BANKRUPT')).toBe(true);
  });

  it('déclare le dernier joueur solvable vainqueur', () => {
    const s = inDebt();
    const { state, events } = applyCommand(s, { t: 'DECLARE_BANKRUPTCY', by: 'p1' });
    expect(state.phase).toBe('GAME_OVER');
    expect(state.winner).toBe('p2');
    expect(events.some((e) => e.e === 'GAME_OVER')).toBe(true);
  });

  it('poursuit la partie à 3 joueurs après une élimination', () => {
    let s = atRound(newGame(3), 2);
    s = give(s, 'p2', GROUP_INDEX.or);
    for (let i = 0; i < 3; i++) {
      for (const t of GROUP_INDEX.or) s = applyCommand(s, { t: 'BUILD', by: 'p2', tile: t }).state;
    }
    s = cash(s, 'p1', 10);
    s = put(s, 'p1', 35);
    s = rollAs(s, 'p1', 1, 1).state;
    const after = applyCommand(s, { t: 'DECLARE_BANKRUPTCY', by: 'p1' }).state;
    expect(after.players.p1.bankrupt).toBe(true);
    expect(after.winner).toBeNull();
    expect(after.phase).not.toBe('GAME_OVER');
    expect(['p2', 'p3']).toContain(current(after));
  });
});

describe('anti-triche', () => {
  it('refuse toute commande de tour venant d’un autre joueur', () => {
    const s = newGame(3);
    for (const cmd of ['ROLL_DICE', 'END_TURN'] as const) {
      expect(applyCommand(s, { t: cmd, by: 'p2' }).rejected, cmd).toBeTruthy();
    }
  });

  it('laisse l’état intact quand une commande est refusée', () => {
    const s = newGame(2);
    const r = applyCommand(s, { t: 'BUY_PROPERTY', by: 'p1' });
    expect(r.rejected).toBeTruthy();
    expect(r.state).toBe(s);
    expect(r.events).toHaveLength(0);
  });

  it('refuse de construire sur la propriété d’autrui', () => {
    const s = give(newGame(2), 'p2', GROUP_INDEX.sable);
    expect(applyCommand(s, { t: 'BUILD', by: 'p1', tile: GROUP_INDEX.sable[0] }).rejected).toBeTruthy();
  });

  it('refuse un lancer hors de la phase ROLL_DICE', () => {
    const s = atRound(newGame(2), 2);
    const offered = rollAs(s, 'p1', 1, 1).state;
    expect(offered.phase).toBe('PROPERTY_DECISION');
    expect(applyCommand(offered, { t: 'ROLL_DICE', by: 'p1' }).rejected).toBeTruthy();
  });
});

describe('patrimoine', () => {
  it('additionne liquidités, propriétés et constructions', () => {
    const sable = GROUP_INDEX.sable;
    let s = give(newGame(2), 'p1', sable);
    const prices = sable.reduce((a, i) => a + (tileAt(i) as { price: number }).price, 0);
    expect(netWorth(s, 'p1')).toBe(15_000 + prices);
    s = applyCommand(s, { t: 'BUILD', by: 'p1', tile: sable[0] }).state;
    expect(netWorth(s, 'p1')).toBe(15_000 + prices);
  });
});
