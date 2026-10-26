/** One generation owns its requests and timeout. An expired worker rejects all
 * its requests immediately, and can never terminate its replacement. */
export interface WorkerTransport {
 postMessage(message:unknown):void;
 addEventListener(type:'message'|'error',listener:(event:any)=>void):void;
 removeEventListener(type:'message'|'error',listener:(event:any)=>void):void;
 terminate():void;
}
export function createRequestBroker(factory:()=>WorkerTransport,timeoutMs=20000){
 type Generation={worker:WorkerTransport;pending:Map<number,{channel:string;resolve:(data:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>;receive:(event:any)=>void;fail:()=>void};
 let generation:Generation|undefined,sequence=0;
 const dispose=(current:Generation,error:Error)=>{
  current.worker.removeEventListener('message',current.receive);current.worker.removeEventListener('error',current.fail);current.worker.terminate();
  for(const request of current.pending.values()){clearTimeout(request.timer);request.reject(error)}
  current.pending.clear();if(generation===current)generation=undefined;
 };
 function open():Generation{
  const worker=factory();
  const current:Generation={worker,pending:new Map(),receive:event=>{
   const request=current.pending.get(event.data?.id);if(!request)return;
   clearTimeout(request.timer);current.pending.delete(event.data.id);request.resolve(event.data);
  },fail:()=>dispose(current,new Error('No se pudo abrir el motor de rutas.'))};
  worker.addEventListener('message',current.receive);worker.addEventListener('error',current.fail);return current;
 }
 return {request(input:Record<string,unknown>):Promise<any>{
  const current=generation??=open(),id=++sequence;
  const channel=input.kind==='walk'?'walk':'plan';
  for(const [oldId,old]of current.pending)if(old.channel===channel){clearTimeout(old.timer);current.pending.delete(oldId);old.reject(new Error('Cálculo sustituido por una búsqueda más reciente.'));}
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>dispose(current,new Error('El cálculo tardó demasiado. Intenta otra vez.')),timeoutMs);
   current.pending.set(id,{channel,resolve,reject,timer});
   try{current.worker.postMessage({...input,id})}catch{dispose(current,new Error('No se pudo iniciar el cálculo.'))}
  });
 },cancel(){if(generation)dispose(generation,new Error('Cálculo cancelado.'))}};
}
