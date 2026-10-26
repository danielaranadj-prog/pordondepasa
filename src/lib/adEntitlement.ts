/** Development/legacy opt-out only, NOT a purchased or verified entitlement. */
export function adsSuppressed(storage?:Pick<Storage,'getItem'>):boolean{try{return (storage??localStorage).getItem('isPremiumUser')==='true'}catch{return false}}
