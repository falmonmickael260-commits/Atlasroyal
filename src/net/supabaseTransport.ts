import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { BaseTransport } from './transport';
import type { ClientMsg, ServerMsg } from './protocol';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;
const getClient = () => {
  if (!URL || !KEY) throw new Error('Supabase non configuré');
  client ??= createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 20 } } });
  return client;
};

/**
 * Transport Supabase Realtime : une `channel` par salon, deux évènements
 * broadcast (`to_host`, `to_all`). L'hôte reste l'autorité ; le schéma
 * `supabase/schema.sql` prépare le passage à une Edge Function.
 */
export class SupabaseTransport extends BaseTransport {
  readonly kind = 'supabase' as const;
  private channel: RealtimeChannel | null = null;

  constructor(private roomCode: string, private selfId: string) { super(); }

  async connect() {
    const ch = getClient().channel(`atlas:${this.roomCode}`, {
      config: { broadcast: { self: false, ack: false } },
    });
    ch.on('broadcast', { event: 'to_host' }, ({ payload }) => {
      this.emitClient(payload as ClientMsg);
    });
    ch.on('broadcast', { event: 'to_all' }, ({ payload }) => {
      this.emitServer(payload as ServerMsg);
    });
    await new Promise<void>((resolve, reject) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(status));
      });
    });
    this.channel = ch;
  }

  sendToHost(msg: ClientMsg) {
    this.channel?.send({ type: 'broadcast', event: 'to_host', payload: msg });
    this.emitClient(msg); // l'hôte traite aussi ses propres intentions
  }

  broadcast(msg: ServerMsg) {
    this.channel?.send({ type: 'broadcast', event: 'to_all', payload: msg });
    this.emitServer(msg);
  }

  close() {
    if (this.channel) getClient().removeChannel(this.channel);
    this.channel = null;
  }

  get id() { return this.selfId; }
}
