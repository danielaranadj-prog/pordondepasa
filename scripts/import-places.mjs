import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Uso: node scripts/import-places.mjs /ruta/pordondepasa-lugares.geojson');
const collection = JSON.parse(await readFile(source, 'utf8'));
const network = JSON.parse(await readFile(resolve('public/data/tepic-walk-network.json'), 'utf8'));
if (collection.type !== 'FeatureCollection' || collection.dataset !== 'pordondepasa-places' || !Array.isArray(collection.features)) throw new Error('GeoJSON de lugares no válido');
const meters = (a,b) => Math.hypot((a[0]-b[0])*111320*Math.cos(a[1]*Math.PI/180),(a[1]-b[1])*111320);
function streetAccess(point) {
 let best;
 for (const [a,b] of network.edges) {
  const start=network.nodes[a],end=network.nodes[b];
  const x=point[0],y=point[1],sx=start[1],sy=start[0],ex=end[1],ey=end[0],scale=Math.cos(y*Math.PI/180);
  const dx=(ex-sx)*scale,dy=ey-sy;
  const t=Math.max(0,Math.min(1,((x-sx)*scale*dx+(y-sy)*dy)/(dx*dx+dy*dy||1)));
  const access=[sx+(ex-sx)*t,sy+(ey-sy)*t],distance=meters(point,access);
  if (!best || distance<best.distance) best={coordinates:access,distance};
 }
 return best;
}
const ids=new Set();
const places=collection.features.map((feature,index)=>{
 const p=feature.properties,coordinates=feature.geometry?.coordinates;
 if(feature.geometry?.type!=='Point'||!Array.isArray(coordinates)||coordinates.length!==2||!coordinates.every(Number.isFinite)||!p?.id||!p?.name||ids.has(p.id))throw new Error(`Lugar inválido o duplicado: ${index}`);
 ids.add(p.id);
 const access=streetAccess(coordinates);
 if(!access||access.distance>120)throw new Error(`Sin calle cercana: ${p.name}`);
 return {id:p.id,name:p.name,category:p.category??'',aliases:Array.isArray(p.aliases)?p.aliases:[],neighborhood:p.neighborhood??'',municipality:p.municipality??'',entrance:p.entrance??'',status:p.status??'pendiente',coordinates:{lng:coordinates[0],lat:coordinates[1]},access:{lng:access.coordinates[0],lat:access.coordinates[1]},accessMeters:Math.round(access.distance)};
});
await writeFile(resolve('public/data/places.json'),JSON.stringify({dataset:collection.dataset,schemaVersion:collection.schemaVersion,sourceExportedAt:collection.exportedAt,accessMethod:'nearest-walk-network-edge; approximate, not a verified entrance',places})+'\n');
console.log(`Importados ${places.length} lugares; ${places.filter(p=>p.accessMeters>40).length} a más de 40 m de la red.`);
