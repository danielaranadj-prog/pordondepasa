import {meters, type Point, type Shape} from './router';

// Audited segment indices in the immutable baseline, not nearest endpoints
// across the entire route (which could accidentally erase a return trip).
const metatesSections: Record<string, {start:number;end:number;reverse:boolean}[]> = {
 'progreso-4': [{start:199,end:217,reverse:true}],
 'progreso-5': [{start:18,end:43,reverse:false}],
 'jazmines': [{start:5,end:9,reverse:false},{start:83,end:88,reverse:true}],
};
const febreroSections: Record<string, {start:number;end:number;reverse:boolean}[]> = {
 // Hospitales 1 leaves the yellow line at its shared junction with the
 // surveyed Victoria continuation; Hospitales 2 continues north to south.
 'cantera-hospitales-1': [{start:96,end:128,reverse:false}],
 'cantera-hospitales-2': [{start:397,end:418,reverse:false}],
};
type Detour = {features:{properties:{active?:boolean};geometry:{type:string;coordinates:number[][]}}[]};
function join(point:Point,a:Point,b:Point):Point {
 const scale=Math.cos(point.lat*Math.PI/180);
 const dx=(b.lng-a.lng)*scale,dy=b.lat-a.lat;
 const t=Math.max(0,Math.min(1,(((point.lng-a.lng)*scale)*dx+(point.lat-a.lat)*dy)/(dx*dx+dy*dy||1)));
 const projected={lat:a.lat+t*dy,lng:a.lng+t*(b.lng-a.lng)};
 if(meters(projected,point)>30)throw new Error('El desvío requiere revisar sus conexiones');
 return projected;
}
/** Temporary geometry overlay: preserves baseline, route IDs, colors and order. */
function applyDetour(shapes:Shape[],data:Detour,sections:Record<string,{start:number;end:number;reverse:boolean}[]>,pathForRoute?:(id:string,path:Point[])=>Point[]):Shape[] {
 const feature=data.features[0];
 if(feature?.properties.active===false)return shapes;
 const coordinates=feature?.geometry.coordinates;
 if(feature?.geometry.type!=='LineString'||!Array.isArray(coordinates)||coordinates.length<2||
  !coordinates.every(p=>p.length===2&&p.every(Number.isFinite)&&p[0]>-105&&p[0]<-104&&p[1]>21&&p[1]<22))
  throw new Error('Geometría de desvío inválida');
 const path=coordinates.map(([lng,lat])=>({lat,lng}));
 return shapes.map(shape=>{
  const spans=sections[shape.id];if(!spans)return shape;
  const original=shape.coordinates;
  let cursor=0;const result:Point[]=[];
  for(const span of spans){
   if(!original[span.end+1]||span.start<cursor)throw new Error('Trazado base incompatible con desvío');
   const replacement=pathForRoute?.(shape.id,path)??(span.reverse?[...path].reverse():path);
   const entry=join(replacement[0],original[span.start],original[span.start+1]);
   const exit=join(replacement.at(-1)!,original[span.end],original[span.end+1]);
   result.push(...original.slice(cursor,span.start+1),entry,...replacement,exit);
   cursor=span.end+1;
  }
  result.push(...original.slice(cursor));
  return {...shape,coordinates:result};
 });
}
export function applyMetates(shapes:Shape[],data:Detour):Shape[] {
 return applyDetour(shapes,data,metatesSections);
}
export function apply21Febrero(shapes:Shape[],data:Detour,continuation:Detour):Shape[] {
 const feature=continuation.features[0];
 if(feature?.properties.active===false)return applyDetour(shapes,data,{'cantera-hospitales-2':febreroSections['cantera-hospitales-2']});
 const coords=feature?.geometry.coordinates;
 if(feature?.geometry.type!=='LineString'||!Array.isArray(coords)||coords.length!==23||
  !coords.every(p=>p.length===2&&p.every(Number.isFinite)&&p[0]>-105&&p[0]<-104&&p[1]>21&&p[1]<22))
  throw new Error('Geometría de Hospitales 1 inválida');
 const victoria=coords.map(([lng,lat])=>({lat,lng}));
 return applyDetour(shapes,data,febreroSections,(id,path)=>{
  if(id!=='cantera-hospitales-1')return path;
  if(path.length!==33||meters(path[4],victoria[7])>10)
   throw new Error('No coincide el cruce de Hospitales 1 con 21 de Febrero');
  // South end -> shared junction -> Vicente Guerrero/Zacatecas/Victoria.
  // The first seven Victoria points describe the old Colosio approach.
  return [...path.slice(4).reverse(),...victoria.slice(7)];
 });
}
