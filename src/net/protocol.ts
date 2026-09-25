import type { Command, GameEvent, GameState, PlayerId } from '../engine/types';

export interface Seat {
  id: PlayerId;
  name: string;
  avatar: string;
  color: string;
  token: string;
  ready: boolean;
  connected: boolean;
  /** Le siège de l'hôte porte l'autorité tant qu'aucun serveur n'est déporté. */
  host: boolean;
}

export interface LobbyState {
  roomCode: string;
  hostId: PlayerId;
  seats: Seat[];
  started: boolean;
}

/** Client → autorité. */
export type ClientMsg =
  | { k: 'HELLO'; seat: Omit<Seat, 'host' | 'connected'> }
  | { k: 'UPDATE_SEAT'; id: PlayerId; patch: Partial<Pick<Seat, 'name' | 'avatar' | 'color' | 'token' | 'ready'>> }
  | { k: 'LEAVE'; id: PlayerId }
  | { k: 'INTENT'; cmd: Command }
  | { k: 'REQUEST_SYNC'; id: PlayerId };

/** Autorité → clients. */
export type ServerMsg =
  | { k: 'LOBBY'; lobby: LobbyState }
  | { k: 'SNAPSHOT'; seq: number; state: GameState; events: GameEvent[] }
  | { k: 'REJECT'; to: PlayerId; reason: string }
  | { k: 'CLOSED'; reason: string };

export type NetMsg = ClientMsg | ServerMsg;

export const AVATARS = [
  { id: 'a1', label: 'Navigatrice', glyph: 'compass' },
  { id: 'a2', label: 'Bâtisseur', glyph: 'crane' },
  { id: 'a3', label: 'Aviatrice', glyph: 'plane' },
  { id: 'a4', label: 'Financier', glyph: 'vault' },
  { id: 'a5', label: 'Exploratrice', glyph: 'globe' },
  { id: 'a6', label: 'Architecte', glyph: 'tower' },
] as const;

export const TOKENS = [
  { id: 't1', label: 'Obélisque' },
  { id: 't2', label: 'Dirigeable' },
  { id: 't3', label: 'Cargo' },
  { id: 't4', label: 'Monolithe' },
  { id: 't5', label: 'Satellite' },
  { id: 't6', label: 'Phare' },
] as const;

export const COLORS = [
  '#F5D97B', '#5FE3BC', '#FF9C86', '#7BA6FF', '#D183F5', '#FFB24D',
] as const;

const CODE_ALPHABET = 'ACDEFGHJKLMNPQRSTUVWXYZ2345679';

export const makeRoomCode = (): string =>
  Array.from({ length: 5 }, () =>
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

export const makePlayerId = (): string =>
  `u_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
