/** Only remove events confirmed by the endpoint, not a whole batch on HTTP200. */
export function acknowledgedEventIds(body:unknown,submitted:readonly {id:string}[]):Set<string>{
 if(!body||typeof body!=='object')return new Set();
 const data=body as {acknowledged?:unknown;accepted?:unknown},sent=new Set(submitted.map(e=>e.id));
 if(Array.isArray(data.acknowledged))return new Set(data.acknowledged.filter((id):id is string=>typeof id==='string'&&sent.has(id)));
 // Backward-compatible only when the older endpoint confirms the whole batch.
 return data.accepted===submitted.length?sent:new Set();
}
