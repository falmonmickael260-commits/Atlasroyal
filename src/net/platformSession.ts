export type PlatformSeat = {code:string;playerId:string;token:string};
const KEY='fortune-city:platform-seats';
const memory=new Map<string,PlatformSeat>();
export function nativeSeat(code:string):PlatformSeat|null {
 if(memory.has(code))return memory.get(code)!;
 try { const value=JSON.parse(localStorage.getItem(KEY)||'{}')[code];return value?.code===code&&typeof value.playerId==='string'&&typeof value.token==='string'?value:null; } catch{return null;}
}
export function saveNativeSeat(seat:PlatformSeat){
 memory.set(seat.code,seat);
 try {const seats=JSON.parse(localStorage.getItem(KEY)||'{}');delete seats[seat.code];seats[seat.code]=seat;localStorage.setItem(KEY,JSON.stringify(Object.fromEntries(Object.entries(seats).slice(-20))));} catch{/* Private storage can be disabled. */}
}
export function platformToken():string|null {
 try {const token=new URLSearchParams(location.search).get('rg_token');if(token)sessionStorage.setItem('fortune-city:rg-token',token);return token||sessionStorage.getItem('fortune-city:rg-token');}catch{return null;}
}
export function adoptNativeIdentity(seat:PlatformSeat){
 saveNativeSeat(seat);
 try {sessionStorage.setItem('fortune-city:id',JSON.stringify(seat.playerId));const ids=JSON.parse(localStorage.getItem('fortune-city:room-identities')||'{}');ids[seat.code]=seat.playerId;localStorage.setItem('fortune-city:room-identities',JSON.stringify(Object.fromEntries(Object.entries(ids).slice(-20))));}catch{/* Session still works in memory. */}
}
