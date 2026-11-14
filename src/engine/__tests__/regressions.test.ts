import { describe, it, expect } from 'vitest';
import { applyCommand } from '../engine';
import { CARDS } from '../cards';
import { RULES, MAX_LEVEL } from '../board';
import { rentFor } from '../rules';
import { newGame, rollAs, current } from './helpers';
import type { Command, GameState, CardEffect } from '../types';
const own = (s: GameState, tile: number, player = 'p1', level = 0) => {
  s.tiles[tile] = { owner: player, level: level as 0, mortgaged: false };
};
const card = (s: GameState, id: string) => {
  const c = CARDS.find((c) => c.id === id)!;
  s.decks[c.deck] = [id];
  s.players.p1.position = c.deck === 'destin' ? 0 : 5;
  return rollAs(s, 'p1', 1, 1);
};
const jailDebt = () => {
  const s = newGame(2);
  s.round = 3;
  own(s, 1);
  Object.assign(s.players.p1, {
    cash: 20,
    position: 10,
    inJail: true,
    jailAttempts: 2,
    jailFreeCards: 1,
  });
  s.phase = 'JAIL';
  s.pending = { type: 'JAIL_CHOICE', player: 'p1' };
  return rollAs(s, 'p1', 3, 5, 'ATTEMPT_JAIL_ROLL').state;
};
describe('regressions de partie', () => {
  it('annonce sur chaque carte les montants réellement configurés', () => {
    const amounts = (fx: CardEffect): number[] => {
      if (fx.k === 'multi') return fx.effects.flatMap(amounts);
      if (fx.k === 'repairs') return [fx.perHouse, fx.perHotel];
      if (['cash', 'cashToPot', 'cashPerProperty', 'collectFromEach', 'payEach'].includes(fx.k))
        return [Math.abs((fx as { amount: number }).amount)];
      return [];
    };
    for (const card of CARDS) {
      const printed = Array.from(card.text.matchAll(/(\d[\d ]*)\s*€/g), (match) =>
        Number(match[1].replace(/ /g, '')),
      );
      expect(printed, card.id).toEqual(amounts(card.effect));
    }
  });

  it('reprend le déplacement après financement de la caution obligatoire', () => {
    let s = jailDebt();
    expect(s.pending?.type).toBe('DEBT');
    s = applyCommand(s, { t: 'MORTGAGE', by: 'p1', tile: 1 }).state;
    const r = applyCommand(s, { t: 'SETTLE_DEBT', by: 'p1' });
    s = r.state;
    expect(r.rejected).toBeUndefined();
    expect(s.players.p1.inJail).toBe(false);
    expect(s.players.p1.position).toBe(18);
    expect(s.players.p1.cash).toBe(0);
    expect(s.pot).toBe(RULES.jailFine);
    expect(current(s)).toBe('p2');
  });
  it('ne permet pas à un laissez-passer d’effacer une dette déjà ouverte', () => {
    const s = jailDebt();
    const r = applyCommand(s, { t: 'USE_JAIL_CARD', by: 'p1' });
    expect(r.rejected).toBeTruthy();
    expect(r.state).toBe(s);
  });
  it('paie chaque participant une seule fois après une dette de carte', () => {
    const s = newGame(4);
    s.round = 3;
    s.players.p1.cash = 15;
    own(s, 1);
    const banquet = CARDS.find((c) => c.deck === 'destin' && c.effect.k === 'payEach')!;
    let result = card(s, banquet.id).state;
    expect(result.pending?.type).toBe('DEBT');
    result = applyCommand(result, { t: 'MORTGAGE', by: 'p1', tile: 1 }).state;
    result = applyCommand(result, { t: 'SETTLE_DEBT', by: 'p1' }).state;
    for (const id of ['p2', 'p3', 'p4'])
      expect(result.players[id].cash).toBe(s.players[id].cash + 10);
    expect(result.players.p1.cash).toBe(15 + 30 - 30);
    expect(current(result)).toBe('p1');
    expect(result.phase).toBe('ROLL_DICE');
  });
  it('conserve le loyer puis la taxe d’une carte composée qui ouvre deux dettes', () => {
    const s = newGame(3);
    s.round = 3;
    s.players.p1.cash = 5;
    s.players.p1.position = 34;
    own(s, 1);
    own(s, 3);
    own(s, 34, 'p2');
    const visa = CARDS.find(
      (c) =>
        c.effect.k === 'multi' &&
        c.effect.effects.some((e) => e.k === 'moveBy') &&
        c.effect.effects.some((e) => e.k === 'cashToPot'),
    )!;
    s.decks.destin = [visa.id];
    const rent = rentFor(s, 34, 2);
    let result = rollAs(s, 'p1', 1, 1).state;
    expect(result.pending).toMatchObject({ type: 'DEBT', debt: { creditor: 'p2', amount: rent } });
    result = applyCommand(result, { t: 'MORTGAGE', by: 'p1', tile: 1 }).state;
    result = applyCommand(result, { t: 'SETTLE_DEBT', by: 'p1' }).state;
    expect(result.pending).toMatchObject({ type: 'DEBT', debt: { creditor: null, amount: 10 } });
    result = applyCommand(result, { t: 'MORTGAGE', by: 'p1', tile: 3 }).state;
    result = applyCommand(result, { t: 'SETTLE_DEBT', by: 'p1' }).state;
    expect(result.players.p2.cash).toBe(s.players.p2.cash + rent);
    expect(result.pot).toBe(10);
    expect(result.pending).toBeNull();
    expect(current(result)).toBe('p1');
  });
  it('ouvre une vraie dette au joueur qui doit payer une carte à un autre', () => {
    const s = newGame(4);
    s.players.p2.cash = 5;
    const collection = CARDS.find((c) => c.deck === 'destin' && c.effect.k === 'collectFromEach')!;
    let result = card(s, collection.id).state;
    expect(result.pending).toMatchObject({
      type: 'DEBT',
      player: 'p2',
      debt: { amount: 15, creditor: 'p1' },
    });
    result = applyCommand(result, { t: 'DECLARE_BANKRUPTCY', by: 'p2' }).state;
    expect(result.players.p2.bankrupt).toBe(true);
    expect(result.players.p1.cash).toBe(s.players.p1.cash + 5 + 15 + 15);
    expect(result.players.p3.cash).toBe(s.players.p3.cash - 15);
    expect(result.players.p4.cash).toBe(s.players.p4.cash - 15);
    expect(current(result)).toBe('p1');
    expect(result.phase).toBe('ROLL_DICE');
  });
  it('facture les quatre maisons et les hôtels selon le barème de la carte', () => {
    const s = newGame(2);
    s.players.p1.cash = 50000;
    own(s, 1, 'p1', 4);
    own(s, 3, 'p1', 4);
    own(s, 37, 'p1', MAX_LEVEL);
    own(s, 39, 'p1', MAX_LEVEL);
    const repairs = CARDS.find((c) => c.deck === 'destin' && c.effect.k === 'repairs')!;
    const r = card(s, repairs.id).state;
    expect(r.players.p1.cash).toBe(50000 - 8 * 400 - 2 * 1200);
    expect(r.pot).toBe(8 * 400 + 2 * 1200);
  });
  it('revérifie les constructions lors de l’acceptation d’un échange', () => {
    let s = newGame(2);
    own(s, 1);
    own(s, 3);
    s = applyCommand(s, {
      t: 'PROPOSE_TRADE',
      by: 'p1',
      offer: { to: 'p2', giveTiles: [1], getTiles: [], giveCash: 0, getCash: 50 },
    }).state;
    const id = s.trades[0].id;
    s = applyCommand(s, { t: 'BUILD', by: 'p1', tile: 1 }).state;
    const r = applyCommand(s, { t: 'ACCEPT_TRADE', by: 'p2', id });
    expect(r.rejected).toBeTruthy();
    expect(r.state).toBe(s);
  });
  it('refuse les commandes inconnues et les indices hors du plateau sans planter', () => {
    const s = newGame(2);
    for (const cmd of [
      { t: 'UNKNOWN', by: 'p1' },
      { t: 'BUILD', by: 'p1', tile: 999 },
      { t: 'PROPOSE_TRADE', by: 'p1', offer: null },
    ] as unknown as Command[]) {
      const r = applyCommand(s, cmd);
      expect(r.rejected).toBeTruthy();
      expect(r.state).toBe(s);
    }
  });
  it('ne change plus les biens ni les liquidités après la fin de partie', () => {
    const s = newGame(2);
    own(s, 1);
    own(s, 3);
    s.phase = 'GAME_OVER';
    s.winner = 'p1';
    const r = applyCommand(s, { t: 'BUILD', by: 'p1', tile: 1 });
    expect(r.rejected).toBeTruthy();
    expect(r.state).toBe(s);
  });
});
