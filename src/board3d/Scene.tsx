import { useEffect, useRef, useState } from 'react';
import type { Cinema } from '../ui/cinema';
import type { GameState, PlayerId } from '../engine/types';
export const Scene = ({state,cinema}: {
 state: GameState; cinema: Cinema; compact: boolean; activePlayer: PlayerId|null;
 onContextLost?:()=>void; labels: React.RefObject<Map<PlayerId,HTMLElement|null>>;
}) => {
 const [loaded,setLoaded]=useState(false);
 const frame=useRef<HTMLIFrameElement>(null);
 const latest=useRef('');
 latest.current=JSON.stringify({type:'fortune-state',state,cinema,reduced:typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches});
 const send=()=>frame.current?.contentWindow?.postMessage(latest.current,location.origin);
 useEffect(()=>{send();},[state,cinema]);
 useEffect(()=>{
  const ready=(event:MessageEvent)=>{
   if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;
   try{const data=JSON.parse(event.data);if(data?.type==='fortune-ready')send();if(data?.type==='fortune-rendered')setLoaded(true);}catch{/* unrelated frame event */}
  };
  window.addEventListener('message',ready);return()=>window.removeEventListener('message',ready);
 },[]);
 return <><iframe ref={frame} title="Plateau Fortune Empire" src="/godot/index.html?renderer=1" onLoad={send}
  style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0,pointerEvents:'none'}} allow="autoplay" />{!loaded&&<div role="status" style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',padding:20,background:'#091e25',color:'#d6b982',borderRadius:12}}>Chargement du plateau…</div>}</>;
};
