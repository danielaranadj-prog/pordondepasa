const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const ts=require('typescript');
// Execute the production TS implementation using the existing compiler.
function load(file){
 const filename=path.resolve(file),module={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',js)(id=>id.startsWith('.')?load(path.resolve(path.dirname(filename),id+'.ts')):require(id),module,module.exports);
 return module.exports;
}
const {applyMetates,apply21Febrero}=load('src/lib/detours.ts');
const shapes=JSON.parse(fs.readFileSync('public/data/tepic-routes.json')).routes;
const data=JSON.parse(fs.readFileSync('public/data/detours/colosio-metates.geojson'));
const before=JSON.stringify(shapes),updated=applyMetates(shapes,data);
assert.equal(JSON.stringify(shapes),before);
const affected=['progreso-4','progreso-5','jazmines'];
for(let i=0;i<shapes.length;i++){
 const a=shapes[i],b=updated[i];
 if(!affected.includes(a.id)){assert.equal(a,b);continue;}
 assert.equal(a.id,b.id);assert.equal(a.color,b.color);assert.equal(a.name,b.name);
 assert.deepEqual(a.coordinates[0],b.coordinates[0]);
 assert.deepEqual(a.coordinates.at(-1),b.coordinates.at(-1));
 const marker=data.features[0].geometry.coordinates[20];
 assert.equal(b.coordinates.filter(p=>p.lng===marker[0]&&p.lat===marker[1]).length,a.id==='jazmines'?2:1);
 const spans=a.id==='jazmines'?[[5,9,false],[83,88,true]]:a.id==='progreso-4'?[[199,217,true]]:[[18,43,false]];
  for(const [start,,reverse] of spans){
  const middle=a.coordinates[start+2];
  assert.ok(!b.coordinates.some(p=>p.lat===middle.lat&&p.lng===middle.lng));
  const track=data.features[0].geometry.coordinates.map(([lng,lat])=>({lat,lng}));
  if(reverse)track.reverse();
  const j=b.coordinates.findIndex((p,k)=>p.lat===track[0].lat&&p.lng===track[0].lng&&b.coordinates[k+1]?.lat===track[1].lat&&b.coordinates[k+1]?.lng===track[1].lng);
  assert.ok(j>=0);assert.deepEqual(b.coordinates.slice(j,j+track.length),track);
 }
}
const disabled=structuredClone(data);disabled.features[0].properties.active=false;
assert.equal(applyMetates(shapes,disabled),shapes);
const bad=structuredClone(data);bad.features[0].geometry.coordinates[0]=[-104.5,21.2];
assert.throws(()=>applyMetates(shapes,bad));
console.log('PASS: three routes, both Jazmines passes, direction, exact geometry, baseline preservation, reversal and invalid joins.');

const febrero=JSON.parse(fs.readFileSync('public/data/detours/colosio-21-de-febrero.geojson'));
const victoria=JSON.parse(fs.readFileSync('public/data/detours/hospitales-1-hacia-victoria.geojson'));
const combined=apply21Febrero(updated,febrero,victoria);
const h1=shapes.find(s=>s.id==='cantera-hospitales-1');
const h2=shapes.find(s=>s.id==='cantera-hospitales-2');
const changedH1=combined.find(s=>s.id===h1.id);
const changedH2=combined.find(s=>s.id===h2.id);
assert.notEqual(changedH1,h1);
assert.notEqual(changedH2,h2);
assert.equal(changedH1.color,h1.color);
assert.deepEqual(changedH1.coordinates[0],h1.coordinates[0]);
assert.deepEqual(changedH1.coordinates.at(-1),h1.coordinates.at(-1));
assert.ok(!changedH1.coordinates.some(p=>p.lat===h1.coordinates[108].lat&&p.lng===h1.coordinates[108].lng));
const yellow=febrero.features[0].geometry.coordinates.map(([lng,lat])=>({lat,lng}));
const victoriaLine=victoria.features[0].geometry.coordinates.map(([lng,lat])=>({lat,lng}));
const hospital1=changedH1.coordinates;
const h1Start=hospital1.findIndex((p,k)=>p.lat===yellow.at(-1).lat&&p.lng===yellow.at(-1).lng&&hospital1[k+1]?.lat===yellow.at(-2).lat);
assert.ok(h1Start>=0);
assert.deepEqual(hospital1.slice(h1Start,h1Start+yellow.length-4),yellow.slice(4).reverse());
assert.deepEqual(hospital1.slice(h1Start+yellow.length-4,h1Start+yellow.length-4+victoriaLine.length-7),victoriaLine.slice(7));
assert.ok(!hospital1.some(p=>p.lat===victoriaLine[0].lat&&p.lng===victoriaLine[0].lng));
assert.equal(changedH2.color,h2.color);
assert.deepEqual(changedH2.coordinates[0],h2.coordinates[0]);
assert.deepEqual(changedH2.coordinates.at(-1),h2.coordinates.at(-1));
const originalMiddle=h2.coordinates[409];
assert.ok(!changedH2.coordinates.some(p=>p.lat===originalMiddle.lat&&p.lng===originalMiddle.lng));
const replacement=febrero.features[0].geometry.coordinates.map(([lng,lat])=>({lat,lng}));
const at=changedH2.coordinates.findIndex((p,k)=>p.lat===replacement[0].lat&&p.lng===replacement[0].lng&&changedH2.coordinates[k+1]?.lat===replacement[1].lat);
assert.ok(at>=0);
assert.deepEqual(changedH2.coordinates.slice(at,at+replacement.length),replacement);
assert.ok(combined.every((s,i)=>s===updated[i]||['cantera-hospitales-1','cantera-hospitales-2'].includes(s.id)));
const febreroOff=structuredClone(febrero);febreroOff.features[0].properties.active=false;
assert.equal(apply21Febrero(updated,febreroOff,victoria),updated);
const victoriaOff=structuredClone(victoria);victoriaOff.features[0].properties.active=false;
assert.equal(apply21Febrero(updated,febrero,victoriaOff).find(s=>s.id===h1.id),h1);
console.log('PASS: Hospitales 1 exits 21 de Febrero at the shared junction; Hospitales 2 follows north to south.');
