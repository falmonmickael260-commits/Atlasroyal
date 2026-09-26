import { GROUPS, tileAt } from '../../engine/board';
import { Icon } from '../Icon';
import { euro } from '../format';
import type { GameState, PlayerId, TradeOffer } from '../../engine/types';

/** Couleur du groupe d'une case, ou celle de sa famille d'actifs. */
export const tileColor = (tile: number): string => {
  const t = tileAt(tile);
  if (t.kind === 'city') return GROUPS[t.group].color;
  if (t.kind === 'hub') return '#60A5FA';
  return '#22C55E';
};

/** Pastille de couleur + nom : on identifie le groupe avant de lire le texte. */
export const TileChip = ({ tile, muted }: { tile: number; muted?: boolean }) => (
  <span className="tilechip" style={{ opacity: muted ? 0.75 : 1 }}>
    <i className="tilechip__dot" style={{ background: tileColor(tile) }} />
    {tileAt(tile).name}
  </span>
);

const Side = ({ tiles, cash, label }: { tiles: number[]; cash: number; label: string }) => (
  <div className="ticker__side">
    <span className="ticker__label">{label}</span>
    <span className="ticker__items">
      {tiles.map((i) => (
        <TileChip key={i} tile={i} />
      ))}
      {cash > 0 && <span className="tilechip tilechip--cash">{euro(cash)}</span>}
      {tiles.length === 0 && cash === 0 && <span className="ticker__nothing">rien</span>}
    </span>
  </div>
);

/**
 * Bandeau des échanges en cours, visible par **tous** les joueurs.
 *
 * Les offres vivent dans l'état autoritaire : chaque client en reçoit la même
 * copie, donc la table entière voit qu'une négociation est ouverte, entre qui
 * et qui, et sur quoi — sans pouvoir y toucher si elle ne la concerne pas.
 */
export const TradeTicker = ({
  state,
  me,
  onOpen,
}: {
  state: GameState;
  me: PlayerId;
  onOpen: () => void;
}) => {
  if (state.trades.length === 0) return null;

  return (
    <div className="ticker" role="status" aria-live="polite">
      {state.trades.map((o: TradeOffer) => {
        const from = state.players[o.from];
        const to = state.players[o.to];
        const concerne = o.from === me || o.to === me;
        return (
          <div key={o.id} className={`ticker__row${concerne ? ' ticker__row--mine' : ''}`}>
            <div className="ticker__head">
              <Icon name="swap" size={15} />
              <strong style={{ color: from?.color }}>{from?.name}</strong>
              <span>propose un échange à</span>
              <strong style={{ color: to?.color }}>{to?.name}</strong>
            </div>
            <div className="ticker__body">
              <Side label="donne" tiles={o.giveTiles} cash={o.giveCash} />
              <Icon name="swap" size={14} className="ticker__arrow" />
              <Side label="reçoit" tiles={o.getTiles} cash={o.getCash} />
            </div>
            {concerne ? (
              <button className="btn btn--sm btn--accent" onClick={onOpen}>
                {o.to === me ? 'Répondre' : 'Voir mon offre'}
              </button>
            ) : (
              <span className="ticker__wait">négociation en cours…</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
