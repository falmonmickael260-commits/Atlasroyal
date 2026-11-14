import type { Cinema } from '../cinema';
import type { GameState,PlayerId } from '../../engine/types';
const dots: Record<number,number[]>={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
const Die=({value,rolling}:{value:number;rolling:boolean})=><svg className={rolling?'roll-result__die roll-result__die--rolling':'roll-result__die'} viewBox="0 0 44 44" role="img" aria-label={rolling?'Dé en mouvement':`Dé ${value}`}><rect x="1" y="1" width="42" height="42" rx="10" fill="#f1eadb" stroke="#b69b67"/>{(dots[value]??[]).map(n=><circle key={n} cx={12+(n%3)*10} cy={12+Math.floor(n/3)*10} r="3" fill="#123039"/>)}</svg>;
export const RollResult=({dice,state,me}:{dice:Cinema['dice'];state:GameState;me:PlayerId})=>{
 if(!dice)return null;
 const name=state.players[dice.player]?.name??'Joueur';
 const replay=state.order[state.currentIndex]===dice.player&&state.doubles>0&&!state.players[dice.player]?.inJail;
 let detail='';
 if(!dice.rolling&&dice.isDouble){
  if(dice.jail)detail='Double · libéré, sans relance';
  else if(dice.streak>=3)detail='Troisième double · prison';
  else if(state.players[dice.player]?.inJail)detail='Double · envoyé en prison';
  else if(replay)detail=state.pending?'Double · relance après votre décision':dice.player===me?'Double · vous rejouez':`Double · ${name} rejoue`;
  else detail='Double';
 }
 return <aside className={`roll-result glass${detail?' roll-result--double':''}`} aria-label="Résultat des dés" aria-live="polite">
  <span className="roll-result__name">{name}{dice.rolling?' · lancer en cours':' · dernier lancer'}</span>
  <div className="roll-result__values"><Die value={dice.values[0]} rolling={dice.rolling}/><span>+</span><Die value={dice.values[1]} rolling={dice.rolling}/><strong>{dice.rolling?'…':`= ${dice.values[0]+dice.values[1]}`}</strong></div>
  {detail&&<strong className="roll-result__detail">{detail}</strong>}
 </aside>;
};
