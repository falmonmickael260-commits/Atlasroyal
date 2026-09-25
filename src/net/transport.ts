import type { ClientMsg, ServerMsg } from './protocol';

export type TransportRole = 'host' | 'client';

/**
 * Canal de diffusion abstrait. Deux implémentations :
 * `LocalTransport` (BroadcastChannel, multi-onglets) et `SupabaseTransport`
 * (Realtime broadcast). L'autorité est toujours l'hôte : le transport ne
 * fait que véhiculer des messages.
 */
export interface Transport {
  readonly kind: 'local' | 'supabase';
  connect(): Promise<void>;
  /** Client → autorité. */
  sendToHost(msg: ClientMsg): void;
  /** Autorité → tous. */
  broadcast(msg: ServerMsg): void;
  onClientMsg(cb: (msg: ClientMsg) => void): () => void;
  onServerMsg(cb: (msg: ServerMsg) => void): () => void;
  close(): void;
}

type Listener<T> = (msg: T) => void;

export abstract class BaseTransport implements Transport {
  abstract readonly kind: 'local' | 'supabase';
  protected clientListeners = new Set<Listener<ClientMsg>>();
  protected serverListeners = new Set<Listener<ServerMsg>>();

  abstract connect(): Promise<void>;
  abstract sendToHost(msg: ClientMsg): void;
  abstract broadcast(msg: ServerMsg): void;
  abstract close(): void;

  onClientMsg(cb: Listener<ClientMsg>) {
    this.clientListeners.add(cb);
    return () => this.clientListeners.delete(cb);
  }
  onServerMsg(cb: Listener<ServerMsg>) {
    this.serverListeners.add(cb);
    return () => this.serverListeners.delete(cb);
  }
  protected emitClient(m: ClientMsg) { for (const l of this.clientListeners) l(m); }
  protected emitServer(m: ServerMsg) { for (const l of this.serverListeners) l(m); }
}
