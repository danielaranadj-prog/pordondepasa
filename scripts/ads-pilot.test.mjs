import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';

const temp=await mkdtemp(join(tmpdir(),'pdp-ads-pilot-'));
process.env.ADS_PILOT_STORE=join(temp,'feed.json');
process.env.ADS_PILOT_TOKEN='local-pilot-test-token';
const {createAdsPilotServer}=await import('./ads-pilot-server.mjs');
const server=createAdsPilotServer();
server.listen(0,'127.0.0.1');
await once(server,'listening');
const url=`http://127.0.0.1:${server.address().port}/api/ads`;
const expect=(value,message)=>{if(!value)throw Error(message)};
try {
  const initial=await (await fetch(url)).json();
  expect(initial.enabled===false && initial.campaigns.length===0,'Fresh bridge is off');
  const body={schemaVersion:1,enabled:true,campaigns:[{id:'cafe',type:'pin',title:'Café',isActive:true,routeIds:['mexico'],coordinates:{lat:21.5,lng:-104.9},clientId:'private-client',notes:'private'}]};
  const rejected=await fetch(url,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  expect(rejected.status===401,'Publishing requires token');
  const published=await fetch(url,{method:'PUT',headers:{authorization:'Bearer local-pilot-test-token','content-type':'application/json',origin:'http://127.0.0.1:4359'},body:JSON.stringify(body)});
  expect(published.ok,'Authorized local publish succeeds');
  const saved=await (await fetch(url)).json();
  expect(saved.enabled && saved.campaigns.length===1 && !('clientId' in saved.campaigns[0]) && !('notes' in saved.campaigns[0]),'Only public fields are stored');
  expect((await readFile(process.env.ADS_PILOT_STORE,'utf8')).includes('cafe'),'Feed persists to disk');
  const switched=await fetch(url,{method:'PUT',headers:{authorization:'Bearer local-pilot-test-token','content-type':'application/json'},body:JSON.stringify({...body,enabled:false})});
  expect(switched.ok && (await (await fetch(url)).json()).enabled===false,'Remote switch disables ads');
  console.log('OK: local ads bridge publish, auth, privacy and kill switch');
} finally {
  server.close();
  await rm(temp,{recursive:true,force:true});
}
