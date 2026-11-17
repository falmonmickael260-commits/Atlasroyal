import { nodeObserver } from '../admin-observer/server.mjs';
import http from 'node:http';
import { nodeConnector } from './game-connector.mjs';
import { initializeRoom, authorizeSeat, accountFor, createAdapter, startMirror, mirrorClient, verifySnapshot, enqueueResult } from './platform.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
export const rooms = new Map();
export const server = http.createServer(async (req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const pathname = new URL(req.url, 'http://local').pathname;
  if(await nodeObserver(req,res,'fortune-empire',(code,instance)=>{
    const room=rooms.get(code);if(!room||room.instance!==instance)return null;
    const s=room.mirror;
    return {code:room.code,started:!!room.lastLobby?.started,
      players:s?Object.values(s.players).map(p=>({id:p.id,name:p.name,cash:p.cash,position:p.position,inJail:p.inJail,bankrupt:p.bankrupt,connected:p.connected})):
        (room.lastLobby?.seats||[]).map(p=>({id:p.id,name:p.name})),
      board:s?{phase:s.phase,round:s.round,lastRoll:s.lastRoll,pot:s.pot,tiles:s.tiles,currentIndex:s.currentIndex,winner:s.winner}:null};
  }))return;
  if (pathname.startsWith('/api/platform/')) {
    try { if (await nodeConnector(req,res,'fortune-empire',platformAdapter)) return; }
    catch { res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Connexion indisponible.'}));return; }
    res.writeHead(404);res.end();return;
  }
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Fortune Empire OK');
    return;
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  let file = path.resolve(base, '.' + decoded);
  if (!file.startsWith(base + path.sep) && file !== base) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    if (path.extname(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    file = path.join(base, 'index.html');
  }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader(
    'Cache-Control',
    path.extname(file) === '.html' || path.basename(file) === 'manifest.json'
      ? 'no-cache'
      : /fortune-[a-f0-9]{12}\./.test(path.basename(file))
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300',
  );
  res.setHeader('Vary', 'Accept-Encoding');
  const accepted = String(req.headers['accept-encoding'] || '')
    .split(',')
    .map((value) => {
      const [name, ...params] = value.trim().split(';');
      const quality = params.find((p) => p.trim().startsWith('q='));
      return { name, q: quality ? Number(quality.trim().slice(2)) : 1 };
    });
  const quality = (name) =>
    accepted.find((e) => e.name === name)?.q ?? accepted.find((e) => e.name === '*')?.q ?? 0;
  const encoding = ['br', 'gzip']
    .filter((name) => quality(name) > 0 && fs.existsSync(file + (name === 'br' ? '.br' : '.gz')))
    .sort((a, b) => quality(b) - quality(a))[0];
  if (encoding) {
    res.setHeader('Content-Encoding', encoding);
    file += encoding === 'br' ? '.br' : '.gz';
  }
  res.setHeader('Content-Length', fs.statSync(file).size);
  if (req.method === 'HEAD') {
    res.writeHead(200);
    res.end();
    return;
  }
  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    res.writeHead(404);
    res.end();
  });
  stream.pipe(res);
});
const wsServer = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
export const heartbeat = () => {
  for (const ws of wsServer.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
};
const heartbeatTimer = setInterval(heartbeat, 30000);
heartbeatTimer.unref();
server.on('close', () => clearInterval(heartbeatTimer));
const send = (ws, msg) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
};
const fail = (ws, message) => {
  send(ws, { type: 'error', message });
  ws.close(1008, message);
};
const platformAdapter = createAdapter(rooms,send);
wsServer.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  let room = null,
    id = null,
    host = false;
  let authenticating = false;
  let windowStart = Date.now(),
    rate = 0;
  const timeout = setTimeout(() => fail(ws, 'Connexion au salon expirée.'), 10000);
  ws.on('message', async (raw) => {
    if (Date.now() - windowStart > 1000) {
      windowStart = Date.now();
      rate = 0;
    }
    if (++rate > 100) {
      fail(ws, 'Trop de messages.');
      return;
    }
    let packet;
    try {
      packet = JSON.parse(raw);
    } catch {
      fail(ws, 'Message invalide.');
      return;
    }
    if (packet === null || typeof packet !== 'object' || Array.isArray(packet)) {
      fail(ws, 'Message invalide.');
      return;
    }
    if (!room) {
      if (authenticating) return;
      if (
        packet.type !== 'connect' ||
        !/^([A-Z2-9]){5}$/.test(packet.code) ||
        typeof packet.id !== 'string' ||
        !packet.id ||
        packet.id.length > 100 ||
        typeof packet.host !== 'boolean'
      ) {
        fail(ws, 'Code de salon invalide.');
        return;
      }
      authenticating = true;
      let account;
      try { account = await accountFor(packet.rg_token); }
      catch { authenticating=false;fail(ws,'Connexion à Revanche Games indisponible. Réessaie.');return; }
      authenticating = false;
      if (ws.readyState !== WebSocket.OPEN) return;
      id = packet.id;
      host = packet.host === true;
      if (host) {
        if (rooms.has(packet.code)) {
          fail(ws, 'Ce code existe déjà. Réessayez de créer un salon.');
          return;
        }
        room = { code: packet.code, host: ws, peers: new Map(), lastLobby: null };
        initializeRoom(room);
        rooms.set(packet.code, room);
      } else {
        room = rooms.get(packet.code);
        if (!room) {
          fail(ws, 'Salon introuvable. Vérifiez le code.');
          return;
        }
        if (room.peers.size >= 8 && !room.peers.has(id)) {
          room = null;
          fail(ws, 'Salon complet.');
          return;
        }
      }
      if (room.peers.has(id)) {
        room = null;
        fail(ws, 'Ce joueur est déjà connecté dans un autre onglet.');
        return;
      }
      let seat;
      try { seat=authorizeSeat(room,id,packet.proof,account); }
      catch(error) { room=null;fail(ws,error.message);return; }
      room.peers.set(id, ws);
      clearTimeout(timeout);
      send(ws, { type: 'ready', token: seat.token });
      return;
    }
    if (packet.type === 'start' && host) { startMirror(room,packet,id);return; }
    if (packet.type === 'client') {
      const m = packet.payload;
      if (!m || typeof m.k !== 'string') return;
      if (
        m.k === 'HELLO' &&
        (!m.seat || m.seat.id !== id || typeof m.seat.name !== 'string' || m.seat.name.length > 32)
      )
        return;
      if (m.k === 'UPDATE_SEAT') {
        if (!m.patch || typeof m.patch !== 'object' || Array.isArray(m.patch)) return;
        const allowed = ['name', 'avatar', 'color', 'token', 'ready'];
        if (
          Object.entries(m.patch).some(
            ([key, value]) =>
              !allowed.includes(key) ||
              (key === 'ready'
                ? typeof value !== 'boolean'
                : typeof value !== 'string' || value.length > 64),
          )
        )
          return;
      }
      if (['UPDATE_SEAT', 'LEAVE', 'REQUEST_SYNC'].includes(m.k) && m.id !== id) return;
      if (m.k === 'INTENT' && m.cmd?.by !== id) return;
      if (!['HELLO', 'UPDATE_SEAT', 'LEAVE', 'REQUEST_SYNC', 'INTENT'].includes(m.k)) return;
      if (m.k==='HELLO' && room.auth.get(id)?.name) m.seat.name=room.auth.get(id).name.slice(0,32);
      mirrorClient(room,m);
      send(room.host, { type: 'client', payload: m });
    } else if (packet.type === 'server' && host) {
      const m = packet.payload;
      if (!m || !['LOBBY', 'SNAPSHOT', 'REJECT', 'CLOSED'].includes(m.k)) return;
      if (m.k==='LOBBY' && Array.isArray(m.lobby?.seats) && typeof m.lobby.started==='boolean') {room.lastLobby=m.lobby;for(const notify of [...room.watchers])notify();}
      if (m.k==='SNAPSHOT' && verifySnapshot(room,m.state) && m.state.phase==='GAME_OVER') enqueueResult(room);
      for (const peer of room.peers.values()) send(peer, { type: 'server', payload: m });
    }
  });
  ws.on('close', () => {
    clearTimeout(timeout);
    if (!room) return;
    if (host) {
      for (const peer of room.peers.values())
        if (peer !== ws) {
          send(peer, {
            type: 'server',
            payload: { k: 'CLOSED', reason: 'L’hôte a quitté le salon.' },
          });
          peer.close(1000);
        }
      rooms.delete(room.code);
      for(const notify of [...room.watchers])notify();
    } else if (room.peers.get(id) === ws) {
      room.peers.delete(id);
      mirrorClient(room,{k:'LEAVE',id});
      send(room.host, { type: 'client', payload: { k: 'LEAVE', id } });
    }
  });
  ws.on('error', () => {});
});
if (process.argv[1] === fileURLToPath(import.meta.url))
  server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () =>
    console.log('Fortune Empire ready, HTTP + rooms on', process.env.PORT || 8080),
  );
