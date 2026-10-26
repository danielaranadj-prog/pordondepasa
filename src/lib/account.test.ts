import assert from 'node:assert/strict';
import {accountFetch,personalName,saveFavorite,savePrivatePlace,validPrivatePoint,validSupabaseConfig,verifiedAccount} from './account.ts';
import {accountStorageKey,clearAccountLocalData,setAccountStorageOwner} from './accountStorage.ts';
import type {SupabaseClient} from '@supabase/supabase-js';

assert.equal(validSupabaseConfig('https://pilot.supabase.co','sb_publishable_12345678901234567890'),true);
for(const [url,key] of [
 ['http://pilot.supabase.co','sb_publishable_12345678901234567890'],
 ['https://pilot.supabase.co.evil.test','sb_publishable_12345678901234567890'],
 ['https://pilot.supabase.co','sb_secret_do_not_ship'],
 ['https://user:password@pilot.supabase.co','sb_publishable_12345678901234567890'],
 ['https://pilot.supabase.co?key=private','sb_publishable_12345678901234567890'],
 ['https://pilot.supabase.co',`abc.${btoa(JSON.stringify({role:'service_role'}))}.sig`]
])assert.equal(validSupabaseConfig(url,key),false);
assert.equal(personalName('  Mi   nombre  '),'Mi nombre');
assert.equal(personalName('X'.repeat(100)).length,80);
assert.equal(validPrivatePoint({lat:NaN,lng:-104.9}),false);
assert.equal(validPrivatePoint({lat:21.5,lng:Infinity}),false);
assert.equal(validPrivatePoint({lat:0,lng:0}),false);
assert.equal(validPrivatePoint({lat:21.5,lng:-104.9}),true);
let verified=0,permissions=0;
const makeClient=({session=true,server=true,google=true,access=true}:{session?:boolean;server?:boolean;google?:boolean;access?:boolean}={})=>({auth:{
 getSession:async()=>({data:{session:session?{user:{id:'client-spoof'}}:null},error:null}),
 getUser:async()=>{verified++;return {data:{user:server?{id:'server-user',app_metadata:{provider:google?'google':'email'}}:null},error:server?null:new Error('Offline')}},
},rpc:async()=>{permissions++;return {data:access,error:null}}}) as unknown as SupabaseClient;
assert.equal(await verifiedAccount(makeClient({session:false})),null);
assert.equal(verified,0);
assert.equal((await verifiedAccount(makeClient()))?.id,'server-user');
assert.equal(verified,1);assert.equal(permissions,1);
await assert.rejects(verifiedAccount(makeClient({server:false})),/verificar/);
await assert.rejects(verifiedAccount(makeClient({google:false})),/Google/);
await assert.rejects(verifiedAccount(makeClient({access:false})),/autorizada/);
assert.equal(permissions,2,'Do not authorize via browser session metadata');
await assert.rejects(savePrivatePlace(makeClient(),'server-user',{kind:'home',label:'Casa',point:{lat:0,lng:0}}),/ubicación/);
await assert.rejects(saveFavorite(makeClient(),'server-user','../places.json',true),/válida/);
setAccountStorageOwner(undefined);assert.equal(accountStorageKey('waiting'),null);
setAccountStorageOwner('user-a');const a=accountStorageKey('route-reports')!;
setAccountStorageOwner('user-b');assert.notEqual(accountStorageKey('route-reports'),a);
const removed:string[]=[];clearAccountLocalData({removeItem:key=>removed.push(key)});
assert.ok(removed.every(key=>key.includes('user-b')));assert.ok(!removed.includes(a));
setAccountStorageOwner(undefined);
const realFetch=globalThis.fetch;
try {
 globalThis.fetch=async()=>new Response('{"ok":true}');
 assert.deepEqual(await (await accountFetch('https://pilot.example.test')).json(),{ok:true});
 globalThis.fetch=(_input,init)=>new Promise((_resolve,reject)=>{
  if(init?.signal?.aborted)reject(new Error('aborted'));
  else init?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
 });
 await assert.rejects(accountFetch('https://pilot.example.test',{},10),/aborted/);
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(accountFetch('https://pilot.example.test',{signal:aborted.signal}),/aborted/);
}finally{globalThis.fetch=realFetch}
console.log('OK: sesión verificada en servidor, denegación sin permiso o conexión, validación de claves/puntos y separación de almacenamiento.');
