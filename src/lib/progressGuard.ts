import {meters,type Point} from './router.ts';
import {projectProgress} from './navigation.ts';

export type ProgressSample={point:Point;accuracy:number;time:number;along:number};

/** Nearby parallel passes can have very different positions along one route. */
export function ambiguousProjection(point:Point,line:Point[],accuracy:number,along:number,distance:number):boolean{
 let offset=0;
 for(let i=1;i<line.length;i++){
  const segment=projectProgress(point,[line[i-1],line[i]]);
  if(Math.abs(offset+segment.along-along)>35&&segment.distance<=distance+Math.max(5,Math.min(accuracy,15)))return true;
  offset+=meters(line[i-1],line[i]);
 }
 return false;
}

export function reliableProgressSample(point:Point,line:Point[],accuracy:number,time:number):ProgressSample|null{
 if(!Number.isFinite(time)||!Number.isFinite(accuracy)||accuracy<0||accuracy>40||line.length<2)return null;
 const progress=projectProgress(point,line);
 if(progress.distance>Math.max(25,accuracy)||ambiguousProjection(point,line,accuracy,progress.along,progress.distance))return null;
 return {point,accuracy,time,along:progress.along};
}

/** Require a second plausible GPS fix before trimming or showing a stop. */
export function confirmsProgress(previous:ProgressSample|undefined,current:ProgressSample,mode:'walk'|'bus'):boolean{
 if(!previous||current.time<=previous.time)return false;
 const elapsed=(current.time-previous.time)/1000;
 if(elapsed>15)return false;
 const maxAdvance=elapsed*(mode==='bus'?25:3)+previous.accuracy+current.accuracy+5;
 return Math.abs(current.along-previous.along)<=Math.max(8,maxAdvance);
}

export type ProgressState={along:number;accepted?:ProgressSample;pending?:ProgressSample};
/** Two consistent fixes may initialize anywhere on the current leg. This also
 * supports a passenger who confirms boarding after the vehicle has moved. */
export function updateProgress(state:ProgressState,sample:ProgressSample|null,mode:'walk'|'bus'):ProgressState{
 if(!sample)return {...state,pending:undefined};
 const next={...state,pending:sample};
 if(!confirmsProgress(state.pending,sample,mode)||sample.along<state.along)return next;
 if(!state.accepted&&state.pending&&mode==='bus'&&sample.along<state.pending.along-10)return next;
 if(state.accepted){
  const elapsed=(sample.time-state.accepted.time)/1000;
  const allowance=Math.max(50,elapsed*(mode==='bus'?25:3)+state.accepted.accuracy+sample.accuracy);
  if(elapsed<=0||sample.along-state.along>allowance)return next;
 }
 return {along:sample.along,accepted:sample,pending:sample};
}
