import {boardingAlternative,ESTIMATED_WAIT_MINUTES,meters,type Leg,type Option,type Point} from './router.ts';
import {preciseWalkFix} from './walkingReroute.ts';
import {reliableProgressSample} from './progressGuard.ts';
import type {JourneyFix} from './journeyStatus.ts';
import type {WaitingRecord} from './waitingRecords.ts';

export function waitingCandidate(history:JourneyFix[],leg:Leg,now:number){
 const last=history.at(-1);if(!last||!preciseWalkFix(last,now)||last.accuracy>25)return;
 const recent:JourneyFix[]=[];
 for(let i=history.length-1;i>=0;i--){const fix=history[i],next=history[i+1];
  if(last.time-fix.time>20000||fix.accuracy>25||next&&(next.time<=fix.time||next.time-fix.time>15000)||meters(fix.point,last.point)>Math.max(18,fix.accuracy))break;
  recent.unshift(fix);
 }
 if(recent.length<3||last.time-recent[0].time<12000)return;
 const bus=boardingAlternative(leg,last.point);return bus?{point:last.point,bus}:undefined;
}
export function installBoarding(option:Option,index:number,expectedWalk:Leg,expectedBus:Leg,bus:Leg,point:Point):Option|null{
 if(option.legs[index]!==expectedWalk||option.legs[index+1]!==expectedBus||expectedWalk.kind!=='walk'||bus.kind!=='bus'||bus.route!==expectedBus.route||meters(bus.to,expectedBus.to)>.1)return null;
 const connection=meters(point,bus.from);if(connection>25)return null;
 const walk:Leg={kind:'walk',from:point,to:bus.from,geometry:[point,bus.from],meters:connection,minutes:0,instruction:'Espera en un punto permitido para abordar.'};
 const legs=option.legs.map((leg,i)=>i===index?walk:i===index+1?bus:leg);
 const walking=legs.filter(leg=>leg.kind==='walk').reduce((sum,leg)=>sum+leg.minutes,0),minutes=legs.reduce((sum,leg)=>sum+leg.minutes,0)+legs.filter(leg=>leg.kind==='bus').length*ESTIMATED_WAIT_MINUTES;
 return {...option,legs,walk:walking,minutes,score:minutes+walking*.15+option.transfers*2};
}
/** Compatible motion is not proof of the vehicle's identity. The UI requires
 * confirmed waiting, offers a cancellation countdown and keeps an undo. */
export function compatibleBoarding(history:JourneyFix[],leg:Leg,startedAt:number,now:number){
 if(leg.kind!=='bus'||!leg.geometry)return false;
 const last=history.at(-1);if(!last||!preciseWalkFix(last,now)||last.accuracy>25)return false;
 const fixes=history.filter(f=>f.time>=startedAt&&last.time-f.time<=30000);
 if(fixes.length<3||last.time-fixes[0].time<20000)return false;
 const samples=fixes.map(f=>f.accuracy<=25?reliableProgressSample(f.point,leg.geometry!,f.accuracy,f.time):null);
 if(samples.some(s=>!s))return false;
 for(let i=1;i<fixes.length;i++){
  const elapsed=(fixes[i].time-fixes[i-1].time)/1000,advance=samples[i]!.along-samples[i-1]!.along;
  if(elapsed>15||elapsed<=0||advance<-10||advance>elapsed*25+fixes[i].accuracy+fixes[i-1].accuracy+5)return false;
 }
 const travelled=samples.at(-1)!.along-samples[0]!.along,seconds=(last.time-fixes[0].time)/1000,speed=travelled/seconds;
 return travelled>=90&&speed>=3.8&&speed<=25;
}
/** The question is self-reporting, not a computed bus frequency. Infrequent
 * stationary GPS callbacks must not prevent it; require a fresh fix nearby. */
export function shouldAskWaiting(record:WaitingRecord,waitingAt:Point,fix:JourneyFix|undefined,now:number){
 const answer=record.reasons.at(-1)?.at??0;
 return record.status==='waiting'&&!record.endedAt&&now-record.startedAt>=300000&&now-answer>=300000&&!!fix&&preciseWalkFix(fix,now)&&fix.accuracy<=25&&meters(waitingAt,fix.point)<=35;
}
