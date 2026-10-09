import type {Point} from './router';
export function normalHeading(value:number){return ((value%360)+360)%360}
export function headingDelta(from:number,to:number){return ((to-from+540)%360)-180}
export function smoothHeading(from:number,to:number,amount:number){return normalHeading(from+headingDelta(from,to)*amount)}
export function compassHeading(event:{alpha:number|null;absolute?:boolean;webkitCompassHeading?:number;webkitCompassAccuracy?:number}){
 if(Number.isFinite(event.webkitCompassHeading)&&(event.webkitCompassAccuracy===undefined||(event.webkitCompassAccuracy>=0&&event.webkitCompassAccuracy<=45)))return normalHeading(event.webkitCompassHeading!);
 if(event.absolute&&event.alpha!==null&&Number.isFinite(event.alpha))return normalHeading(360-event.alpha);
 return undefined;
}
export function movementHeading(from:Point,to:Point){
 const rad=Math.PI/180,a=from.lat*rad,b=to.lat*rad,d=(to.lng-from.lng)*rad;
 return normalHeading(Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d))/rad);
}
