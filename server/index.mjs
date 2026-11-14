import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer, WebSocket} from 'ws';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.pck':'application/octet-stream','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
export const rooms=new Map();
export const server=http.createServer((req,res)=>{
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('X-Content-Type-Options','nosniff');
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('Fortune Empire OK');return;}
 let decoded;try{decoded=decodeURIComponent(pathname);}catch{res.writeHead(400);res.end();return;}
 let file=path.resolve(base,'.'+decoded);
 if(!file.startsWith(base+path.sep)&&file!==base){res.writeHead(403);res.end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){if(path.extname(file)){res.writeHead(404);res.end();return;}file=path.join(base,'index.html');}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
 res.setHeader('Cache-Control',path.extname(file)==='.html'?'no-cache':'public, max-age=300');
 const stream=fs.createReadStream(file);stream.on('error',()=>{res.writeHead(404);res.end();});stream.pipe(res);
});
const wsServer=new WebSocketServer({server,path:'/ws',maxPayload:256*1024});
const send=(ws,msg)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));};
const fail=(ws,message)=>{send(ws,{type:'error',message});ws.close(1008,message);};
wsServer.on('connection',(ws)=>{
 let room=null,id=null,host=false;let windowStart=Date.now(),rate=0;
 const timeout=setTimeout(()=>fail(ws,'Connexion au salon expirée.'),10000);
 ws.on('message',(raw)=>{
  if(Date.now()-windowStart>1000){windowStart=Date.now();rate=0;}if(++rate>100){fail(ws,'Trop de messages.');return;}
  let packet;try{packet=JSON.parse(raw);}catch{fail(ws,'Message invalide.');return;}
  if(!room){
   if(packet.type!=='connect'||!/^([A-Z2-9]){5}$/.test(packet.code)||typeof packet.id!=='string'||packet.id.length>100){fail(ws,'Code de salon invalide.');return;}
   id=packet.id;host=packet.host===true;
   if(host){if(rooms.has(packet.code)){fail(ws,'Ce code existe déjà. Réessayez de créer un salon.');return;}room={code:packet.code,host:ws,peers:new Map(),lastLobby:null};rooms.set(packet.code,room);}
   else{room=rooms.get(packet.code);if(!room){fail(ws,'Salon introuvable. Vérifiez le code.');return;}if(room.peers.size>=8&&!room.peers.has(id)){room=null;fail(ws,'Salon complet.');return;}}
   if(room.peers.has(id)){room=null;fail(ws,'Ce joueur est déjà connecté dans un autre onglet.');return;}
   room.peers.set(id,ws);clearTimeout(timeout);send(ws,{type:'ready'});return;
  }
  if(packet.type==='client'){
   const m=packet.payload;if(!m||typeof m.k!=='string')return;
   if(m.k==='HELLO'&&m.seat?.id!==id)return;
   if(['UPDATE_SEAT','LEAVE','REQUEST_SYNC'].includes(m.k)&&m.id!==id)return;
   if(m.k==='INTENT'&&m.cmd?.by!==id)return;
   if(!['HELLO','UPDATE_SEAT','LEAVE','REQUEST_SYNC','INTENT'].includes(m.k))return;
   send(room.host,{type:'client',payload:m});
  }else if(packet.type==='server'&&host){
   const m=packet.payload;if(!m||!['LOBBY','SNAPSHOT','REJECT','CLOSED'].includes(m.k))return;
   for(const peer of room.peers.values())send(peer,{type:'server',payload:m});
  }
 });
 ws.on('close',()=>{
  clearTimeout(timeout);if(!room)return;
  if(host){for(const peer of room.peers.values())if(peer!==ws){send(peer,{type:'server',payload:{k:'CLOSED',reason:'L’hôte a quitté le salon.'}});peer.close(1000);}rooms.delete(room.code);}
  else if(room.peers.get(id)===ws){room.peers.delete(id);send(room.host,{type:'client',payload:{k:'LEAVE',id}});}
 });
 ws.on('error',()=>{});
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Fortune Empire ready, HTTP + rooms on',process.env.PORT||8080));
