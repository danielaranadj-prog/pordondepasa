import {accountStorageKey} from './accountStorage.ts';

export type LocalRecordKind='waiting'|'route-reports';
export type LocalRecordStorage=Pick<Storage,'getItem'|'setItem'>&Partial<Pick<Storage,'removeItem'>>;
export const LOCAL_RECORD_RETENTION_MS=7*86400000;
const MAX_SERIALIZED_CHARACTERS=2_000_000;
type RecordValue={id:string;startedAt:number};
type Entry<T>={savedAt:number;record:T};

/** Guest records never reuse a signed-in owner's or the old global keys. */
export function localRecordKey(kind:LocalRecordKind){
 return accountStorageKey(kind)??`pordondepasa:guest:${kind}:v1`;
}
const consentKey=()=>`${localRecordKey('waiting')}:consent`;
const target=(storage?:LocalRecordStorage)=>storage??localStorage;

export function localRecordPreference(storage?:LocalRecordStorage):boolean|undefined{
 try{const value=target(storage).getItem(consentKey());return value==='true'?true:value==='false'?false:undefined}catch{return undefined}
}
/** Disabling also removes the current guest/account's records, not other users. */
export function setLocalRecordPreference(allowed:boolean,storage?:LocalRecordStorage):boolean{
 try{
  const store=target(storage);store.setItem(consentKey(),String(allowed));
  if(!allowed)for(const kind of ['waiting','route-reports'] as const){
   const key=localRecordKey(kind);if(store.removeItem)store.removeItem(key);else store.setItem(key,'');
  }
  return store.getItem(consentKey())===String(allowed);
 }catch{return false}
}
/** Ask only from an explicit record/wait action; background GPS never prompts. */
export function requestLocalRecordPreference():boolean{
 const preference=localRecordPreference();if(preference!==undefined)return preference;
 if(typeof window==='undefined')return false;
 try{
  const allowed=window.confirm('¿Guardar tus esperas y reportes en este dispositivo durante un máximo de 7 días? Los reportes incluyen el tramo GPS que decidas registrar. No se envían al administrador. Puedes desactivar y borrar este guardado en Ajustes.');
  return setLocalRecordPreference(allowed)&&allowed;
 }catch{return false}
}

function entries<T extends RecordValue>(kind:LocalRecordKind,store:LocalRecordStorage,now:number):Entry<T>[] {
 const raw=store.getItem(localRecordKey(kind));if(!raw||raw.length>MAX_SERIALIZED_CHARACTERS)return [];
 const parsed=JSON.parse(raw);
 // Only migrate the selected, scoped key; never read legacy global histories.
 const candidates=Array.isArray(parsed)?parsed.map(record=>({record,savedAt:record?.startedAt})):
  parsed?.version===1&&Array.isArray(parsed.entries)?parsed.entries:[];
 const valid=candidates.filter((entry:Entry<T>)=>entry&&Number.isFinite(entry.savedAt)&&entry.savedAt<=now&&now-entry.savedAt<LOCAL_RECORD_RETENTION_MS&&entry.record&&typeof entry.record.id==='string'&&Number.isFinite(entry.record.startedAt));
 if(valid.length!==candidates.length)store.setItem(localRecordKey(kind),JSON.stringify({version:1,entries:valid}));
 return valid;
}
export function readLocalRecords<T extends RecordValue>(kind:LocalRecordKind,storage?:LocalRecordStorage,now=Date.now()):T[]{
 try{if(localRecordPreference(storage)!==true)return [];return entries<T>(kind,target(storage),now).map(entry=>entry.record)}catch{return []}
}
export function saveLocalRecord<T extends RecordValue>(kind:LocalRecordKind,record:T,limit:number,storage?:LocalRecordStorage,now=Date.now(),expectedKey?:string):boolean{
 try{
  // A late GPS/unmount callback from a signed-out account must not write to guest/another account.
  if(expectedKey!==undefined&&localRecordKey(kind)!==expectedKey)return false;
  if(localRecordPreference(storage)!==true||!record||typeof record.id!=='string'||!Number.isFinite(record.startedAt))return false;
  const store=target(storage),previous=entries<T>(kind,store,now),savedAt=previous.find(entry=>entry.record.id===record.id)?.savedAt??now;
  const value=JSON.stringify({version:1,entries:[...previous.filter(entry=>entry.record.id!==record.id),{savedAt,record}].slice(-limit)});
  if(value.length>MAX_SERIALIZED_CHARACTERS)return false;
  store.setItem(localRecordKey(kind),value);return true;
 }catch{return false}
}
/** Expiration is applied on opening/reading, even if no new record is made. */
export function pruneLocalRecords(storage?:LocalRecordStorage,now=Date.now()){
 for(const kind of ['waiting','route-reports'] as const)readLocalRecords(kind,storage,now);
}
