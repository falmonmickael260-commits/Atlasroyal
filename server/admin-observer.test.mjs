import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {server,rooms} from './index.mjs';
test('spectateur : miroir public sans RNG, pioche ni authentification et sans place',async()=>{
 const previous=process.env.PLATFORM_SHARED_SECRET;process.env.PLATFORM_SHARED_SECRET='local-observer-test-key';
 const room={code:'ADMIN',instance:randomUUID(),lastLobby:{started:true,seats:[{id:'p1',name:'Alice',token:'PRIVATE-SEAT'}]},auth:new Map([['p1',{token:'PRIVATE-TOKEN'}]]),
  mirror:{players:{p1:{id:'p1',name:'Alice',cash:1000,position:5,connected:true,token:'PRIVATE-TOKEN'}},phase:'AWAIT_ROLL',round:1,lastRoll:null,pot:0,tiles:{},currentIndex:0,winner:null,rng:9876,decks:{chance:['PRIVATE-DECK']}}};
 rooms.set(room.code,room);
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
  const raw=JSON.stringify({v:1,game:'fortune-empire',operation:'snapshot',actor:randomUUID(),access:randomUUID(),room:room.code,instance:room.instance});
  const stamp=String(Math.floor(Date.now()/1000)),signature=`${stamp}.${createHmac('sha256',process.env.PLATFORM_SHARED_SECRET).update(`rg-admin-observer-v1.${stamp}.${raw}`).digest('hex')}`;
  const response=await fetch(`http://127.0.0.1:${port}/api/platform/observer`,{method:'POST',headers:{'x-rg-signature':signature},body:raw});
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.publicState.players[0].cash,1000);
  assert.equal(JSON.stringify(data).includes('PRIVATE'),false);assert.equal('rng' in data.publicState.board,false);
  assert.equal(room.lastLobby.seats.length,1);assert.equal(room.auth.size,1);
 }finally{rooms.delete(room.code);await new Promise(resolve=>server.close(resolve));if(previous===undefined)delete process.env.PLATFORM_SHARED_SECRET;else process.env.PLATFORM_SHARED_SECRET=previous;}
});
