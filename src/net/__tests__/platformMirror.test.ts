import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {runBotGame} from '../../engine/__tests__/bot';
import {SEATS} from '../../engine/__tests__/helpers';
// @ts-expect-error Node-only relay module; its runtime engine is bundled before tests.
import {initializeRoom,authorizeSeat,startMirror,mirrorClient,verifySnapshot,resultPayload} from '../../../server/platform.mjs';
it('vérifie chaque commande d’une vraie partie complète avant d’attribuer la victoire au compte du vainqueur',()=>{
 const room:any={code:'SIM',lastLobby:{seats:SEATS(4),started:true}};initializeRoom(room);
 const uids=Object.fromEntries(SEATS(4).map(s=>[s.id,randomUUID()]));
 for(const seat of SEATS(4))authorizeSeat(room,seat.id,null,{uid:uids[seat.id],username:seat.name});
 let checked=0;
 const {s}=runBotGame('platform-full-game',4,40000,(state,command)=>{
  if(!command)startMirror(room,{seed:'platform-full-game',startedAt:state.startedAt},state.order[0]);
  else mirrorClient(room,{k:'INTENT',cmd:command});
  expect(verifySnapshot(room,state)).toBe(true);checked++;
 });
 expect(checked).toBeGreaterThan(50);expect(s.phase).toBe('GAME_OVER');
 const result=resultPayload(room);
 expect(result.players.filter((p:any)=>p.outcome==='win')).toHaveLength(1);
 expect(result.players[0].userId).toBe(uids[s.winner!]);
 expect(result.players.filter((p:any)=>p.outcome==='loss')).toHaveLength(3);
 expect(room.integrity).toBe(true);
});
