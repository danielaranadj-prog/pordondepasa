import {meters,type Point,type Shape} from './router.ts';

type Break={after:number;before:Point;afterPoint:Point};

// Surveyed source contains two closed loops concatenated without a traversed
// street between them. Keep every vertex and the public route ID; split only
// this confirmed data break. Other suspicious gaps remain under the router's
// conservative 1 km guard pending review.
const knownBreaks:Record<string,Break[]>={
 'agr-nomos-universidad':[{after:220,before:{lat:21.5112906,lng:-104.8896268},afterPoint:{lat:21.4911332,lng:-104.8631248}}],
};

export function splitKnownRouteBreaks(shapes:Shape[]):Shape[]{
 return shapes.flatMap(shape=>{
  const breaks=knownBreaks[shape.id];if(!breaks)return [shape];
  let start=0;
  const fragments:Shape[]=[];
  for(const point of breaks){
   const a=shape.coordinates[point.after],b=shape.coordinates[point.after+1];
   if(!a||!b||meters(a,point.before)>2||meters(b,point.afterPoint)>2||point.after<start)
    throw new Error(`El corte de ${shape.name} requiere revisión del trazo base`);
   const coordinates=shape.coordinates.slice(start,point.after+1);
   if(coordinates.length<2)throw new Error(`Fragmento vacío de ${shape.name}`);
   fragments.push({...shape,coordinates});
   start=point.after+1;
  }
  const coordinates=shape.coordinates.slice(start);
  if(coordinates.length<2)throw new Error(`Fragmento final vacío de ${shape.name}`);
  fragments.push({...shape,coordinates});
  return fragments;
 });
}
