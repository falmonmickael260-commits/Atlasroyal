import { GROUPS, LEVEL_NAMES, tileAt } from '../../engine/board';
import { priceOf } from '../../engine/rules';
import type { GameState } from '../../engine/types';
import { Icon } from '../Icon';
import { euro } from '../format';
import { tileColor } from './TradeTicker';

export const catalogueValue = (tiles: number[], cash: number) =>
  tiles.reduce((value, tile) => value + priceOf(tile), cash);

export const TradeAsset = ({
  tile,
  state,
  selected,
  onToggle,
}: {
  tile: number;
  state: GameState;
  selected?: boolean;
  onToggle?: () => void;
}) => {
  const property = tileAt(tile),
    asset = state.tiles[tile];
  const locked = asset.level > 0;
  const family =
    property.kind === 'city'
      ? GROUPS[property.group].name
      : property.kind === 'hub'
        ? 'Hub international'
        : 'Réseau';
  const content = (
    <>
      <img
        className="trade-asset__art"
        src={`${import.meta.env.BASE_URL}properties/${String(tile).padStart(2, '0')}.svg`}
        alt=""
        loading="lazy"
      />
      <span className="trade-asset__copy">
        <strong>{property.name}</strong>
        <span>{property.kind === 'city' ? property.country : family}</span>
        <small>
          {locked
            ? `${LEVEL_NAMES[asset.level]} · à revendre`
            : asset.mortgaged
              ? 'Hypothéquée'
              : family}
        </small>
      </span>
      <span className="trade-asset__end">
        <b>{euro(priceOf(tile))}</b>
        {onToggle && (
          <span className="trade-asset__check">
            <Icon name={locked ? 'lock' : selected ? 'check' : 'plus'} size={13} />
          </span>
        )}
      </span>
    </>
  );
  const style = { ['--asset-color' as string]: tileColor(tile) };
  return onToggle ? (
    <button
      type="button"
      className={`trade-asset${selected ? ' trade-asset--selected' : ''}`}
      style={style}
      aria-pressed={!!selected}
      aria-label={`${property.name}${locked ? ' · constructions à revendre' : ''}`}
      disabled={locked}
      onClick={onToggle}
    >
      {content}
    </button>
  ) : (
    <div className="trade-asset trade-asset--static" style={style}>
      {content}
    </div>
  );
};

export const TradeBundle = ({
  tiles,
  cash,
  state,
  empty = 'Aucune propriété',
}: {
  tiles: number[];
  cash: number;
  state: GameState;
  empty?: string;
}) => (
  <>
    <div className="trade-bundle">
      {tiles.map((tile) => (
        <TradeAsset key={tile} tile={tile} state={state} />
      ))}
      {!tiles.length && (
        <div className="trade-empty-assets">
          <Icon name="building" size={23} />
          <span>{empty}</span>
        </div>
      )}
    </div>
    <div className="trade-money-line">
      <span>
        <Icon name="coins" size={16} /> Liquidités
      </span>
      <strong>{euro(cash)}</strong>
    </div>
  </>
);
