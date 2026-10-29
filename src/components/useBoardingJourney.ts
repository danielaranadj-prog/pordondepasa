import {useEffect,useMemo,useRef,useState} from 'react';
import {meters,type Leg,type Option,type Point} from '../lib/router';
import type {JourneyFix} from '../lib/journeyStatus';
import {preciseWalkFix} from '../lib/walkingReroute';
import {compatibleBoarding,waitingCandidate,shouldAskWaiting} from '../lib/boarding';
import {readWaiting,saveWaiting,type WaitingRecord,type WaitReason} from '../lib/waitingRecords';
import {localRecordKey,requestLocalRecordPreference} from '../lib/localRecords';
export type UpdatePickup=(index:number,walk:Leg,previous:Leg,bus:Leg,point:Point)=>void;
type Session={record:WaitingRecord;step:number;point:Point;automatic:boolean;lastFix?:JourneyFix};
export function useBoardingJourney({option,step,history,clock,arrived,onPickup,onAutoAdvance,onUndo}:{option:Option;step:number;history:JourneyFix[];clock:number;arrived:boolean;onPickup?:UpdatePickup;onAutoAdvance:()=>void;onUndo:(index:number)=>void}){
 const [session,setSession]=useState<Session>(),[detectAt,setDetectAt]=useState(0),[message,setMessage]=useState(''),[storageIssue,setStorageIssue]=useState(false);
 const storageKey=useRef(localRecordKey('waiting'));
 const ref=useRef<Session|undefined>(undefined);ref.current=session;
 const persistedAt=useRef(0),latest=useRef({option,step,history,clock,arrived,onPickup,onAutoAdvance,onUndo});latest.current={option,step,history,clock,arrived,onPickup,onAutoAdvance,onUndo};
 const waiting=!!session&&!session.record.endedAt&&session.step===step&&!arrived;
 const bus=option.legs[step+1],candidate=useMemo(()=>!arrived&&!waiting&&option.legs[step].kind==='walk'&&bus?.kind==='bus'?waitingCandidate(history,bus,clock):undefined,[history,bus,clock,arrived,waiting,step,option]);
 function change(next:Session){ref.current=next;setSession(next);}
 function persist(record:WaitingRecord){setStorageIssue(!saveWaiting(record,undefined,storageKey.current));}
 function confirmWaiting(){
  const current=latest.current,walk=current.option.legs[current.step],previous=current.option.legs[current.step+1];
  if(!previous||!current.onPickup)return;
  let proposal=waitingCandidate(current.history,previous,Date.now());
  if(!proposal){setMessage('Espera una ubicación reciente y precisa antes de ajustar el abordaje.');return;}
  requestLocalRecordPreference();
  proposal=waitingCandidate(latest.current.history,previous,Date.now());
  if(!proposal){setMessage('Esperando una ubicación reciente para confirmar el abordaje.');return;}
  const record:WaitingRecord={id:`wait-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,routeId:previous.route?.id??'',routeName:previous.route?.name??'Ruta',startedAt:Date.now(),observedSeconds:0,status:'waiting',reasons:[]};
  change({record,step:current.step,point:proposal.point,automatic:true,lastFix:current.history.at(-1)});
  persist(record);setMessage('');current.onPickup(current.step,walk,previous,proposal.bus,proposal.point);
 }
 function finish(source:'manual'|'motion'='manual'){
  const active=ref.current;if(!active||active.record.endedAt)return;
  const next={...active,record:{...active.record,endedAt:Date.now(),status:'boarded' as const,source,confirmed:source==='manual'}};
  change(next);persist(next.record);setDetectAt(0);
 }
 function cancel(){const active=ref.current;if(!active||active.record.endedAt)return;const next={...active,record:{...active.record,endedAt:Date.now(),status:'cancelled' as const}};change(next);persist(next.record);setDetectAt(0);}
 function reason(value:WaitReason){const active=ref.current;if(!active)return;const next={...active,record:{...active.record,reasons:[...active.record.reasons,{reason:value,at:Date.now()}]}};change(next);persist(next.record);}
 function undoMotion(){const active=ref.current;if(!active)return;const next={...active,automatic:false,lastFix:undefined,record:{...active.record,endedAt:undefined,status:'waiting' as const,source:undefined,confirmed:undefined}};change(next);persist(next.record);latest.current.onUndo(active.step);setDetectAt(0);}
 function confirmMotion(){const active=ref.current;if(!active)return;const next={...active,record:{...active.record,confirmed:true}};change(next);persist(next.record);}
 function toggleAutomatic(){const active=ref.current;if(active)change({...active,automatic:!active.automatic});setDetectAt(0);}
 useEffect(()=>{
  const active=ref.current,fix=history.at(-1);if(!active||active.record.endedAt||active.step!==step||!fix||!preciseWalkFix(fix,clock)||fix.accuracy>25||fix.time===(active.lastFix?.time??0))return;
  const previous=active.lastFix,seconds=previous?(fix.time-previous.time)/1000:0;
  const observed=seconds>0&&seconds<=15&&previous&&meters(previous.point,fix.point)<=25&&meters(active.point,fix.point)<=35?seconds:0;
  const next={...active,lastFix:fix,record:{...active.record,observedSeconds:active.record.observedSeconds+observed}};change(next);
  if(clock-persistedAt.current>=10000){persist(next.record);persistedAt.current=clock;}
 },[history,step,clock]);
 useEffect(()=>{
  const active=ref.current,currentBus=option.legs[step+1];
  if(!waiting||!active?.automatic||!currentBus||!compatibleBoarding(history,currentBus,active.record.startedAt,clock)){if(detectAt)setDetectAt(0);return;}
  if(!detectAt){setDetectAt(clock);return;}
  if(clock-detectAt>=10000){finish('motion');latest.current.onAutoAdvance();}
 },[clock,history,waiting,option,step,detectAt]);
 useEffect(()=>()=>{const active=ref.current;if(active&&!active.record.endedAt)saveWaiting({...active.record,endedAt:Date.now(),status:'cancelled'},undefined,storageKey.current);},[]);
 function exportWaiting(){const current=ref.current?.record,stored=readWaiting(undefined,storageKey.current),records=current?[...stored.filter(record=>record.id!==current.id),current]:stored;const url=URL.createObjectURL(new Blob([JSON.stringify({dataset:'waiting-observations',realTime:false,records},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='pordondepasa-esperas.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return {candidate,waiting,session,message,storageIssue,confirmWaiting,finish,cancel,reason,toggleAutomatic,undoMotion,confirmMotion,exportWaiting,
  elapsed:session?Math.max(0,Math.floor((clock-session.record.startedAt)/60000)):0,
  ask:waiting&&!!session&&shouldAskWaiting(session.record,session.point,history.at(-1),clock),
  countdown:waiting&&detectAt?Math.max(0,Math.ceil((10000-(clock-detectAt))/1000)):undefined,
  inferred:!!session&&step===session.step+1&&session.record.source==='motion'&&!session.record.confirmed};
}
