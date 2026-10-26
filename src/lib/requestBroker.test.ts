import assert from 'node:assert/strict';
import {createRequestBroker,type WorkerTransport} from './requestBroker.ts';
class Fake implements WorkerTransport{
 listeners=new Map<string,Set<(e:any)=>void>>();messages:any[]=[];terminated=false;
 postMessage(value:unknown){this.messages.push(value)}
 addEventListener(type:string,fn:(e:any)=>void){const set=this.listeners.get(type)??new Set();set.add(fn);this.listeners.set(type,set)}
 removeEventListener(type:string,fn:(e:any)=>void){this.listeners.get(type)?.delete(fn)}
 terminate(){this.terminated=true}
 emit(data:any){for(const fn of this.listeners.get('message')??[])fn({data})}
}
const workers:Fake[]=[],broker=createRequestBroker(()=>{const worker=new Fake();workers.push(worker);return worker},15);
const first=broker.request({kind:'walk'}),second=broker.request({kind:'second'});
const settled=await Promise.allSettled([first,second]);
assert.ok(settled.every(result=>result.status==='rejected'),'All requests of a terminated generation settle together');
assert.equal(workers[0].terminated,true);
const next=broker.request({kind:'replacement'}),id=workers[1].messages[0].id;
workers[0].emit({id,options:['stale']});workers[1].emit({id,options:['current']});
assert.deepEqual((await next).options,['current']);assert.equal(workers[1].terminated,false);
broker.cancel();
const superseding=createRequestBroker(()=>{const w=new Fake();workers.push(w);return w},30);
const old=superseding.request({kind:'plan'}).catch(error=>error);
await new Promise(resolve=>setTimeout(resolve,20));
const replacement=superseding.request({kind:'plan'}),transport=workers.at(-1)!;
assert.match(String(await old),/sustituido/);
await new Promise(resolve=>setTimeout(resolve,15));
assert.equal(transport.terminated,false,'The superseded timer cannot terminate the active request');
transport.emit({id:transport.messages.at(-1).id,options:['new']});assert.deepEqual((await replacement).options,['new']);superseding.cancel();
console.log('OK: timeout settles all old requests, stale replies cannot affect the replacement.');
