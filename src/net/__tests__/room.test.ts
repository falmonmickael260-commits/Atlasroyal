import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { newGame } from '../../engine/__tests__/helpers';
const harness = vi.hoisted(() => ({ instances: [] as any[], fail: false }));
vi.mock('../supabaseTransport', () => ({ supabaseConfigured: false, SupabaseTransport: class {} }));
vi.mock('../serverTransport', () => ({
  ServerTransport: class {
    clients = new Set<(m: any) => void>();
    servers = new Set<(m: any) => void>();
    close = vi.fn();
    sendToHost = vi.fn();
    startVerifiedGame = vi.fn();
    constructor() {
      harness.instances.push(this);
    }
    async connect() {
      if (harness.fail) throw Error('Network unavailable');
    }
    broadcast(m: any) {
      this.emit(m);
    }
    emit(m: any) {
      for (const fn of this.servers) fn(m);
    }
    onClientMsg(fn: (m: any) => void) {
      this.clients.add(fn);
      return () => this.clients.delete(fn);
    }
    onServerMsg(fn: (m: any) => void) {
      this.servers.add(fn);
      return () => this.servers.delete(fn);
    }
  },
}));
class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  harness.instances = [];
  harness.fail = false;
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubGlobal('localStorage', new MemoryStorage());
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const load = async () => {
  const { useRoom } = await import('../room');
  return useRoom;
};
const lobby = (id: string) => ({
  roomCode: 'ABCDE',
  hostId: 'host',
  started: false,
  seats: [
    {
      id,
      name: 'Guest',
      avatar: 'a1',
      color: '#fff',
      token: 't1',
      ready: false,
      connected: true,
      host: false,
    },
  ],
});
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
it('efface un salon fermé avant de créer ou rejoindre une autre partie', async () => {
  const room = await load();
  await room.getState().createRoom('server');
  expect(room.getState().lobby).not.toBeNull();
  harness.instances[0].emit({ k: 'CLOSED', reason: 'Host left' });
  expect(room.getState()).toMatchObject({
    screen: 'home',
    lobby: null,
    state: null,
    isHost: false,
    connecting: false,
    queue: [],
  });
  expect(sessionStorage.getItem('fortune-city:last-room')).toBeNull();
});
it('garde un écran visible et la connexion active jusqu’à la réponse du salon', async () => {
  const room = await load();
  const join = room.getState().joinRoom('ABCDE', 'server');
  await tick();
  expect(room.getState()).toMatchObject({ screen: 'home', connecting: true, lobby: null });
  harness.instances[0].emit({ k: 'LOBBY', lobby: lobby(room.getState().identity.id) });
  await join;
  expect(room.getState()).toMatchObject({ screen: 'lobby', connecting: false });
});
it('libère une connexion échouée et ne conserve pas un ancien salon', async () => {
  const room = await load();
  await room.getState().createRoom('server');
  harness.fail = true;
  await room.getState().joinRoom('ABCDE', 'server');
  expect(room.getState()).toMatchObject({
    screen: 'home',
    lobby: null,
    state: null,
    connecting: false,
    isHost: false,
  });
  expect(harness.instances[1].close).toHaveBeenCalled();
});
it('ne lance qu’une reprise lors d’un double montage du composant', async () => {
  const room = await load();
  sessionStorage.setItem(
    'fortune-city:last-room',
    JSON.stringify({ code: 'ABCDE', host: false, mode: 'server' }),
  );
  const one = room.getState().resume(),
    two = room.getState().resume();
  await tick();
  expect(harness.instances).toHaveLength(1);
  harness.instances[0].emit({ k: 'LOBBY', lobby: lobby(room.getState().identity.id) });
  await vi.advanceTimersByTimeAsync(6001);
  await Promise.all([one, two]);
  expect(room.getState().screen).toBe('lobby');
});
it('ne rejoue pas les événements d’un instantané déjà reçu', async () => {
  const room = await load();
  const join = room.getState().joinRoom('ABCDE', 'server');
  await tick();
  const transport = harness.instances[0],
    id = room.getState().identity.id;
  transport.emit({ k: 'LOBBY', lobby: lobby(id) });
  await join;
  const s = newGame(2);
  s.players[id] = { ...s.players.p1, id };
  s.order = [id, 'p2'];
  delete s.players.p1;
  const msg = {
    k: 'SNAPSHOT',
    seq: 1,
    state: s,
    events: [{ e: 'TURN_STARTED', player: id, round: 1 }],
  };
  transport.emit(msg);
  transport.emit(msg);
  expect(room.getState().queue).toHaveLength(1);
});

it('conserve le code d’un invité après une coupure récupérable', async () => {
  const room = await load();
  const join = room.getState().joinRoom('ABCDE', 'server');
  await tick();
  harness.instances[0].emit({ k: 'LOBBY', lobby: lobby(room.getState().identity.id) });
  await join;
  harness.instances[0].emit({ k: 'CLOSED', reason: 'Network lost', recoverable: true });
  expect(room.getState()).toMatchObject({ screen: 'home', lobby: null, connecting: false });
  expect(JSON.parse(sessionStorage.getItem('fortune-city:last-room')!)).toMatchObject({
    code: 'ABCDE',
    host: false,
  });
});

it('ne démarre qu’une fois malgré deux demandes de lancement', async () => {
  const room = await load();
  await room.getState().createRoom('server');
  const transport = harness.instances[0];
  for (const handler of transport.clients)
    handler({
      k: 'HELLO',
      seat: {
        id: 'guest',
        name: 'Guest',
        avatar: 'a1',
        token: 't2',
        color: '#5FE3BC',
        ready: true,
      },
    });
  const broadcast = vi.spyOn(transport, 'broadcast');
  room.getState().startGame();
  room.getState().startGame();
  const starts = broadcast.mock.calls.filter(
    ([m]: any) => m.k === 'SNAPSHOT' && m.events.some((e: any) => e.e === 'GAME_STARTED'),
  );
  expect(starts).toHaveLength(1);
});
it('annonce la fermeture aux invités avant de quitter le salon', async () => {
  const room = await load();
  await room.getState().createRoom('server');
  const broadcast = vi.spyOn(harness.instances[0], 'broadcast');
  room.getState().leaveRoom();
  expect(broadcast).toHaveBeenCalledWith({ k: 'CLOSED', reason: 'L’hôte a quitté le salon.' });
});
