import { applyCommand, createGame } from '../engine';
import { GROUP_INDEX, tileAt } from '../board';
import { canBuild, canMortgage, ownedBy, priceOf, unmortgageCost } from '../rules';
import { SEATS } from './helpers';
import type { Command, GameState, PlayerId, TileIndex } from '../types';

/**
 * Pilote autonome utilisé par les tests : ne passe que par des commandes
 * publiques, exactement comme un client. Sert à la fois de test anti-blocage
 * et de vérification que la partie converge vers un vainqueur.
 */
export interface BotResult {
  s: GameState;
  steps: number;
  rejects: number;
  trades: number;
  /** Commandes refusées, pour diagnostiquer un écart règles/garde-fous. */
  rejections: string[];
}

const valueOf = (s: GameState, i: TileIndex): number =>
  priceOf(i) * (s.tiles[i].mortgaged ? 0.5 : 1);

/** Groupes où le joueur possède exactement 2 villes sur 3. */
const nearGroups = (s: GameState, p: PlayerId) =>
  (Object.keys(GROUP_INDEX) as (keyof typeof GROUP_INDEX)[])
    .map((g) => ({ g, idx: GROUP_INDEX[g] }))
    .filter(({ idx }) => idx.filter((i) => s.tiles[i].owner === p).length === 2)
    .map(({ idx }) => ({ mine: idx.filter((i) => s.tiles[i].owner === p), missing: idx.find((i) => s.tiles[i].owner !== p)! }));

const ownsFull = (s: GameState, p: PlayerId, i: TileIndex) => {
  const t = tileAt(i);
  return t.kind === 'city' && GROUP_INDEX[t.group].every((k) => s.tiles[k].owner === p);
};

export const runBotGame = (seed: string, seats: number, maxSteps = 40_000): BotResult => {
  let s: GameState = createGame('SIM', SEATS(seats), seed);
  s = applyCommand(s, { t: 'START_GAME', by: s.order[0] }).state;
  let steps = 0; let rejects = 0; let trades = 0;
  const rejections: string[] = [];

  const send = (cmd: Command): boolean => {
    const r = applyCommand(s, cmd);
    if (r.rejected) { rejects++; rejections.push(`${cmd.t}: ${r.rejected}`); return false; }
    s = r.state;
    return true;
  };

  /** Cherche un échange qui complète un groupe et le propose. */
  const tryTrade = (me: PlayerId) => {
    if (s.trades.length > 0) return;
    for (const { missing } of nearGroups(s, me)) {
      const holder = s.tiles[missing].owner;
      if (!holder || holder === me || s.tiles[missing].level > 0) continue;
      if (ownsFull(s, holder, missing)) continue;
      const price = priceOf(missing);
      const offerCash = Math.round(price * 1.6);
      if (s.players[me].cash < offerCash + 3_000) continue;
      // Contrepartie : une ville isolée, sans valeur stratégique pour moi.
      const spare = ownedBy(s, me).find((i) =>
        s.tiles[i].level === 0 && !ownsFull(s, me, i)
        && !nearGroups(s, me).some((n) => n.mine.includes(i)));
      const offer = {
        to: holder,
        giveTiles: spare !== undefined ? [spare] : [],
        giveCash: offerCash,
        getTiles: [missing],
        getCash: 0,
      };
      if (send({ t: 'PROPOSE_TRADE', by: me, offer })) return;
    }
  };

  /** Réponse aux offres reçues : accepte si l'opération est nettement favorable. */
  const answerTrades = () => {
    for (const o of [...s.trades]) {
      const gain = o.giveCash + o.giveTiles.reduce((a, i) => a + valueOf(s, i), 0);
      const loss = o.getCash + o.getTiles.reduce((a, i) => a + valueOf(s, i), 0);
      const breaksGroup = o.getTiles.some((i) => ownsFull(s, o.to, i));
      send(gain > loss * 1.25 && !breaksGroup
        ? { t: 'ACCEPT_TRADE', by: o.to, id: o.id }
        : { t: 'DECLINE_TRADE', by: o.to, id: o.id });
      trades++;
    }
  };

  while (s.phase !== 'GAME_OVER' && steps < maxSteps) {
    steps++;
    const me = s.order[s.currentIndex];
    const p = s.players[me];
    const pend = s.pending;

    if (pend?.type === 'DEBT') {
      const d = pend.player;
      const need = () => s.players[d].cash >= pend.debt.amount;
      // La revente doit partir du niveau le plus haut : le groupe reste homogène.
      const byLevelDesc = () => ownedBy(s, d).sort((a, b) => s.tiles[b].level - s.tiles[a].level);
      for (const i of byLevelDesc()) { if (need()) break; if (s.tiles[i].level > 0) send({ t: 'SELL_BUILDING', by: d, tile: i }); }
      for (const i of ownedBy(s, d)) { if (need()) break; if (!canMortgage(s, d, i)) send({ t: 'MORTGAGE', by: d, tile: i }); }
      send(need() ? { t: 'SETTLE_DEBT', by: d } : { t: 'DECLARE_BANKRUPTCY', by: d });
      continue;
    }

    if (pend?.type === 'PROPERTY_DECISION') {
      send(s.players[pend.player].cash - pend.price > 2_000
        ? { t: 'BUY_PROPERTY', by: pend.player }
        : { t: 'DECLINE_PROPERTY', by: pend.player });
      continue;
    }

    if (s.phase === 'JAIL') {
      if (p.jailFreeCards > 0) send({ t: 'USE_JAIL_CARD', by: me });
      else if (p.cash > 500) send({ t: 'PAY_JAIL_FINE', by: me });
      else send({ t: 'ATTEMPT_JAIL_ROLL', by: me });
      continue;
    }

    if (s.phase === 'ROLL_DICE') {
      answerTrades();
      tryTrade(me);
      answerTrades();
      for (const i of ownedBy(s, me)) {
        if (s.tiles[i].mortgaged && s.players[me].cash > unmortgageCost(i) * 3) {
          send({ t: 'UNMORTGAGE', by: me, tile: i });
        }
      }
      for (const i of ownedBy(s, me)) {
        if (!canBuild(s, me, i) && s.players[me].cash > 5_000) send({ t: 'BUILD', by: me, tile: i });
      }
      send({ t: 'ROLL_DICE', by: me });
      continue;
    }

    if (!send({ t: 'END_TURN', by: me })) {
      throw new Error(`Blocage en phase ${s.phase} (pending=${JSON.stringify(s.pending)})`);
    }
  }
  return { s, steps, rejects, trades, rejections };
};
