import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,geometryStats} from './patch-route-geometry.mjs';
import {meters,MAX_UNVERIFIED_BUS_EDGE_METERS} from '../src/lib/router.ts';
import {projectProgress} from '../src/lib/navigation.ts';

export const PROGRESO_PATCH_ID='20261029-progreso3-maphub-v1';
const beforeHash='edd85c693c4caccb3ef625b2d32d24f307ea372af7cef53839307cd9081ffa42';
const afterHash='4be2f3af01c5aca29c602367f59f50b29254aafd38aad8cd1818311794198fe8';
const sourceHash='e0e40dda7ed0859b90c2ce69a71fd9d7073fc33f8cc90b7c9a3c6e954f95b6c0';
function sampledDistance(line,other){
 let maximum=0;
 for(let i=1;i<line.length;i++){
  const a=line[i-1],b=line[i],count=Math.max(1,Math.ceil(meters(a,b)/30));
  for(let k=0;k<=count;k++){const t=k/count;maximum=Math.max(maximum,projectProgress({lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t},other).distance);}
 }
 return maximum;
}
export function patchProgreso3(input,source){
 assert.equal(hash(JSON.stringify(source,null,2)+'\n'),sourceHash,'La copia pública de MapHub cambió: revisar la fuente');
 const feature=source.features?.find(f=>f.properties?.title==='Progreso 3');
 assert.equal(feature?.geometry?.type,'LineString');assert.equal(feature.geometry.coordinates.length,71);
 const reference=feature.geometry.coordinates.map(([lng,lat])=>({lat,lng}));
 const data=structuredClone(input),matches=data.routes.filter(r=>r.id==='progreso-3');assert.equal(matches.length,1,'Se esperaba una sola Progreso 3');
 const route=matches[0],p=route.coordinates,digest=hash(p);
 assert.ok([beforeHash,afterHash].includes(digest),'Progreso 3 distinta de la base y del parche: revisar antes de usar índices');
 const provenance={url:'https://maphub.net/MovilidadNayarit/Transporte-Publico-Tepic',downloadSha256:'95df51759166d2d556de4ad0d450d8b0c8a22f79afc684941972499cb77ec0ee',referenceSha256:sourceHash,referenceFeature:'Progreso 3',originalSlicesInclusive:[[0,30],[224,251],[257,284],[179,222],[32,48],[77,109],[147,177],[111,145],[50,75]],replacement:{originalSliceInclusive:[252,256],mapHubSliceInclusive:[16,20]},joinsRemoved:[[30,31],[75,76],[145,146],[177,178],[222,223]]};
 if(digest===afterHash)return {data,report:{patchId:PROGRESO_PATCH_ID,changed:[],provenance,targets:[{id:route.id,after:geometryStats(p),afterSha256:afterHash}]}};
 for(const [a,b] of [[30,223],[284,178],[222,31],[48,76],[109,146],[177,110],[145,49],[75,0],[109,110]])assert.deepEqual(p[a],p[b],`Unión incompatible ${a}/${b}`);
 // The two retained boundary points lie on the same reference streets, not nearest roads elsewhere.
 assert.ok(projectProgress(p[251],reference.slice(15,17)).distance<15);
 assert.ok(projectProgress(p[257],reference.slice(20,22)).distance<15);
 const next=[...p.slice(0,31),...p.slice(224,252),...reference.slice(16,21),...p.slice(257,285),...p.slice(179,223),...p.slice(32,49),...p.slice(77,110),...p.slice(147,178),...p.slice(111,146),...p.slice(50,76)];
 assert.equal(hash(next),afterHash,'Resultado inesperado');
 const after=geometryStats(next);assert.equal(after.vertices,278);assert.equal(after.unverifiedEdges.length,0);assert.equal(after.closureMeters,0);
 const alignment={samplingMeters:30,patchedToReferenceMaxMeters:sampledDistance(next,reference),referenceToPatchedMaxMeters:sampledDistance(reference,next)};
 assert.ok(alignment.patchedToReferenceMaxMeters<20&&alignment.referenceToPatchedMaxMeters<20,'El trazo se aparta de la referencia de MapHub');
 route.coordinates=next;
 assert.deepEqual({...data,routes:data.routes.filter(r=>r.id!==route.id)},{...input,routes:input.routes.filter(r=>r.id!==route.id)},'Se modificaron otras rutas');
 const {coordinates:oldPoints,...oldMetadata}=input.routes.find(r=>r.id===route.id),{coordinates:newPoints,...newMetadata}=route;assert.deepEqual(oldMetadata,newMetadata);
 return {data,report:{patchId:PROGRESO_PATCH_ID,changed:[route.id],thresholdMeters:MAX_UNVERIFIED_BUS_EDGE_METERS,provenance,alignment,targets:[{id:route.id,beforeSha256:beforeHash,afterSha256:afterHash,before:geometryStats(p),after,originalCoordinates:p}]}};
}
async function main(){
 const args=process.argv.slice(2),apply=args.includes('--apply');assert.ok(!(apply&&args.includes('--check')),'Usa --check o --apply');
 for(let i=0;i<args.length;i++){if(args[i]==='--audit'){assert.ok(args[++i]&&!args[i].startsWith('--'),'Falta archivo de auditoría');continue;}assert.ok(['--apply','--check'].includes(args[i]),`Opción desconocida: ${args[i]}`);}
 const root=new URL('../',import.meta.url),file=new URL('public/data/tepic-routes.json',root),text=await readFile(file,'utf8');
 const source=JSON.parse(await readFile(new URL('docs/geometry/progreso3-maphub-20261029.geojson',root),'utf8'));
 const {data,report}=patchProgreso3(JSON.parse(text),source),output=JSON.stringify(data,null,2)+'\n',audit={...report,inputFileSha256:hash(text),expectedOutputFileSha256:hash(output)};
 if(apply&&report.changed.length){
  const index=args.indexOf('--audit');assert.ok(index>=0,'--apply requiere --audit /ruta/plan.json');
  const auditPath=resolve(args[index+1]);assert.notEqual(auditPath,fileURLToPath(file));await mkdir(dirname(auditPath),{recursive:true});await writeFile(auditPath,JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
  assert.equal(hash(await readFile(file,'utf8')),hash(text),'El archivo cambió durante la preparación');
  const temporary=fileURLToPath(file)+`.${process.pid}.tmp`;
  try{await writeFile(temporary,output,{flag:'wx'});await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}
  assert.equal(hash(await readFile(file,'utf8')),audit.expectedOutputFileSha256);
 }
 console.log(JSON.stringify({...audit,mode:apply?'apply':'check',result:report.changed.length?(apply?'applied':'changes-proposed'):'already-applied'},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
