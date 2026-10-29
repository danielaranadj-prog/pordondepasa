import {localRecordKey,readLocalRecords,saveLocalRecord,type LocalRecordStorage} from './localRecords.ts';
export type WaitReason='still-waiting'|'not-arrived'|'full'|'missed'|'declined';
export type WaitingRecord={id:string;routeId:string;routeName:string;startedAt:number;endedAt?:number;observedSeconds:number;source?:'manual'|'motion';status:'waiting'|'boarded'|'cancelled';confirmed?:boolean;reasons:{reason:WaitReason;at:number}[]};
export function saveWaiting(record:WaitingRecord,storage?:LocalRecordStorage,expectedKey?:string){
 try{
  // Explicit allowlist: never persist GPS coordinates, device IDs or history.
  const safe:WaitingRecord={id:record.id,routeId:record.routeId,routeName:record.routeName,startedAt:record.startedAt,endedAt:record.endedAt,observedSeconds:record.observedSeconds,source:record.source,status:record.status,confirmed:record.confirmed,reasons:record.reasons};
  return saveLocalRecord('waiting',safe,100,storage,Date.now(),expectedKey);
 }catch{return false;}
}
export function readWaiting(storage?:LocalRecordStorage,expectedKey?:string):WaitingRecord[]{return expectedKey!==undefined&&localRecordKey('waiting')!==expectedKey?[]:readLocalRecords<WaitingRecord>('waiting',storage)}
