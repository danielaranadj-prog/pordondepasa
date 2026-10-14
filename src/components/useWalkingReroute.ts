import {useEffect,useRef,useState} from 'react';
import type {Leg,Option} from '../lib/router';
import {meters} from '../lib/router';
import {projectProgress} from '../lib/navigation';
import type {JourneyFix} from '../lib/journeyStatus';
import {planWalkingLeg} from '../lib/workerClient';
import {canRequestWalkingReroute,preciseWalkFix,replaceWalkingLeg,walkingDeviation,type WalkAttempt,type WalkDeviation} from '../lib/walkingReroute';

type Status={step:number;kind:'pending'|'failed'|'updated';message:string};
export type UpdateWalkingLeg=(index:number,expected:Leg,next:Leg)=>void;
export function useWalkingReroute({option,step,history,arrived,confirmedAlong,onUpdate}:{option:Option;step:number;history:JourneyFix[];arrived:boolean;confirmedAlong?:number;onUpdate?:UpdateWalkingLeg}){
 const leg=option.legs[step];
 const [status,setStatus]=useState<Status>();
 const busy=useRef(false),sequence=useRef(0),attempt=useRef<WalkAttempt|undefined>(undefined);
 const current=useRef({option,step,history,arrived,confirmedAlong,onUpdate});current.current={option,step,history,arrived,confirmedAlong,onUpdate};
 useEffect(()=>()=>{sequence.current++;busy.current=false;},[]);
 // In-flight results must not survive boarding, arrival or another geometry.
 useEffect(()=>{sequence.current++;busy.current=false;setStatus(previous=>previous?.kind==='pending'?undefined:previous);},[leg,step,arrived]);
 useEffect(()=>{attempt.current=undefined;setStatus(undefined);},[step]);
 useEffect(()=>{if(status?.kind!=='updated')return;const timer=setTimeout(()=>setStatus(undefined),6000);return()=>clearTimeout(timer);},[status]);

 async function request(candidate:WalkDeviation){
  const context=current.current,target=context.option.legs[context.step];
  if(busy.current||context.arrived||target.kind!=='walk'||!context.onUpdate)return;
  const id=++sequence.current;busy.current=true;
  attempt.current={time:Date.now(),point:candidate.fix.point};
  setStatus({step:context.step,kind:'pending',message:'Ajustando caminata…'});
  try{
   const next=await planWalkingLeg(candidate.fix.point,target.to,candidate.heading);
   const latest=current.current;
   if(id!==sequence.current||latest.arrived||latest.step!==context.step||latest.option.legs[latest.step]!==target)return;
   const fix=latest.history.at(-1);
   if(!fix||!preciseWalkFix(fix,Date.now())){setStatus(undefined);return;}
   // The pedestrian may already have rejoined the old path while we searched.
   if(!walkingDeviation(latest.history,target.geometry??[target.from,target.to],Date.now(),latest.confirmedAlong)){
    setStatus(undefined);return;
   }
   if(!next||!replaceWalkingLeg(latest.option,latest.step,next))throw new Error('No connected walking path');
   // Discard a result whose starting street no longer represents the user.
   if(meters(fix.point,candidate.fix.point)>50||projectProgress(fix.point,next.geometry!).distance>Math.max(35,fix.accuracy*2)){
    setStatus(undefined);return;
   }
   setStatus({step:context.step,kind:'updated',message:'Caminata actualizada'});
   latest.onUpdate?.(latest.step,target,next);
  }catch{
   if(id!==sequence.current)return;
   if(attempt.current)attempt.current.failed=true;
   setStatus({step:context.step,kind:'failed',message:'No pudimos conectar otra caminata con las calles disponibles. Conservamos el recorrido anterior.'});
  }finally{if(id===sequence.current)busy.current=false;}
 }
 useEffect(()=>{
  if(arrived||leg.kind!=='walk'||!onUpdate)return;
  const candidate=walkingDeviation(history,leg.geometry??[leg.from,leg.to],Date.now(),confirmedAlong);
  if(candidate&&canRequestWalkingReroute(candidate,attempt.current,Date.now()))void request(candidate);
  else if(!candidate&&status?.kind==='failed'){
   const fix=history.at(-1),line=leg.geometry??[leg.from,leg.to];
   if(fix&&preciseWalkFix(fix,Date.now())&&projectProgress(fix.point,line).distance<=Math.max(35,fix.accuracy*2))setStatus(undefined);
  }
 },[history,leg,step,arrived,confirmedAlong,onUpdate]);
 function retry(){
  const latest=current.current,active=latest.option.legs[latest.step],fix=latest.history.at(-1);
  if(!fix||!preciseWalkFix(fix,Date.now()))return;
  const candidate=walkingDeviation(latest.history,active.geometry??[active.from,active.to],Date.now(),latest.confirmedAlong);
  if(candidate)void request(candidate);
 }
 return {status:status?.step===step&&!arrived&&leg.kind==='walk'?status:undefined,retry};
}
