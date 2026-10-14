import type {Leg,Option,Point} from './router';
export type RoutePlanIssue='origin_off_street'|'destination_off_street';
export class RoutePlanError extends Error{
 constructor(message:string,public issue:RoutePlanIssue){super(message);this.name='RoutePlanError'}
}
let worker:Worker|undefined,sequence=0;
export function planRoutes(origin:Point,destination:Point):Promise<Option[]>{
 return requestWorker<Option[]>({origin,destination});
}
export function planWalkingLeg(origin:Point,destination:Point,heading?:number):Promise<Leg|null>{
 return requestWorker<Leg|null>({kind:'walk',origin,destination,heading});
}
function requestWorker<T>(input:{kind?:'walk';origin:Point;destination:Point;heading?:number}):Promise<T>{
 worker??=new Worker(new URL('./router.worker.ts',import.meta.url),{type:'module'});
 const current=worker,id=++sequence;
 return new Promise((resolve,reject)=>{
  const cleanup=()=>{current.removeEventListener('message',receive);current.removeEventListener('error',fail);clearTimeout(timeout)};
  const receive=(event:MessageEvent)=>{if(event.data.id!==id)return;cleanup();if(event.data.error)reject(event.data.code?new RoutePlanError(event.data.error,event.data.code):new Error(event.data.error));else resolve(input.kind==='walk'?event.data.leg:event.data.options)};
  const fail=()=>{cleanup();current.terminate();worker=undefined;reject(new Error('No se pudo abrir el motor de rutas.'))};
  const timeout=setTimeout(fail,20000);
  current.addEventListener('message',receive);current.addEventListener('error',fail);current.postMessage({...input,id});
 });
}
