import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createGame, applyCommand } from './engine.mjs';
export const PLATFORM_ORIGIN = () => process.env.PLATFORM_SHELL_ORIGIN || 'https://revanchegames-production.up.railway.app';
const sameSecret=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export async function platformRequest(kind, value, fetcher=fetch) {
  const key=process.env.PLATFORM_SHARED_SECRET;
  if(!key) throw Error('Connexion à Revanche Games indisponible.');
  const raw=JSON.stringify(value), stamp=String(Math.floor(Date.now()/1000));
  const signature=createHmac('sha256',key).update(`rg-fortune-${kind}-v1.${stamp}.${raw}`).digest('hex');
  const response=await fetcher(`${PLATFORM_ORIGIN()}/api/game/fortune-empire/${kind==='result'?'results':'identity'}`,{method:'POST',body:raw,headers:{'content-type':'application/json','x-rg-signature':`${stamp}.${signature}`},signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok) throw Error('Connexion à Revanche Games indisponible.');
  return response.json();
}
export async function accountFor(token){
  if(typeof token!=='string'||!token||token.length>8192||!process.env.PLATFORM_SHARED_SECRET)return null;
  const {identity}=await platformRequest('identity',{token});
  if(!identity||!/^([a-f0-9]{8}-[a-f0-9-]{27})$/i.test(identity.uid)||typeof identity.username!=='string')return null;
  return identity;
}
export function initializeRoom(room){
  room.instance=randomUUID();room.auth=new Map();room.admissions=new Map();room.pending=new Map();room.watchers=new Set();room.mirror=null;room.expected=new Map();room.integrity=true;room.resultQueued=false;room.eliminated=[];
}
export function authorizeSeat(room,id,proof,account){
  const seat=room.auth.get(id);
  if(seat){
    if(!sameSecret(seat.token,proof)&&!(account&&seat.uid===account.uid))throw Error('Cette place nécessite sa connexion d’origine.');
    if(account&&seat.uid&&seat.uid!==account.uid)throw Error('Cette place appartient à un autre compte.');
    if(account&&!seat.uid){if([...room.auth].some(([other,s])=>other!==id&&s.uid===account.uid))throw Error('Ce compte possède déjà une place.');seat.uid=account.uid;}
    return seat;
  }
  if(account&&[...room.auth].some(([other,s])=>other!==id&&s.uid===account.uid))throw Error('Ce compte possède déjà une place dans ce salon. Reviens depuis ton invitation.');
  const added={token:randomBytes(32).toString('base64url'),uid:account?.uid||null,name:account?.username||null};room.auth.set(id,added);return added;
}
export function startMirror(room,packet,hostId){
  if(room.mirror||!room.lastLobby?.started||typeof packet.seed!=='string'||packet.seed.length>100||!Number.isFinite(packet.startedAt))return;
  const seats=room.lastLobby.seats.map(s=>({id:s.id,name:s.name||'Joueur',avatar:s.avatar,color:s.color,token:s.token}));
  if(seats.length<2||seats.length>8||!seats.some(s=>s.id===hostId))return;
  const initial=createGame(room.code,seats,packet.seed);initial.startedAt=packet.startedAt;
  room.mirror=applyCommand(initial,{t:'START_GAME',by:hostId}).state;
  room.expected.set(room.mirror.version,room.mirror);
}
export function mirrorCommand(room,command){
  if(!room.mirror)return;
  const result=applyCommand(room.mirror,command);
  if(!result.rejected){room.mirror=result.state;room.expected.set(room.mirror.version,room.mirror);for(const event of result.events)if(event.e==='BANKRUPT'&&!room.eliminated.includes(event.player))room.eliminated.push(event.player);while(room.expected.size>256)room.expected.delete(room.expected.keys().next().value);}
}
export function mirrorClient(room,m){
  if(m.k==='INTENT')mirrorCommand(room,m.cmd);
  else if(room.mirror&&(m.k==='LEAVE'||m.k==='HELLO')){
    const id=m.id||m.seat?.id;
    if(room.mirror.players[id])mirrorCommand(room,{t:'SET_CONNECTED',by:id,connected:m.k==='HELLO'});
  }
}
export function verifySnapshot(room,state){
  if(!room.mirror)return false;
  const expected=room.expected.get(state?.version);
  if(!expected||!isDeepStrictEqual(expected,state)){room.integrity=false;return false;}
  for(const version of room.expected.keys())if(version<state.version)room.expected.delete(version);
  room.verifiedVersion=state.version;
  return room.integrity;
}
export function resultPayload(room){
  const s=room.mirror;
  if(!s||!room.integrity||s.phase!=='GAME_OVER'||!s.winner)return null;
  const eliminated=[...room.eliminated].reverse().filter(id=>id!==s.winner);
  const order=[s.winner,...eliminated,...s.order.filter(id=>id!==s.winner&&!eliminated.includes(id))];
  const seen=new Set();
  const players=order.map((id,i)=>{const p=s.players[id];let uid=room.auth.get(id)?.uid||null;if(uid&&seen.has(uid))uid=null;if(uid)seen.add(uid);return {userId:uid,name:p.name,outcome:id===s.winner?'win':'loss',score:p.cash,position:i+1};});
  return {game:'fortune-empire',room:room.code,instance:room.instance,startedAt:s.startedAt,endedAt:Date.now(),players};
}
export function enqueueResult(room,report=platformRequest){
  if(room.resultQueued||!process.env.PLATFORM_SHARED_SECRET)return;
  const result=resultPayload(room);if(!result||!result.players.some(p=>p.userId))return;
  room.resultQueued=true;
  const retry=async(attempt=0)=>{
    try{await report('result',result);}
    catch{if(attempt<5)setTimeout(()=>void retry(attempt+1),[1000,5000,15000,60000,180000][attempt]).unref();else console.error('[platform] Résultat en attente non transmis:',room.instance);}
  };void retry();
}
export function createAdapter(rooms,send){
  const snapshot=room=>({code:room.code,instance:room.instance,capacity:8,count:(room.lastLobby?.seats.length||0)+room.pending.size,status:room.lastLobby?.started?'started':'open'});
  const find=c=>{const room=rooms.get(c.room);if(!room?.lastLobby)throw Error('Salon fermé ou introuvable.');return room;};
  return {
    async inspect(c){
      const room=find(c),member=room.auth.get(c.proof.playerId);
      const uid=c.operation==='admit'?c.inviter:c.uid;
      if(!member||!sameSecret(member.token,c.proof.token)||!room.lastLobby.seats.some(s=>s.id===c.proof.playerId)||uid&&member.uid&&member.uid!==uid)throw Error('Présence dans le salon non vérifiée.');
      if(uid&&!member.uid){if([...room.auth].some(([id,s])=>id!==c.proof.playerId&&s.uid===uid))throw Error('Compte déjà présent.');member.uid=uid;}
      return {...snapshot(room),ownerUid:member.uid};
    },
    async admit(c){
      const room=find(c);
      if(room.instance!==c.instance)throw Error('Ce salon a été remplacé.');
      if(room.admissions.has(c.invitation)){const cached=room.admissions.get(c.invitation);if(room.lastLobby.seats.some(s=>s.id===cached.playerId))return cached;room.admissions.delete(c.invitation);}
      const existing=[...room.auth].find(([id,s])=>s.uid===c.uid&&room.lastLobby.seats.some(p=>p.id===id));
      if(existing){const session={code:room.code,playerId:existing[0],token:existing[1].token};room.admissions.set(c.invitation,session);return session;}
      if(room.lastLobby.started)throw Error('La partie a déjà commencé.');
      if(snapshot(room).count>=8)throw Error('Salon complet.');
      if(room.pending.has(c.uid))return room.pending.get(c.uid);
      const promise=(async()=>{
        const id=randomUUID(),seat=authorizeSeat(room,id,null,{uid:c.uid,username:c.name});
        try{
          await new Promise((resolve,reject)=>{
            const timeout=setTimeout(()=>{room.watchers.delete(changed);reject(Error('L’hôte ne répond pas. Réessaie.'));},5000);
            const changed=()=>{
              if(!rooms.has(room.code)||room.lastLobby.started&&!room.lastLobby.seats.some(s=>s.id===id)){clearTimeout(timeout);room.watchers.delete(changed);reject(Error('Salon fermé ou déjà lancé.'));}
              else if(room.lastLobby.seats.some(s=>s.id===id)){clearTimeout(timeout);room.watchers.delete(changed);resolve();}
            };room.watchers.add(changed);
            send(room.host,{type:'client',payload:{k:'HELLO',seat:{id,name:c.name.slice(0,32)||'Joueur',avatar:'a1',color:'#F5D97B',token:'t1',ready:false}}});
          });
          const session={code:room.code,playerId:id,token:seat.token};room.admissions.set(c.invitation,session);return session;
        }catch(error){room.auth.delete(id);send(room.host,{type:'client',payload:{k:'LEAVE',id}});throw error;}
      })();room.pending.set(c.uid,promise);
      try{return await promise;}finally{room.pending.delete(c.uid);}
    },
  };
}
