import type {Leg,Option,Point} from './router';
import {createRequestBroker} from './requestBroker';
export type RoutePlanIssue='origin_off_street'|'destination_off_street'|'dataset_changed';
export class RoutePlanError extends Error{
 constructor(message:string,public issue:RoutePlanIssue){super(message);this.name='RoutePlanError'}
}
const broker=createRequestBroker(()=>new Worker(new URL('./router.worker.ts',import.meta.url),{type:'module'}));
export function planRoutes(origin:Point,destination:Point):Promise<Option[]>{
 return requestWorker<Option[]>({origin,destination});
}
export function planWalkingLeg(origin:Point,destination:Point,heading?:number):Promise<Leg|null>{
 return requestWorker<Leg|null>({kind:'walk',origin,destination,heading});
}
async function requestWorker<T>(input:{kind?:'walk';origin:Point;destination:Point;heading?:number}):Promise<T>{
 const data=await broker.request(input);
 if(data.error)throw data.code?new RoutePlanError(data.error,data.code):new Error(data.error);
 return input.kind==='walk'?data.leg:data.options;
}
