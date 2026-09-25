import { useMemo } from 'react';
import { netWorth, ownedBy } from '../../engine/rules';
import { Icon } from '../Icon';
import { euro } from '../format';
import type { GameState } from '../../engine/types';

/** Séquence finale : couronnement, patrimoine, classement. */
export const Victory = ({ state, onLeave }: { state: GameState; onLeave: () => void }) => {
  const winner = state.winner ? state.players[state.winner] : null;
  const confetti = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      delay: `${(i % 14) * 0.32}s`,
      duration: `${3.4 + (i % 7) * 0.45}s`,
      color: ['#EAB308', '#22C55E', '#60A5FA', '#F5D97B', '#FF9C86'][i % 5],
    })),
    [],
  );
  if (!winner) return null;

  const ranking = [...state.order].sort((a, b) => netWorth(state, b) - netWorth(state, a));
  const built = ownedBy(state, winner.id).reduce((a, i) => a + state.tiles[i].level, 0);

  return (
    <div className="victory">
      <div className="confetti" aria-hidden="true">
        {confetti.map((c, i) => (
          <i key={i} style={{ left: c.left, background: c.color, animationDelay: c.delay, animationDuration: c.duration }} />
        ))}
      </div>
      <div className="victory__inner">
        <div className="victory__crown"><Icon name="crown" size={72} strokeWidth={1.2} /></div>
        <div style={{ letterSpacing: '.3em', fontSize: 12, color: 'var(--fg-muted)', marginTop: 8 }}>
          EMPIRE ACHEVÉ
        </div>
        <div className="victory__name">{winner.name}</div>

        <div className="victory__stats">
          <div className="vstat">
            <div className="vstat__k">Patrimoine</div>
            <div className="vstat__v" style={{ color: 'var(--gold)' }}>{euro(netWorth(state, winner.id))}</div>
          </div>
          <div className="vstat">
            <div className="vstat__k">Liquidités</div>
            <div className="vstat__v">{euro(winner.cash)}</div>
          </div>
          <div className="vstat">
            <div className="vstat__k">Villes</div>
            <div className="vstat__v">{ownedBy(state, winner.id).length}</div>
          </div>
          <div className="vstat">
            <div className="vstat__k">Niveaux bâtis</div>
            <div className="vstat__v">{built}</div>
          </div>
        </div>

        <div style={{ marginTop: 'var(--sp-6)', textAlign: 'left', maxWidth: 420, marginInline: 'auto' }}>
          <div className="label">Classement final</div>
          {ranking.map((id, i) => (
            <div key={id} className="holding">
              <span className="holding__band" style={{ background: state.players[id].color }} />
              <div style={{ flex: 1 }}>
                <div className="holding__name">{i + 1}. {state.players[id].name}</div>
                <div className="holding__sub">{state.players[id].bankrupt ? 'Éliminé' : 'Debout'}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{euro(netWorth(state, id))}</div>
            </div>
          ))}
        </div>

        <button className="btn btn--accent btn--lg" style={{ marginTop: 'var(--sp-6)' }} onClick={onLeave}>
          <Icon name="home" size={18} /> Retour à l’accueil
        </button>
      </div>
    </div>
  );
};
