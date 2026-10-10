import type {Point} from './router';
export type Place={id:string;name:string;category:string;aliases:string[];neighborhood:string;municipality:string;entrance:string;status:string;coordinates:Point;access:Point;accessMeters:number};
export const normalizePlace=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function searchPlaces(places:Place[],text:string,limit=8):Place[]{
 const term=normalizePlace(text.trim());if(term.length<2)return [];
 return places.filter(place=>[place.name,...place.aliases,place.neighborhood].some(value=>normalizePlace(value).includes(term)))
  .sort((a,b)=>Number(normalizePlace(b.name).startsWith(term))-Number(normalizePlace(a.name).startsWith(term))||Number(b.status==='verificado')-Number(a.status==='verificado')||a.name.localeCompare(b.name,'es'))
  .slice(0,limit);
}
