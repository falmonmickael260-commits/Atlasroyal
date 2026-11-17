import { nativeSeat, saveNativeSeat, platformToken } from './platformSession';
import { BaseTransport } from './transport';
import type { ClientMsg, ServerMsg } from './protocol';
export class ServerTransport extends BaseTransport {
  readonly kind = 'server' as const;
  private socket: WebSocket | null = null;
  private closed = false;
  constructor(
    private code: string,
    private id: string,
    private host: boolean,
  ) {
    super();
  }
  async connect() {
    const url = new URL('/ws', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.closed = false;
    const ws = (this.socket = new WebSocket(url));
    try {
      await new Promise<void>((resolve, reject) => {
        let ready = false;
        const timeout = setTimeout(
          () => reject(new Error('Le serveur ne répond pas. Réessayez.')),
          10000,
        );
        ws.onopen = () =>
          ws.send(
            JSON.stringify({ type: 'connect', code: this.code, id: this.id, host: this.host, proof: nativeSeat(this.code)?.token, rg_token: platformToken() }),
          );
        ws.onmessage = (event) => {
          let data;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }
          if (!data || typeof data !== 'object' || Array.isArray(data)) return;
          if (data.type === 'ready') {
            if (data.token) saveNativeSeat({code:this.code,playerId:this.id,token:data.token});
            ready = true;
            clearTimeout(timeout);
            resolve();
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            reject(new Error(data.message));
          } else if (data.type === 'client' && this.host)
            this.emitClient(data.payload as ClientMsg);
          else if (data.type === 'server') this.emitServer(data.payload as ServerMsg);
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Connexion au salon impossible. Vérifiez votre connexion.'));
        };
        ws.onclose = () => {
          clearTimeout(timeout);
          if (!ready) reject(new Error('Connexion au salon interrompue.'));
          else if (!this.closed)
            this.emitServer({
              k: 'CLOSED',
              reason:
                'Connexion au salon interrompue. Rechargez pour tenter de rejoindre la partie.',
              recoverable: true,
            });
        };
      });
    } catch (error) {
      this.close();
      throw error;
    }
  }
  startVerifiedGame(seed: string, startedAt: number) {
    if(this.socket?.readyState===WebSocket.OPEN) this.socket.send(JSON.stringify({type:'start',seed,startedAt}));
  }
  sendToHost(payload: ClientMsg) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: 'client', payload }));
  }
  broadcast(payload: ServerMsg) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type: 'server', payload }));
  }
  close() {
    this.closed = true;
    this.socket?.close();
    this.socket = null;
  }
}
