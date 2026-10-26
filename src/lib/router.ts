export type Point = { lat: number; lng: number };
export type Shape = { id: string; name: string; color: string; groupName: string; coordinates: Point[] };
export type Place = { name: string; address: string; point: Point };
export type Leg = { kind: 'walk' | 'bus'; from: Point; to: Point; minutes: number; meters: number; route?: Shape; geometry?: Point[]; instruction?: string; streetNames?: string[] };
export type Option = { id: string; minutes: number; walk: number; transfers: number; fare: number; score: number; legs: Leg[] };
export const ESTIMATED_WAIT_MINUTES = 7;
const walkSpeed = 78, busSpeed = 270;
// A kilometre-long edge with no intermediate surveyed vertices must be
// reviewed before it is used to direct someone through the city.
export const MAX_UNVERIFIED_BUS_EDGE_METERS = 1000;
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
type Indexed={shape:Shape;along:number[];length:number;grid:Map<string,number[]>};
const indexCache=new WeakMap<Shape,Indexed>();
function index(shape:Shape):Indexed {
 const cached=indexCache.get(shape);if(cached)return cached;
 const along=[0];for(let i=1;i<shape.coordinates.length;i++)along.push(along[i-1]+meters(shape.coordinates[i-1],shape.coordinates[i]));
 const grid=new Map<string,number[]>();
 for(let i=0;i<shape.coordinates.length-1;i++){
  if(along[i+1]-along[i]>MAX_UNVERIFIED_BUS_EDGE_METERS)continue;
  const a=shape.coordinates[i],b=shape.coordinates[i+1];
  for(let x=Math.floor(Math.min(a.lng,b.lng)*1000);x<=Math.floor(Math.max(a.lng,b.lng)*1000);x++)
   for(let y=Math.floor(Math.min(a.lat,b.lat)*1000);y<=Math.floor(Math.max(a.lat,b.lat)*1000);y++){
    const key=`${x},${y}`,list=grid.get(key)??[];list.push(i);grid.set(key,list);
   }
 }
 const result={shape,along,length:along.at(-1)??0,grid};indexCache.set(shape,result);return result;
}
/** Only close a surveyed loop within GPS rounding tolerance, not across an
 * unsurveyed street/block. Larger endpoint gaps remain separate directed ends. */
function isClosed(route:Indexed){return meters(route.shape.coordinates[0],route.shape.coordinates.at(-1)!)<=5;}
function projection(point:Point, route:Indexed,i:number):Snap {
 const a=route.shape.coordinates[i],b=route.shape.coordinates[i+1];
 const scale=Math.cos(point.lat*Math.PI/180),dx=(b.lng-a.lng)*scale,dy=b.lat-a.lat;
 const t=Math.max(0,Math.min(1,(((point.lng-a.lng)*scale)*dx+(point.lat-a.lat)*dy)/(dx*dx+dy*dy||1)));
 const p={lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t};
 return {point:p,index:i,along:route.along[i]+t*(route.along[i+1]-route.along[i]),distance:meters(point,p)};
}
/** Preserve independent outbound/return passes and local minima within each pass. */
function snaps(point:Point,route:Indexed,radius:number):Snap[] {
 const indices=new Set<number>(),latRadius=radius/111320,lngRadius=latRadius/Math.max(.01,Math.cos(point.lat*Math.PI/180));
 for(let x=Math.floor((point.lng-lngRadius)*1000);x<=Math.floor((point.lng+lngRadius)*1000);x++)
  for(let y=Math.floor((point.lat-latRadius)*1000);y<=Math.floor((point.lat+latRadius)*1000);y++)
   for(const i of route.grid.get(`${x},${y}`)??[])indices.add(i);
 const candidates=[...indices].map(i=>projection(point,route,i)).filter(s=>s.distance<=radius&&
   (s.index===0||s.distance<=projection(point,route,s.index-1).distance)&&
   (s.index===route.shape.coordinates.length-2||s.distance<=projection(point,route,s.index+1).distance));
 const distinct:Snap[]=[];
 for(const s of candidates.sort((a,b)=>a.distance-b.distance))if(!distinct.some(p=>Math.abs(p.along-s.along)<80))distinct.push(s);
 return distinct.sort((a,b)=>a.along-b.along);
}
function geometry(route:Indexed,a:Snap,b:Snap):Point[] {
 if(b.along>a.along){
  const middle=route.shape.coordinates.filter((_,i)=>route.along[i]>a.along+.01&&route.along[i]<b.along-.01);
  return [a.point,...middle,b.point];
 } else {
  const end=route.shape.coordinates.filter((_,i)=>route.along[i]>a.along+.01);
  const start=route.shape.coordinates.filter((_,i)=>route.along[i]<b.along-.01);
  return [a.point,...end,...start,b.point];
 }
}
function walk(a:Point,b:Point,arrival=false):Leg {
 const d=meters(a,b);
 return {kind:'walk',from:a,to:b,meters:d,minutes:d<5?0:Math.max(1,Math.ceil(d/walkSpeed)),
 instruction:arrival?(d<=80?'Baja cerca del destino y camina; si está enfrente, usa un cruce peatonal permitido.':'Baja aquí y camina hasta tu destino.'):undefined};
}
function bus(route:Indexed,a:Snap,b:Snap):Leg {
 const line=geometry(route,a,b);
 const d=line.slice(1).reduce((sum,p,i)=>sum+meters(line[i],p),0);
 return {kind:'bus',from:a.point,to:b.point,meters:d,minutes:Math.max(1,Math.ceil(d/busSpeed)),route:route.shape,geometry:line};
}
function rideDistance(route:Indexed,a:Snap,b:Snap){return b.along>a.along?b.along-a.along:route.length-a.along+b.along+meters(route.shape.coordinates[0],route.shape.coordinates.at(-1)!);}
/** Edit only the boarding of an already chosen, directed bus leg. Recover its
 * exact source interval first; never reverse a route or bridge a missing edge. */
export function boardingAlternative(leg:Leg,point:Point,radius=25,maxShift=400):Leg|null{
 if(leg.kind!=='bus'||!leg.route||!leg.geometry||leg.geometry.length<2)return null;
 const route=index(leg.route),starts=snaps(leg.from,route,2),ends=snaps(leg.to,route,2);
 const same=(line:Point[])=>line.length===leg.geometry!.length&&line.every((p,i)=>meters(p,leg.geometry![i])<.5);
 const original=starts.flatMap(a=>ends.map(b=>({a,b}))).find(({a,b})=>same(geometry(route,a,b)));
 if(!original)return null;
 const circular=isClosed(route);
 const choices=snaps(point,route,radius).flatMap(a=>{
  const b=original.b,forward=b.along>a.along||circular;
  if(!forward)return [];
  const edited=bus(route,a,b);
  if(edited.meters<80||Math.abs(edited.meters-leg.meters)>maxShift||hasUnverifiedBusEdge([edited]))return [];
  return [{edited,distance:a.distance}];
 }).sort((a,b)=>a.distance-b.distance);
 return choices[0]?.edited??null;
}
function option(id:string,legs:Leg[]):Option {
 const rides=legs.filter(l=>l.kind==='bus').length;
 const walking=legs.filter(l=>l.kind==='walk').reduce((s,l)=>s+l.minutes,0);
 const minutes=legs.reduce((s,l)=>s+l.minutes,0)+ESTIMATED_WAIT_MINUTES*rides;
 // The displayed ranking prioritizes arrival time. Walking and a transfer
 // break near-ties, but must not hide a materially faster trip.
 return {id,legs,minutes,walk:walking,transfers:Math.max(0,rides-1),fare:rides*10,score:minutes+walking*.15+Math.max(0,rides-1)*2};
}
function valid(legs:Leg[]) {
 return legs.filter(l=>l.kind==='walk').reduce((s,l)=>s+l.meters,0)<=1250;
}
function hasUnverifiedBusEdge(legs:Leg[]):boolean {
 return legs.some(leg=>leg.kind==='bus'&&leg.geometry?.some((p,i)=>i>0&&meters(leg.geometry![i-1],p)>MAX_UNVERIFIED_BUS_EDGE_METERS));
}
type Connection={a:Snap;b:Snap};
const connections=new WeakMap<Shape,WeakMap<Shape,Connection[]>>();
/** Connections sampled by actual distance, cached independently of each user query. */
function connect(a:Indexed,b:Indexed):Connection[] {
 let second=connections.get(a.shape);if(!second){second=new WeakMap();connections.set(a.shape,second);}
 const cached=second.get(b.shape);if(cached)return cached;
 const result:Connection[]=[];
 // Interpolate on the surveyed segments. Inserting collinear source vertices
 // must not make an interchange appear/disappear. Never interpolate a gap.
 let next=0;
 for(let i=0;i<a.shape.coordinates.length-1;i++){
  const start=a.along[i],end=a.along[i+1],length=end-start;
  if(length>MAX_UNVERIFIED_BUS_EDGE_METERS){next=end;continue;}
  if(length<=0)continue;
  next=Math.max(next,start);
  for(;next<=end;next+=100){
   const t=(next-start)/length,from=a.shape.coordinates[i],to=a.shape.coordinates[i+1];
   const p={lat:from.lat+(to.lat-from.lat)*t,lng:from.lng+(to.lng-from.lng)*t};
   for(const s of snaps(p,b,350))result.push({a:{point:p,index:i,along:next,distance:0},b:s});
  }
 }
 second.set(b.shape,result);return result;
}
export type RefineCandidate=(candidate:Option)=>Option|null;
/** A candidate is finalized against streets BEFORE deduplication or selection.
 * The preliminary minutes are a lower bound, so an already better valid
 * alternative can safely prune work without hiding another usable alighting. */
export function findRoutes(origin:Point,destination:Point,shapes:Shape[],limit=5,refine:RefineCandidate=c=>c):Option[] {
 if(![origin.lat,origin.lng,destination.lat,destination.lng].every(Number.isFinite)||Math.abs(origin.lat)>90||Math.abs(destination.lat)>90||Math.abs(origin.lng)>180||Math.abs(destination.lng)>180)return [];
 if(meters(origin,destination)<1){const same=refine(option('walk',[walk(origin,destination)]));return same?[same]:[];}
 const active=shapes.filter(s=>isActiveRoute(s)&&s.coordinates.length>=2).map(index);
 const starts=active.map(route=>({route,passes:snaps(origin,route,750)})).filter(r=>r.passes.length);
 const ends=active.map(route=>({route,passes:snaps(destination,route,750)})).filter(r=>r.passes.length);
 const unique=new Map<string,Option>();
 let threshold=Infinity,simpleThreshold=Infinity;
 const canImprove=(id:string,minutes:number,walking:number,transfers:number)=>{
  const best=unique.get(id);
  return !(best&&(minutes>best.minutes||minutes===best.minutes&&walking>best.walk))&&minutes<=(transfers===0?Math.max(threshold,simpleThreshold):threshold);
 };
 const consider=(candidate:Option)=>{
  const key=candidate.id,best=unique.get(key);
  if(!canImprove(key,candidate.minutes,candidate.walk,candidate.transfers))return;
  const final=refine(candidate);if(!final)return;
  if(!best||final.minutes<best.minutes||final.minutes===best.minutes&&final.walk<best.walk){
   unique.set(key,final);
   const ranked=[...unique.values()].sort((a,b)=>a.minutes-b.minutes||a.walk-b.walk||a.transfers-b.transfers);
   threshold=ranked.length>=limit?ranked[limit-1].minutes:Infinity;
   simpleThreshold=(ranked[0]?.minutes??Infinity)+25;
  }
 };
 if(meters(origin,destination)<=800)consider(option('walk',[{...walk(origin,destination),instruction:'Camina hasta tu destino.'}]));
 for(const start of starts){
  const end=ends.find(e=>e.route===start.route);if(!end)continue;
  for(const a of start.passes)for(const b of end.passes){
   const circular = isClosed(start.route);
   let validPass = b.along-a.along>=100;
   if (!validPass && circular && (start.route.length-a.along)+b.along>=100) validPass = true;
   if(!validPass)continue;
   const lowerWalk=(a.distance<5?0:Math.ceil(a.distance/walkSpeed))+(b.distance<5?0:Math.ceil(b.distance/walkSpeed));
   if(!canImprove('direct-'+start.route.shape.id,lowerWalk+Math.max(1,Math.ceil(rideDistance(start.route,a,b)/busSpeed))+ESTIMATED_WAIT_MINUTES,lowerWalk,0))continue;
   const legs=[walk(origin,a.point),bus(start.route,a,b),walk(b.point,destination,true)];
   if(valid(legs)&&!hasUnverifiedBusEdge(legs))consider(option('direct-'+start.route.shape.id,legs));
  }
 }
 for(const start of starts)for(const end of ends){
  // Different fragments of the same named route are not evidence of a
  // physical transfer or a second fare. Do not bridge a missing segment.
  if(start.route.shape.id===end.route.shape.id)continue;
  for(const connection of connect(start.route,end.route)){
   for(const a of start.passes)for(const b of end.passes){
    const startCircular = isClosed(start.route);
    const endCircular = isClosed(end.route);
    const validStart = connection.a.along-a.along>=100 || (startCircular && (start.route.length-a.along)+connection.a.along>=100);
    const validEnd = b.along-connection.b.along>=100 || (endCircular && (end.route.length-connection.b.along)+b.along>=100);
    if(!validStart||!validEnd)continue;
    const walking=a.distance+connection.b.distance+b.distance;if(walking>1250)continue;
    const lowerWalk=[a.distance,connection.b.distance,b.distance].reduce((sum,d)=>sum+(d<5?0:Math.ceil(d/walkSpeed)),0);
    const lowerMinutes=lowerWalk+Math.max(1,Math.ceil(rideDistance(start.route,a,connection.a)/busSpeed))+Math.max(1,Math.ceil(rideDistance(end.route,connection.b,b)/busSpeed))+2*ESTIMATED_WAIT_MINUTES;
    if(!canImprove('transfer-'+start.route.shape.id+'-'+end.route.shape.id,lowerMinutes,lowerWalk,1))continue;
    const legs=[walk(origin,a.point),bus(start.route,a,connection.a),walk(connection.a.point,connection.b.point),bus(end.route,connection.b,b),walk(b.point,destination,true)];
    if(hasUnverifiedBusEdge(legs))continue;
    const candidate=option('transfer-'+start.route.shape.id+'-'+end.route.shape.id,legs);
    consider(candidate);
   }
  }
 }
 // Never suppress a valid transfer solely because a direct ride exists.
 // The passenger can compare its extra fare against the time saved.
 const ranked=[...unique.values()].sort((a,b)=>a.minutes-b.minutes||a.walk-b.walk||a.transfers-b.transfers),selected=ranked.slice(0,limit);
 const simple=ranked.find(o=>o.transfers===0&&o.minutes<=ranked[0]?.minutes+25);
 if(simple&&selected.length&&!selected.includes(simple))selected[selected.length-1]=simple;
 return selected.sort((a,b)=>a.minutes-b.minutes||a.walk-b.walk||a.transfers-b.transfers);
}
