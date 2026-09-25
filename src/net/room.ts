import { create } from 'zustand';
import { applyCommand, createGame } from '../engine/engine';
import { RULES } from '../engine/board';
import type { Command, GameEvent, GameState } from '../engine/types';
import { LocalTransport } from './localTransport';
import { SupabaseTransport, supabaseConfigured } from './supabaseTransport';
import { COLORS, TOKENS, makeRoomCode, type ClientMsg, type LobbyState, type Seat } from './protocol';
import { forgetRoom, loadIdentity, recallRoom, rememberRoom, saveIdentity, type Identity } from './identity';
import type { Transport } from './transport';

export type NetMode = 'local' | 'supabase';
export type Screen = 'home' | 'lobby' | 'game';

interface RoomStore {
  identity: Identity;
  screen: Screen;
  mode: NetMode;
  isHost: boolean;
  connecting: boolean;
  error: string | null;
  lobby: LobbyState | null;
  state: GameState | null;
  /** File d'évènements à mettre en scène, vidée par le moteur d'animation. */
  queue: GameEvent[];
  toast: string | null;

  setIdentity: (p: Partial<Identity>) => void;
  createRoom: (mode: NetMode) => Promise<void>;
  joinRoom: (code: string, mode: NetMode) => Promise<void>;
  leaveRoom: () => void;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  send: (cmd: Command) => void;
  shiftQueue: (n: number) => void;
  clearToast: () => void;
  /** Reprise après rafraîchissement : rejoint le dernier salon connu. */
  resume: () => Promise<void>;
  resuming: boolean;
}

/** Contexte hors-store : une seule connexion vivante à la fois. */
let transport: Transport | null = null;
let unsubs: Array<() => void> = [];
let hostLobby: LobbyState | null = null;
let hostState: GameState | null = null;
let seq = 0;

const teardown = () => {
  for (const u of unsubs) u();
  unsubs = [];
  transport?.close();
  transport = null;
  hostLobby = null;
  hostState = null;
  seq = 0;
};

const makeTransport = (mode: NetMode, code: string, id: string): Transport =>
  mode === 'supabase' && supabaseConfigured
    ? new SupabaseTransport(code, id)
    : new LocalTransport(code);

export const useRoom = create<RoomStore>((set, get) => {
  /* ---------------- autorité (hôte uniquement) ---------------- */

  const pushLobby = () => {
    if (!hostLobby || !transport) return;
    transport.broadcast({ k: 'LOBBY', lobby: hostLobby });
  };

  const pushSnapshot = (events: GameEvent[]) => {
    if (!hostState || !transport) return;
    seq += 1;
    transport.broadcast({ k: 'SNAPSHOT', seq, state: hostState, events });
  };

  const handleClientMsg = (msg: ClientMsg) => {
    if (!hostLobby || !transport) return;

    switch (msg.k) {
      case 'HELLO': {
        const existing = hostLobby.seats.find((s) => s.id === msg.seat.id);
        if (existing) {
          // Reconnexion : on retrouve le siège, on ne le duplique pas.
          existing.connected = true;
          existing.name = msg.seat.name || existing.name;
          pushLobby();
          if (hostState) {
            hostState = applyCommand(hostState, { t: 'SET_CONNECTED', by: msg.seat.id, connected: true }).state;
            pushSnapshot([]);
          }
          return;
        }
        if (hostLobby.started) {
          transport.broadcast({ k: 'REJECT', to: msg.seat.id, reason: 'Partie déjà lancée.' });
          return;
        }
        if (hostLobby.seats.length >= RULES.maxPlayers) {
          transport.broadcast({ k: 'REJECT', to: msg.seat.id, reason: 'Salon complet (6 joueurs).' });
          return;
        }
        // Couleur ET pion doivent être uniques : deux joueurs identiques sur
        // le plateau seraient indiscernables.
        const usedColors = new Set(hostLobby.seats.map((s) => s.color));
        const usedTokens = new Set(hostLobby.seats.map((s) => s.token));
        const color = usedColors.has(msg.seat.color)
          ? COLORS.find((c) => !usedColors.has(c)) ?? msg.seat.color
          : msg.seat.color;
        const token = usedTokens.has(msg.seat.token)
          ? TOKENS.find((t) => !usedTokens.has(t.id))?.id ?? msg.seat.token
          : msg.seat.token;
        hostLobby.seats.push({ ...msg.seat, color, token, connected: true, host: false });
        pushLobby();
        return;
      }

      case 'UPDATE_SEAT': {
        const seat = hostLobby.seats.find((s) => s.id === msg.id);
        if (!seat || hostLobby.started) return;
        // Deux joueurs ne peuvent pas partager couleur ou pion.
        if (msg.patch.color && hostLobby.seats.some((s) => s.id !== msg.id && s.color === msg.patch.color)) {
          delete msg.patch.color;
        }
        if (msg.patch.token && hostLobby.seats.some((s) => s.id !== msg.id && s.token === msg.patch.token)) {
          delete msg.patch.token;
        }
        Object.assign(seat, msg.patch);
        pushLobby();
        return;
      }

      case 'LEAVE': {
        const seat = hostLobby.seats.find((s) => s.id === msg.id);
        if (!seat) return;
        if (hostLobby.started) {
          seat.connected = false;
          if (hostState) {
            hostState = applyCommand(hostState, { t: 'SET_CONNECTED', by: msg.id, connected: false }).state;
            pushSnapshot([]);
          }
        } else {
          hostLobby.seats = hostLobby.seats.filter((s) => s.id !== msg.id);
        }
        pushLobby();
        return;
      }

      case 'REQUEST_SYNC': {
        pushLobby();
        if (hostState) pushSnapshot([]);
        return;
      }

      case 'INTENT': {
        if (!hostState) return;
        if (msg.cmd.t === 'START_GAME') {
          if (msg.cmd.by !== hostLobby.hostId) return;
        }
        const r = applyCommand(hostState, msg.cmd);
        if (r.rejected) {
          transport.broadcast({ k: 'REJECT', to: msg.cmd.by, reason: r.rejected });
          return;
        }
        hostState = r.state;
        pushSnapshot(r.events);
        return;
      }
    }
  };

  /* ---------------- client (tout le monde, hôte compris) ---------------- */

  const attach = (isHost: boolean) => {
    if (!transport) return;
    if (isHost) unsubs.push(transport.onClientMsg(handleClientMsg));
    unsubs.push(transport.onServerMsg((msg) => {
      switch (msg.k) {
        case 'LOBBY':
          set({ lobby: msg.lobby, screen: msg.lobby.started ? 'game' : 'lobby' });
          break;
        case 'SNAPSHOT':
          set((s) => ({
            state: msg.state,
            screen: 'game',
            queue: msg.events.length ? [...s.queue, ...msg.events] : s.queue,
          }));
          break;
        case 'REJECT':
          if (msg.to === get().identity.id) set({ toast: msg.reason });
          break;
        case 'CLOSED':
          set({ error: msg.reason, screen: 'home' });
          teardown();
          break;
      }
    }));
  };

  const connect = async (code: string, mode: NetMode, asHost: boolean) => {
    teardown();
    set({ connecting: true, error: null, queue: [], state: null });
    const id = get().identity;
    transport = makeTransport(mode, code, id.id);
    await transport.connect();

    if (asHost) {
      hostLobby = {
        roomCode: code,
        hostId: id.id,
        seats: [{ ...seatFrom(id), connected: true, host: true, ready: true }],
        started: false,
      };
      attach(true);
      pushLobby();
    } else {
      attach(false);
      transport.sendToHost({ k: 'HELLO', seat: { ...seatFrom(id), ready: false } });
      // Si l'hôte est déjà en jeu, on demande l'état complet.
      transport.sendToHost({ k: 'REQUEST_SYNC', id: id.id });
    }
    rememberRoom(code, asHost);
    set({ connecting: false, isHost: asHost, mode, screen: 'lobby' });
  };

  return {
    identity: loadIdentity(),
    screen: 'home',
    mode: 'local',
    isHost: false,
    connecting: false,
    resuming: false,
    error: null,
    lobby: null,
    state: null,
    queue: [],
    toast: null,

    setIdentity: (p) => {
      const next = { ...get().identity, ...p };
      saveIdentity(next);
      set({ identity: next });
      if (transport && get().screen === 'lobby') {
        transport.sendToHost({
          k: 'UPDATE_SEAT', id: next.id,
          patch: { name: next.name, avatar: next.avatar, color: next.color, token: next.token },
        });
      }
    },

    createRoom: async (mode) => {
      try { await connect(makeRoomCode(), mode, true); }
      catch (e) { set({ connecting: false, error: String(e) }); }
    },

    joinRoom: async (code, mode) => {
      try { await connect(code.toUpperCase().trim(), mode, false); }
      catch (e) { set({ connecting: false, error: String(e) }); }
    },

    leaveRoom: () => {
      forgetRoom();
      transport?.sendToHost({ k: 'LEAVE', id: get().identity.id });
      teardown();
      set({ screen: 'home', lobby: null, state: null, queue: [], isHost: false });
    },

    setReady: (ready) => {
      transport?.sendToHost({ k: 'UPDATE_SEAT', id: get().identity.id, patch: { ready } });
    },

    startGame: () => {
      const { lobby, identity } = get();
      if (!lobby || lobby.hostId !== identity.id || !hostLobby) return;
      if (hostLobby.seats.length < RULES.minPlayers) {
        set({ toast: 'Il faut au moins 2 joueurs.' });
        return;
      }
      if (!hostLobby.seats.every((s) => s.ready)) {
        set({ toast: 'Tous les joueurs doivent être prêts.' });
        return;
      }
      hostLobby.started = true;
      hostState = createGame(hostLobby.roomCode, hostLobby.seats.map((s) => ({
        id: s.id, name: s.name || 'Joueur', avatar: s.avatar, color: s.color, token: s.token,
      })), String(Date.now()));
      pushLobby();
      const r = applyCommand(hostState, { t: 'START_GAME', by: identity.id });
      hostState = r.state;
      pushSnapshot(r.events);
    },

    send: (cmd) => { transport?.sendToHost({ k: 'INTENT', cmd }); },

    /**
     * Après un rafraîchissement, l'onglet garde son identité et le code du
     * dernier salon : on y retourne tout seul. L'hôte est exclu — son autorité
     * vit en mémoire et rejoindre recréerait un salon vide portant le même code.
     */
    resume: async () => {
      const last = recallRoom();
      if (!last || last.host || get().screen !== 'home') return;
      set({ resuming: true });
      try {
        await connect(last.code, get().mode, false);
        // Sans réponse de l'hôte, le salon n'existe plus : on rend la main.
        await new Promise((r) => setTimeout(r, 6000));
        if (!get().lobby) {
          forgetRoom();
          teardown();
          set({ screen: 'home', error: 'La partie précédente n’est plus accessible.' });
        }
      } catch {
        forgetRoom();
        set({ screen: 'home' });
      } finally {
        set({ resuming: false });
      }
    },

    shiftQueue: (n) => set((s) => ({ queue: s.queue.slice(n) })),
    clearToast: () => set({ toast: null }),
  };
});

/** Accès au salon depuis la console en développement (diagnostic réseau). */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __room?: unknown }).__room = useRoom;
}

const seatFrom = (i: Identity): Omit<Seat, 'host' | 'connected'> => ({
  id: i.id, name: i.name || 'Joueur', avatar: i.avatar, color: i.color, token: i.token, ready: false,
});

/** Signale le départ proprement quand l'onglet se ferme. */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const { identity, screen } = useRoom.getState();
    if (screen !== 'home') transport?.sendToHost({ k: 'LEAVE', id: identity.id });
  });
}
