import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadTransitShapes} from './transitShapes.ts';
import {routePreview} from './routeExplorer.ts';
import {meters,MAX_UNVERIFIED_BUS_EDGE_METERS,type Shape} from './router.ts';
import {apply21Febrero,applyMetates} from './detours.ts';
import {splitKnownRouteBreaks} from './routeFragments.ts';

const fetcher:typeof fetch=async input=>{
 const name=String(input).replace(/^\/data\//,'');
 return new Response(await readFile(new URL(`../../public/data/${name}`,import.meta.url)));
};
const shapes=await loadTransitShapes(fetcher);
const json=async(name:string)=>JSON.parse(await readFile(new URL(`../../public/data/${name}`,import.meta.url),'utf8'));
const [base,metates,febrero,victoria]=await Promise.all(['tepic-routes.json','detours/colosio-metates.geojson','detours/colosio-21-de-febrero.geojson','detours/hospitales-1-hacia-victoria.geojson'].map(json));
assert.deepEqual(shapes,splitKnownRouteBreaks(apply21Febrero(applyMetates(base.routes,metates),febrero,victoria)),'shared loader preserves the planner geometry exactly');
const before=JSON.stringify(shapes);
for(const id of new Set(shapes.map(shape=>shape.id))){
 const preview=routePreview(shapes,id);
 if(!preview)continue;
 assert.ok(preview.lines.every(line=>line.length>=2));
 for(const line of preview.lines)for(let i=1;i<line.length;i++)assert.ok(meters(line[i-1],line[i])<=MAX_UNVERIFIED_BUS_EDGE_METERS);
}
for(const id of ['m-xico','r-rio-suchiate'])assert.ok(routePreview(shapes,id),`${id} available for exploration`);
const loops=routePreview(shapes,'agr-nomos-universidad')!;
assert.ok(loops.lines.length>=2,'separate registered loops remain separate');
assert.equal(JSON.stringify(shapes),before,'preview does not mutate planner data');
assert.equal(routePreview(shapes,'not-a-route'),null);
const synthetic:Shape={id:'test',name:'Test',color:'#2563eb',groupName:'Test',coordinates:[{lat:21.5,lng:-104.9},{lat:21.501,lng:-104.9},{lat:21.53,lng:-104.9},{lat:21.531,lng:-104.9}]};
const gap=routePreview([synthetic],synthetic.id)!;
assert.equal(gap.lines.length,2);assert.equal(gap.incomplete,true);
assert.equal(routePreview([{...synthetic,id:'ruta-24'}],'ruta-24'),null,'inactive route not resurrected');
await assert.rejects(()=>loadTransitShapes(async()=>new Response('',{status:503})));
console.log('OK: route exploration preserves planner detours/fragments, excludes inactive routes and never bridges unverified gaps.');
