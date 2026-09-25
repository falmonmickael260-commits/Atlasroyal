import { Icon } from '../Icon';
import { PropertyCard } from './PropertyCard';
import { euro } from '../format';
import { audio } from '../../audio/audio';
import type { GameState } from '../../engine/types';

/**
 * Décision d'acquisition. Le prix affiché est celui calculé par l'autorité
 * (remise de carte comprise) : le client ne recalcule rien.
 */
export const PropertyPrompt = ({
  state, tile, price, cash, onBuy, onDecline,
}: {
  state: GameState; tile: number; price: number; cash: number;
  onBuy: () => void; onDecline: () => void;
}) => {
  return (
    <div className="sheet sheet--center" role="dialog" aria-label="Acquisition">
      <PropertyCard state={state} tile={tile} />
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => { audio.click(); onDecline(); }}>
          <Icon name="close" size={16} /> Refuser
        </button>
        <button
          className="btn btn--accent"
          style={{ flex: 1.5 }}
          disabled={cash < price}
          onClick={() => { audio.click(); onBuy(); }}
        >
          <Icon name="check" size={16} /> Acheter · {euro(price)}
        </button>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--fg-muted)', textAlign: 'center' }}>
        Vos liquidités après achat : {euro(cash - price)}
      </div>
    </div>
  );
};
