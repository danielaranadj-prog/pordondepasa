import type {Point} from './router';

// A map reference is never an authenticated/confirmed location fix.
export const TEPIC_MAP_CENTER:Point={lat:21.5055,lng:-104.893};
export type Endpoint='origin'|'destination';
export type MapSelection={id:number;target:Endpoint;initial:Point;draft:Point;moving:boolean};
export function withinServiceArea(point:Point){
 return Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&point.lat>=21.40&&point.lat<=21.58&&point.lng>=-105.02&&point.lng<=-104.78;
}
export function planningLocation(fix:{point:Point;accuracy:number;timestamp:number},now=Date.now()):Point|null{
 if(!withinServiceArea(fix.point)||!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>100||!Number.isFinite(fix.timestamp)||now-fix.timestamp>60000||fix.timestamp-now>10000)return null;
 return {...fix.point};
}
export function beginMapSelection(id:number,target:Endpoint,point:Point):MapSelection{
 return {id,target,initial:{...point},draft:{...point},moving:false};
}
export function updateMapSelection(current:MapSelection|null,id:number,point:Point,moving:boolean):MapSelection|null{
 if(!current||current.id!==id||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return current;
 return {...current,draft:{...point},moving};
}
