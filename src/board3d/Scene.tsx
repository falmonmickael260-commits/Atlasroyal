import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Cinema } from '../ui/cinema';
import type { GameState, PlayerId } from '../engine/types';

type LoadState={loaded:boolean;progress:number;engineReady:boolean;error:string|null;attempt:number};
let loading:LoadState={loaded:false,progress:0,engineReady:false,error:null,attempt:0};
const listeners=new Set<()=>void>();
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
const snapshot=()=>loading;
const update=(patch:Partial<LoadState>)=>{
 if(Object.entries(patch).every(([k,v])=>loading[k as keyof LoadState]===v))return;
 loading={...loading,...patch};for(const fn of listeners)fn();
};
let canvasFrame:HTMLIFrameElement|null=null;
let latest='';
let labelElements:React.RefObject<Map<PlayerId,HTMLElement|null>>|null=null;
const send=()=>{if(latest)canvasFrame?.contentWindow?.postMessage(latest,location.origin);};
export const useBoardPreparation=()=>useSyncExternalStore(subscribe,snapshot,snapshot);

/** One renderer is retained from the lobby into the game, including its compiled shaders. */
export const BoardFrame=({active,visible}:{active:boolean;visible:boolean})=>{
 const frame=useRef<HTMLIFrameElement>(null);
 const {attempt}=useBoardPreparation();
 useEffect(()=>{
  if(!active){latest='';update({loaded:false,progress:0,engineReady:false,error:null});return;}
  canvasFrame=frame.current;
  const receive=(event:MessageEvent)=>{
   if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;
   try{
    const data=JSON.parse(event.data);
    if(data?.type==='fortune-pawns'&&data.width>0&&data.height>0){
     const width=frame.current?.clientWidth??0,height=frame.current?.clientHeight??0;
     for(const [id,point] of Object.entries(data.positions) as [string,{x:number;y:number;visible:boolean;stack:number}][]){
      const label=labelElements?.current.get(id);if(!label)continue;
      label.style.transform=`translate3d(${Math.round(point.x/data.width*width)}px, ${Math.round(point.y/data.height*height-point.stack*19)}px, 0) translate(-50%, -50%)`;
      label.style.opacity=point.visible?'1':'0';
     }
    }
    if(data?.type==='fortune-ready'){update({progress:98,engineReady:true});send();}
    if(data?.type==='fortune-rendered')update({loaded:true,error:null});
    if(data?.type==='fortune-loading')update({progress:Math.min(95,Math.max(0,Number(data.progress)||0))});
    if(data?.type==='fortune-error')update({error:'Le plateau 3D n’a pas pu démarrer.'});
   }catch{/* unrelated frame event */}
  };
  window.addEventListener('message',receive);
  return()=>{window.removeEventListener('message',receive);canvasFrame=null;};
 },[active,attempt]);
 if(!active)return null;
 return <iframe key={attempt} ref={frame} title="Plateau Fortune Empire" src="/godot/index.html?renderer=1" onLoad={()=>{canvasFrame=frame.current;send();}}
  style={{position:'fixed',inset:0,width:'100%',height:'100%',border:0,pointerEvents:'none',visibility:visible?'visible':'hidden',zIndex:0}} allow="autoplay"/>;
};

export const Scene=({state,cinema,onReadyChange,labels}:{
 state:GameState;cinema:Cinema;compact:boolean;activePlayer:PlayerId|null;
 onContextLost?:()=>void;labels:React.RefObject<Map<PlayerId,HTMLElement|null>>;
 onReadyChange?:(ready:boolean)=>void;
})=>{
 const {loaded,progress,error}=useBoardPreparation();
 useEffect(()=>{
  labelElements=labels;
  latest=JSON.stringify({type:'fortune-state',state,cinema,reduced:typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches});
  send();
 },[state,cinema,labels]);
 useEffect(()=>{onReadyChange?.(loaded);},[loaded,onReadyChange]);
 if(loaded)return null;
 return <div className="stage-loader" role="status">
  <img className="stage-loader__logo" src={`${import.meta.env.BASE_URL}ui/logo.webp`} alt="Fortune Empire"/>
  <strong>{error??(progress>=95?'Installation de votre table…':'Préparation du plateau…')}</strong>
  {!error&&<><progress aria-label="Chargement du plateau" max={100} value={progress}/><span>{progress} %</span></>}
  {error&&<button className="btn btn--accent" onClick={()=>update({loaded:false,progress:0,engineReady:false,error:null,attempt:loading.attempt+1})}>Réessayer le plateau</button>}
 </div>;
};
