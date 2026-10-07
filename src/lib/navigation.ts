import {meters,type Point,type Option} from './router.ts';
/** Keep the exact street geometry beyond an accepted distance along the leg. */
export function remainingGeometry(line:Point[],along:number):Point[]{
 if(along<=0)return line;
 let travelled=0;
 for(let i=1;i<line.length;i++){
  const length=meters(line[i-1],line[i]);
  if(length>0&&travelled+length>along){
   const t=(along-travelled)/length,a=line[i-1],b=line[i];
   return [{lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t},...line.slice(i)];
  }
  travelled+=length;
 }
 return line.length?[line[line.length-1]]:[];
}
export type TransitStop={id:string;name:string;coordinates:Point;type?:'oficial'|'costumbre'|'base';routeIds?:string[];direction?:string;source?:string};
export type RouteStop=TransitStop&{legIndex:number;along:number;distance:number;inferred:boolean;side:'right'|'on-trace'};
export function projectProgress(point:Point,line:Point[]){
 let best={distance:Infinity,along:0,point:line[0]??point,rightOffset:0},length=0;
 for(let i=0;i<line.length-1;i++){
  const a=line[i],b=line[i+1],scale=Math.cos(point.lat*Math.PI/180),dx=(b.lng-a.lng)*scale,dy=b.lat-a.lat;
  if(Math.hypot(dx,dy)<1e-12)continue;
  const t=Math.max(0,Math.min(1,((point.lng-a.lng)*scale*dx+(point.lat-a.lat)*dy)/(dx*dx+dy*dy||1)));
  const projected={lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t},segment=meters(a,b),distance=meters(point,projected);
  // East/north coordinates: clockwise cross product is positive on the right.
  const rightOffset=(dy*(point.lng-a.lng)*scale-dx*(point.lat-a.lat))/Math.hypot(dx,dy)*111320;
  if(distance<best.distance)best={distance,along:length+segment*t,point:projected,rightOffset};length+=segment;
 }
 return {...best,length,remaining:Math.max(0,length-best.along)};
}
/** Stops without route IDs are spatial references, not a verified assignment. */
export function stopsForOption(option:Option,stops:TransitStop[]):RouteStop[]{
 const result:RouteStop[]=[];
 option.legs.forEach((leg,legIndex)=>{
  if(leg.kind!=='bus'||!leg.geometry||!leg.route)return;
  const whole=leg.route.coordinates;
  const start=projectProgress(leg.from,whole),end=projectProgress(leg.to,whole);
  for(const stop of stops){
   if(stop.routeIds?.length&&!stop.routeIds.includes(leg.route.id))continue;
   const p=projectProgress(stop.coordinates,leg.geometry);
   if(p.distance>35)continue;
   // Imported Mexico/Insurgentes stops were snapped onto their full route.
   // The nearest pass on the FULL shape identifies which direction owns them.
   // Do not apply this exception to arbitrary coordinates near the centre line.
   const assigned=!!stop.routeIds?.includes(leg.route.id)||
    (stop.source==='mexico'&&leg.route.id==='m-xico')||
    (stop.source==='insurgentes'&&leg.route.id==='insurgentes');
   const full=assigned?projectProgress(stop.coordinates,whole):undefined;
   const onTrace=!!full&&full.distance<=1.5;
   if(onTrace){
    if(end.along<=start.along||full!.along<start.along-.5||full!.along>end.along+.5)continue;
   }else if(p.rightOffset<=1.5)continue;
   const existing=result.find(s=>s.legIndex===legIndex&&meters(s.coordinates,stop.coordinates)<15);
   if(existing){if(existing.type!=='oficial'&&stop.type==='oficial')Object.assign(existing,stop);continue;}
   result.push({...stop,legIndex,along:p.along,distance:p.distance,inferred:!stop.routeIds?.length,side:onTrace?'on-trace':'right'});
  }
 });
 return result.sort((a,b)=>a.legIndex-b.legIndex||a.along-b.along);
}
