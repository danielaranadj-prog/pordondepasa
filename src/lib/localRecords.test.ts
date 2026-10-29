import assert from 'node:assert/strict';
import {accountStorageKey,clearAccountLocalData,setAccountStorageOwner} from './accountStorage.ts';
import {LOCAL_RECORD_RETENTION_MS,localRecordKey,localRecordPreference,setLocalRecordPreference,readLocalRecords,saveLocalRecord,pruneLocalRecords,requestLocalRecordPreference} from './localRecords.ts';
import {saveWaiting,readWaiting,type WaitingRecord} from './waitingRecords.ts';
import {saveRouteReport,type RouteReport} from './routeReport.ts';

const memory=new Map<string,string>(),storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{memory.set(key,value)},removeItem:(key:string)=>{memory.delete(key)}};
const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
const now=Date.now(),waiting:WaitingRecord={id:'wait-test',routeId:'test',routeName:'Prueba',startedAt:now,observedSeconds:30,status:'waiting',reasons:[]};
const report:RouteReport={id:'report-test',routeId:'test',routeName:'Prueba',startedAt:now,kind:'deviation',reason:'unknown',fixes:[]};
try{
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});setAccountStorageOwner(undefined);
 memory.set('pordondepasa:waiting:v1',JSON.stringify([{...waiting,id:'old-global'}]));
 assert.equal(accountStorageKey('waiting'),null,'Private account guard remains closed for guest');
 assert.equal(localRecordPreference(),undefined);assert.equal(saveWaiting(waiting),false,'No persistence without consent');
 let prompts=0;Object.defineProperty(globalThis,'window',{configurable:true,value:{confirm:()=>{prompts++;return false}}});
 assert.equal(requestLocalRecordPreference(),false);assert.equal(requestLocalRecordPreference(),false);assert.equal(prompts,1,'Declining does not cause recurring GPS prompts');
 assert.ok(setLocalRecordPreference(true));assert.deepEqual(readWaiting(),[],'No adoption of the old global history');
 assert.ok(saveWaiting({...waiting,point:{lat:1,lng:2},history:['private']} as WaitingRecord));
 assert.deepEqual(readWaiting(),[waiting],'Production guest path persists without injected storage');
 const guestKey=localRecordKey('waiting');assert.ok(!memory.get(guestKey)!.includes('point'));
 assert.ok(saveRouteReport(report));assert.deepEqual(readLocalRecords('route-reports'),[report]);
 setAccountStorageOwner('account-a');assert.equal(localRecordPreference(),undefined);assert.deepEqual(readWaiting(),[]);
 assert.ok(setLocalRecordPreference(true));assert.ok(saveWaiting({...waiting,id:'account-a-record'}));const aKey=localRecordKey('waiting');
 setAccountStorageOwner('account-b');assert.deepEqual(readWaiting(),[]);assert.equal(saveRouteReport(report),false);
 setAccountStorageOwner('account-a');assert.equal(readWaiting()[0].id,'account-a-record');const privateReportKey=localRecordKey('route-reports');clearAccountLocalData(storage);assert.equal(localRecordPreference(),undefined);assert.ok(!memory.has(aKey));
 setAccountStorageOwner(undefined);assert.deepEqual(readWaiting(),[waiting],'Account sign-out never clears or adopts guest records');
 assert.equal(saveWaiting({...waiting,id:'late-account-wait'},undefined,aKey),false,'Late private callbacks cannot write to guest');
 assert.equal(saveRouteReport({...report,id:'late-account-report'},undefined,privateReportKey),false,'Report cleanup cannot leak an account trace to guest');
 assert.equal(readWaiting(undefined,aKey).length,0,'Stale account export cannot read guest history');
 assert.ok(saveLocalRecord('waiting',{...waiting,id:'ttl'},100,storage,now));
 assert.ok(saveLocalRecord('waiting',{...waiting,id:'ttl',observedSeconds:90},100,storage,now+LOCAL_RECORD_RETENTION_MS-1));
 assert.deepEqual(readLocalRecords('waiting',storage,now+LOCAL_RECORD_RETENTION_MS+100),[],'Updates do not extend the original retention');
 pruneLocalRecords(storage,now+LOCAL_RECORD_RETENTION_MS+100);assert.equal(JSON.parse(memory.get(localRecordKey('route-reports'))!).entries.length,0);
 assert.ok(setLocalRecordPreference(false));assert.ok(!memory.has(guestKey));assert.deepEqual(readWaiting(),[]);
 assert.ok(memory.has('pordondepasa:waiting:v1'),'Deletion targets only the chosen scope, not unrelated/legacy storage');
 const blocked={getItem:()=>{throw new Error('blocked')},setItem:()=>{throw new Error('blocked')}};
 assert.equal(setLocalRecordPreference(true,blocked),false);assert.equal(saveWaiting(waiting,blocked),false);assert.deepEqual(readWaiting(blocked),[]);
}finally{
 setAccountStorageOwner(undefined);
 if(original)Object.defineProperty(globalThis,'localStorage',original);else Reflect.deleteProperty(globalThis,'localStorage');
 if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');
}
console.log('OK: guest persistence, explicit consent, 7-day TTL, GPS-free waits, account isolation, scoped deletion and blocked storage.');
