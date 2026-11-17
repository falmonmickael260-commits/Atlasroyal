import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { ServerTransport } from '../serverTransport';
class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.();
  });
  constructor() {
    Socket.instances.push(this);
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  Socket.instances = [];
  vi.stubGlobal('location', { href: 'https://example.test/', protocol: 'https:' });
  vi.stubGlobal('WebSocket', Socket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('ferme le socket quand la connexion échoue', async () => {
  const t = new ServerTransport('ABCDE', 'a', false);
  const promise = t.connect();
  Socket.instances[0].emit({ type: 'error', message: 'Salon introuvable' });
  await expect(promise).rejects.toThrow('Salon introuvable');
  expect(Socket.instances[0].close).toHaveBeenCalledOnce();
});
it('ferme une connexion expirée et annonce la bonne erreur', async () => {
  const t = new ServerTransport('ABCDE', 'a', false);
  const pending = expect(t.connect()).rejects.toThrow('Le serveur ne répond pas');
  await vi.advanceTimersByTimeAsync(10000);
  await pending;
  expect(Socket.instances[0].close).toHaveBeenCalledOnce();
});
it('ignore une réponse mal formée sans casser la connexion', async () => {
  const t = new ServerTransport('ABCDE', 'a', false);
  const pending = t.connect();
  const socket = Socket.instances[0];
  expect(() => socket.emit(null)).not.toThrow();
  expect(() => socket.emit([])).not.toThrow();
  socket.emit({ type: 'ready' });
  await pending;
  t.close();
});
