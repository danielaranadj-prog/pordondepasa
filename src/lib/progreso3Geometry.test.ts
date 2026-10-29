import assert from 'node:assert/strict';
import data from '../../public/data/tepic-routes.json' with {type:'json'};
import {readFileSync} from 'node:fs';
import audit from '../../docs/geometry/20261029-progreso3.audit.json' with {type:'json'};
import {patchProgreso3} from '../../scripts/patch-progreso3-geometry.mjs';
import {findRoutes,meters,MAX_UNVERIFIED_BUS_EDGE_METERS,type Shape,type Point} from './router.ts';
import {routePreview} from './routeExplorer.ts';
const source=JSON.parse(readFileSync(new URL('../../docs/geometry/progreso3-maphub-20261029.geojson',import.meta.url),'utf8'));

const baseline=structuredClone(data),old=audit.targets[0].originalCoordinates;
baseline.routes.find(r=>r.id==='progreso-3')!.coordinates=old;
const before=JSON.stringify(baseline),{data:result,report}=patchProgreso3(baseline,source);
assert.equal(JSON.stringify(baseline),before,'patch is pure');
assert.deepEqual(result,data,'patch recreates the exact checked-in dataset');
assert.deepEqual(patchProgreso3(result,source).report.changed,[],'idempotent');
const current=result.routes.find((r:Shape)=>r.id==='progreso-3') as Shape,p=current.coordinates;
assert.equal(p.length,278);assert.equal(meters(p[0],p.at(-1)!),0);
for(let i=1;i<p.length;i++)assert.ok(meters(p[i-1],p[i])<=MAX_UNVERIFIED_BUS_EDGE_METERS);
const preview=routePreview(result.routes,'progreso-3')!;assert.equal(preview.incomplete,false);assert.equal(preview.lines.length,1);
for(const [a,b] of [[30,31],[75,76],[145,146],[177,178],[222,223]]){
 assert.ok(!p.some((point,i)=>i>0&&JSON.stringify(p[i-1])===JSON.stringify(old[a])&&JSON.stringify(point)===JSON.stringify(old[b])),`artificial edge ${a}→${b} removed`);
}
const hook=source.features[0].geometry.coordinates.slice(16,21).map(([lng,lat]:number[])=>({lat,lng}));
assert.ok(p.some((_point,i)=>JSON.stringify(p.slice(i,i+5))===JSON.stringify(hook)),'exact reference hook retained in order');
assert.ok(report.alignment);
assert.ok(report.alignment.patchedToReferenceMaxMeters<20&&report.alignment.referenceToPatchedMaxMeters<20);
for(const [from,to] of [[old[25],old[95]],[old[130],old[15]],[old[250],old[55]]]){
 const direct=findRoutes(from as Point,to as Point,[current],25).find(option=>option.id==='direct-progreso-3');
 assert.ok(direct,'direct route remains connected through the repaired blocks');
}
const corrupted=structuredClone(baseline);corrupted.routes.find(r=>r.id==='progreso-3')!.coordinates[30].lat+=.0001;
assert.throws(()=>patchProgreso3(corrupted,source),/distinta de la base/);
const wrongSource=structuredClone(source);wrongSource.features[0].geometry.coordinates[17][0]+=.0001;
assert.throws(()=>patchProgreso3(baseline,wrongSource),/MapHub cambió/);
console.log('OK: Progreso 3 topology, public MapHub hook, source alignment, direct trips, closed circuit, no false edges and idempotence.');
