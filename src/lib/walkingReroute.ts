import {ESTIMATED_WAIT_MINUTES,meters,type Leg,type Option,type Point} from './router.ts';
import {projectProgress} from './navigation.ts';
import {reliableJourneyFix,type JourneyFix} from './journeyStatus.ts';

export type WalkDeviation={fix:JourneyFix;heading?:number;reason:'off-path'|'backtracking'};
export type WalkAttempt={time:number;point:Point;failed?:boolean};
export const WALK_REROUTE_COOLDOWN=20000;
export function preciseWalkFix(fix:JourneyFix,now:number){
 return reliableJourneyFix(fix,now)&&fix.accuracy<=30&&Number.isFinite(fix.point.lat)&&Number.isFinite(fix.point.lng);
}

/** Three precise, plausible fixes spanning eight seconds, not one GPS jump.
 * Compass orientation is deliberately not evidence of the chosen street. */
export function walkingDeviation(history:JourneyFix[],line:Point[],now:number,confirmedAlong?:number):WalkDeviation|undefined{
 const last=history.at(-1);if(!last||!preciseWalkFix(last,now)||line.length<2)return;
 if(meters(last.point,line.at(-1)!)<=25)return;
 const tail:JourneyFix[]=[];
 for(let i=history.length-1;i>=0;i--){
  const fix=history[i],next=history[i+1];
  if(!preciseWalkFix(fix,last.time)||next&&(next.time<=fix.time||next.time-fix.time>15000||meters(fix.point,next.point)>(next.time-fix.time)/1000*3+fix.accuracy+next.accuracy+5))break;
  const p=projectProgress(fix.point,line),margin=Math.max(35,fix.accuracy*2);
  const away=p.distance>margin,back=confirmedAlong!==undefined&&confirmedAlong-p.along>margin;
  if(!away&&!back)break;
  tail.unshift(fix);
 }
 if(tail.length<3||last.time-tail[0].time<8000)return;
 // Use recent movement only when it exceeds the uncertainty of both fixes.
 const movement=tail.find(fix=>last.time-fix.time>=5000&&meters(fix.point,last.point)>=Math.max(15,fix.accuracy+last.accuracy));
 let heading:number|undefined;
 if(movement){const dx=(last.point.lng-movement.point.lng)*Math.cos(last.point.lat*Math.PI/180),dy=last.point.lat-movement.point.lat;heading=(Math.atan2(dx,dy)*180/Math.PI+360)%360;}
 return {fix:last,heading,reason:projectProgress(last.point,line).distance>Math.max(35,last.accuracy*2)?'off-path':'backtracking'};
}

export function canRequestWalkingReroute(candidate:WalkDeviation,attempt:WalkAttempt|undefined,now:number){
 if(!attempt)return true;
 if(now-attempt.time<WALK_REROUTE_COOLDOWN)return false;
 // After a failed connection, don't repeatedly search from the same position.
 return !attempt.failed||meters(candidate.fix.point,attempt.point)>=20;
}

/** This is the only permitted mutation of a followed journey. Bus leg objects,
 * stops, endpoints, fares, transfers and the option ID remain untouched. */
export function replaceWalkingLeg(option:Option,index:number,next:Leg):Option|null{
 const current=option.legs[index];
 if(!current||current.kind!=='walk'||next.kind!=='walk'||next.route||meters(current.to,next.to)>.5||
  !Number.isFinite(next.from.lat)||!Number.isFinite(next.from.lng)||!Number.isFinite(next.to.lat)||!Number.isFinite(next.to.lng)||
  !Number.isFinite(next.meters)||next.meters<0||next.meters>1800||!Number.isFinite(next.minutes)||next.minutes<0||
  !next.geometry||next.geometry.length<2||next.geometry.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng))||
  meters(next.from,next.geometry[0])>40||meters(current.to,next.geometry.at(-1)!)>40)return null;
 const legs=option.legs.map((leg,i)=>i===index?{...next,to:current.to}:leg);
 const walk=legs.filter(leg=>leg.kind==='walk').reduce((sum,leg)=>sum+leg.minutes,0);
 const minutes=legs.reduce((sum,leg)=>sum+leg.minutes,0)+legs.filter(leg=>leg.kind==='bus').length*ESTIMATED_WAIT_MINUTES;
 return {...option,legs,walk,minutes,score:minutes+walk*.15+option.transfers*2};
}
