import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {meters,MAX_UNVERIFIED_BUS_EDGE_METERS} from '../src/lib/router.ts';

export const PATCH_ID='20261029-pedregal-mexico-v1';
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const expected={
 pedregal:{before:'4ea9c170c26cc2cf9565f5efa3b24d2d215517995651a395eb8f85d017669f76',after:'0b7981d5da011181ced421dafdd8c4fe879eac7c39c076fe5b91286d992d942e'},
 'm-xico':{before:'78a725c4ea0044113a00f963c589a7be765f386ce3c21e6c67c03a4668e535e7',after:'529c6b0df484bcffcd79c26fdde5a39dcfd8ff3c39a3e9cc1cfd8b9cf656f7cd'},
 'tepic-bellavista-ida':'35c5e904ea4b89bf677447793e0d7b794374f55d3e235192c338a072a57d5aca',
 'bellavista-tepic-vuelta':'d6d8ea4ab914bdf4da244650aada816d697bea381d106ab8d6be35be2f6be23e',
};
export function geometryStats(points){
 const edges=points.slice(1).map((point,i)=>({from:i,to:i+1,meters:meters(points[i],point)}));
 return {vertices:points.length,maxEdgeMeters:Math.max(0,...edges.map(edge=>edge.meters)),closureMeters:meters(points[0],points.at(-1)),unverifiedEdges:edges.filter(edge=>edge.meters>MAX_UNVERIFIED_BUS_EDGE_METERS)};
}
/** Recover only the exact recognized baseline; useful for audit/rollback and idempotence. */
export function originalCoordinates(id,points){
 const spec=expected[id],digest=hash(points);
 assert.ok(spec&&typeof spec==='object',`Ruta no admitida: ${id}`);
 if(digest===spec.before)return structuredClone(points);
 assert.equal(digest,spec.after,`Trazo ${id} distinto del original y del parche: revisar antes de usar índices`);
 const original=id==='pedregal'
  ?[...points.slice(0,7),points[126],...points.slice(127,246),points[114],...points.slice(115,127),points[6],...points.slice(7,115)]
  :[...points.slice(0,55),...points.slice(76,82),...points.slice(104)];
 assert.equal(hash(original),spec.before,`No se pudo recuperar la base de ${id}`);
 return structuredClone(original);
}
export function patchRouteGeometry(input){
 assert.ok(Array.isArray(input.routes),'Falta routes');
 const data=structuredClone(input),route=id=>{
  const matches=data.routes.filter(item=>item.id===id);assert.equal(matches.length,1,`Se esperaba una sola ruta ${id}`);return matches[0];
 };
 const north=route('tepic-bellavista-ida').coordinates,south=route('bellavista-tepic-vuelta').coordinates;
 assert.equal(hash(north),expected['tepic-bellavista-ida'],'Cambió la fuente de ida Bellavista');
 assert.equal(hash(south),expected['bellavista-tepic-vuelta'],'Cambió la fuente de vuelta Bellavista');
 const ped=originalCoordinates('pedregal',route('pedregal').coordinates),mex=originalCoordinates('m-xico',route('m-xico').coordinates);
 for(const [a,b] of [[6,140],[248,127],[139,7],[126,0]])assert.deepEqual(ped[a],ped[b],`Unión Pedregal ${a}/${b} incompatible`);
 const replacements={
  pedregal:[...ped.slice(0,7),...ped.slice(141,249),...ped.slice(128,140),...ped.slice(8,127)],
  'm-xico':[...mex.slice(0,55),...north.slice(94,115),...mex.slice(55,61),...south.slice(174,196),...mex.slice(61)],
 };
 const targets=[],changed=[];
 for(const id of ['pedregal','m-xico']){
  const current=route(id),original=id==='pedregal'?ped:mex,next=replacements[id];
  assert.equal(hash(next),expected[id].after,`Resultado inesperado de ${id}`);
  const after=geometryStats(next);assert.equal(after.unverifiedEdges.length,0,`Persisten saltos >${MAX_UNVERIFIED_BUS_EDGE_METERS} m en ${id}`);
  assert.ok(after.closureMeters<=5,`Circuito abierto en ${id}`);
  if(hash(current.coordinates)!==expected[id].after)changed.push(id);
  targets.push({id,beforeSha256:expected[id].before,afterSha256:expected[id].after,before:geometryStats(original),after,originalCoordinates:original});
  current.coordinates=next;
 }
 assert.deepEqual(replacements['m-xico'].slice(0,55),mex.slice(0,55),'Cambió el corredor sur de México');
 const withoutTargets=doc=>({...doc,routes:doc.routes.filter(item=>!['pedregal','m-xico'].includes(item.id))});
 assert.deepEqual(withoutTargets(data),withoutTargets(input),'Se modificaron otras rutas');
 for(const id of ['pedregal','m-xico']){
  const {coordinates:before,...oldMetadata}=input.routes.find(item=>item.id===id),{coordinates:after,...newMetadata}=route(id);
  assert.deepEqual(newMetadata,oldMetadata,`Cambió la identidad de ${id}`);
 }
 return {data,report:{patchId:PATCH_ID,coordinateSystem:'EPSG:4326 (JSON {lat,lng})',distanceMethod:'router.meters: aproximación equirectangular local',thresholdMeters:MAX_UNVERIFIED_BUS_EDGE_METERS,changed,targets,provenance:{pedregal:{originalSlicesInclusive:[[0,6],[141,248],[128,139],[8,126]],reversedSegments:false},mexico:{north:{routeId:'tepic-bellavista-ida',sourceSha256:expected['tepic-bellavista-ida'],sliceInclusive:[94,114],insertAfterOriginal:54},south:{routeId:'bellavista-tepic-vuelta',sourceSha256:expected['bellavista-tepic-vuelta'],sliceInclusive:[174,195],insertAfterOriginal:60}}}}};
}
async function main(){
 const args=process.argv.slice(2),apply=args.includes('--apply');
 assert.ok(!(apply&&args.includes('--check')),'Usa --check o --apply, no ambos');
 for(let i=0;i<args.length;i++){if(args[i]==='--audit'){assert.ok(args[++i]&&!args[i].startsWith('--'),'Falta la ruta de auditoría');continue;}assert.ok(['--apply','--check'].includes(args[i]),`Opción desconocida: ${args[i]}`);}
 const root=new URL('../',import.meta.url),file=new URL('public/data/tepic-routes.json',root),text=await readFile(file,'utf8');
 const {data,report}=patchRouteGeometry(JSON.parse(text)),output=JSON.stringify(data,null,2)+'\n';
 const audit={...report,inputFileSha256:hash(text),expectedOutputFileSha256:hash(output)};
 if(apply&&report.changed.length){
  const auditArg=args.indexOf('--audit');assert.ok(auditArg>=0,'--apply requiere --audit /ruta/plan.json para conservar la base reversible');
  const auditPath=resolve(args[auditArg+1]);assert.notEqual(auditPath,fileURLToPath(file),'La auditoría no puede reemplazar los datos');
  await mkdir(dirname(auditPath),{recursive:true});await writeFile(auditPath,JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
  // Atomic file replacement. Refuse concurrent edits after preparing the audit plan.
  assert.equal(hash(await readFile(file,'utf8')),hash(text),'El archivo cambió durante la preparación');
  const temporary=fileURLToPath(file)+`.${process.pid}.tmp`;
  try{await writeFile(temporary,output,{flag:'wx'});await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}
  assert.equal(hash(await readFile(file,'utf8')),audit.expectedOutputFileSha256,'No coincide el archivo escrito');
 }
 console.log(JSON.stringify({...audit,mode:apply?'apply':'check',result:report.changed.length?(apply?'applied':'changes-proposed'):'already-applied'},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
