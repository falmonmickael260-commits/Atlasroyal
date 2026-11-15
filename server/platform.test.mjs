import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initializeRoom,authorizeSeat,startMirror,mirrorClient,verifySnapshot,resultPayload,enqueueResult,createAdapter,platformRequest} from './platform.mjs';
import {createGame,applyCommand} from './engine.mjs';
const seats=()=>[{id:'alice',name:'Alice',avatar:'a1',color:'#abc',token:'t1'},{id:'bob',name:'Bob',avatar:'a2',color:'#def',token:'t2'}];
function fixture(){const room={code:'ABCD2',lastLobby:{seats:seats(),started:true}};initializeRoom(room);return room;}
test('Le même moteur vérifie le lancement et les commandes successives même si le navigateur a du retard',()=>{
 const room=fixture(),startedAt=12345;startMirror(room,{seed:'test',startedAt},'alice');
 let s=createGame(room.code,seats(),'test');s.startedAt=startedAt;s=applyCommand(s,{t:'START_GAME',by:'alice'}).state;
 const first=structuredClone(s),cmd={t:'ROLL_DICE',by:s.order[s.currentIndex]};
 s=applyCommand(s,cmd).state;mirrorClient(room,{k:'INTENT',cmd});
 assert(verifySnapshot(room,first));assert(verifySnapshot(room,s));
 const forged=structuredClone(s);forged.players.alice.cash+=1;assert.equal(verifySnapshot(room,forged),false);
 assert.equal(resultPayload(room),null);
});
test('Une place a une preuve secrète, les comptes et les invités restent distincts',()=>{
 const room=fixture(),uid=randomUUID();const seat=authorizeSeat(room,'alice',null,{uid,username:'Alice'});
 assert.equal(authorizeSeat(room,'alice',seat.token,null),seat);
 assert.throws(()=>authorizeSeat(room,'alice','wrong',null));
 assert.throws(()=>authorizeSeat(room,'alice',seat.token,{uid:randomUUID(),username:'Intrus'}));
 assert.throws(()=>authorizeSeat(room,'other',null,{uid,username:'Alice'}));
 assert.equal(authorizeSeat(room,'bob',null,null).uid,null);
});
test('Invitation native idempotente, refus du salon lancé, complet et des preuves étrangères',async()=>{
 const room=fixture();room.lastLobby.started=false;room.lastLobby.seats=seats().slice(0,1);
 const uid=randomUUID(),bob=randomUUID(),rooms=new Map([[room.code,room]]);const proof=authorizeSeat(room,'alice',null,{uid,username:'Alice'});
 const command={room:room.code,uid:bob,inviter:uid,operation:'admit',instance:room.instance,invitation:randomUUID(),name:'Bob',proof:{code:room.code,playerId:'alice',token:proof.token}};
 const adapter=createAdapter(rooms,(_host,packet)=>{
  if(packet.payload.k==='HELLO'){room.lastLobby.seats.push(packet.payload.seat);queueMicrotask(()=>{for(const f of [...room.watchers])f();});}
 });
 assert.equal((await adapter.inspect(command)).count,1);
 const session=await adapter.admit(command);assert.equal(room.lastLobby.seats.length,2);
 assert.deepEqual(await adapter.admit(command),session);assert.equal(room.lastLobby.seats.length,2);
 assert.deepEqual(await adapter.admit({...command,invitation:randomUUID()}),session);
 await assert.rejects(adapter.inspect({...command,proof:{...command.proof,token:'wrong'}}));
 room.lastLobby.started=true;await assert.rejects(adapter.admit({...command,uid:randomUUID(),invitation:randomUUID()}),/commencé/);
 room.lastLobby.started=false;room.lastLobby.seats=Array.from({length:8},(_,i)=>({id:String(i)}));
 await assert.rejects(adapter.admit({...command,uid:randomUUID(),invitation:randomUUID()}),/complet/);
});
test('Résultat unique, vainqueur réel, invité sans compte, et requête signée côté serveur',async()=>{
 const room=fixture();authorizeSeat(room,'alice',null,{uid:randomUUID(),username:'Alice'});authorizeSeat(room,'bob',null,null);
 startMirror(room,{seed:'result',startedAt:1},'alice');
 assert.equal(resultPayload(room),null);
 room.mirror={...room.mirror,phase:'GAME_OVER',winner:'alice'};
 const payload=resultPayload(room);assert.equal(payload.players[0].outcome,'win');assert.equal(payload.players[1].userId,null);
 assert.equal(payload.players[1].outcome,'loss');
 const old=process.env.PLATFORM_SHARED_SECRET;process.env.PLATFORM_SHARED_SECRET='test-only-platform-key';
 try{
  let calls=0;enqueueResult(room,async(kind,data)=>{calls++;assert.equal(kind,'result');assert.equal(data.instance,room.instance);});enqueueResult(room);assert.equal(calls,1);
  await platformRequest('result',payload,async(url,init)=>{assert(url.endsWith('/results'));assert(init.headers['x-rg-signature']);assert.equal(JSON.parse(init.body).instance,room.instance);return Response.json({id:randomUUID()});});
 }finally{if(old===undefined)delete process.env.PLATFORM_SHARED_SECRET;else process.env.PLATFORM_SHARED_SECRET=old;}
});
