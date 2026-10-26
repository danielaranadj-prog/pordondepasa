import type {Option,Point} from './router.ts';
import manifest from './dataset-manifest.json' with {type:'json'};
export const JOURNEY_KEY='pordondepasa:active-journey:v1';
export const DATASET_VERSION=manifest.version;
export type JourneySession={version:1;dataset:string;at:number;option:Option;step:number;origin:Point;destination:Point;originName:string;destinationName:string;placeAccess?:{meters:number;entrance:string}};
const point=(p:any):p is Point=>!!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
const line=(v:any)=>Array.isArray(v)&&v.length<=20000&&v.every(point);
const label=(v:any)=>typeof v==='string'&&v.length<=300;
export function validJourney(value:unknown,now=Date.now()):value is JourneySession{
 if(!value||typeof value!=='object')return false;const v=value as JourneySession,o=v.option;
 if(v.version!==1||v.dataset!==DATASET_VERSION||!Number.isFinite(v.at)||now-v.at<0||now-v.at>12*3600000||!point(v.origin)||!point(v.destination)||!label(v.originName)||!label(v.destinationName))return false;
 if(v.placeAccess&&(!Number.isFinite(v.placeAccess.meters)||v.placeAccess.meters<0||v.placeAccess.meters>10000||!label(v.placeAccess.entrance)))return false;
 if(!o||!label(o.id)||![o.minutes,o.walk,o.fare,o.transfers,o.score].every(n=>Number.isFinite(n)&&n>=0)||!Array.isArray(o.legs)||o.legs.length<1||o.legs.length>9||!Number.isInteger(v.step)||v.step<0||v.step>=o.legs.length)return false;
 return o.legs.every(l=>!!l&&['walk','bus'].includes(l.kind)&&point(l.from)&&point(l.to)&&Number.isFinite(l.meters)&&l.meters>=0&&Number.isFinite(l.minutes)&&l.minutes>=0&&line(l.geometry)&&
  (l.streetNames===undefined||Array.isArray(l.streetNames)&&l.streetNames.length<=100&&l.streetNames.every(label))&&
  (l.kind!=='bus'||!!l.route&&label(l.route.id)&&label(l.route.name)&&label(l.route.color)&&line(l.route.coordinates)));
}
export function readJourney(storage?:Pick<Storage,'getItem'|'removeItem'>):JourneySession|undefined{
 try{const target=storage??localStorage,raw=target.getItem(JOURNEY_KEY);if(!raw)return;if(raw.length>1500000){target.removeItem(JOURNEY_KEY);return;}const value=JSON.parse(raw);if(validJourney(value))return value;target.removeItem(JOURNEY_KEY)}catch{/* Storage is optional. */}
}
export function saveJourney(value:JourneySession,storage?:Pick<Storage,'setItem'>):boolean{
 try{if(!validJourney(value))return false;const raw=JSON.stringify(value);if(raw.length>1500000)return false;(storage??localStorage).setItem(JOURNEY_KEY,raw);return true}catch{return false}
}
export function clearJourney(storage?:Pick<Storage,'removeItem'>){try{(storage??localStorage).removeItem(JOURNEY_KEY);if(typeof window!=='undefined')window.dispatchEvent(new Event('pdp:journey-cleared'))}catch{}}
