import {
  BOARD_SIZE, GO_TILE, GROUP_INDEX, HUB_TILES, JAIL_TILE, RESEAU_TILES,
  RULES, isOwnable, tileAt,
} from './board';
import { CARDS_BY_ID, buildDeck } from './cards';
import { rollDie, seedFromString, shuffle } from './rng';
import {
  activePlayers, buildCostFor, canBuild, canMortgage, countOwnedIn, mortgageValue,
  ownedBy, ownsFullGroup, priceOf, rentFor, unmortgageCost,
} from './rules';
import type {
  BuildLevel, CardEffect, Command, CommandResult, Debt, GameEvent, GameState,
  PlayerId, TileIndex, TradeOffer,
} from './types';

const clone = <T>(v: T): T => structuredClone(v);

export interface SeatConfig {
  id: PlayerId; name: string; avatar: string; color: string; token: string;
}

export const createGame = (roomCode: string, seats: SeatConfig[], seedSalt = ''): GameState => {
  let rng = seedFromString(`${roomCode}:${seedSalt}:${seats.map((s) => s.id).join(',')}`);
  const [order, r1] = shuffle(seats.map((s) => s.id), rng);
  rng = r1;
  const [destin, r2] = shuffle(buildDeck('destin'), rng);
  rng = r2;
  const [marche, r3] = shuffle(buildDeck('marche'), rng);
  rng = r3;

  return {
    roomCode,
    phase: 'GAME_START',
    rng,
    order,
    players: Object.fromEntries(seats.map((s) => [s.id, {
      ...s,
      cash: RULES.startingCash,
      position: 0,
      inJail: false,
      jailAttempts: 0,
      jailFreeCards: 0,
      bankrupt: false,
      connected: true,
      purchaseDiscount: 0,
      roundsPlayed: 0,
    }])),
    tiles: Object.fromEntries(
      Array.from({ length: BOARD_SIZE }, (_, i) => [i, { owner: null, level: 0 as BuildLevel, mortgaged: false }]),
    ),
    currentIndex: 0,
    round: 1,
    doubles: 0,
    lastRoll: null,
    pot: 0,
    decks: { destin, marche },
    discard: { destin: [], marche: [] },
    pending: null,
    trades: [],
    winner: null,
    version: 0,
    startedAt: Date.now(),
  };
};

/* ------------------------------------------------------------------ */
/* Primitives internes — mutent un brouillon, empilent des évènements  */
/* ------------------------------------------------------------------ */

type Ctx = { s: GameState; ev: GameEvent[] };

const current = (s: GameState): PlayerId => s.order[s.currentIndex];

const setPhase = (c: Ctx, phase: GameState['phase']) => {
  c.s.phase = phase;
  c.ev.push({ e: 'PHASE', phase });
};

const credit = (c: Ctx, p: PlayerId, amount: number, reason: string) => {
  if (amount <= 0) return;
  c.s.players[p].cash += amount;
  c.ev.push({ e: 'CASH_CHANGED', player: p, delta: amount, cash: c.s.players[p].cash, reason });
};

const addToPot = (c: Ctx, amount: number) => {
  c.s.pot += amount;
  c.ev.push({ e: 'POT_CHANGED', pot: c.s.pot });
};

/**
 * Tente un débit. Si le joueur n'a pas les liquidités, ouvre une dette
 * (phase DEBT_RESOLUTION) et renvoie `false` : l'appelant doit s'arrêter là.
 */
const debit = (
  c: Ctx, from: PlayerId, to: PlayerId | null, amount: number, reason: string, toPot = false,
): boolean => {
  if (amount <= 0) return true;
  const player = c.s.players[from];
  if (player.cash < amount) {
    const debt: Debt = { debtor: from, creditor: to, amount, toPot };
    c.s.pending = { type: 'DEBT', player: from, debt };
    setPhase(c, 'DEBT_RESOLUTION');
    c.ev.push({ e: 'DEBT_OPENED', debt });
    return false;
  }
  player.cash -= amount;
  c.ev.push({ e: 'CASH_CHANGED', player: from, delta: -amount, cash: player.cash, reason });
  if (to) credit(c, to, amount, reason);
  else if (toPot) addToPot(c, amount);
  return true;
};

const sendToJail = (c: Ctx, p: PlayerId, reason: 'doubles' | 'card' | 'tile') => {
  const pl = c.s.players[p];
  pl.position = JAIL_TILE;
  pl.inJail = true;
  pl.jailAttempts = 0;
  c.s.doubles = 0;
  c.ev.push({ e: 'JAILED', player: p, reason });
};

/** Déplacement case par case : chaque pas est un évènement à animer. */
const movePlayer = (c: Ctx, p: PlayerId, steps: number, collectGo = true) => {
  const pl = c.s.players[p];
  setPhase(c, 'MOVING');
  const dir = steps >= 0 ? 1 : -1;
  let wrapped = false;
  for (let n = 1; n <= Math.abs(steps); n++) {
    const from = pl.position;
    const to = (from + dir + BOARD_SIZE) % BOARD_SIZE;
    pl.position = to;
    if (dir === 1 && to === GO_TILE) wrapped = true;
    c.ev.push({ e: 'MOVE_STEP', player: p, from, to, step: n, total: Math.abs(steps) });
  }
  if (collectGo && dir === 1) {
    if (pl.position === GO_TILE) {
      credit(c, p, RULES.exactGo, 'Départ exact');
      c.ev.push({ e: 'EXACT_GO', player: p, amount: RULES.exactGo });
    } else if (wrapped) {
      credit(c, p, RULES.passGo, 'Passage Départ');
      c.ev.push({ e: 'PASSED_GO', player: p, amount: RULES.passGo });
    }
  }
};

/** Téléportation contrôlée (cartes) : on anime quand même le trajet. */
const moveTo = (c: Ctx, p: PlayerId, target: TileIndex, collectGo: boolean) => {
  const pos = c.s.players[p].position;
  const steps = (target - pos + BOARD_SIZE) % BOARD_SIZE;
  if (steps === 0) return;
  movePlayer(c, p, steps, collectGo);
};

/**
 * Somme du dernier lancer. Les réseaux facturent un multiple des dés : un
 * déplacement provoqué par une carte doit donc s'appuyer sur le lancer du
 * tour, sinon le loyer tomberait à zéro et la case serait gratuite.
 */
const lastSum = (s: GameState): number =>
  s.lastRoll ? s.lastRoll[0] + s.lastRoll[1] : 7;

const nearestOf = (from: TileIndex, list: readonly TileIndex[]): TileIndex => {
  let best = list[0];
  let bestD = BOARD_SIZE + 1;
  for (const i of list) {
    const d = (i - from + BOARD_SIZE) % BOARD_SIZE;
    if (d > 0 && d < bestD) { bestD = d; best = i; }
  }
  return best;
};

/* ------------------------------------------------------------------ */
/* Cartes                                                              */
/* ------------------------------------------------------------------ */

const drawCard = (c: Ctx, p: PlayerId, deck: 'destin' | 'marche') => {
  if (c.s.decks[deck].length === 0) {
    const [re, r] = shuffle(c.s.discard[deck], c.s.rng);
    c.s.rng = r;
    c.s.decks[deck] = re;
    c.s.discard[deck] = [];
  }
  const id = c.s.decks[deck].shift();
  if (!id) return;
  c.s.discard[deck].push(id);
  setPhase(c, 'CARD_EVENT');
  c.ev.push({ e: 'CARD_DRAWN', player: p, deck, card: id });
  applyEffect(c, p, CARDS_BY_ID[id].effect);
};

/** Interprète un effet de carte. Renvoie false si une dette a interrompu la chaîne. */
const applyEffect = (c: Ctx, p: PlayerId, fx: CardEffect): boolean => {
  const others = activePlayers(c.s).filter((o) => o !== p);
  switch (fx.k) {
    case 'cash':
      if (fx.amount >= 0) credit(c, p, fx.amount, 'Carte');
      else return debit(c, p, null, -fx.amount, 'Carte', true);
      return true;
    case 'cashToPot':
      return debit(c, p, null, fx.amount, 'Carte', true);
    case 'collectFromEach': {
      for (const o of others) {
        // Un débiteur insolvable ouvre sa propre dette : on la traite au tour suivant.
        if (c.s.players[o].cash >= fx.amount) {
          c.s.players[o].cash -= fx.amount;
          c.ev.push({ e: 'CASH_CHANGED', player: o, delta: -fx.amount, cash: c.s.players[o].cash, reason: 'Carte' });
          credit(c, p, fx.amount, 'Carte');
        } else {
          const all = c.s.players[o].cash;
          c.s.players[o].cash = 0;
          c.ev.push({ e: 'CASH_CHANGED', player: o, delta: -all, cash: 0, reason: 'Carte' });
          credit(c, p, all, 'Carte');
        }
      }
      return true;
    }
    case 'payEach': {
      for (const o of others) {
        if (!debit(c, p, o, fx.amount, 'Carte')) return false;
      }
      return true;
    }
    case 'moveTo':
      moveTo(c, p, fx.tile, fx.collectGo);
      resolveLanding(c, p, lastSum(c.s));
      return true;
    case 'moveBy':
      movePlayer(c, p, fx.steps, fx.steps > 0);
      resolveLanding(c, p, lastSum(c.s));
      return true;
    case 'moveToNearest': {
      const list = fx.target === 'hub' ? HUB_TILES : RESEAU_TILES;
      moveTo(c, p, nearestOf(c.s.players[p].position, list), true);
      resolveLanding(c, p, lastSum(c.s));
      return true;
    }
    case 'goToJail':
      sendToJail(c, p, 'card');
      return true;
    case 'jailFree':
      c.s.players[p].jailFreeCards += 1;
      return true;
    case 'repairs': {
      let total = 0;
      for (const i of ownedBy(c.s, p)) {
        const lvl = c.s.tiles[i].level;
        if (lvl === 1) total += fx.perHouse;
        if (lvl === 2) total += fx.perVilla;
        if (lvl === 3) total += fx.perHotel;
      }
      return total === 0 ? true : debit(c, p, null, total, 'Travaux', true);
    }
    case 'takePot': {
      const amount = c.s.pot;
      c.s.pot = 0;
      c.ev.push({ e: 'POT_CHANGED', pot: 0 });
      if (amount > 0) {
        credit(c, p, amount, 'Cagnotte');
        c.ev.push({ e: 'POT_WON', player: p, amount });
      }
      return true;
    }
    case 'cashPerProperty': {
      const n = ownedBy(c.s, p).length;
      const total = Math.abs(fx.amount) * n;
      if (total === 0) return true;
      if (fx.amount >= 0) { credit(c, p, total, 'Patrimoine'); return true; }
      return debit(c, p, null, total, 'Patrimoine', true);
    }
    case 'discountNextPurchase':
      c.s.players[p].purchaseDiscount = fx.percent;
      return true;
    case 'multi': {
      for (const sub of fx.effects) if (!applyEffect(c, p, sub)) return false;
      return true;
    }
  }
};

/* ------------------------------------------------------------------ */
/* Arrivée sur une case                                                */
/* ------------------------------------------------------------------ */

const resolveLanding = (c: Ctx, p: PlayerId, diceSum: number) => {
  // Une dette ouverte gèle la résolution jusqu'à règlement.
  if (c.s.phase === 'DEBT_RESOLUTION') return;
  const pos = c.s.players[p].position;
  const t = tileAt(pos);
  setPhase(c, 'LANDING');
  c.ev.push({ e: 'LANDED', player: p, tile: pos });

  switch (t.kind) {
    case 'card':
      drawCard(c, p, t.deck);
      return;
    case 'tax':
      if (debit(c, p, null, t.amount, t.name, true)) {
        c.ev.push({ e: 'TAX_PAID', player: p, amount: t.amount, tile: pos });
      }
      return;
    case 'gotoprison':
      sendToJail(c, p, 'tile');
      return;
    case 'parc': {
      const amount = c.s.pot;
      c.s.pot = 0;
      c.ev.push({ e: 'POT_CHANGED', pot: 0 });
      if (amount > 0) {
        credit(c, p, amount, 'Parc Gratuit');
        c.ev.push({ e: 'POT_WON', player: p, amount });
      } else {
        c.ev.push({ e: 'POT_WON', player: p, amount: 0 });
      }
      return;
    }
    case 'depart':
    case 'prison':
      return;
    default:
      break;
  }

  if (!isOwnable(t)) return;
  const st = c.s.tiles[pos];

  if (st.owner && st.owner !== p) {
    const rent = rentFor(c.s, pos, diceSum);
    if (rent > 0 && debit(c, p, st.owner, rent, 'Loyer')) {
      c.ev.push({ e: 'RENT_PAID', from: p, to: st.owner, amount: rent, tile: pos });
    }
    return;
  }

  if (!st.owner) {
    // Règle du premier tour : rien n'est à vendre tant que le tour 1 n'est pas bouclé.
    if (c.s.round < RULES.purchasesFromRound) return;
    const price = discountedPrice(c.s, p, pos);
    if (c.s.players[p].cash < price) return;
    c.s.pending = { type: 'PROPERTY_DECISION', player: p, tile: pos, price };
    setPhase(c, 'PROPERTY_DECISION');
    c.ev.push({ e: 'PROPERTY_OFFERED', player: p, tile: pos, price });
  }
};

const discountedPrice = (s: GameState, p: PlayerId, tile: TileIndex): number => {
  const d = s.players[p].purchaseDiscount;
  return Math.round(priceOf(tile) * (1 - d / 100));
};

/* ------------------------------------------------------------------ */
/* Enchaînement des tours                                              */
/* ------------------------------------------------------------------ */

const checkVictory = (c: Ctx): boolean => {
  const alive = activePlayers(c.s);
  if (alive.length <= 1 && c.s.order.length > 1) {
    c.s.winner = alive[0] ?? null;
    setPhase(c, 'GAME_OVER');
    if (c.s.winner) c.ev.push({ e: 'GAME_OVER', winner: c.s.winner });
    return true;
  }
  return false;
};

const beginTurn = (c: Ctx) => {
  const p = current(c.s);
  c.s.doubles = 0;
  c.s.pending = null;
  c.ev.push({ e: 'TURN_STARTED', player: p, round: c.s.round });
  if (c.s.players[p].inJail) {
    c.s.pending = { type: 'JAIL_CHOICE', player: p };
    setPhase(c, 'JAIL');
  } else {
    setPhase(c, 'ROLL_DICE');
  }
};

const advanceTurn = (c: Ctx) => {
  if (checkVictory(c)) return;
  const n = c.s.order.length;
  for (let k = 1; k <= n; k++) {
    const idx = (c.s.currentIndex + k) % n;
    if (!c.s.players[c.s.order[idx]].bankrupt) {
      // Un passage par le début de l'ordre ferme le tour de table.
      if (idx <= c.s.currentIndex) {
        c.s.round += 1;
      }
      c.s.currentIndex = idx;
      c.s.players[c.s.order[idx]].roundsPlayed += 1;
      break;
    }
  }
  beginTurn(c);
};

/**
 * Fin de séquence : soit le joueur rejoue (double), soit on passe la main.
 * Ne fait rien tant qu'une décision est en attente.
 */
const finishTurnStep = (c: Ctx) => {
  if (c.s.pending) return;
  if (c.s.phase === 'GAME_OVER' || c.s.phase === 'DEBT_RESOLUTION') return;
  const p = current(c.s);
  if (c.s.doubles > 0 && !c.s.players[p].inJail && !c.s.players[p].bankrupt) {
    setPhase(c, 'ROLL_DICE');
    return;
  }
  setPhase(c, 'NEXT_PLAYER');
  advanceTurn(c);
};

/* ------------------------------------------------------------------ */
/* Faillite                                                            */
/* ------------------------------------------------------------------ */

const goBankrupt = (c: Ctx, p: PlayerId, creditor: PlayerId | null) => {
  const tiles = ownedBy(c.s, p);
  const pl = c.s.players[p];
  for (const i of tiles) {
    if (creditor) {
      c.s.tiles[i].owner = creditor;
      // Les constructions et l'hypothèque suivent la propriété.
    } else {
      c.s.tiles[i] = { owner: null, level: 0, mortgaged: false };
    }
  }
  if (pl.cash > 0) {
    if (creditor) credit(c, creditor, pl.cash, 'Faillite');
    else addToPot(c, pl.cash);
  }
  pl.cash = 0;
  pl.bankrupt = true;
  pl.inJail = false;
  c.s.pending = null;
  c.s.trades = c.s.trades.filter((t) => t.from !== p && t.to !== p);
  c.ev.push({ e: 'BANKRUPT', player: p, creditor, tiles });
  setPhase(c, 'BANKRUPTCY');
  if (checkVictory(c)) return;
  if (current(c.s) === p) {
    c.s.doubles = 0;
    setPhase(c, 'NEXT_PLAYER');
    advanceTurn(c);
  }
};

/* ------------------------------------------------------------------ */
/* Commandes                                                           */
/* ------------------------------------------------------------------ */

const reject = (state: GameState, why: string): CommandResult =>
  ({ state, events: [], rejected: why });

export const applyCommand = (prev: GameState, cmd: Command): CommandResult => {
  const s = clone(prev);
  const c: Ctx = { s, ev: [] };
  const actor = s.players[cmd.by];

  if (!actor && cmd.t !== 'START_GAME') return reject(prev, 'Joueur inconnu.');
  if (actor?.bankrupt && cmd.t !== 'SET_CONNECTED') return reject(prev, 'Joueur éliminé.');

  /** Les commandes de tour exigent d'être le joueur courant. */
  const isCurrent = current(s) === cmd.by;

  switch (cmd.t) {
    case 'START_GAME': {
      if (s.phase !== 'GAME_START') return reject(prev, 'Partie déjà lancée.');
      c.ev.push({ e: 'GAME_STARTED', order: s.order });
      s.players[s.order[0]].roundsPlayed = 1;
      beginTurn(c);
      break;
    }

    case 'ROLL_DICE': {
      if (!isCurrent) return reject(prev, 'Ce n’est pas votre tour.');
      if (s.phase !== 'ROLL_DICE') return reject(prev, 'Lancer impossible dans cette phase.');
      const [d1, r1] = rollDie(s.rng);
      const [d2, r2] = rollDie(r1);
      s.rng = r2;
      const dice: [number, number] = [d1, d2];
      s.lastRoll = dice;
      const isDouble = d1 === d2;
      s.doubles = isDouble ? s.doubles + 1 : 0;
      setPhase(c, 'DICE_RESULT');
      c.ev.push({ e: 'DICE_ROLLED', player: cmd.by, dice, isDouble, doublesStreak: s.doubles });

      if (s.doubles >= 3) {
        c.ev.push({ e: 'THREE_DOUBLES', player: cmd.by });
        sendToJail(c, cmd.by, 'doubles');
        setPhase(c, 'NEXT_PLAYER');
        advanceTurn(c);
        break;
      }
      movePlayer(c, cmd.by, d1 + d2);
      resolveLanding(c, cmd.by, d1 + d2);
      finishTurnStep(c);
      break;
    }

    case 'BUY_PROPERTY': {
      const pend = s.pending;
      if (!pend || pend.type !== 'PROPERTY_DECISION' || pend.player !== cmd.by) {
        return reject(prev, 'Aucune acquisition en attente.');
      }
      if (actor.cash < pend.price) return reject(prev, 'Fonds insuffisants.');
      actor.cash -= pend.price;
      actor.purchaseDiscount = 0;
      s.tiles[pend.tile].owner = cmd.by;
      c.ev.push({ e: 'CASH_CHANGED', player: cmd.by, delta: -pend.price, cash: actor.cash, reason: 'Acquisition' });
      c.ev.push({ e: 'PROPERTY_BOUGHT', player: cmd.by, tile: pend.tile, price: pend.price });
      s.pending = null;
      finishTurnStep(c);
      break;
    }

    case 'DECLINE_PROPERTY': {
      const pend = s.pending;
      if (!pend || pend.type !== 'PROPERTY_DECISION' || pend.player !== cmd.by) {
        return reject(prev, 'Aucune acquisition en attente.');
      }
      c.ev.push({ e: 'PROPERTY_DECLINED', player: cmd.by, tile: pend.tile });
      s.pending = null;
      finishTurnStep(c);
      break;
    }

    case 'BUILD': {
      const why = canBuild(s, cmd.by, cmd.tile);
      if (why) return reject(prev, why);
      const cost = buildCostFor(cmd.tile);
      actor.cash -= cost;
      const lvl = (s.tiles[cmd.tile].level + 1) as BuildLevel;
      s.tiles[cmd.tile].level = lvl;
      c.ev.push({ e: 'CASH_CHANGED', player: cmd.by, delta: -cost, cash: actor.cash, reason: 'Construction' });
      c.ev.push({ e: 'BUILT', player: cmd.by, tile: cmd.tile, level: lvl, cost });
      break;
    }

    case 'SELL_BUILDING': {
      const st = s.tiles[cmd.tile];
      if (!st || st.owner !== cmd.by) return reject(prev, 'Propriété inconnue.');
      if (st.level === 0) return reject(prev, 'Rien à revendre.');
      const t = tileAt(cmd.tile);
      if (t.kind === 'city') {
        // Symétrique de canBuild : on ne descend pas sous le niveau du groupe.
        const max = Math.max(...GROUP_INDEX[t.group].map((i) => s.tiles[i].level));
        if (st.level < max) return reject(prev, 'Revendez d’abord les niveaux supérieurs du groupe.');
      }
      const refund = Math.round(buildCostFor(cmd.tile) * RULES.sellBuildingRate);
      const lvl = (st.level - 1) as BuildLevel;
      st.level = lvl;
      credit(c, cmd.by, refund, 'Revente');
      c.ev.push({ e: 'BUILDING_SOLD', player: cmd.by, tile: cmd.tile, level: lvl, refund });
      break;
    }

    case 'MORTGAGE': {
      const why = canMortgage(s, cmd.by, cmd.tile);
      if (why) return reject(prev, why);
      const amount = mortgageValue(cmd.tile);
      s.tiles[cmd.tile].mortgaged = true;
      credit(c, cmd.by, amount, 'Hypothèque');
      c.ev.push({ e: 'MORTGAGED', player: cmd.by, tile: cmd.tile, amount });
      break;
    }

    case 'UNMORTGAGE': {
      const st = s.tiles[cmd.tile];
      if (!st || st.owner !== cmd.by) return reject(prev, 'Propriété inconnue.');
      if (!st.mortgaged) return reject(prev, 'Cette propriété n’est pas hypothéquée.');
      const cost = unmortgageCost(cmd.tile);
      if (actor.cash < cost) return reject(prev, 'Fonds insuffisants.');
      actor.cash -= cost;
      st.mortgaged = false;
      c.ev.push({ e: 'CASH_CHANGED', player: cmd.by, delta: -cost, cash: actor.cash, reason: 'Levée d’hypothèque' });
      c.ev.push({ e: 'UNMORTGAGED', player: cmd.by, tile: cmd.tile, amount: cost });
      break;
    }

    case 'PAY_JAIL_FINE': {
      if (!isCurrent || !actor.inJail) return reject(prev, 'Vous n’êtes pas en prison.');
      if (s.phase !== 'JAIL') return reject(prev, 'Phase invalide.');
      if (actor.cash < RULES.jailFine) return reject(prev, 'Fonds insuffisants.');
      actor.cash -= RULES.jailFine;
      addToPot(c, RULES.jailFine);
      c.ev.push({ e: 'CASH_CHANGED', player: cmd.by, delta: -RULES.jailFine, cash: actor.cash, reason: 'Caution' });
      actor.inJail = false;
      actor.jailAttempts = 0;
      s.pending = null;
      c.ev.push({ e: 'JAIL_RELEASED', player: cmd.by, reason: 'fine' });
      setPhase(c, 'ROLL_DICE');
      break;
    }

    case 'USE_JAIL_CARD': {
      if (!isCurrent || !actor.inJail) return reject(prev, 'Vous n’êtes pas en prison.');
      if (actor.jailFreeCards < 1) return reject(prev, 'Aucun laissez-passer.');
      actor.jailFreeCards -= 1;
      actor.inJail = false;
      actor.jailAttempts = 0;
      s.pending = null;
      c.ev.push({ e: 'JAIL_RELEASED', player: cmd.by, reason: 'card' });
      setPhase(c, 'ROLL_DICE');
      break;
    }

    case 'ATTEMPT_JAIL_ROLL': {
      if (!isCurrent || !actor.inJail) return reject(prev, 'Vous n’êtes pas en prison.');
      if (s.phase !== 'JAIL') return reject(prev, 'Phase invalide.');
      const [d1, r1] = rollDie(s.rng);
      const [d2, r2] = rollDie(r1);
      s.rng = r2;
      const dice: [number, number] = [d1, d2];
      s.lastRoll = dice;
      actor.jailAttempts += 1;
      const success = d1 === d2;
      c.ev.push({ e: 'JAIL_ATTEMPT', player: cmd.by, attempt: actor.jailAttempts, dice, success });

      if (success) {
        actor.inJail = false;
        actor.jailAttempts = 0;
        s.pending = null;
        c.ev.push({ e: 'JAIL_RELEASED', player: cmd.by, reason: 'double' });
        // Sortie sur double : on avance, mais sans droit de rejouer.
        movePlayer(c, cmd.by, d1 + d2);
        resolveLanding(c, cmd.by, d1 + d2);
        s.doubles = 0;
        finishTurnStep(c);
        break;
      }

      if (actor.jailAttempts >= RULES.jailMaxAttempts) {
        // Troisième échec : la caution devient obligatoire.
        s.pending = null;
        if (!debit(c, cmd.by, null, RULES.jailFine, 'Caution obligatoire', true)) break;
        actor.inJail = false;
        actor.jailAttempts = 0;
        c.ev.push({ e: 'JAIL_RELEASED', player: cmd.by, reason: 'fine' });
        movePlayer(c, cmd.by, d1 + d2);
        resolveLanding(c, cmd.by, d1 + d2);
        s.doubles = 0;
        finishTurnStep(c);
        break;
      }
      // Tentative ratée, la main passe.
      s.pending = null;
      setPhase(c, 'NEXT_PLAYER');
      advanceTurn(c);
      break;
    }

    case 'PROPOSE_TRADE': {
      const o = cmd.offer;
      if (!s.players[o.to] || s.players[o.to].bankrupt) return reject(prev, 'Destinataire invalide.');
      if (o.to === cmd.by) return reject(prev, 'Échange avec soi-même impossible.');
      if (o.giveTiles.some((i) => s.tiles[i].owner !== cmd.by)) return reject(prev, 'Vous ne possédez pas ces propriétés.');
      if (o.getTiles.some((i) => s.tiles[i].owner !== o.to)) return reject(prev, 'Propriétés adverses invalides.');
      if ([...o.giveTiles, ...o.getTiles].some((i) => s.tiles[i].level > 0)) {
        return reject(prev, 'Revendez les constructions avant d’échanger.');
      }
      if (o.giveCash > actor.cash) return reject(prev, 'Fonds insuffisants.');
      const offer: TradeOffer = { ...o, id: `t${s.version}_${s.trades.length}`, from: cmd.by };
      s.trades.push(offer);
      c.ev.push({ e: 'TRADE_PROPOSED', offer });
      break;
    }

    case 'ACCEPT_TRADE': {
      const offer = s.trades.find((t) => t.id === cmd.id);
      if (!offer) return reject(prev, 'Offre introuvable.');
      if (offer.to !== cmd.by) return reject(prev, 'Cette offre ne vous est pas destinée.');
      const from = s.players[offer.from];
      if (offer.giveTiles.some((i) => s.tiles[i].owner !== offer.from)
        || offer.getTiles.some((i) => s.tiles[i].owner !== offer.to)) {
        s.trades = s.trades.filter((t) => t.id !== cmd.id);
        return reject(prev, 'Offre périmée.');
      }
      if (from.cash < offer.giveCash || actor.cash < offer.getCash) {
        return reject(prev, 'Fonds insuffisants pour honorer l’échange.');
      }
      for (const i of offer.giveTiles) s.tiles[i].owner = offer.to;
      for (const i of offer.getTiles) s.tiles[i].owner = offer.from;
      if (offer.giveCash > 0) {
        from.cash -= offer.giveCash;
        credit(c, offer.to, offer.giveCash, 'Échange');
        c.ev.push({ e: 'CASH_CHANGED', player: offer.from, delta: -offer.giveCash, cash: from.cash, reason: 'Échange' });
      }
      if (offer.getCash > 0) {
        actor.cash -= offer.getCash;
        credit(c, offer.from, offer.getCash, 'Échange');
        c.ev.push({ e: 'CASH_CHANGED', player: offer.to, delta: -offer.getCash, cash: actor.cash, reason: 'Échange' });
      }
      s.trades = s.trades.filter((t) => t.id !== cmd.id);
      c.ev.push({ e: 'TRADE_ACCEPTED', offer });
      break;
    }

    case 'DECLINE_TRADE': {
      const offer = s.trades.find((t) => t.id === cmd.id);
      if (!offer) return reject(prev, 'Offre introuvable.');
      if (offer.to !== cmd.by && offer.from !== cmd.by) return reject(prev, 'Offre tierce.');
      s.trades = s.trades.filter((t) => t.id !== cmd.id);
      c.ev.push({ e: 'TRADE_DECLINED', id: cmd.id });
      break;
    }

    case 'SETTLE_DEBT': {
      const pend = s.pending;
      if (!pend || pend.type !== 'DEBT' || pend.player !== cmd.by) return reject(prev, 'Aucune dette.');
      const { debt } = pend;
      if (actor.cash < debt.amount) return reject(prev, 'Fonds encore insuffisants.');
      actor.cash -= debt.amount;
      c.ev.push({ e: 'CASH_CHANGED', player: cmd.by, delta: -debt.amount, cash: actor.cash, reason: 'Règlement' });
      if (debt.creditor) credit(c, debt.creditor, debt.amount, 'Règlement');
      else if (debt.toPot) addToPot(c, debt.amount);
      s.pending = null;
      c.ev.push({ e: 'DEBT_SETTLED', debtor: cmd.by });
      if (current(s) === cmd.by) {
        setPhase(c, 'LANDING');
        finishTurnStep(c);
      } else {
        setPhase(c, s.players[current(s)].inJail ? 'JAIL' : 'ROLL_DICE');
      }
      break;
    }

    case 'DECLARE_BANKRUPTCY': {
      const pend = s.pending;
      if (!pend || pend.type !== 'DEBT' || pend.player !== cmd.by) return reject(prev, 'Aucune dette.');
      goBankrupt(c, cmd.by, pend.debt.creditor);
      break;
    }

    case 'END_TURN': {
      if (!isCurrent) return reject(prev, 'Ce n’est pas votre tour.');
      if (s.pending) return reject(prev, 'Décision en attente.');
      if (s.phase === 'ROLL_DICE' || s.phase === 'JAIL') return reject(prev, 'Vous devez d’abord jouer.');
      s.doubles = 0;
      setPhase(c, 'NEXT_PLAYER');
      advanceTurn(c);
      break;
    }

    case 'SET_CONNECTED': {
      actor.connected = cmd.connected;
      break;
    }
  }

  s.version = prev.version + 1;
  return { state: s, events: c.ev };
};

/* Réexports pratiques pour l'UI. */
export { ownsFullGroup, countOwnedIn, rentFor, ownedBy, priceOf, unmortgageCost, mortgageValue };
