import { BaseTransport } from './transport';
import type { ClientMsg, ServerMsg } from './protocol';

/**
 * Transport multi-onglets d'une même machine (BroadcastChannel).
 * Parfait pour tester une partie à 6 dans 6 onglets, et pour jouer
 * en local sans backend. Le message est renvoyé aussi à l'émetteur
 * quand celui-ci est l'hôte, pour que l'hôte traite ses propres intentions.
 */
export class LocalTransport extends BaseTransport {
  readonly kind = 'local' as const;
  private ch: BroadcastChannel | null = null;

  constructor(private roomCode: string) { super(); }

  async connect() {
    this.ch = new BroadcastChannel(`atlas-royale:${this.roomCode}`);
    this.ch.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as ClientMsg | ServerMsg;
      if ('k' in msg && (msg.k === 'LOBBY' || msg.k === 'SNAPSHOT' || msg.k === 'REJECT' || msg.k === 'CLOSED')) {
        this.emitServer(msg as ServerMsg);
      } else {
        this.emitClient(msg as ClientMsg);
      }
    };
  }

  sendToHost(msg: ClientMsg) {
    this.ch?.postMessage(msg);
    // L'hôte est aussi un joueur : il doit voir sa propre intention.
    this.emitClient(msg);
  }

  broadcast(msg: ServerMsg) {
    this.ch?.postMessage(msg);
    this.emitServer(msg);
  }

  close() { this.ch?.close(); this.ch = null; }
}
