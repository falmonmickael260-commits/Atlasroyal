import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, GROUP_INDEX } from '../board';
import { liquidationValue, ownedBy } from '../rules';
import { runBotGame } from './bot';

/**
 * Parties complètes jouées par des pilotes autonomes, uniquement via des
 * commandes publiques. Un blocage du moteur lève une exception dans `bot.ts`.
 */
describe('parties complètes simulées', () => {
  it.each([2, 3, 4, 5, 6])('mène une partie à %i joueurs jusqu’à son terme', (n) => {
    const { s, steps, rejects } = runBotGame(`sim-${n}`, n);
    expect(s.phase).toBe('GAME_OVER');
    expect(s.winner).toBeTruthy();
    expect(s.order.filter((id) => !s.players[id].bankrupt)).toHaveLength(1);
    expect(steps).toBeLessThan(40_000);
    // Le pilote ne doit jamais avoir besoin de commandes illégales.
    expect(rejects).toBe(0);
  }, 60_000);

  it('conserve les invariants comptables sur 10 parties', () => {
    for (let k = 0; k < 10; k++) {
      const { s } = runBotGame(`inv-${k}`, 2 + (k % 5));
      for (const id of s.order) {
        const pl = s.players[id];
        expect(pl.cash, `${id} liquidités négatives`).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(pl.cash)).toBe(true);
        expect(pl.position).toBeGreaterThanOrEqual(0);
        expect(pl.position).toBeLessThan(BOARD_SIZE);
        if (pl.bankrupt) expect(ownedBy(s, id), 'un éliminé ne possède rien').toHaveLength(0);
      }
      expect(s.pot).toBeGreaterThanOrEqual(0);
      for (const [i, st] of Object.entries(s.tiles)) {
        if (st.owner) expect(s.players[st.owner].bankrupt, `case ${i} orpheline`).toBe(false);
      }
    }
  }, 120_000);

  it('produit des échanges, des groupes complets et des constructions', () => {
    const { s, trades } = runBotGame('rich', 4);
    expect(trades).toBeGreaterThan(0);
    const groups = Object.values(GROUP_INDEX)
      .filter((idx) => s.order.some((p) => idx.every((i) => s.tiles[i].owner === p)));
    expect(groups.length).toBeGreaterThan(0);
  }, 60_000);

  it('laisse le vainqueur solvable', () => {
    const { s } = runBotGame('solv', 3);
    expect(liquidationValue(s, s.winner!)).toBeGreaterThan(0);
  }, 60_000);
});
