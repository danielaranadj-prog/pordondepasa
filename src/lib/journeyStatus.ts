import {meters,type Point} from './router.ts';
import {projectProgress} from './navigation.ts';

export type JourneyFix={point:Point;accuracy:number;time:number};
export function reliableJourneyFix(fix:JourneyFix,now:number){
 return Number.isFinite(fix.time)&&Number.isFinite(fix.accuracy)&&fix.accuracy>=0&&fix.accuracy<=40&&
  now-fix.time>=-1000&&now-fix.time<=15000;
}

/** Only a sequence of recent, precise readings can establish a deviation or a
 * stationary vehicle. A lost GPS signal is never evidence of traffic. */
export function journeyStatus(history:JourneyFix[],line:Point[],mode:'walk'|'bus',now:number){
 const last=history.at(-1);
 if(!last||!reliableJourneyFix(last,now))return {kind:'gps' as const};
 const tail:JourneyFix[]=[];
 for(let i=history.length-1;i>=0;i--){
  const fix=history[i];
  if(fix.accuracy>40||now-fix.time>90000||i<history.length-1&&history[i+1].time-fix.time>15000)break;
  tail.unshift(fix);
 }
 const off:JourneyFix[]=[];
 for(let i=tail.length-1;i>=0;i--){
  const fix=tail[i];
  if(projectProgress(fix.point,line).distance<=Math.max(100,fix.accuracy*2))break;
  off.unshift(fix);
 }
 if(off.length>=3&&last.time-off[0].time>=15000)return {kind:'off-route' as const};
 const recent=tail.filter(fix=>last.time-fix.time<=20000);
 if(mode==='bus'&&recent.length>=3&&last.time-recent[0].time>=15000){
  const first=projectProgress(recent[0].point,line),current=projectProgress(last.point,line);
  if(first.distance<=40&&current.distance<=40&&first.along-current.along>150)
   return {kind:'wrong-direction' as const};
 }
 if(mode==='bus'&&tail.length>=4&&last.time-tail[0].time>=60000&&
  tail.every(fix=>meters(fix.point,last.point)<=Math.max(20,fix.accuracy)))
  return {kind:'stopped' as const};
 return {kind:'tracking' as const};
}

export function alightingStage(mode:'walk'|'bus',trusted:boolean,remaining:number):0|1|2{
 if(mode!=='bus'||!trusted||!Number.isFinite(remaining)||remaining<0||remaining>500)return 0;
 return remaining<=150?2:1;
}
