import type { RollInfo } from '../cinema';
import type { GameState } from '../../engine/types';

/** Pastille d'un dé : le chiffre plutôt que des points, lisible de loin. */
const Pip = ({ value }: { value: number }) => (
  <span
    style={{
      display: 'grid',
      placeItems: 'center',
      width: 34,
      height: 34,
      borderRadius: 9,
      background: 'linear-gradient(150deg, #FFFFFF, #CBD5E1)',
      color: '#0B1220',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 19,
      boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.18), 0 3px 10px rgba(0,0,0,.45)',
    }}
  >
    {value}
  </span>
);

/**
 * Résultat du dernier lancer, affiché en permanence.
 *
 * Les dés 3D roulent près du pion et la caméra les quitte dès que le pion
 * avance : sans ce rappel fixe, la table perd le chiffre de vue au moment
 * précis où elle en a besoin.
 */
export const RollReadout = ({
  roll,
  state,
}: {
  roll: RollInfo | null;
  state: GameState;
}) => {
  if (!roll) return null;
  const player = state.players[roll.player];

  return (
    <div
      className="glass rollout"
      role="status"
      aria-live="polite"
      aria-label={`${player?.name ?? ''} a fait ${roll.dice[0]} et ${roll.dice[1]}, total ${roll.total}`}
    >
      <div className="rollout__who" style={{ color: player?.color }}>
        {player?.name ?? ''}
      </div>
      <div className="rollout__dice">
        <Pip value={roll.dice[0]} />
        <span className="rollout__plus">+</span>
        <Pip value={roll.dice[1]} />
        <span className="rollout__eq">=</span>
        <span className="rollout__total">{roll.total}</span>
      </div>
      {roll.double && <div className="rollout__double">Double</div>}
    </div>
  );
};
