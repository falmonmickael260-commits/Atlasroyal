import { create } from 'zustand';
import { applyCommand, createGame } from '../engine/engine';
import { RULES } from '../engine/board';
import type { Command, GameEvent, GameState } from '../engine/types';
import { ServerTransport } from './serverTransport';
import { LocalTransport } from './localTransport';
import { SupabaseTransport, supabaseConfigured } from './supabaseTransport';
import {
  COLORS,
  TOKENS,
  makeRoomCode,
  type ClientMsg,
  type LobbyState,
  type Seat,
} from './protocol';
import {
  forgetRoom,
  loadIdentity,
  recallRoom,
  rememberRoom,
  saveIdentity,
  restoreRoomIdentity,
  type Identity,
} from './identity';
import type { Transport } from './transport';

export type NetMode = 'local' | 'supabase' | 'server';
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
let joinTimer: ReturnType<typeof setTimeout> | null = null;
let lastSnapshotSeq = 0;
let joining: { resolve: () => void; reject: (error: Error) => void } | null = null;
const finishJoin = (error?: string) => {
  if (joinTimer) {
    clearTimeout(joinTimer);
    joinTimer = null;
  }
  const pending = joining;
  joining = null;
  if (error) pending?.reject(new Error(error));
  else pending?.resolve();
};

const teardown = () => {
  finishJoin('Connexion annulée.');
  for (const u of unsubs) u();
  unsubs = [];
  transport?.close();
  transport = null;
  hostLobby = null;
  hostState = null;
  seq = 0;
  lastSnapshotSeq = 0;
};

const makeTransport = (mode: NetMode, code: string, id: string, host: boolean): Transport =>
  mode === 'server'
    ? new ServerTransport(code, id, host)
    : mode === 'supabase' && supabaseConfigured
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
    if (!hostLobby || !transport || !msg || typeof msg !== 'object') return;

    switch (msg.k) {
      case 'HELLO': {
        if (
          !msg.seat ||
          typeof msg.seat.id !== 'string' ||
          typeof msg.seat.name !== 'string' ||
          msg.seat.name.length > 32 ||
          !['color', 'token', 'avatar'].every(
            (key) => typeof msg.seat[key as 'color' | 'token' | 'avatar'] === 'string',
          )
        )
          return;
        const existing = hostLobby.seats.find((s) => s.id === msg.seat.id);
        if (existing) {
          // Reconnexion : on retrouve le siège, on ne le duplique pas.
          existing.connected = true;
          existing.name = msg.seat.name || existing.name;
          pushLobby();
          if (hostState) {
            hostState = applyCommand(hostState, {
              t: 'SET_CONNECTED',
              by: msg.seat.id,
              connected: true,
            }).state;
            pushSnapshot([]);
          }
          return;
        }
        if (hostLobby.started) {
          transport.broadcast({ k: 'REJECT', to: msg.seat.id, reason: 'Partie déjà lancée.' });
          return;
        }
        if (hostLobby.seats.length >= RULES.maxPlayers) {
          transport.broadcast({
            k: 'REJECT',
            to: msg.seat.id,
            reason: 'Salon complet (8 joueurs).',
          });
          return;
        }
        // Couleur ET pion doivent être uniques : deux joueurs identiques sur
        // le plateau seraient indiscernables.
        const usedColors = new Set(hostLobby.seats.map((s) => s.color));
        const usedTokens = new Set(hostLobby.seats.map((s) => s.token));
        const color = usedColors.has(msg.seat.color)
          ? (COLORS.find((c) => !usedColors.has(c)) ?? msg.seat.color)
          : msg.seat.color;
        const token = usedTokens.has(msg.seat.token)
          ? (TOKENS.find((t) => !usedTokens.has(t.id))?.id ?? msg.seat.token)
          : msg.seat.token;
        hostLobby.seats.push({ ...msg.seat, color, token, connected: true, host: false });
        pushLobby();
        return;
      }

      case 'UPDATE_SEAT': {
        const seat = hostLobby.seats.find((s) => s.id === msg.id);
        if (!seat || hostLobby.started || !msg.patch || typeof msg.patch !== 'object') return;
        // Deux joueurs ne peuvent pas partager couleur ou pion.
        if (
          msg.patch.color &&
          hostLobby.seats.some((s) => s.id !== msg.id && s.color === msg.patch.color)
        ) {
          delete msg.patch.color;
        }
        if (
          msg.patch.token &&
          hostLobby.seats.some((s) => s.id !== msg.id && s.token === msg.patch.token)
        ) {
          delete msg.patch.token;
        }
        for (const field of ['name', 'avatar', 'color', 'token', 'ready'] as const) {
          const value = msg.patch[field];
          if (field === 'ready') {
            if (typeof value === 'boolean') seat.ready = value;
          } else if (typeof value === 'string') seat[field] = value;
        }
        pushLobby();
        return;
      }

      case 'LEAVE': {
        const seat = hostLobby.seats.find((s) => s.id === msg.id);
        if (!seat) return;
        if (hostLobby.started) {
          seat.connected = false;
          if (hostState) {
            hostState = applyCommand(hostState, {
              t: 'SET_CONNECTED',
              by: msg.id,
              connected: false,
            }).state;
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
        if (!msg.cmd || typeof msg.cmd !== 'object') return;
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
    unsubs.push(
      transport.onServerMsg((msg) => {
        if (!msg || typeof msg !== 'object') return;
        /*
        L'hôte diffuse à la cantonade : salon et instantanés partent vers tous
        les abonnés du canal, y compris un arrivant qu'il vient de refuser
        (partie déjà lancée, salon complet). Sans vérifier qu'on a bien un
        siège, ce client basculait sur l'écran de jeu en spectateur fantôme —
        il voyait la partie, ne pouvait rien faire et ne pouvait pas revenir.
      */
        const assis = (ids: string[]) => ids.includes(get().identity.id);

        switch (msg.k) {
          case 'LOBBY':
            if (!assis(msg.lobby.seats.map((s) => s.id))) break;
            finishJoin();
            set({
              lobby: msg.lobby,
              connecting: false,
              screen: msg.lobby.started ? 'game' : 'lobby',
            });
            break;
          case 'SNAPSHOT':
            if (!assis(Object.keys(msg.state.players)) || msg.seq <= lastSnapshotSeq) break;
            lastSnapshotSeq = msg.seq;
            finishJoin();
            set((s) => ({
              connecting: false,
              state: msg.state,
              screen: 'game',
              queue: msg.events.length ? [...s.queue, ...msg.events] : s.queue,
            }));
            break;
          case 'REJECT':
            if (msg.to !== get().identity.id) break;
            // Refus faute de siège : c'est la connexion qui échoue, pas une
            // action de jeu. On repart à l'accueil au lieu d'afficher un salon
            // dont on ne fait pas partie.
            if (!assis((get().lobby?.seats ?? []).map((s) => s.id))) {
              finishJoin(msg.reason);
              set({
                error: msg.reason,
                screen: 'home',
                lobby: null,
                state: null,
                queue: [],
                isHost: false,
                connecting: false,
              });
              // Sans cela, le prochain rafraîchissement tenterait de reprendre
              // un salon qui vient justement de nous refuser.
              forgetRoom();
              teardown();
              break;
            }
            set({ toast: msg.reason });
            break;
          case 'CLOSED':
            finishJoin(msg.reason);
            if (!msg.recoverable || get().isHost) forgetRoom();
            teardown();
            set({
              error: msg.reason,
              screen: 'home',
              lobby: null,
              state: null,
              queue: [],
              isHost: false,
              connecting: false,
              resuming: false,
            });
            break;
        }
      }),
    );
  };

  const connect = async (code: string, mode: NetMode, asHost: boolean) => {
    teardown();
    forgetRoom();
    set({
      connecting: true,
      error: null,
      toast: null,
      lobby: null,
      queue: [],
      state: null,
      screen: 'home',
      isHost: asHost,
      mode,
    });
    const id = get().identity;
    const next = makeTransport(mode, code, id.id, asHost);
    transport = next;
    try {
      await next.connect();
      if (transport !== next) return;
      await new Promise<void>((resolve, reject) => {
        joining = { resolve, reject };
        joinTimer = setTimeout(
          () => finishJoin('Le salon ne répond pas. Vérifiez le code et la connexion de l’hôte.'),
          12000,
        );
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
          next.sendToHost({ k: 'HELLO', seat: { ...seatFrom(id), ready: false } });
          next.sendToHost({ k: 'REQUEST_SYNC', id: id.id });
        }
      });
      if (transport !== next) return;
      rememberRoom({ code, host: asHost, mode });
      set({ connecting: false });
    } catch (error) {
      if (transport !== next) return;
      teardown();
      forgetRoom();
      set({
        connecting: false,
        isHost: false,
        lobby: null,
        state: null,
        queue: [],
        screen: 'home',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    identity: loadIdentity(),
    screen: 'home',
    mode: supabaseConfigured ? 'supabase' : 'server',
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
          k: 'UPDATE_SEAT',
          id: next.id,
          patch: { name: next.name, avatar: next.avatar, color: next.color, token: next.token },
        });
      }
    },

    createRoom: async (mode) => {
      if (get().connecting || get().resuming) return;
      await connect(makeRoomCode(), mode, true);
    },

    joinRoom: async (code, mode) => {
      if (get().connecting || get().resuming) return;
      const normalized = code.toUpperCase().trim();
      const savedId = mode !== 'local' ? restoreRoomIdentity(normalized) : null;
      if (savedId) set({ identity: { ...get().identity, id: savedId } });
      await connect(normalized, mode, false);
    },

    leaveRoom: () => {
      const current = get();
      if (!current.isHost && current.state && current.lobby)
        rememberRoom({ code: current.lobby.roomCode, host: false, mode: current.mode });
      else forgetRoom();
      if (get().isHost) transport?.broadcast({ k: 'CLOSED', reason: 'L’hôte a quitté le salon.' });
      else transport?.sendToHost({ k: 'LEAVE', id: get().identity.id });
      teardown();
      set({
        screen: 'home',
        lobby: null,
        state: null,
        queue: [],
        isHost: false,
        connecting: false,
        resuming: false,
      });
    },

    setReady: (ready) => {
      transport?.sendToHost({ k: 'UPDATE_SEAT', id: get().identity.id, patch: { ready } });
    },

    startGame: () => {
      const { lobby, identity } = get();
      if (!lobby || lobby.hostId !== identity.id || !hostLobby || hostLobby.started) return;
      if (hostLobby.seats.length < RULES.minPlayers) {
        set({ toast: 'Il faut au moins 2 joueurs.' });
        return;
      }
      if (!hostLobby.seats.every((s) => s.ready)) {
        set({ toast: 'Tous les joueurs doivent être prêts.' });
        return;
      }
      hostLobby.started = true;
      const seed = String(Date.now());
      hostState = createGame(
        hostLobby.roomCode,
        hostLobby.seats.map((s) => ({
          id: s.id,
          name: s.name || 'Joueur',
          avatar: s.avatar,
          color: s.color,
          token: s.token,
        })),
        seed,
      );
      pushLobby();
      if (transport instanceof ServerTransport) transport.startVerifiedGame(seed, hostState.startedAt);
      const r = applyCommand(hostState, { t: 'START_GAME', by: identity.id });
      hostState = r.state;
      pushSnapshot(r.events);
    },

    send: (cmd) => {
      transport?.sendToHost({ k: 'INTENT', cmd });
    },

    /**
     * Après un rafraîchissement, l'onglet garde son identité et le code du
     * dernier salon : on y retourne tout seul. L'hôte est exclu — son autorité
     * vit en mémoire et rejoindre recréerait un salon vide portant le même code.
     */
    resume: async () => {
      const last = recallRoom();
      if (!last || last.host || get().screen !== 'home' || get().resuming || get().connecting)
        return;
      set({ resuming: true });
      try {
        await connect(last.code, last.mode, false);
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
  id: i.id,
  name: i.name || 'Joueur',
  avatar: i.avatar,
  color: i.color,
  token: i.token,
  ready: false,
});

/** Signale le départ proprement quand l'onglet se ferme. */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const { identity, screen, isHost } = useRoom.getState();
    if (screen !== 'home') {
      if (isHost) transport?.broadcast({ k: 'CLOSED', reason: 'L’hôte a quitté le salon.' });
      else transport?.sendToHost({ k: 'LEAVE', id: identity.id });
    }
  });
}
