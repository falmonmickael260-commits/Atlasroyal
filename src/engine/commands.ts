import { BOARD_SIZE } from './board';
import type { Command } from './types';
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const tile = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) < BOARD_SIZE;
const tiles = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length <= BOARD_SIZE &&
  value.every(tile) &&
  new Set(value).size === value.length;
const money = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
const simple = new Set([
  'START_GAME',
  'ROLL_DICE',
  'BUY_PROPERTY',
  'DECLINE_PROPERTY',
  'PAY_JAIL_FINE',
  'USE_JAIL_CARD',
  'ATTEMPT_JAIL_ROLL',
  'SETTLE_DEBT',
  'DECLARE_BANKRUPTCY',
  'END_TURN',
]);
/** Network input is unknown even when callers use the TypeScript command union. */
export const isCommand = (value: unknown): value is Command => {
  if (!object(value) || typeof value.by !== 'string' || !value.by || typeof value.t !== 'string')
    return false;
  if (simple.has(value.t)) return true;
  if (['BUILD', 'SELL_BUILDING', 'MORTGAGE', 'UNMORTGAGE'].includes(value.t))
    return tile(value.tile);
  if (['ACCEPT_TRADE', 'DECLINE_TRADE'].includes(value.t))
    return typeof value.id === 'string' && value.id.length > 0;
  if (value.t === 'SET_CONNECTED') return typeof value.connected === 'boolean';
  if (value.t === 'PROPOSE_TRADE') {
    const offer = value.offer;
    return (
      object(offer) &&
      typeof offer.to === 'string' &&
      offer.to.length > 0 &&
      tiles(offer.giveTiles) &&
      tiles(offer.getTiles) &&
      money(offer.giveCash) &&
      money(offer.getCash)
    );
  }
  return false;
};
