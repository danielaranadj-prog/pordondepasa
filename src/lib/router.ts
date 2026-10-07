export type Point = { lat: number; lng: number };
export type Shape = { id: string; name: string; color: string; groupName: string; coordinates: Point[] };
export type Place = { name: string; address: string; point: Point };
export type Leg = { kind: 'walk' | 'bus'; from: Point; to: Point; minutes: number; meters: number; route?: Shape; geometry?: Point[]; instruction?: string };
export type Option = { id: string; minutes: number; walk: number; transfers: number; fare: number; score: number; legs: Leg[] };
const walkSpeed = 78, busSpeed = 270, wait = 7;
export function meters(a: Point,b: Point) {
 const x=(b.lng-a.lng)*Math.cos((a.lat+b.lat)/2*Math.PI/180);
 return Math.hypot(x,b.lat-a.lat)*111320;
}
export function isActiveRoute(shape: Shape) {
 return !/(?:ruta[\s_-]*)24(?:\b|[_-])/i.test(shape.id+' '+shape.name);
}
export function routeTextColor(color: string) {
 const hex=color.replace('#','');if(!/^[0-9a-f]{6}$/i.test(hex))return '#fff';
 const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#101827':'#fff';
}
type Snap={point:Point;along:number;distance:number;index:number};
type Indexed={shape:Shape;along:number[];length:number};
const indexCache=new WeakMap<Shape,Indexed>();
function index(shape:Shape):Indexed {
 const cached=indexCache.get(shape);if(cached)return cached;
 const along=[0];for(let i=1;i<shape.coordinates.length;i++)along.push(along[i-1]+meters(shape.coordinates[i-1],shape.coordinates[i]));
 const result={shape,along,length:along.at(-1)??0};indexCache.set(shape,result);return result;
}
function projection(point:Point, route:Indexed,i:number):Snap {
 const a=route.shape.coordinates[i],b=route.shape.coordinates[i+1];
 const scale=Math.cos(point.lat*Math.PI/180),dx=(b.lng-a.lng)*scale,dy=b.lat-a.lat;
 const t=Math.max(0,Math.min(1,(((point.lng-a.lng)*scale)*dx+(point.lat-a.lat)*dy)/(dx*dx+dy*dy||1)));
 const p={lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t};
 return {point:p,index:i,along:route.along[i]+t*(route.along[i+1]-route.along[i]),distance:meters(point,p)};
}
/** Preserve independent outbound/return passes and local minima within each pass. */
function snaps(point:Point,route:Indexed,radius:number):Snap[] {
 const projections:Snap[]=[];
 for(let i=0;i<route.shape.coordinates.length-1;i++)projections.push(projection(point,route,i));
 const candidates=projections.filter((s,i)=>s.distance<=radius &&
   (i===0||s.distance<=projections[i-1].distance) &&
   (i===projections.length-1||s.distance<=projections[i+1].distance));
 const distinct:Snap[]=[];
 for(const s of candidates.sort((a,b)=>a.distance-b.distance))if(!distinct.some(p=>Math.abs(p.along-s.along)<80))distinct.push(s);
 return distinct.sort((a,b)=>a.along-b.along);
}
function geometry(route:Indexed,a:Snap,b:Snap):Point[] {
 const middle=route.shape.coordinates.filter((_,i)=>route.along[i]>a.along+.01&&route.along[i]<b.along-.01);
 return [a.point,...middle,b.point];
}
function walk(a:Point,b:Point,arrival=false):Leg {
 const d=meters(a,b);
 return {kind:'walk',from:a,to:b,meters:d,minutes:d<5?0:Math.max(1,Math.ceil(d/walkSpeed)),
 instruction:arrival?(d<=80?'Baja cerca del destino y camina; si está enfrente, usa un cruce peatonal permitido.':'Baja aquí y camina hasta tu destino.'):undefined};
}
function bus(route:Indexed,a:Snap,b:Snap):Leg {
 const d=b.along-a.along;
 return {kind:'bus',from:a.point,to:b.point,meters:d,minutes:Math.max(1,Math.ceil(d/busSpeed)),route:route.shape,geometry:geometry(route,a,b)};
}
function option(id:string,legs:Leg[]):Option {
 const rides=legs.filter(l=>l.kind==='bus').length;
 const walking=legs.filter(l=>l.kind==='walk').reduce((s,l)=>s+l.minutes,0);
 const minutes=legs.reduce((s,l)=>s+l.minutes,0)+wait*rides;
 return {id,legs,minutes,walk:walking,transfers:Math.max(0,rides-1),fare:rides*10,score:minutes+walking*.8+Math.max(0,rides-1)*8};
}
function valid(legs:Leg[]) {
 return legs.filter(l=>l.kind==='walk').reduce((s,l)=>s+l.meters,0)<=1250;
}
type Connection={a:Snap;b:Snap};
const connections=new WeakMap<Shape,WeakMap<Shape,Connection[]>>();
/** Connections sampled by actual distance, cached independently of each user query. */
function connect(a:Indexed,b:Indexed):Connection[] {
 let second=connections.get(a.shape);if(!second){second=new WeakMap();connections.set(a.shape,second);}
 const cached=second.get(b.shape);if(cached)return cached;
 const result:Connection[]=[];
 let last=-Infinity;
 for(let i=0;i<a.shape.coordinates.length-1;i++){
  if(a.along[i]-last<100)continue;last=a.along[i];
  const p=a.shape.coordinates[i];
  for(const s of snaps(p,b,350))result.push({a:{point:p,index:i,along:a.along[i],distance:0},b:s});
 }
 second.set(b.shape,result);return result;
}
export function findRoutes(origin:Point,destination:Point,shapes:Shape[],limit=5):Option[] {
 const active=shapes.filter(s=>isActiveRoute(s)&&s.coordinates.length>=2).map(index);
 const starts=active.map(route=>({route,passes:snaps(origin,route,750)})).filter(r=>r.passes.length);
 const ends=active.map(route=>({route,passes:snaps(destination,route,750)})).filter(r=>r.passes.length);
 const candidates:Option[]=[];
 if(meters(origin,destination)<=800)candidates.push(option('walk',[{...walk(origin,destination),instruction:'Camina hasta tu destino.'}]));
 for(const start of starts){
  const end=ends.find(e=>e.route===start.route);if(!end)continue;
  for(const a of start.passes)for(const b of end.passes){
   if(b.along-a.along<100)continue;
   const legs=[walk(origin,a.point),bus(start.route,a,b),walk(b.point,destination,true)];
   if(valid(legs))candidates.push(option('direct-'+start.route.shape.id,legs));
  }
 }
 for(const start of starts)for(const end of ends){
  if(start.route===end.route)continue;
  let best:Option|undefined;
  for(const connection of connect(start.route,end.route)){
   for(const a of start.passes)for(const b of end.passes){
    if(connection.a.along-a.along<100||b.along-connection.b.along<100)continue;
    const walking=a.distance+connection.b.distance+b.distance;if(walking>1250)continue;
    const legs=[walk(origin,a.point),bus(start.route,a,connection.a),walk(connection.a.point,connection.b.point),bus(end.route,connection.b,b),walk(b.point,destination,true)];
    const candidate=option('transfer-'+start.route.shape.id+'-'+end.route.shape.id,legs);
    if(candidate.minutes<=90&&(!best||candidate.score<best.score))best=candidate;
   }
  }
  if(best)candidates.push(best);
 }
 const unique=new Map<string,Option>();
 for(const candidate of candidates){
  const key=candidate.legs.filter(l=>l.kind==='bus').map(l=>l.route!.id).join('|')||'walk';
  if(!unique.has(key)||unique.get(key)!.score>candidate.score)unique.set(key,candidate);
 }
 return [...unique.values()].sort((a,b)=>a.score-b.score).slice(0,limit);
}
