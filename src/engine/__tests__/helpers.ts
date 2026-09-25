import { createGame, applyCommand } from '../engine';
import { rollDie } from '../rng';
import type { Command, GameState, PlayerId } from '../types';

export const SEATS = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Joueur ${i + 1}`,
    avatar: 'a1',
    color: '#fff',
    token: 't1',
  }));

export const newGame = (n = 2): GameState => {
  const g = createGame('TEST01', SEATS(n), 'seed');
  // Ordre déterministe pour les tests : p1, p2, ...
  g.order = SEATS(n).map((s) => s.id);
  return applyCommand(g, { t: 'START_GAME', by: g.order[0] }).state;
};

/**
 * Trouve un état de PRNG qui produit exactement le lancer demandé.
 * Permet de tester des scénarios précis sans rendre le moteur injectable.
 */
export const seedForRoll = (d1: number, d2: number): number => {
  for (let s = 1; s < 4_000_000; s++) {
    const [a, r] = rollDie(s);
    if (a !== d1) continue;
    const [b] = rollDie(r);
    if (b === d2) return s;
  }
  throw new Error(`Aucun seed pour ${d1}/${d2}`);
};

/** Force le prochain lancer puis exécute la commande. */
export const rollAs = (
  st: GameState, by: PlayerId, d1: number, d2: number,
  cmd: Command['t'] = 'ROLL_DICE',
) => {
  const s = { ...st, rng: seedForRoll(d1, d2) };
  return applyCommand(s, { t: cmd, by } as Command);
};

export const run = (st: GameState, ...cmds: Command[]): GameState =>
  cmds.reduce((s, c) => applyCommand(s, c).state, st);

export const current = (s: GameState) => s.order[s.currentIndex];
