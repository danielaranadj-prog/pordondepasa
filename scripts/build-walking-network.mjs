import fs from 'node:fs';
// Offline conversion of public OSM data. No traveller coordinates are sent out.
const input=process.argv[2];if(!input)throw new Error('Pass the downloaded Overpass JSON path');
const data=JSON.parse(fs.readFileSync(input,'utf8'));if(data.remark)throw new Error(data.remark);
const allowed=new Set(['residential','living_street','unclassified','service','tertiary','tertiary_link','secondary','secondary_link','primary','primary_link','pedestrian','footway','path','steps','track']);
const nodeMap=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
const deny=new Set(['no','private','customers','delivery','agricultural','forestry']);
const ways=data.elements.filter(e=>{if(e.type!=='way')return false;const t=e.tags??{};return allowed.has(t.highway)&&!deny.has(t.foot)&&!(deny.has(t.access)&&!['yes','designated','permissive'].includes(t.foot))&&t.foot!=='use_sidepath'&&t.area!=='yes'&&t.construction===undefined});
const nodes=[],edges=[],indexes=new Map(),names=[''],nameIndexes=new Map([['',0]]);
function index(id){if(indexes.has(id))return indexes.get(id);const n=nodeMap.get(id);if(!n)return undefined;const t=n.tags??{};if(deny.has(t.foot)||deny.has(t.access)&&!['yes','designated','permissive'].includes(t.foot)||t.barrier&& !['kerb','entrance','bollard','cycle_barrier','gate','lift_gate'].includes(t.barrier))return undefined;const i=nodes.length;indexes.set(id,i);nodes.push([n.lat,n.lon]);return i}
for(const way of ways){const name=way.tags.name??'';if(!nameIndexes.has(name)){nameIndexes.set(name,names.length);names.push(name)}for(let i=1;i<way.nodes.length;i++){const a=index(way.nodes[i-1]),b=index(way.nodes[i]);if(a!==undefined&&b!==undefined&&a!==b)edges.push([a,b,nameIndexes.get(name)])}}
if(edges.length<1000)throw new Error('Incomplete street extract');
const result={source:'© OpenStreetMap contributors — ODbL 1.0',license:'https://www.openstreetmap.org/copyright',updated:data.osm3s.timestamp_osm_base,bounds:[21.40,-105.01,21.57,-104.80],nodes,edges,names};
fs.writeFileSync(new URL('../public/data/tepic-walk-network.json',import.meta.url),JSON.stringify(result));
console.log(`${nodes.length} nodes, ${edges.length} edges, ${JSON.stringify(result).length} bytes`);
