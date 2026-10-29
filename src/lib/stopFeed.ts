import type {TransitStop} from './navigation.ts';
export const STOP_SOURCES=['general','insurgentes','mexico'] as const;
export type StopSource=typeof STOP_SOURCES[number];
type FetchStops=(input:string,init?:RequestInit)=>Promise<Response>;

function validStop(value:unknown):value is TransitStop{
 if(!value||typeof value!=='object')return false;
 const stop=value as TransitStop,point=stop.coordinates;
 return typeof stop.id==='string'&&stop.id.length>0&&typeof stop.name==='string'&&stop.name.trim().length>0&&
  !!point&&Number.isFinite(point.lat)&&Math.abs(point.lat)<=90&&Number.isFinite(point.lng)&&Math.abs(point.lng)<=180&&
  (stop.type===undefined||['oficial','costumbre','base'].includes(stop.type))&&
  (stop.routeIds===undefined||Array.isArray(stop.routeIds)&&stop.routeIds.every(id=>typeof id==='string'))&&
  (stop.direction===undefined||typeof stop.direction==='string');
}
/** A broken source must not discard the independent, healthy collections. */
export async function loadStopSources(base:string,fetcher:FetchStops=fetch,sources:readonly StopSource[]=STOP_SOURCES,signal?:AbortSignal){
 const results=await Promise.allSettled(sources.map(async source=>{
  const response=await fetcher(`${base}data/stops/${source}-stops.json`,{signal});if(!response.ok)throw new Error('stop_source_unavailable');
  const data:unknown=await response.json();
  if(!data||typeof data!=='object'||!Array.isArray((data as {stops?:unknown}).stops))throw new Error('stop_source_invalid');
  const raw=(data as {stops:unknown[]}).stops,stops=raw.filter(validStop).map(stop=>({...stop,source}));
  return {source,stops,partial:stops.length!==raw.length};
 }));
 const stops:TransitStop[]=[],loadedSources:StopSource[]=[],failedSources:StopSource[]=[];
 results.forEach((result,index)=>{
  if(result.status==='rejected'){failedSources.push(sources[index]);return;}
  loadedSources.push(result.value.source);stops.push(...result.value.stops);
  if(result.value.partial)failedSources.push(result.value.source);
 });
 return {stops,loadedSources,failedSources};
}
export function mergeStopSources(previous:TransitStop[],update:{stops:TransitStop[];loadedSources:StopSource[]}){
 return [...previous.filter(stop=>!update.loadedSources.some(source=>source===stop.source)),...update.stops];
}
