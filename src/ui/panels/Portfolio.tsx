import { GROUPS, LEVEL_NAMES, RULES, tileAt } from '../../engine/board';
import { canBuild, canMortgage, buildCostFor, mortgageValue, ownedBy, unmortgageCost, rentFor } from '../../engine/rules';
import { Icon } from '../Icon';
import { euro } from '../format';
import { audio } from '../../audio/audio';
import type { Command, GameState, PlayerId } from '../../engine/types';

const bandColor = (tile: number) => {
  const t = tileAt(tile);
  if (t.kind === 'city') return GROUPS[t.group].color;
  if (t.kind === 'hub') return '#60A5FA';
  return '#22C55E';
};

/**
 * Patrimoine du joueur : construire, revendre, hypothéquer.
 * Chaque bouton est désactivé avec sa raison — le moteur reste l'arbitre,
 * mais on n'envoie pas une commande qu'on sait refusée.
 */
export const Portfolio = ({
  state, me, onClose, send,
}: {
  state: GameState; me: PlayerId; onClose: () => void; send: (c: Command) => void;
}) => {
  const tiles = ownedBy(state, me);
  const player = state.players[me];

  return (
    <div className="sheet sheet--right" role="dialog" aria-label="Patrimoine">
      <div className="sheet__head">
        <div>
          <div className="sheet__title">Patrimoine</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            {tiles.length} propriété{tiles.length > 1 ? 's' : ''} · {euro(player.cash)}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="close" size={18} /></button>
      </div>

      <div className="sheet__scroll">
        {tiles.length === 0 && (
          <p style={{ color: 'var(--fg-muted)', fontSize: 14 }}>
            Vous ne possédez encore aucune ville. Les acquisitions s’ouvrent à partir du deuxième tour de table.
          </p>
        )}

        {tiles.map((i) => {
          const t = tileAt(i);
          const st = state.tiles[i];
          const buildErr = canBuild(state, me, i);
          const mortErr = canMortgage(state, me, i);
          const isCity = t.kind === 'city';
          return (
            <div className="holding" key={i}>
              <span className="holding__band" style={{ background: bandColor(i) }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="holding__name">{t.name}</div>
                <div className="holding__sub">
                  {st.mortgaged
                    ? `Hypothéquée · levée ${euro(unmortgageCost(i))}`
                    : `${isCity ? LEVEL_NAMES[st.level] : 'Actif'} · loyer ${euro(rentFor(state, i, 7))}`}
                </div>
              </div>
              <div className="holding__act">
                {isCity && st.level < 3 && (
                  <button
                    className="btn btn--sm btn--accent"
                    title={buildErr ?? `Construire pour ${euro(buildCostFor(i))}`}
                    disabled={Boolean(buildErr)}
                    onClick={() => { audio.click(); send({ t: 'BUILD', by: me, tile: i }); }}
                  >
                    <Icon name="hammer" size={14} />
                  </button>
                )}
                {isCity && st.level > 0 && (
                  <button
                    className="btn btn--sm btn--ghost"
                    title={`Revendre un niveau (+${euro(Math.round(buildCostFor(i) * RULES.sellBuildingRate))})`}
                    onClick={() => { audio.click(); send({ t: 'SELL_BUILDING', by: me, tile: i }); }}
                  >
                    <Icon name="minus" size={14} />
                  </button>
                )}
                {st.mortgaged ? (
                  <button
                    className="btn btn--sm btn--ghost"
                    title={`Lever l’hypothèque (${euro(unmortgageCost(i))})`}
                    disabled={player.cash < unmortgageCost(i)}
                    onClick={() => { audio.click(); send({ t: 'UNMORTGAGE', by: me, tile: i }); }}
                  >
                    <Icon name="bank" size={14} />
                  </button>
                ) : (
                  <button
                    className="btn btn--sm btn--ghost"
                    title={mortErr ?? `Hypothéquer (+${euro(mortgageValue(i))})`}
                    disabled={Boolean(mortErr)}
                    onClick={() => { audio.click(); send({ t: 'MORTGAGE', by: me, tile: i }); }}
                  >
                    <Icon name="coins" size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
