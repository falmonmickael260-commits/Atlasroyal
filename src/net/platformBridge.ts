import {useRoom} from './room';
import {nativeSeat,adoptNativeIdentity,type PlatformSeat} from './platformSession';
const GAME='fortune-empire';
const origin=()=>import.meta.env.VITE_PLATFORM_ORIGIN||'https://revanchegames-production.up.railway.app';
export const platformEmbedded=()=>window.parent!==window;
const validSeat=(s:PlatformSeat)=>s&&/^[A-Z2-9]{5}$/.test(s.code)&&typeof s.playerId==='string'&&s.playerId.length<=100&&typeof s.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s.token);
export function startPlatformBridge(){
 let launch:string|null=null,adopted:string|null=null,booting=false,booted=false,last='',sent=0;
 const embedded=platformEmbedded(),platform=origin();
 const ready=()=>{if(embedded&&!launch)window.parent.postMessage({type:'rg:ready',v:1,game:GAME},platform);};
 const session=()=>{const s=useRoom.getState();return s.mode==='server'&&s.lobby?nativeSeat(s.lobby.roomCode):null;};
 const publish=()=>{if(!embedded||!launch)return;const value=session(),raw=JSON.stringify(value);if(raw===last&&Date.now()-sent<20000)return;last=raw;sent=Date.now();window.parent.postMessage({type:'rg:room',v:1,game:GAME,launch,session:value},platform);};
 const receive=async(event:MessageEvent)=>{
  const d=event.data;
  if(!embedded||event.source!==window.parent||event.origin!==platform||d?.type!=='rg:bootstrap'||d.v!==1||d.game!==GAME||typeof d.launch!=='string')return;
  launch=d.launch;launchId=d.launch;
  if(booting)return;
  booting=true;
  try{
   const name=d.identity?.username;
   if(typeof name==='string')useRoom.getState().setIdentity({name:name.slice(0,32)});
   if(d.admission&&d.admission.id!==adopted){
    const seat=d.admission.session as PlatformSeat;
    if(!validSeat(seat))throw Error('Invitation invalide.');
    const current=useRoom.getState();
    if(current.lobby?.roomCode!==seat.code||current.identity.id!==seat.playerId){
     adoptNativeIdentity(seat);useRoom.setState({identity:{...current.identity,id:seat.playerId}});
     await useRoom.getState().joinRoom(seat.code,'server');
     if(useRoom.getState().lobby?.roomCode!==seat.code)throw Error('Connexion au salon interrompue.');
    }
    adopted=d.admission.id;booted=true;
   }else if(!booted){booted=true;await launchOrResume();}
   publish();
  }catch(error){useRoom.setState({error:error instanceof Error?error.message:'Invitation indisponible.'});window.parent.postMessage({type:'rg:join-error',v:1,game:GAME,launch},platform);}
  finally{booting=false;}
 };
 const listener=(event:MessageEvent)=>{void receive(event);};
 window.addEventListener('message',listener);
 const unsubscribe=useRoom.subscribe(publish);
 const timer=setInterval(()=>{ready();publish();},1000);
 ready();
 if(!embedded)void launchOrResume();
 return()=>{clearInterval(timer);unsubscribe();window.removeEventListener('message',listener);};
}
async function launchOrResume(){
 const code=new URLSearchParams(location.search).get('rg_room');
 if(code&&/^[A-Z2-9]{5}$/.test(code.toUpperCase())){
  const s=useRoom.getState();if(!s.identity.name)s.setIdentity({name:'Invité'});
  await s.joinRoom(code,'server');
 }else await useRoom.getState().resume();
}
export async function invitePlatformFriend(){
 if(platformEmbedded()){window.parent.postMessage({type:'rg:invite-request',v:1,game:GAME,launch:currentLaunch()},origin());return;}
 const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
 try{
  const state=useRoom.getState(),seat=state.lobby?nativeSeat(state.lobby.roomCode):null;
  if(!seat)throw Error('Crée ou rejoins un salon avant d’inviter.');
  const response=await fetch('/api/platform/context',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session:seat,identity:null})});
  const value=await response.json();if(!response.ok)throw Error(value.error||'Invitation indisponible.');
  const url=`${origin()}/invite?context=${encodeURIComponent(value.context)}`;
  if(tab)tab.location.href=url;else window.location.href=url;
 }catch(error){tab?.close();useRoom.setState({toast:error instanceof Error?error.message:'Invitation indisponible.'});}
}
let launchId:string|null=null;
function currentLaunch(){return launchId;}
