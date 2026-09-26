import { useRef, useState } from 'react';
import { createGame } from '../engine/engine';
import { BOARD, GROUP_INDEX } from '../engine/board';
import { Scene } from '../board3d/Scene';
import { useCompact } from '../ui/useCompact';
import type { BuildLevel, GameState } from '../engine/types';
import type { Cinema } from '../ui/cinema';

/**
 * Banc d'essai du rendu (développement uniquement, `?preview=board`).
 *
 * Il fabrique un état de partie arbitraire — niveaux de construction, pions,
 * dés — pour inspecter le plateau sans avoir à atteindre ces situations en
 * jouant. Sert à vérifier les silhouettes de bâtiments et le cadrage caméra.
 */
const SEATS = ['#F5D97B', '#5FE3BC', '#FF9C86', '#7BA6FF'].map((color, i) => ({
  id: `p${i}`, name: `Joueur ${i + 1}`, avatar: 'a1', color, token: `t${i + 1}`,
}));

const build = (level: BuildLevel): GameState => {
  const s = createGame('PREVIEW', SEATS, 'preview');
  const tiles = { ...s.tiles };
  // Chaque groupe est attribué à un joueur et bâti au niveau demandé.
  Object.values(GROUP_INDEX).forEach((idx, g) => {
    for (const i of idx) tiles[i] = { owner: SEATS[g % SEATS.length].id, level, mortgaged: false };
  });
  for (const t of BOARD) {
    if (t.kind === 'hub' || t.kind === 'reseau') {
      tiles[t.i] = { owner: SEATS[t.i % SEATS.length].id, level: 0, mortgaged: false };
    }
  }
  const players = { ...s.players };
  SEATS.forEach((seat, i) => {
    players[seat.id] = { ...players[seat.id], position: [1, 12, 24, 33][i] };
  });
  return { ...s, tiles, players, phase: 'ROLL_DICE', pot: 4200 };
};

const EMPTY_CINEMA = (state: GameState): Cinema => ({
  tokenTile: Object.fromEntries(state.order.map((id) => [id, state.players[id].position])),
  hop: {},
  dice: { values: [4, 2], rolling: false, key: 1 },
  roll: { player: state.order[0], dice: [4, 2], total: 6, double: false },
  banner: null,
  card: null,
  highlight: null,
  build: null,
  cashFly: null,
  purchase: null,
  follow: null,
  destination: null,
  playing: false,
});

export const BoardPreview = () => {
  const [level, setLevel] = useState<BuildLevel>(3);
  const compact = useCompact();
  const state = build(level);
  const labels = useRef(new Map<string, HTMLElement | null>());

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050A14' }}>
      <Scene
        state={state}
        cinema={EMPTY_CINEMA(state)}
        compact={compact}
        activePlayer={state.order[0]}
        labels={labels}
      />
      <div className="panel" style={{ position: 'absolute', left: 16, top: 16, padding: 16, display: 'flex', gap: 8 }}>
        {(['Terrain', 'Maison', 'Villa', 'Grand Hôtel'] as const).map((label, i) => (
          <button key={label} className="pill-opt" aria-pressed={level === i}
            onClick={() => setLevel(i as BuildLevel)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
