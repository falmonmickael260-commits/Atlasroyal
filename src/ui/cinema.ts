import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoom } from '../net/room';
import { audio } from '../audio/audio';
import { PLACEMENTS } from '../board3d/layout';
import { CARDS_BY_ID } from '../engine/cards';
import { HUB_TILES, LEVEL_NAMES, RESEAU_TILES, RULES, tileAt } from '../engine/board';
import { countOwnedIn, ownsFullGroup } from '../engine/rules';
import type { GameState, PlayerId } from '../engine/types';

export interface Banner {
  key: number;
  kind: 'go' | 'exact-go' | 'jail' | 'doubles' | 'jackpot' | 'buy' | 'rent' | 'tax' | 'bankrupt' | 'build' | 'trade';
  title: string;
  detail?: string;
  amount?: number;
  color?: string;
}

export interface CashFly {
  key: number;
  from: PlayerId | null;
  to: PlayerId | null;
  amount: number;
}

/** Dernier lancer, conservé à l'écran jusqu'au suivant. */
export interface RollInfo {
  player: PlayerId;
  dice: [number, number];
  total: number;
  double: boolean;
}

export interface Cinema {
  /** Case occupée visuellement (peut être en retard sur l'état autoritaire). */
  tokenTile: Record<PlayerId, number>;
  /** Incrémenté à chaque pas : déclenche le rebond du pion. */
  hop: Record<PlayerId, number>;
  dice: { values: [number, number]; rolling: boolean; key: number } | null;
  /** Résultat lisible en permanence, pour que toute la table le voie. */
  roll: RollInfo | null;
  focus: { at: [number, number, number]; zoom: number; key: number };
  banner: Banner | null;
  card: string | null;
  highlight: number | null;
  build: { tile: number; level: number; key: number } | null;
  cashFly: CashFly | null;
  /** Vrai tant que des évènements restent à mettre en scène. */
  playing: boolean;
}

const OVERVIEW: [number, number, number] = [0, 0, 0];

const initial: Cinema = {
  tokenTile: {}, hop: {}, dice: null, roll: null,
  focus: { at: OVERVIEW, zoom: 1, key: 0 },
  banner: null, card: null, highlight: null, build: null, cashFly: null, playing: false,
};

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const at = (tile: number): [number, number, number] => {
  const p = PLACEMENTS[tile];
  return [p.pos[0] * 0.72, 0, p.pos[2] * 0.72];
};

/**
 * Transforme le flux d'évènements de l'autorité en mise en scène.
 * Un évènement = un état visuel + une durée ; rien n'est calculé ici,
 * on ne fait que jouer ce que le serveur a décidé.
 */
export const useCinematic = () => {
  const queue = useRoom((s) => s.queue);
  const shiftQueue = useRoom((s) => s.shiftQueue);
  const state = useRoom((s) => s.state);
  const [cinema, setCinema] = useState<Cinema>(initial);
  const timer = useRef<number | null>(null);
  const key = useRef(0);
  const slow = useMemo(() => (reducedMotion() ? 0.22 : 1), []);

  // Le ref doit être remis à zéro, pas seulement le minuteur annulé : sinon un
  // remontage (StrictMode, reprise de partie) laisse la pompe bloquée sur un
  // identifiant périmé et la file d'évènements ne se vide plus jamais.
  useEffect(() => () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (timer.current !== null || queue.length === 0 || !state) return;
    const ev = queue[0];
    const k = ++key.current;
    let dur = 0;

    const banner = (b: Omit<Banner, 'key'>, d: number) => {
      setCinema((c) => ({ ...c, banner: { ...b, key: k } }));
      dur = d;
    };

    switch (ev.e) {
      case 'TURN_STARTED': {
        const tile = state.players[ev.player]?.position ?? 0;
        setCinema((c) => ({ ...c, banner: null, card: null, highlight: null, focus: { at: at(tile), zoom: 1, key: k } }));
        dur = 420;
        break;
      }
      case 'DICE_ROLLED': {
        audio.diceShake();
        setCinema((c) => ({
          ...c,
          dice: { values: ev.dice, rolling: true, key: k },
          roll: { player: ev.player, dice: ev.dice, total: ev.dice[0] + ev.dice[1], double: ev.isDouble },
          // Les dés roulent au centre : c'est là que la caméra se pose.
          focus: { at: [0, 0, 2.4], zoom: 1.5, key: k },
        }));
        dur = 980;
        window.setTimeout(() => {
          audio.diceLand();
          setCinema((c) => (c.dice?.key === k ? { ...c, dice: { ...c.dice, rolling: false } } : c));
        }, 820 * slow);
        break;
      }
      case 'JAIL_ATTEMPT': {
        audio.diceShake();
        setCinema((c) => ({
          ...c,
          dice: { values: ev.dice, rolling: true, key: k },
          roll: { player: ev.player, dice: ev.dice, total: ev.dice[0] + ev.dice[1], double: ev.success },
        }));
        window.setTimeout(() => {
          audio.diceLand();
          setCinema((c) => (c.dice?.key === k ? { ...c, dice: { ...c.dice, rolling: false } } : c));
        }, 820 * slow);
        banner({
          kind: 'jail',
          title: ev.success ? 'Double ! Libéré' : `Tentative ${ev.attempt}/3`,
          detail: ev.success ? 'Les portes s’ouvrent' : 'Raté — la main passe',
        }, 1800);
        break;
      }
      case 'MOVE_STEP': {
        audio.step();
        setCinema((c) => ({
          ...c,
          tokenTile: { ...c.tokenTile, [ev.player]: ev.to },
          hop: { ...c.hop, [ev.player]: (c.hop[ev.player] ?? 0) + 1 },
          focus: { at: at(ev.to), zoom: 1.2, key: k },
          dice: c.dice ? { ...c.dice, rolling: false } : null,
        }));
        // Les longs déplacements accélèrent : on garde le rythme sans sacrifier la lisibilité.
        // Un déplacement long s'accélère : on garde le rythme sans perdre
        // la lecture case par case.
        dur = ev.total > 8 ? 108 : 138;
        break;
      }
      case 'PASSED_GO':
        audio.coin();
        banner({ kind: 'go', title: 'Passage au Départ', amount: ev.amount, color: '#22C55E' }, 850);
        break;
      case 'EXACT_GO':
        audio.jackpot();
        banner({ kind: 'exact-go', title: 'DÉPART EXACT', detail: 'Prime doublée', amount: ev.amount, color: '#EAB308' }, 2100);
        break;
      case 'LANDED':
        audio.land();
        setCinema((c) => ({ ...c, highlight: ev.tile, focus: { at: at(ev.tile), zoom: 1.35, key: k } }));
        dur = 200;
        break;
      case 'PROPERTY_OFFERED':
        setCinema((c) => ({ ...c, focus: { at: at(ev.tile), zoom: 1.75, key: k } }));
        dur = 320;
        break;
      case 'PROPERTY_BOUGHT':
        audio.buy();
        banner({ kind: 'buy', title: tileAt(ev.tile).name, detail: 'Acquise', amount: -ev.price, color: '#22C55E' }, 1100);
        break;
      case 'RENT_PAID': {
        audio.pay();
        setCinema((c) => ({ ...c, cashFly: { key: k, from: ev.from, to: ev.to, amount: ev.amount } }));
        const proprio = state.players[ev.to]?.name ?? '';
        banner({
          kind: 'rent',
          title: `Loyer · ${tileAt(ev.tile).name}`,
          detail: `${rentReason(state, ev.tile)} — versé à ${proprio}`,
          amount: -ev.amount,
          color: '#F05252',
        }, 1800);
        break;
      }
      case 'TAX_PAID':
        audio.pay();
        setCinema((c) => ({ ...c, cashFly: { key: k, from: ev.player, to: null, amount: ev.amount } }));
        banner({ kind: 'tax', title: tileAt(ev.tile).name, detail: 'Versé à la cagnotte', amount: -ev.amount, color: '#F05252' }, 1200);
        break;
      case 'CARD_DRAWN':
        audio.card();
        setCinema((c) => ({ ...c, card: ev.card, focus: { at: OVERVIEW, zoom: 1.5, key: k } }));
        dur = 2900;
        window.setTimeout(() => setCinema((c) => (c.card === ev.card ? { ...c, card: null } : c)), 2800 * slow);
        break;
      case 'POT_WON':
        if (ev.amount > 0) {
          audio.jackpot();
          banner({ kind: 'jackpot', title: 'CAGNOTTE REMPORTÉE', detail: 'Parc Gratuit', amount: ev.amount, color: '#EAB308' }, 2500);
        } else {
          dur = 300;
        }
        break;
      case 'BUILT': {
        audio.build();
        const names = ['', 'Maison', 'Villa', 'Grand Hôtel'];
        setCinema((c) => ({ ...c, build: { tile: ev.tile, level: ev.level, key: k }, focus: { at: at(ev.tile), zoom: 2.1, key: k } }));
        banner({ kind: 'build', title: names[ev.level], detail: tileAt(ev.tile).name, amount: -ev.cost, color: '#EAB308' }, 2300);
        break;
      }
      case 'THREE_DOUBLES':
        audio.alarm();
        banner({ kind: 'doubles', title: 'TROISIÈME DOUBLE', detail: 'Direction la prison', color: '#F05252' }, 1700);
        break;
      case 'JAILED':
        audio.jail();
        setCinema((c) => ({ ...c, tokenTile: { ...c.tokenTile, [ev.player]: 10 }, focus: { at: at(10), zoom: 1.6, key: k } }));
        banner({ kind: 'jail', title: 'PRISON', detail: { doubles: 'Trois doubles consécutifs', card: 'Ordre de la carte', tile: 'Case Allez en Prison' }[ev.reason], color: '#94A3B8' }, 1800);
        break;
      case 'JAIL_RELEASED':
        banner({ kind: 'jail', title: 'Libéré', detail: { double: 'Sur un double', fine: 'Caution réglée', card: 'Laissez-passer' }[ev.reason], color: '#22C55E' }, 900);
        break;
      case 'TRADE_ACCEPTED':
        audio.buy();
        banner({ kind: 'trade', title: 'Échange conclu', color: '#60A5FA' }, 1100);
        break;
      case 'BANKRUPT':
        audio.bankrupt();
        banner({ kind: 'bankrupt', title: 'FAILLITE', detail: `${state.players[ev.player]?.name ?? ''} est éliminé`, color: '#F05252' }, 2600);
        break;
      case 'GAME_OVER':
        audio.victory();
        dur = 400;
        break;
      default:
        dur = 0;
    }

    timer.current = window.setTimeout(() => {
      timer.current = null;
      shiftQueue(1);
    }, Math.max(16, dur * slow));
  }, [queue, state, shiftQueue, slow]);

  // Quand la file est vide, la mise en scène se recale sur l'état autoritaire.
  useEffect(() => {
    if (queue.length > 0 || !state) return;
    setCinema((c) => {
      const tokenTile = { ...c.tokenTile };
      let changed = false;
      for (const id of state.order) {
        if (tokenTile[id] !== state.players[id].position) {
          tokenTile[id] = state.players[id].position;
          changed = true;
        }
      }
      if (!changed && !c.playing && !c.banner) return c;
      return { ...c, tokenTile, playing: false, banner: null };
    });
  }, [queue.length, state]);

  useEffect(() => {
    setCinema((c) => (c.playing === queue.length > 0 ? c : { ...c, playing: queue.length > 0 }));
  }, [queue.length]);

  return cinema;
};

export const cardOf = (id: string | null) => (id ? CARDS_BY_ID[id] : null);

/**
 * D'où vient le montant du loyer. Le joueur qui paie doit pouvoir le
 * vérifier sans ouvrir de panneau : c'est la différence entre subir et
 * comprendre.
 */
const rentReason = (state: GameState, tile: number): string => {
  const t = tileAt(tile);
  const st = state.tiles[tile];
  if (!st?.owner) return '';
  if (t.kind === 'hub') {
    const n = countOwnedIn(state, st.owner, HUB_TILES);
    return `${n} hub${n > 1 ? 's' : ''} sur 4`;
  }
  if (t.kind === 'reseau') {
    const n = countOwnedIn(state, st.owner, RESEAU_TILES);
    const mult = RULES.reseauRent[Math.max(0, n - 1)] ?? RULES.reseauRent[0];
    return `${mult} × la somme des dés`;
  }
  if (st.level > 0) return LEVEL_NAMES[st.level];
  return ownsFullGroup(state, st.owner, tile) ? 'Terrain nu, groupe complet (×2)' : 'Terrain nu';
};
