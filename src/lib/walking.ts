import {ESTIMATED_WAIT_MINUTES,meters,type Point,type Leg,type Option} from './router.ts';
export type WalkNetwork={nodes:[number,number][];edges:[number,number,string|number][];names?:string[];source?:string;updated?:string};
type Edge={a:number;b:number;name:string;distance:number};
type Snap={edge:Edge;point:Point;t:number;distance:number};
export type WalkingPreference={heading?:number};
class Heap{
 values:{node:number;cost:number;priority:number}[]=[];
 push(value:{node:number;cost:number;priority:number}){const a=this.values;a.push(value);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].priority<=value.priority)break;a[i]=a[p];i=p}a[i]=value}
 pop(){const a=this.values,first=a[0],last=a.pop();if(a.length&&last){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].priority<a[c].priority)c++;if(a[c].priority>=last.priority)break;a[i]=a[c];i=c}a[i]=last}return first}
}
export class WalkingRouter{
 points:Point[];edges:Edge[];adj: {to:number;edge:Edge}[][];grid=new Map<string,Edge[]>();cache=new Map<string,Leg|null>();
 constructor(data:WalkNetwork){
  this.points=data.nodes.map(([lat,lng])=>({lat,lng}));this.adj=this.points.map(()=>[]);
  this.edges=data.edges.map(([a,b,name])=>({a,b,name:typeof name==='number'?data.names?.[name]??'':name,distance:meters(this.points[a],this.points[b])}));
  for(const edge of this.edges){this.adj[edge.a].push({to:edge.b,edge});this.adj[edge.b].push({to:edge.a,edge});
   const a=this.points[edge.a],b=this.points[edge.b];
   for(let x=Math.floor(Math.min(a.lng,b.lng)*1000);x<=Math.floor(Math.max(a.lng,b.lng)*1000);x++)for(let y=Math.floor(Math.min(a.lat,b.lat)*1000);y<=Math.floor(Math.max(a.lat,b.lat)*1000);y++){const key=`${x},${y}`;const list=this.grid.get(key)??[];list.push(edge);this.grid.set(key,list)}
  }
 }
 snaps(point:Point):Snap[]{
  const candidates=new Set<Edge>(),x=Math.floor(point.lng*1000),y=Math.floor(point.lat*1000);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const edge of this.grid.get(`${x+dx},${y+dy}`)??[])candidates.add(edge);
  const result:Snap[]=[];
  for(const edge of candidates){const a=this.points[edge.a],b=this.points[edge.b],scale=Math.cos(point.lat*Math.PI/180),dx=(b.lng-a.lng)*scale,dy=b.lat-a.lat;
   const t=Math.max(0,Math.min(1,((point.lng-a.lng)*scale*dx+(point.lat-a.lat)*dy)/(dx*dx+dy*dy||1))),p={lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t},distance=meters(point,p);
   if(distance<=40)result.push({edge,point:p,t,distance});
  }
  result.sort((a,b)=>a.distance-b.distance);
  return result.filter(s=>s.distance<=(result[0]?.distance??0)+8).slice(0,3);
 }
 route(from:Point,to:Point,preference:WalkingPreference={}):Leg|null{
  if(meters(from,to)<1)return {kind:'walk',from,to,geometry:[from,to],meters:meters(from,to),minutes:0,instruction:'Estás en el punto indicado.'};
  const heading=Number.isFinite(preference.heading)?preference.heading:undefined;
  // A small departure cost favors continuing along the user's chosen street.
  // It is never part of the displayed distance or time, and cannot disconnect
  // the graph. Ordinary journey planning has no departure preference.
  const departureCost=(start:Point,next:Point)=>{
   if(heading===undefined||meters(start,next)<5)return 0;
   const dx=(next.lng-start.lng)*Math.cos(start.lat*Math.PI/180),dy=next.lat-start.lat,angle=heading*Math.PI/180;
   const dot=(dx*Math.sin(angle)+dy*Math.cos(angle))/(Math.hypot(dx,dy)||1);
   return Math.max(0,-dot)*80;
  };
  const key=[from.lat,from.lng,to.lat,to.lng].map(v=>v.toFixed(6)).join(',')+`:${heading===undefined?'shortest':heading.toFixed(1)}`;if(this.cache.has(key))return this.cache.get(key)!;
  const starts=this.snaps(from),ends=this.snaps(to);if(!starts.length||!ends.length)return null;
  const searchLimit=heading===undefined?1800:1880;
  let best: {cost:number;distance:number;geometry:Point[];names:string[]}|undefined;
  for(const s of starts)for(const e of ends)if(s.edge===e.edge){const distance=s.distance+e.distance+Math.abs(s.t-e.t)*s.edge.distance,cost=distance+departureCost(s.point,e.point);if(!best||cost<best.cost)best={cost,distance,geometry:[s.point,e.point],names:[s.edge.name]}}
  const queue=new Heap(),costs=new Map<number,number>(),previous=new Map<number,{node:number;edge:Edge}>(),roots=new Map<number,Snap>();
  for(const s of starts)for(const [node,part] of [[s.edge.a,s.t],[s.edge.b,1-s.t]]){const cost=s.distance+part*s.edge.distance+departureCost(s.point,this.points[node]);if(cost<(costs.get(node)??Infinity)){costs.set(node,cost);roots.set(node,s);queue.push({node,cost,priority:cost+meters(this.points[node],to)})}}
  let visits=0;
  while(queue.values.length&&visits++<50000){const current=queue.pop();if(current.cost!==costs.get(current.node))continue;if(current.priority>(best?.cost??searchLimit))break;
   // A GPS fix at a junction has a zero-length initial snap. Charge the
   // preference on its first real departure instead of silently losing it.
   const start=heading!==undefined&&!previous.has(current.node)?roots.get(current.node):undefined;
   const junctionCost=(next:Point)=>start&&meters(start.point,this.points[current.node])<5?departureCost(start.point,next):0;
   for(const end of ends){let part:number|undefined;if(current.node===end.edge.a)part=end.t;else if(current.node===end.edge.b)part=1-end.t;
    if(part===undefined)continue;const cost=current.cost+part*end.edge.distance+end.distance+junctionCost(end.point);if(cost>searchLimit||best&&cost>=best.cost)continue;
    const path=[this.points[current.node]],names=[end.edge.name];let node=current.node;
    while(previous.has(node)){const p=previous.get(node)!;names.unshift(p.edge.name);node=p.node;path.unshift(this.points[node])}
    const root=roots.get(node)!,junctionPenalty=meters(root.point,this.points[node])<5?departureCost(root.point,path[1]??end.point):0;
    const distance=cost-departureCost(root.point,this.points[node])-junctionPenalty;if(distance>1800)continue;
    best={cost,distance,geometry:[root.point,...path,end.point],names:[root.edge.name,...names]};
   }
   for(const connection of this.adj[current.node]){const cost=current.cost+connection.edge.distance+junctionCost(this.points[connection.to]);if(cost>searchLimit||cost>=(costs.get(connection.to)??Infinity))continue;costs.set(connection.to,cost);previous.set(connection.to,{node:current.node,edge:connection.edge});queue.push({node:connection.to,cost,priority:cost+meters(this.points[connection.to],to)})}
  }
  const names=best?[...new Set(best.names.filter(Boolean))].slice(0,4):[];
  const result:Leg|null=best?{kind:'walk',from,to,geometry:best.geometry,meters:best.distance,minutes:best.distance<5?0:Math.max(1,Math.ceil(best.distance/78)),instruction:names.length?`Camina por ${names.join(' → ')}. Usa los cruces permitidos.`:'Sigue las calles y pasos del mapa. Usa los cruces permitidos.',streetNames:names}:null;
  if(this.cache.size>300)this.cache.clear();this.cache.set(key,result);return result;
 }
 refineCandidate(option:Option):Option|null{
   const legs:Leg[]=[];
   for(const leg of option.legs){const next=leg.kind==='walk'?this.route(leg.from,leg.to):leg;if(!next)return null;legs.push(next)}
   const walks=legs.filter(l=>l.kind==='walk');if(walks.reduce((n,l)=>n+l.meters,0)>1250)return null;
   const walk=walks.reduce((n,l)=>n+l.minutes,0),rides=legs.filter(l=>l.kind==='bus').length,minutes=legs.reduce((n,l)=>n+l.minutes,0)+rides*ESTIMATED_WAIT_MINUTES;
   return {...option,legs,walk,minutes,score:minutes+walk*.15+option.transfers*2};
 }
 refine(options:Option[]):Option[]{
  return this.select(options.flatMap(option=>{const result=this.refineCandidate(option);return result?[result]:[]}));
 }
 select(options:Option[]):Option[]{
  const result=[...options];
  result.sort((a,b)=>a.minutes-b.minutes||a.walk-b.walk||a.transfers-b.transfers);
  const selected=result.slice(0,5);
  // Keep a reasonably competitive no-transfer/cheaper option visible even
  // when fast transfer combinations occupy all five slots.
  const simple=result.find(option=>option.transfers===0&&option.minutes<=result[0]?.minutes+25);
  if(simple&&!selected.includes(simple))selected[selected.length-1]=simple;
  return selected.sort((a,b)=>a.minutes-b.minutes||a.walk-b.walk||a.transfers-b.transfers);
 }
}
