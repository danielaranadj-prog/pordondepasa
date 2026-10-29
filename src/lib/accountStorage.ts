// Private cloud places never enter browser storage. User-requested local GPS
// reports are isolated per verified account and removed on sign-out.
let owner:string|undefined;
export function setAccountStorageOwner(userId?:string){owner=userId}
export function accountStorageKey(kind:'waiting'|'route-reports'):string|null {
 return owner?`pordondepasa:account:${owner}:${kind}:v1`:null;
}
export function clearAccountLocalData(storage?:Pick<Storage,'removeItem'>){
 try{const target=storage??localStorage;for(const kind of ['waiting','route-reports'] as const){const key=accountStorageKey(kind);if(key)target.removeItem(key)}const waiting=accountStorageKey('waiting');if(waiting)target.removeItem(`${waiting}:consent`)}catch{/* Storage can be blocked. */}
}
