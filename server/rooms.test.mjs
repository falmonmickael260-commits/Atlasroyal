import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {server} from './index.mjs';
const connect=(port,packet)=>new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);ws.once('open',()=>ws.send(JSON.stringify(packet)));ws.once('message',raw=>resolve({ws,message:JSON.parse(raw)}));ws.once('error',reject);});
const next=ws=>new Promise(resolve=>ws.once('message',raw=>resolve(JSON.parse(raw))));
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
test('rooms relay host and guest, reject unknown rooms and close with host',async()=>{
 const missing=await connect(port,{type:'connect',code:'ABCDE',id:'missing',host:false});assert.equal(missing.message.type,'error');missing.ws.close();
 const host=await connect(port,{type:'connect',code:'ABCDE',id:'alice',host:true});assert.equal(host.message.type,'ready');
 const guest=await connect(port,{type:'connect',code:'ABCDE',id:'bob',host:false});assert.equal(guest.message.type,'ready');
 let received=next(host.ws);guest.ws.send(JSON.stringify({type:'client',payload:{k:'HELLO',seat:{id:'bob',name:'Bob'}}}));assert.equal((await received).payload.seat.id,'bob');
 const h=next(host.ws),g=next(guest.ws);host.ws.send(JSON.stringify({type:'server',payload:{k:'LOBBY',lobby:{roomCode:'ABCDE'}}}));assert.equal((await h).payload.k,'LOBBY');assert.equal((await g).payload.k,'LOBBY');
 const closed=next(guest.ws);host.ws.close();assert.equal((await closed).payload.k,'CLOSED');guest.ws.close();
});
test.after(()=>new Promise(resolve=>server.close(resolve)));
