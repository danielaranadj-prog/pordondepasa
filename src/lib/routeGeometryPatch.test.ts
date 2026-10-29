import assert from 'node:assert/strict';
import data from '../../public/data/tepic-routes.json' with {type:'json'};
import {patchRouteGeometry,originalCoordinates,hash} from '../../scripts/patch-route-geometry.mjs';
import {findRoutes,meters,MAX_UNVERIFIED_BUS_EDGE_METERS,type Shape,type Point} from './router.ts';
import {routePreview} from './routeExplorer.ts';

const unchanged=JSON.stringify(data),patched=patchRouteGeometry(data),routes=patched.data.routes as Shape[];
assert.equal(JSON.stringify(data),unchanged,'patch never mutates its input');
assert.deepEqual(patchRouteGeometry(patched.data).data,patched.data,'second application is identical');
assert.deepEqual(patchRouteGeometry(patched.data).report.changed,[]);
const get=(id:string)=>routes.find(route=>route.id===id)!;
const originalPed=originalCoordinates('pedregal',get('pedregal').coordinates),originalMex=originalCoordinates('m-xico',get('m-xico').coordinates);
assert.equal(originalPed.length,249);assert.equal(originalMex.length,81);
assert.equal(get('pedregal').coordinates.length,246);assert.equal(get('m-xico').coordinates.length,124);

// Exact directed-edge multiset of the four legitimate blocks is retained.
const edgeKey=(a:Point,b:Point)=>JSON.stringify([a,b]);
const edges=(points:Point[])=>points.slice(1).map((p,i)=>edgeKey(points[i],p));
const oldEdges=[[0,6],[7,126],[127,139],[140,248]].flatMap(([a,b])=>edges(originalPed.slice(a,b+1))).sort();
assert.deepEqual(edges(get('pedregal').coordinates).sort(),oldEdges,'no street edge invented, removed or reversed');
assert.deepEqual(get('pedregal').coordinates[0],get('pedregal').coordinates.at(-1));
for(const id of ['pedregal','m-xico']){
 const shape=get(id),preview=routePreview(routes,id)!;
 assert.equal(preview.incomplete,false);assert.equal(preview.lines.length,1);
 assert.ok(meters(shape.coordinates[0],shape.coordinates.at(-1)!)<=5);
 for(let i=1;i<shape.coordinates.length;i++)assert.ok(meters(shape.coordinates[i-1],shape.coordinates[i])<=MAX_UNVERIFIED_BUS_EDGE_METERS);
}
// Every old México vertex remains in the same order; only the two north gaps gain vertices.
assert.deepEqual(get('m-xico').coordinates.slice(0,55),originalMex.slice(0,55));
assert.deepEqual(get('m-xico').coordinates.slice(55,76),get('tepic-bellavista-ida').coordinates.slice(94,115));
assert.deepEqual(get('m-xico').coordinates.slice(82,104),get('bellavista-tepic-vuelta').coordinates.slice(174,196));
assert.equal(hash(originalCoordinates('m-xico',get('m-xico').coordinates)),hash(originalMex));
for(const [a,b] of [[54,56],[60,62]]){
 const origin=originalMex[a],destination=originalMex[b];
 const direct=findRoutes(origin,destination,[get('m-xico')],25).find(option=>option.id==='direct-m-xico');
 assert.ok(direct,`northern corridor ${a}→${b} remains directly reachable`);
 const bus=direct.legs.find(leg=>leg.kind==='bus')!;
 assert.ok(bus.geometry!.length>10,'ride follows donor vertices rather than a straight shortcut');
 assert.ok(bus.meters<3000,'northern ride does not detour around the entire loop');
}
const loop=get('pedregal'),wrap=findRoutes(loop.coordinates[240],loop.coordinates[4],[loop],25).find(option=>option.id==='direct-pedregal');
assert.ok(wrap,'a trip can cross the exact repaired circuit seam');
const wrapLine=wrap.legs.find(leg=>leg.kind==='bus')!.geometry!;
const seam=loop.coordinates[0];assert.ok(wrapLine.some(p=>meters(p,seam)<1));
assert.ok(wrap.legs.find(leg=>leg.kind==='bus')!.meters<1500);

const wrong=structuredClone(patched.data);wrong.routes.find((r:Shape)=>r.id==='pedregal')!.coordinates[0].lat+=.0001;
assert.throws(()=>patchRouteGeometry(wrong),/distinto del original/);
const donor=structuredClone(patched.data);donor.routes.find((r:Shape)=>r.id==='tepic-bellavista-ida')!.coordinates[94].lat+=.0001;
assert.throws(()=>patchRouteGeometry(donor),/fuente de ida/);
console.log('OK: deterministic reversible geometry patch, exact Pedregal street-edge preservation, both México north directions, circuit seam, idempotence and stale-source rejection.');
