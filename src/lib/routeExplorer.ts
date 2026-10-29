import {isActiveRoute,meters,MAX_UNVERIFIED_BUS_EDGE_METERS,type Point,type Shape} from './router.ts';
export type RoutePreview={id:string;name:string;color:string;lines:Point[][];incomplete:boolean};
/** Display every recorded fragment, never connect separate passes or unsurveyed gaps. */
export function routePreview(shapes:Shape[],id:string):RoutePreview|null{
 const routes=shapes.filter(shape=>shape.id===id&&isActiveRoute(shape));
 if(!routes.length)return null;
 const lines:Point[][]=[];let incomplete=false;
 for(const route of routes){
  let line:Point[]=[];
  for(const point of route.coordinates){
   if(line.length&&meters(line.at(-1)!,point)>MAX_UNVERIFIED_BUS_EDGE_METERS){
    if(line.length>1)lines.push(line);line=[];incomplete=true;
   }
   line.push(point);
  }
  if(line.length>1)lines.push(line);
 }
 return lines.length?{id,name:routes[0].name,color:routes[0].color,lines,incomplete}:null;
}
