const assert={ok:(value:unknown)=>{if(!value)throw new Error('Assertion failed');},equal:(a:unknown,b:unknown)=>{if(a!==b)throw new Error(`Expected ${a} to equal ${b}`);}};
import { findRoutes, meters, type Shape } from './router.ts';
const point=(x:number,y=0)=>({lat:21.5+y/111320,lng:-104.9+x/(111320*Math.cos(21.5*Math.PI/180))});
const shape=(id:string,xy:number[][]):Shape=>{
 const dense:number[][]=[xy[0]];
 for(let i=1;i<xy.length;i++){
  const [ax,ay]=xy[i-1],[bx,by]=xy[i],parts=Math.ceil(Math.hypot(bx-ax,by-ay)/250);
  for(let k=1;k<=parts;k++)dense.push([ax+(bx-ax)*k/parts,ay+(by-ay)*k/parts]);
 }
 return {id,name:id,color:'#065F46',groupName:id,coordinates:dense.map(([x,y])=>point(x,y))};
};

// Destination is across the street on the outward pass; return pass is closer,
// but requires a multi-kilometre detour. The earlier alighting must win.
const loop=shape('loop',[[0,0],[1000,0],[4000,0],[4000,30],[1000,30],[0,30]]);
const direct=findRoutes(point(0),point(1000,25),[loop]).find(o=>o.id==='direct-loop')!;
assert.ok(direct);
assert.ok(direct.legs.find(l=>l.kind==='bus')!.meters<1100);
assert.ok(direct.legs.at(-1)!.meters<40);

// Both buses meet later with zero walking, but that connection is a long detour.
const first=shape('first',[[0,0],[1000,0],[5000,0]]);
const second=shape('second',[[1000,60],[1000,1000],[5000,0],[5000,60],[1000,60],[1000,1100]]);
const transfer=findRoutes(point(0),point(1000,1100),[first,second]).find(o=>o.transfers===1)!;
assert.ok(transfer);
assert.ok(transfer.legs.filter(l=>l.kind==='bus').reduce((n,l)=>n+l.meters,0)<2500);
for(const leg of transfer.legs.filter(l=>l.kind==='bus')){
 const length=leg.geometry!.slice(1).reduce((n,p,i)=>n+meters(leg.geometry![i],p),0);
 assert.ok(Math.abs(length-leg.meters)<1);
}
assert.equal(findRoutes(point(0),point(1500),[shape('ruta-24-valles',[[0,0],[1500,0]])]).length,0);
const walking=findRoutes(point(0),point(100),[])[0];
assert.equal(walking.fare,0);assert.equal(walking.minutes,walking.walk);
const broken:Shape={id:'broken',name:'broken',color:'#065F46',groupName:'broken',coordinates:[point(0),point(100),point(2200),point(2300)]};
assert.ok(!findRoutes(point(0),point(2300),[broken]).some(o=>o.legs.some(l=>l.kind==='bus')));
assert.ok(!findRoutes(point(1100),point(2300),[broken]).some(o=>o.legs.some(l=>l.kind==='bus')));
assert.ok(findRoutes(point(0),point(2300),[shape('continuous',[[0,0],[2300,0]])]).some(o=>o.legs.some(l=>l.kind==='bus')));
console.log('OK: bajada antes de vuelta, transbordo temprano, distancia sobre trazo, ruta 24 excluida y caminata sin tarifa/espera.');
