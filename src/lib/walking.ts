import {ESTIMATED_WAIT_MINUTES,meters,type Point,type Leg,type Option} from './router.ts';
export type WalkNetwork={nodes:[number,number][];edges:[number,number,string|number][];names?:string[];source?:string;updated?:string};
type Edge={a:number;b:number;name:string;distance:number};
type Snap={edge:Edge;point:Point;t:number;distance:number};
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
 route(from:Point,to:Point):Leg|null{
  const key=[from.lat,from.lng,to.lat,to.lng].map(v=>v.toFixed(6)).join(',');if(this.cache.has(key))return this.cache.get(key)!;
  const starts=this.snaps(from),ends=this.snaps(to);if(!starts.length||!ends.length)return null;
  let best: {cost:number;geometry:Point[];names:string[]}|undefined;
  for(const s of starts)for(const e of ends)if(s.edge===e.edge){const cost=s.distance+e.distance+Math.abs(s.t-e.t)*s.edge.distance;if(!best||cost<best.cost)best={cost,geometry:[s.point,e.point],names:[s.edge.name]}}
  const queue=new Heap(),costs=new Map<number,number>(),previous=new Map<number,{node:number;edge:Edge}>(),roots=new Map<number,Snap>();
  for(const s of starts)for(const [node,part] of [[s.edge.a,s.t],[s.edge.b,1-s.t]]){const cost=s.distance+part*s.edge.distance;if(cost<(costs.get(node)??Infinity)){costs.set(node,cost);roots.set(node,s);queue.push({node,cost,priority:cost+meters(this.points[node],to)})}}
  let visits=0;
  while(queue.values.length&&visits++<50000){const current=queue.pop();if(current.cost!==costs.get(current.node))continue;if(current.priority>(best?.cost??1800))break;
   for(const end of ends){let part:number|undefined;if(current.node===end.edge.a)part=end.t;else if(current.node===end.edge.b)part=1-end.t;
    if(part===undefined)continue;const cost=current.cost+part*end.edge.distance+end.distance;if(cost>1800||best&&cost>=best.cost)continue;
    const path=[this.points[current.node]],names=[end.edge.name];let node=current.node;
    while(previous.has(node)){const p=previous.get(node)!;names.unshift(p.edge.name);node=p.node;path.unshift(this.points[node])}
    const root=roots.get(node)!;best={cost,geometry:[root.point,...path,end.point],names:[root.edge.name,...names]};
   }
   for(const connection of this.adj[current.node]){const cost=current.cost+connection.edge.distance;if(cost>1800||cost>=(costs.get(connection.to)??Infinity))continue;costs.set(connection.to,cost);previous.set(connection.to,{node:current.node,edge:connection.edge});queue.push({node:connection.to,cost,priority:cost+meters(this.points[connection.to],to)})}
  }
  const names=best?[...new Set(best.names.filter(Boolean))].slice(0,4):[];
  const result:Leg|null=best?{kind:'walk',from,to,geometry:best.geometry,meters:best.cost,minutes:best.cost<5?0:Math.max(1,Math.ceil(best.cost/78)),instruction:names.length?`Camina por ${names.join(' → ')}. Usa los cruces permitidos.`:'Sigue las calles y pasos del mapa. Usa los cruces permitidos.',streetNames:names}:null;
  if(this.cache.size>300)this.cache.clear();this.cache.set(key,result);return result;
 }
 refine(options:Option[]):Option[]{
  const result:Option[]=[];
  for(const option of options){const legs:Leg[]=[];let valid=true;
   for(const leg of option.legs){const next=leg.kind==='walk'?this.route(leg.from,leg.to):leg;if(!next){valid=false;break}legs.push(next)}
   if(!valid)continue;const walks=legs.filter(l=>l.kind==='walk');if(walks.reduce((n,l)=>n+l.meters,0)>1250)continue;
   const walk=walks.reduce((n,l)=>n+l.minutes,0),rides=legs.filter(l=>l.kind==='bus').length,minutes=legs.reduce((n,l)=>n+l.minutes,0)+rides*ESTIMATED_WAIT_MINUTES;
   result.push({...option,legs,walk,minutes,score:minutes+walk*.8+option.transfers*8});
  }
  return result.sort((a,b)=>a.score-b.score).slice(0,5);
 }
}
