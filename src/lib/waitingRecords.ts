import {accountStorageKey} from './accountStorage.ts';
export type WaitReason='still-waiting'|'not-arrived'|'full'|'missed'|'declined';
export type WaitingRecord={id:string;routeId:string;routeName:string;startedAt:number;endedAt?:number;observedSeconds:number;source?:'manual'|'motion';status:'waiting'|'boarded'|'cancelled';confirmed?:boolean;reasons:{reason:WaitReason;at:number}[]};
const KEY='pordondepasa:waiting:v1';
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
export function saveWaiting(record:WaitingRecord,storage?:StorageLike){
 try{const key=storage?KEY:accountStorageKey('waiting');if(!key)return false;const target=storage??localStorage,raw=JSON.parse(target.getItem(key)??'[]'),list:WaitingRecord[]=Array.isArray(raw)?raw:[];
  // Explicit allowlist: never persist GPS coordinates, device IDs or history.
  const safe:WaitingRecord={id:record.id,routeId:record.routeId,routeName:record.routeName,startedAt:record.startedAt,endedAt:record.endedAt,observedSeconds:record.observedSeconds,source:record.source,status:record.status,confirmed:record.confirmed,reasons:record.reasons};
  target.setItem(key,JSON.stringify([...list.filter(item=>item.id!==record.id),safe].slice(-100)));return true;
 }catch{return false;}
}
export function readWaiting(storage?:StorageLike):WaitingRecord[]{try{const key=storage?KEY:accountStorageKey('waiting');if(!key)return [];const value=JSON.parse((storage??localStorage).getItem(key)??'[]');return Array.isArray(value)?value:[]}catch{return []}}
