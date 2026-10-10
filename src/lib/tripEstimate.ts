import {ESTIMATED_WAIT_MINUTES,type Option} from './router.ts';

/** Waiting applies only to a bus that has not been boarded yet. */
export function remainingTripMinutes(option:Option,step:number,currentMeters:number):number {
 const leg=option.legs[step];
 if(!leg)return 0;
 const fraction=leg.meters?Math.min(1,Math.max(0,currentMeters/leg.meters)):1;
 const travel=leg.minutes*fraction+option.legs.slice(step+1).reduce((sum,next)=>sum+next.minutes,0);
 const futureRides=option.legs.slice(step+(leg.kind==='bus'?1:0)).filter(next=>next.kind==='bus').length;
 return Math.max(1,Math.ceil(travel+futureRides*ESTIMATED_WAIT_MINUTES));
}
