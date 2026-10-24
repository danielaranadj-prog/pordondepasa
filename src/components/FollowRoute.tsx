import {useEffect,useMemo,useRef,useState} from 'react';
import type {Option,Point} from '../lib/router';
import type {Place} from '../lib/places';
import {meters,routeTextColor} from '../lib/router';
import {projectProgress,remainingGeometry,stopsForOption,type TransitStop} from '../lib/navigation';
import StreetMap from './StreetMap';
import MapIcon from './MapIcon';
import SheetHandle from './SheetHandle';
import type {SheetMode} from '../lib/sheetMode';
import {useCompass} from './useCompass';
import {movementHeading} from '../lib/heading';
import {nextManeuver} from '../lib/maneuver';
import {remainingTripMinutes} from '../lib/tripEstimate';
import {reliableProgressSample,updateProgress,type ProgressState} from '../lib/progressGuard';
import {alightingStage,journeyStatus,type JourneyFix} from '../lib/journeyStatus';
import {appendReportFix,saveRouteReport,routeReportGeoJSON,type RouteReport,type ReportReason} from '../lib/routeReport';
import {canShowAlightingAd,findMatchingLandmarkAd,isDeliverableAd,type AdCampaign} from '../lib/ads';
import {isPremiumUser,recordSponsoredTripEvent} from '../lib/sponsoredTrip';
import {useWalkingReroute,type UpdateWalkingLeg} from './useWalkingReroute';
import {walkingDeviation} from '../lib/walkingReroute';
import {stopTimeline} from '../lib/stopTimeline';
import {useBoardingJourney,type UpdatePickup} from './useBoardingJourney';
import '../styles/navigation.css';
import '../styles/route-tags.css';
import '../styles/navigation-refined.css';
import '../styles/dynamic-island.css';
import '../styles/sponsored-trip.css';
const distanceLabel=(n:number)=>n>=1000?`${(n/1000).toFixed(1)} km`:`${Math.round(n)} m`;
export default function FollowRoute({option,stops,ads,sponsoredTrip,origin,destination,originName,destinationName,placeAccess,place,compassStart,onExit,onReplan,onWalkReroute,onPickup,onAdDestinationChange,initialStep=0,initialArrived=false,onProgress}:{option:Option;stops:TransitStop[];ads?:AdCampaign[];sponsoredTrip?:AdCampaign;origin:Point;destination:Point;originName?:string;destinationName:string;placeAccess?:{meters:number;entrance:string};place?:Place;compassStart:{enabled:boolean;issue:string};onExit:()=>void;onReplan?:(point:Point)=>void;onWalkReroute?:UpdateWalkingLeg;onPickup?:UpdatePickup;onAdDestinationChange?:(point:Point,name:string,from:Point)=>void;initialStep?:number;initialArrived?:boolean;onProgress?:(step:number,arrived:boolean)=>void}){
 const [step,setStep]=useState(initialStep),[live,setLive]=useState<Point>(),[accuracy,setAccuracy]=useState<number>(),[locationIssue,setLocationIssue]=useState(''),[follow,setFollow]=useState(true),[arrived,setArrived]=useState(initialArrived),[sheetMode,setSheetMode]=useState<SheetMode>('closed');
 const showStops=sheetMode!=='closed',setShowStops=(show:boolean)=>setSheetMode(show?'open':'closed');
 const [dismissedAdStep,setDismissedAdStep]=useState<number|null>(null);
 const [showPassed,setShowPassed]=useState(false),[timelineFollow,setTimelineFollow]=useState(true);
 const timelineList=useRef<HTMLDivElement>(null);
 const [history,setHistory]=useState<JourneyFix[]>([]),[voice,setVoice]=useState(false),[alightingNotice,setAlightingNotice]=useState('');
 const [reportOpen,setReportOpen]=useState(false),[report,setReport]=useState<RouteReport>(),[reportMessage,setReportMessage]=useState('');
 const reportRef=useRef<RouteReport|undefined>(undefined);reportRef.current=report;
 const rejoinedAt=useRef(0),alightingAlerts=useRef(new Map<number,number>()),stoppedDismissed=useRef(new Set<number>());
 const compass=useCompass(!arrived,compassStart);
 const [course,setCourse]=useState<number>(),[northUp,setNorthUp]=useState(false);
 const previous=useRef<{point:Point;accuracy:number}|undefined>(undefined);
 const lastFix=useRef<{point:Point;accuracy:number;time:number}|undefined>(undefined);
 const [clock,setClock]=useState(Date.now()),[fixAt,setFixAt]=useState(0),[courseAt,setCourseAt]=useState(0);
 const stale=!!live&&clock-fixAt>15000;
 const routeStops=useMemo(()=>stopsForOption(option,stops),[option,stops]);
 const leg=option.legs[step],line=leg.geometry??[leg.from,leg.to];
 const freshCourse=clock-courseAt<10000?course:undefined;
 const heading=northUp?0:leg.kind==='bus'?freshCourse??compass.heading:compass.heading??freshCourse;
 const progress=useMemo(()=>live?projectProgress(live,line):undefined,[live,line]);
 const confident=!!live&&!stale&&accuracy!==undefined&&accuracy<=60;
 const [accepted,setAccepted]=useState({step:initialStep,leg,along:0});
 const [painted,setPainted]=useState({step:initialStep,leg,along:0});
 const trackingProgress=useRef<ProgressState>({along:0});
 const sample=useMemo(()=>live&&!stale&&accuracy!==undefined?reliableProgressSample(live,line,accuracy,fixAt):null,[live,line,stale,accuracy,fixAt]);
 const health=useMemo(()=>journeyStatus(history,line,leg.kind,clock),[history,line,leg.kind,clock]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Stop scheduling once the painted line catches up; stationary trips do no work.
  let value=painted.step===accepted.step&&painted.leg===accepted.leg?painted.along:0;
  function tick(){const gap=accepted.along-value;value=reduced||Math.abs(gap)<=.2?accepted.along:value+gap*.35;setPainted({...accepted,along:value});if(value!==accepted.along)timer=setTimeout(tick,80)}
  tick();return()=>clearTimeout(timer);
 },[accepted]);
 const acceptedAt=useRef(0);
 // Never trim from a lone fix or a projection that could belong to a nearby return pass.
 useEffect(()=>{
  if(accepted.step!==step||accepted.leg!==leg){setAccepted({step,leg,along:0});acceptedAt.current=0;trackingProgress.current={along:0};return;}
  if(arrived)return;
  const next=updateProgress(trackingProgress.current,sample,leg.kind);
  trackingProgress.current=next;
  if(next.accepted){acceptedAt.current=next.accepted.time;setAccepted({step,leg,along:next.along});}
 },[sample,step,arrived,accepted.step,accepted.leg,leg]);
 const displayedOption=useMemo(()=>({...option,legs:option.legs.map((item,index)=>({
  ...item,geometry:arrived||index<step?[]:index===step?remainingGeometry(item.geometry??[item.from,item.to],painted.step===step&&painted.leg===leg?painted.along:0):item.geometry
 }))}),[option,step,painted,arrived]);
 const trusted=!!sample&&confident&&accepted.step===step&&accepted.leg===leg&&acceptedAt.current>0&&clock-acceptedAt.current<=15000;
 const hasProgress=accepted.step===step&&accepted.leg===leg&&acceptedAt.current>0;
 const boarding=useBoardingJourney({option,step,history,clock,arrived,onPickup,onAutoAdvance:()=>advance('motion'),onUndo:index=>{setStep(index);onProgress?.(index,false)}});
 const walkReroute=useWalkingReroute({option,step,history,arrived:arrived||boarding.waiting||!!boarding.candidate,confirmedAlong:hasProgress?accepted.along:undefined,onUpdate:onWalkReroute});
 const remaining=boarding.waiting?0:hasProgress&&progress?Math.max(0,progress.length-accepted.along):leg.meters;
 const stage=alightingStage(leg.kind,trusted,remaining);
 const nearAlighting=stage>0;
 const nearAlightingAd=!!progress&&canShowAlightingAd(leg.kind,trusted,accepted.along,progress.length,remaining);
 const adMinute=Math.floor(clock/60000);
 const activeLandmarkAd=useMemo(()=>nearAlightingAd&&leg.kind==='bus'&&dismissedAdStep!==step?findMatchingLandmarkAd(leg.to,ads,leg.route?.id,new Date(adMinute*60000)):undefined,[nearAlightingAd,leg,ads,dismissedAdStep,step,adMinute]);
 const currentStops=routeStops.filter(s=>s.legIndex===step);
 const timeline=useMemo(()=>stopTimeline(routeStops,step,accepted.along,hasProgress),[routeStops,step,accepted.along,hasProgress]);
 const nextStop=trusted?timeline.next:undefined;
 useEffect(()=>{if(showStops&&timelineFollow&&!showPassed)timelineList.current?.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[nextStop?.id,showStops,timelineFollow,showPassed]);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{
  if(arrived)return;
  if(!navigator.geolocation){setLocationIssue('Tu ubicación no está disponible. Sigue los pasos en el mapa.');return;}
  const id=navigator.geolocation.watchPosition(p=>{const point={lat:p.coords.latitude,lng:p.coords.longitude};
   if(Date.now()-p.timestamp>15000){setLocationIssue('Esperando una ubicación reciente…');return;}
   if(p.coords.accuracy>60){setLocationIssue('Ubicación aproximada. Esperando una lectura más precisa.');return;}
   const last=lastFix.current;
   if(last&&p.timestamp<=last.time)return;
   if(last&&meters(last.point,point)>Math.max(80,(p.timestamp-last.time)/1000*45+last.accuracy+p.coords.accuracy)){setLocationIssue('Comprobando tu ubicación…');return;}
   lastFix.current={point,accuracy:p.coords.accuracy,time:p.timestamp};
   if(p.coords.accuracy<=35){
    if(p.coords.heading!==null&&Number.isFinite(p.coords.heading)&&p.coords.speed!==null&&p.coords.speed>.8){setCourse(p.coords.heading);setCourseAt(Date.now());}
    else if(previous.current&&previous.current.accuracy<=35&&meters(previous.current.point,point)>=Math.max(12,p.coords.accuracy,previous.current.accuracy)){setCourse(movementHeading(previous.current.point,point));setCourseAt(Date.now());previous.current={point,accuracy:p.coords.accuracy};}
    if(!previous.current)previous.current={point,accuracy:p.coords.accuracy};
   }
   setLive(point);setFixAt(p.timestamp);setAccuracy(p.coords.accuracy);setLocationIssue(p.coords.accuracy>40?'Ubicación aproximada; comprobando el avance.':'');
   setHistory(previous=>[...previous.filter(fix=>p.timestamp-fix.time<90000),{point,accuracy:p.coords.accuracy,time:p.timestamp}].slice(-120));
  },error=>setLocationIssue(error.code===1?'Permite tu ubicación para seguir tu avance. Puedes continuar con los pasos.':'No pudimos actualizar tu ubicación. Sigue los pasos en el mapa.'),{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  return()=>navigator.geolocation.clearWatch(id);
 },[arrived]);
 function advance(source:'manual'|'motion'='manual'){boarding.finish(source);if(step<option.legs.length-1){setStep(step+1);onProgress?.(step+1,false)}else{setArrived(true);onProgress?.(step,true)}}
 const title=arrived?'Viaje finalizado':boarding.waiting?`Espera ${option.legs[step+1]?.route?.name??'tu ruta'}`:boarding.candidate?'Estás junto a tu ruta':leg.kind==='bus'?(nearAlighting?(stage===2?'Solicita tu bajada':'Anticipa tu bajada'):`Viaja en ${leg.route?.name}`):step===option.legs.length-1?(placeAccess?'Camina al acceso del destino':'Camina a tu destino'):step===0?'Camina al punto de abordaje':'Camina al siguiente abordaje';
 const maneuver=leg.kind==='walk'&&trusted?nextManeuver(line,accepted.along):undefined;
 const totalMeters=remaining+option.legs.slice(step+1).reduce((sum,l)=>sum+l.meters,0);
 const totalMinutes=remainingTripMinutes(option,step,remaining);
 const offRoute=!boarding.waiting&&!boarding.candidate&&(health.kind==='off-route'||health.kind==='wrong-direction'||leg.kind==='walk'&&!!walkingDeviation(history,line,clock,hasProgress?accepted.along:undefined));
 const proximityTarget=leg.kind==='walk'?leg.to:destination;
 const proximityLabel=leg.kind==='walk'&&step<option.legs.length-1?'al abordaje':'al destino';
 const proximity=live&&!stale&&accuracy!==undefined&&accuracy<=40?meters(live,proximityTarget):undefined;
 const metricsMeters=offRoute&&proximity!==undefined?proximity:totalMeters;
 const metricsTime=boarding.waiting?`${boarding.elapsed} min espera`:offRoute?'—':`${trusted?'':'~'}${totalMinutes} min`;
 const action=arrived?'Finalizar viaje':step===option.legs.length-1?'Ya llegué':leg.kind==='bus'?'Ya bajé de la unidad':option.legs[step+1]?.kind==='bus'?'Ya abordé la unidad':'Continuar';
 const currentBusRoute=leg.kind==='bus'?leg.route:undefined;
 const nextBusRoute=option.legs[step+1]?.kind==='bus'?option.legs[step+1]?.route:undefined;
 const showTripSponsor=!arrived && !isPremiumUser() && leg.kind==='bus' && !!sponsoredTrip?.sponsoredTrip &&
  isDeliverableAd(sponsoredTrip,new Date(clock),[leg.route?.id??'']);
 function speak(text:string){
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='es-MX';window.speechSynthesis.speak(utterance);
 }
 useEffect(()=>{
  if(arrived||stage===0||stage<=(alightingAlerts.current.get(step)??0))return;
  alightingAlerts.current.set(step,stage);
  const text=stage===2?'Solicita tu bajada al chofer. Estás cerca del punto marcado.':'Tu bajada está a menos de 500 metros. Avísale al chofer con anticipación.';
  setAlightingNotice(text);
  navigator.vibrate?.([150,80,150]);
  if(voice)speak(text);
 },[stage,step,arrived,voice]);
 useEffect(()=>{setHistory([]);setAlightingNotice('');setReportOpen(false);setShowPassed(false);setTimelineFollow(true);rejoinedAt.current=0;},[step]);
 useEffect(()=>()=>{if('speechSynthesis' in window)window.speechSynthesis.cancel();const active=reportRef.current;if(active&&!active.endedAt)saveRouteReport({...active,endedAt:Date.now()});},[]);
 function finishReport(){
  const active=reportRef.current;if(!active||active.endedAt)return;
  const finished={...active,endedAt:Date.now()};reportRef.current=finished;setReport(finished);
  setReportMessage(saveRouteReport(finished)?'Reporte guardado en este teléfono. Puedes exportarlo para revisión.':'No se pudo guardar. Exporta el reporte para conservarlo.');
 }
 useEffect(()=>{
  const active=reportRef.current,fix=lastFix.current;if(!active||active.endedAt||!fix)return;
  const next=appendReportFix(active,fix,clock);
  if(next!==active){reportRef.current=next;setReport(next);saveRouteReport(next);}
 },[fixAt]);
 useEffect(()=>{
  const active=reportRef.current;if(!active||active.endedAt||clock-active.startedAt<30000)return;
  if(health.kind==='tracking'){rejoinedAt.current||=clock;if(clock-rejoinedAt.current>=15000)finishReport();}
  else rejoinedAt.current=0;
 },[clock,health.kind]);
 function startReport(reason:ReportReason){
  const fix=lastFix.current;if(!fix||clock-fix.time>15000||fix.accuracy>40)return;
  const kind=health.kind==='stopped'?'stop':'deviation';
  let next:RouteReport={id:`report-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,routeId:leg.route?.id??'',routeName:leg.route?.name??'A pie',kind,reason,startedAt:Date.now(),fixes:[]};
  next=appendReportFix(next,fix,clock);
  if(kind==='stop'){next.endedAt=Date.now();stoppedDismissed.current.add(step);}
  reportRef.current=next;setReport(next);setReportOpen(false);rejoinedAt.current=0;
  const saved=saveRouteReport(next);
  setReportMessage(kind==='stop'?(saved?'Reporte guardado en este teléfono.':'Exporta el reporte para conservarlo.'):'Registrando este tramo. Se guardará al volver al recorrido o al tocar Terminar.');
 }
 function exportReport(){
  const active=reportRef.current;if(!active)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(routeReportGeoJSON(active),null,2)],{type:'application/geo+json'}));
  const link=document.createElement('a');link.href=url;link.download=`pordondepasa-${active.id}.geojson`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function replan(){if(live&&confident&&onReplan){finishReport();onReplan(live);}}
 function formatNavInstruction():string{
  if(arrived)return destinationName?`Llegaste a ${destinationName}.`:'Has llegado a tu destino.';
  if(leg.kind==='bus'){
   if(nearAlighting){
    return 'Prepárate para bajar en el punto marcado en el mapa. Solicita tu bajada con anticipación.';
   }
   if(nextStop)return `Siguiente referencia: ${nextStop.name}. Bajada marcada en el mapa.`;
   return `Viaja en ${leg.route?.name??'la unidad'}. La bajada está marcada en el mapa.`;
  }
  let streetNames=leg.streetNames;
  if((!streetNames||streetNames.length===0)&&leg.instruction&&leg.instruction.startsWith('Camina por ')){
   const seg=leg.instruction.replace(/^Camina por /,'').split('.')[0];
   streetNames=seg.split(' → ').map(s=>s.trim()).filter(Boolean);
  }
  let walkStreet='';
  if(streetNames&&streetNames.length>0){
   walkStreet=streetNames.length===1?streetNames[0]:`${streetNames[0]} y ${streetNames[1]}`;
  }
  let walkPhrase='';
  if(walkStreet){
   walkPhrase=`Camina por ${walkStreet}`;
  }else if(originName&&!originName.toLowerCase().includes('mi ubicación')){
   walkPhrase=`Camina desde ${originName}`;
  }else{
   walkPhrase='Camina por la calle';
  }
  const nextLeg=option.legs[step+1];
  let targetPlace='';
  if(nextLeg&&nextLeg.kind==='bus'){
   const rawRouteName=nextLeg.route?.name??'la ruta';
   const routeLabel=/^(ruta\b|camión\b)/i.test(rawRouteName)?rawRouteName:`la Ruta ${rawRouteName}`;
   const legStops=routeStops.filter(s=>s.legIndex===step+1);
   let targetStop=legStops.sort((a,b)=>meters(a.coordinates,leg.to)-meters(b.coordinates,leg.to))[0];
   if(!targetStop||meters(targetStop.coordinates,leg.to)>80){
    const anyStop=stops.filter(s=>meters(s.coordinates,leg.to)<=80).sort((a,b)=>meters(a.coordinates,leg.to)-meters(b.coordinates,leg.to))[0];
    if(anyStop)targetStop=anyStop as typeof routeStops[0];
   }
   if(targetStop&&meters(targetStop.coordinates,leg.to)<=80){
    targetPlace=`${targetStop.name} donde pasa ${routeLabel}`;
   }else if(streetNames&&streetNames.length>1){
    const arrivalStreet=streetNames[streetNames.length-1];
    targetPlace=`${arrivalStreet} donde pasa ${routeLabel}`;
   }else{
    targetPlace=`donde pasa ${routeLabel}`;
   }
  }else if(step===option.legs.length-1||!nextLeg){
   targetPlace=destinationName||'tu destino';
  }else{
   targetPlace='el punto de conexión';
  }
  return `${walkPhrase} hasta llegar a ${targetPlace}`;
 }
 const instructionText=formatNavInstruction();
 const streetSubtitle=useMemo(()=>{
  if(arrived)return destinationName?`Llegaste a ${destinationName}`:'Has llegado a tu destino';
  if(boarding.waiting)return 'Busca una parada o cartel y verifica el sentido.';
  if(leg.kind==='bus'){
   if(nearAlighting){
    return `Faltan ${distanceLabel(remaining)}. Avísale al chofer dónde bajar.`;
   }
   if(nextStop)return `Próxima referencia: ${nextStop.name}`;
   return destinationName?`Hacia ${destinationName}`:`Viaja en ${leg.route?.name??'la unidad'}`;
  }
  let street='';
  if(leg.streetNames&&leg.streetNames.length>0){
   street=leg.streetNames.length===1?leg.streetNames[0]:`${leg.streetNames[0]} y ${leg.streetNames[1]}`;
  }else if(leg.instruction&&leg.instruction.startsWith('Camina por ')){
   street=leg.instruction.replace(/^Camina por /,'').split('.')[0];
  }else if(originName&&!originName.toLowerCase().includes('mi ubicación')){
   street=originName;
  }
  return street||'Sigue la ruta en el mapa';
 },[arrived,leg,nearAlighting,nextStop,destinationName,originName,remaining,boarding.waiting]);
 const routeForDock=currentBusRoute??nextBusRoute;
 const dockRouteLabel=routeForDock?(routeForDock.name.replace(/^(ruta|camión)\s*[:.-]?\s*/i,'').trim()||routeForDock.name):'A pie';
 const displayStops=useMemo(()=>{
  const target=leg.kind==='bus'?step:option.legs.findIndex((item,index)=>index>step&&item.kind==='bus');
  const relevant=routeStops.filter(stop=>stop.legIndex===target);
  if(relevant.length>0)return leg.kind==='bus'&&hasProgress&&!showPassed?relevant.filter(stop=>stop.along>=accepted.along-25):relevant;
  const synthetic:Array<{id:string;name:string;coordinates:Point;legIndex:number;color?:string}>=[];
  option.legs.forEach((l,idx)=>{
   if(l.kind==='bus'&&idx===target){
    synthetic.push({id:`board-${idx}`,name:`Abordaje: ${l.route?.name??'Ruta'}`,coordinates:l.from,legIndex:idx,color:l.route?.color});
    synthetic.push({id:`alight-${idx}`,name:`Bajada de ${l.route?.name??'Ruta'}`,coordinates:l.to,legIndex:idx,color:l.route?.color});
   }
  });
  return synthetic;
 },[routeStops,option,step,leg.kind,hasProgress,showPassed,accepted.along]);
 const alightingStop=currentStops.filter(stop=>meters(stop.coordinates,leg.to)<=80).sort((a,b)=>meters(a.coordinates,leg.to)-meters(b.coordinates,leg.to))[0];
 const hasNextBus=option.legs.slice(step+1).some(item=>item.kind==='bus');
 const endpointLabel=leg.kind==='bus'?(alightingStop?`Baja cerca de ${alightingStop.name}`:hasNextBus?'Baja para el trasbordo':`Baja cerca de ${destinationName||'tu destino'}`):step===option.legs.length-1?`Llegada a ${destinationName||'tu destino'}`:'Punto de abordaje';
 return <main className="trip-screen navigation-screen" data-screen={arrived?'viaje-finalizado':boarding.waiting?'espera-de-ruta':leg.kind==='bus'?'viaje-en-camion':step===0?'caminata-al-abordaje':step===option.legs.length-1?'caminata-final':'caminata-de-transbordo'}>
  <StreetMap fullscreen ads={ads} origin={origin} destination={destination} access={placeAccess?option.legs.at(-1)?.to:undefined} place={place} option={boarding.waiting?{...displayedOption,legs:displayedOption.legs.map((item,index)=>index===step?{...item,geometry:[]}:item)}:displayedOption} adOption={option} stops={routeStops} activeStop={leg.kind==='bus'?nextStop:undefined} live={live} follow={follow&&!arrived} navigation heading={heading} activeLeg={step} accuracy={accuracy} stale={stale} remaining={remaining} onPan={()=>setFollow(false)} onAdDestinationChange={(point,name)=>{if(!onAdDestinationChange)return;if(!window.confirm(`¿Crear un viaje nuevo hacia ${name}? Esto terminará el seguimiento actual.`))return;onAdDestinationChange(point,name,confident&&live?live:origin)}}/>
  <section className="nav-top-card" role="region" aria-label="Indicaciones de viaje">
   <div className="nav-top-icon-circle" style={leg.kind==='bus'&&leg.route?{backgroundColor:leg.route.color,color:routeTextColor(leg.route.color)}:arrived?{backgroundColor:'#10b981',color:'#fff'}:undefined} aria-hidden="true">
    {arrived?'✓':leg.kind==='bus'?'🚌':(maneuver?.icon??'🚶')}
   </div>
   <div className="nav-top-content">
    <div className="nav-top-meta-line">
     <span className="nav-top-dist">{arrived?'FINALIZADO':boarding.waiting?'EN ESPERA':offRoute&&proximity!==undefined?`${distanceLabel(proximity)} ${proximityLabel}`:`${trusted?'':'~'}${distanceLabel(maneuver?.distance??remaining)}`}</span>
     <span className="nav-top-dot">·</span>
     <span className="nav-top-step">Paso {step+1} de {option.legs.length}</span>
    </div>
    <h1 className="nav-top-title">{walkReroute.status?.kind==='pending'?'Ajustando caminata':offRoute?'Recorrido diferente':title}</h1>
    <p className="nav-top-subtitle" title={instructionText}>{walkReroute.status?.kind==='pending'?'Conservamos tu punto de llegada.':offRoute?'Tu ubicación se alejó del recorrido seleccionado.':streetSubtitle}</p>
    {activeLandmarkAd && <div className="nav-landmark-chip" role="note" aria-label="Sugerencia patrocinada cerca de tu bajada">
     <span className="nav-landmark-label">Patrocinado</span>
     <span className="nav-landmark-name">{activeLandmarkAd.icon} {activeLandmarkAd.title}</span>
     <span className="nav-landmark-distance">{distanceLabel(meters(leg.to,activeLandmarkAd.coordinates!))} de bajada</span>
     {activeLandmarkAd.promoText&&<span className="nav-landmark-promo">{activeLandmarkAd.promoText}</span>}
     <button type="button" onClick={()=>setDismissedAdStep(step)} aria-label={`Ocultar anuncio de ${activeLandmarkAd.title}`}>×</button>
    </div>}
   </div>
   <button className="nav-top-back" onClick={onExit} aria-label="Salir del seguimiento" title="Salir">✕</button>
  </section>
  {!arrived&&<div className="navigation-tools apple-map-controls"><button onClick={()=>{setNorthUp(false);void compass.enable()}} aria-label={compass.enabled?'Desactivar brújula':'Activar brújula'} title={compass.enabled?'Desactivar brújula':'Activar brújula'} aria-pressed={compass.enabled}><MapIcon kind="compass"/></button><button onClick={()=>setNorthUp(!northUp)} aria-label={northUp?'Orientar al avanzar':'Norte arriba'} title={northUp?'Orientar al avanzar':'Norte arriba'} aria-pressed={northUp}><MapIcon kind="north"/></button><button onClick={()=>setFollow(true)} disabled={!live} aria-label={!live?'Esperando ubicación':'Centrar en mí'} title={!live?'Esperando ubicación':'Centrar en mí'} aria-pressed={follow}><MapIcon kind="location"/></button></div>}
  <footer className={`nav-bottom-sheet map-sheet sheet-${sheetMode} ${showStops?'is-expanded':''}`} role="region" aria-label="Control del viaje">
   {!arrived&&<SheetHandle mode={sheetMode} onChange={setSheetMode} label={sheetMode==='closed'?'Ver paradas y referencias':sheetMode==='open'?'Próximas referencias':'Paradas y referencias'}/>}
   {showTripSponsor && <div className="nav-trip-sponsor" role="note" aria-label="Patrocinador del viaje">
    <span className="nav-trip-sponsor-copy"><small>Publicidad · Patrocinador del viaje</small><strong>{sponsoredTrip!.icon} {sponsoredTrip!.title}</strong><span>{sponsoredTrip!.sponsoredTrip!.promoOffer}</span></span>
    <a href={sponsoredTrip!.sponsoredTrip!.ctaUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={()=>recordSponsoredTripEvent(sponsoredTrip!.id,'sponsored_trip_cta_clicks')}>Canjear</a>
   </div>}
   <div className="nav-single-row">
    <button
     type="button"
     className="nav-btn-route"
     style={routeForDock?{backgroundColor:routeForDock.color,color:routeTextColor(routeForDock.color)}:undefined}
     onClick={()=>setShowStops(!showStops)}
     aria-label={`Ruta ${dockRouteLabel}`}
     title={dockRouteLabel}
    >
     <span className="nav-btn-route-label">{dockRouteLabel}</span>
    </button>
    <button
     type="button"
     className="nav-btn-action"
     onClick={arrived?onExit:()=>advance()}
     aria-label={action}
    >
     <span className="nav-btn-action-text">{arrived?'Finalizar':leg.kind==='bus'?'Ya bajé':step===option.legs.length-1?'Ya llegué':nextBusRoute?'Ya abordé':'Continuar'}</span>
     <span className="nav-btn-action-arrow" aria-hidden="true">{arrived?'✓':'→'}</span>
    </button>
    <button
     type="button"
     className="nav-btn-metrics"
     onClick={()=>setShowStops(!showStops)}
     aria-expanded={showStops}
     aria-label={`${arrived?'Destino alcanzado':`${offRoute?'Distancia en línea recta':'Viaje restante'}: ${metricsTime}, ${distanceLabel(metricsMeters)}${offRoute?` ${proximityLabel}`:''}`}. Toca para ver paradas.`}
    >
     <div className="nav-btn-metrics-stack">
      {!arrived&&<small className="nav-metrics-label">{offRoute?'Línea recta':'Viaje restante'}</small>}
      <strong className="nav-btn-metrics-time">{arrived?'✓':metricsTime}</strong>
      <span className="nav-btn-metrics-dist">{arrived?'Destino':`${offRoute||!trusted?'~':''}${distanceLabel(metricsMeters)}`}</span>
     </div>
    </button>
   </div>
   {alightingNotice&&nearAlighting&&!arrived&&<p className="nav-alighting-notice" role="alert">{alightingNotice}</p>}
   {boarding.candidate&&onPickup&&!arrived&&<div className="nav-journey-warning" role="status"><strong>Estás junto al recorrido</strong><p>¿Ya estás esperando aquí? Confirma el sentido y busca una parada señalada o un lugar donde se permita abordar.</p><button type="button" onClick={boarding.confirmWaiting}>Esperar aquí</button></div>}
   {boarding.waiting&&<div className="nav-waiting-info"><span>Esperando {nextBusRoute?.name}. Busca cartel o parada; las referencias habituales no garantizan que se permita subir.</span><label><input type="checkbox" checked={boarding.session?.automatic??false} onChange={boarding.toggleAutomatic}/> Detección asistida de abordaje</label><small>{boarding.storageIssue?'No se pudo guardar la espera en este dispositivo.':'Tiempo observado guardado solo en este dispositivo.'}</small><button type="button" onClick={boarding.cancel}>Dejar de esperar</button></div>}
   {boarding.countdown!==undefined&&<div className="nav-journey-warning" role="status"><strong>Parece que ya abordaste</strong><p>El movimiento coincide con el recorrido. Cambiaremos a viaje en {boarding.countdown} s; confirma que es {nextBusRoute?.name}.</p><button type="button" onClick={boarding.toggleAutomatic}>No, sigo esperando</button></div>}
   {boarding.inferred&&<div className="nav-journey-warning" role="status"><strong>Abordaje detectado por movimiento</strong><p>El GPS no identifica la unidad. ¿Vas en {leg.route?.name}?</p><div><button type="button" onClick={boarding.confirmMotion}>Sí, voy en esta ruta</button><button type="button" onClick={boarding.undoMotion}>Sigo esperando</button></div></div>}
   {boarding.ask&&<div className="nav-journey-warning" role="status"><strong>¿Sigues esperando tu ruta?</strong><p>Han pasado {boarding.elapsed} min desde tu confirmación. No son frecuencias en tiempo real.</p><div>{([['still-waiting','Sigo esperando'],['not-arrived','No ha pasado'],['full','Iba llena'],['missed','Se me pasó'],['declined','No la tomé']] as const).map(([reason,label])=><button type="button" key={reason} onClick={()=>boarding.reason(reason)}>{label}</button>)}</div><button type="button" onClick={boarding.exportWaiting}>Exportar mis esperas</button></div>}
   {boarding.message&&<p className="nav-dock-status-chip" role="status">{boarding.message}</p>}
   {walkReroute.status&&walkReroute.status.kind!=='failed'&&<p className="nav-walk-update" role="status">{walkReroute.status.message}</p>}
   {offRoute&&!arrived&&leg.kind==='walk'&&walkReroute.status?.kind!=='pending'&&<div className="nav-journey-warning" role="status">
    <strong>{walkReroute.status?.kind==='failed'?'Caminata sin conexión disponible':'Buscando otro camino'}</strong>
    <p>{walkReroute.status?.kind==='failed'?walkReroute.status.message:'Comprobando tu ubicación para ajustar solo la caminata.'}</p>
    <div><button type="button" onClick={walkReroute.retry} disabled={!confident||accuracy===undefined||accuracy>30||!onWalkReroute}>Actualizar caminata</button><button type="button" onClick={replan} disabled={!confident||!onReplan}>Ver otras opciones</button></div>
   </div>}
   {offRoute&&!arrived&&leg.kind==='bus'&&<div className="nav-journey-warning" role="status">
    <strong>{health.kind==='wrong-direction'?'Estás viajando en otro sentido':'Estás siguiendo otro camino'}</strong>
    <p>{proximity!==undefined?`${distanceLabel(proximity)} al destino en línea recta. `:''}El tiempo del recorrido original ya no es fiable.</p>
    <div><button type="button" onClick={replan} disabled={!confident||!onReplan}>Actualizar viaje</button><button type="button" onClick={()=>setReportOpen(!reportOpen)} disabled={!!report&&!report.endedAt}>Reportar desvío</button></div>
   </div>}
   {health.kind==='stopped'&&!stoppedDismissed.current.has(step)&&!arrived&&<div className="nav-journey-warning" role="status">
    <strong>La unidad lleva un minuto sin avanzar</strong><p>¿Qué ocurrió?</p>
    <div><button type="button" onClick={()=>startReport('traffic')}>Tráfico</button><button type="button" onClick={()=>startReport('incident')}>Incidente</button><button type="button" onClick={()=>{stoppedDismissed.current.add(step);setReportMessage('')}}>No sé</button></div>
   </div>}
   {reportOpen&&<div className="nav-report-panel">
    <strong>¿Por qué cambió el recorrido?</strong>
    <p>Al elegir una opción se registrará tu ubicación durante este tramo. El reporte se guarda en este teléfono y puedes exportarlo.</p>
    <div><button type="button" onClick={()=>startReport('roadworks')}>Obras</button><button type="button" onClick={()=>startReport('traffic')}>Tráfico</button><button type="button" onClick={()=>startReport('different-route')}>Tomé otra ruta</button><button type="button" onClick={()=>startReport('unknown')}>No sé</button><button type="button" onClick={()=>setReportOpen(false)}>Cancelar</button></div>
   </div>}
   {reportMessage&&<div className="nav-report-status" role="status"><span>{reportMessage}</span><div>{report&&!report.endedAt&&<button type="button" onClick={finishReport}>Terminar registro</button>}{report&&<button type="button" onClick={exportReport}>Exportar</button>}<button type="button" onClick={()=>setReportMessage('')} aria-label="Ocultar estado del reporte">×</button></div></div>}
   {(stale||locationIssue||!trusted&&!offRoute&&!boarding.waiting)&&!arrived&&(
    <div className="nav-dock-status-chip">
     <span className="nav-dock-status-dot"/>
     <span>{stale?'GPS sin actualizar; esperando señal.':locationIssue||(!live?'Esperando GPS…':hasProgress?'Último avance confirmado. Comprobando GPS…':'Comprobando el avance GPS…')}</span>
    </div>
   )}
   {!arrived&&<div className="nav-notice-controls">{leg.kind==='walk'&&!boarding.waiting&&<span>Mantén la vista en el camino</span>}<button type="button" aria-pressed={voice} onClick={()=>{setVoice(!voice);if(!voice)speak('Avisos por voz activados')}}>{voice?'Voz activada':'Activar avisos por voz'}</button></div>}
   {showStops&&(
    <div className="nav-sheet-timeline-drawer">
     {activeLandmarkAd&&<div className="nav-sponsored-detail">
      <span>Patrocinado · cerca de tu bajada</span>
      <strong>{activeLandmarkAd.icon} {activeLandmarkAd.title}</strong>
      {activeLandmarkAd.promoText&&<p>{activeLandmarkAd.promoText}</p>}
      {onAdDestinationChange&&<button type="button" onClick={()=>{if(!window.confirm(`¿Crear un viaje nuevo hacia ${activeLandmarkAd.title}? Esto terminará el seguimiento actual.`))return;onAdDestinationChange(activeLandmarkAd.coordinates!,activeLandmarkAd.title,confident&&live?live:origin)}}>Crear ruta a este negocio →</button>}
     </div>}
     <div className="nav-timeline-controls"><button type="button" aria-pressed={showPassed} onClick={()=>{setShowPassed(!showPassed);setTimelineFollow(false)}}>{showPassed?'Ocultar anteriores':`Ver anteriores (${timeline.passed.length})`}</button>{(!timelineFollow||showPassed)&&<button type="button" onClick={()=>{setTimelineFollow(true);setShowPassed(false)}}>Seguir próxima</button>}</div>
     <div className="nav-timeline-list" ref={timelineList} onPointerDown={()=>setTimelineFollow(false)}>
      {displayStops.map((s,idx)=>{
       const isNext=trusted&&nextStop&&nextStop.id===s.id;
       const stopLeg=option.legs[s.legIndex];
       const stopAlong='along' in s?s.along:stopLeg?projectProgress(s.coordinates,stopLeg.geometry??[stopLeg.from,stopLeg.to]).along:undefined;
       const passed=s.legIndex<step||s.legIndex===step&&hasProgress&&stopAlong!==undefined&&stopAlong<accepted.along-25;
       const dist=offRoute||passed||stopAlong===undefined?undefined:s.legIndex===step?Math.max(0,stopAlong-(hasProgress?accepted.along:0)):remaining+option.legs.slice(step+1,s.legIndex).reduce((sum,item)=>sum+item.meters,0)+stopAlong;
       const stopColor=('legIndex' in s?option.legs[s.legIndex]?.route?.color:undefined)??'#06b6d4';
       return (
        <div key={`${'legIndex' in s?s.legIndex:idx}-${s.id}`} className={`nav-timeline-row ${isNext?'is-next':''}`}>
         <div className="nav-timeline-indicator">
          <span className="nav-timeline-dot" style={{backgroundColor:stopColor}}/>
          <span className="nav-timeline-track"/>
         </div>
         <div className="nav-timeline-info">
          <span className="nav-timeline-name">{isNext&&<small className="nav-stop-state">{'type' in s&&s.type==='oficial'?'Próxima parada':'Próxima referencia'}</small>}{s.name}</span>
          {passed?<span className="nav-timeline-dist">Pasada</span>:dist!==undefined&&<span className="nav-timeline-dist">{trusted?'':'~'}{distanceLabel(dist)}</span>}
         </div>
        </div>
       );
      })}
      <div className="nav-timeline-row is-destination">
       <div className="nav-timeline-indicator">
        <span className="nav-timeline-flag">🏁</span>
       </div>
       <div className="nav-timeline-info">
        <strong className="nav-timeline-name">{endpointLabel}</strong>
        <span className="nav-timeline-dist">{offRoute?'—':`${trusted?'':'~'}${distanceLabel(remaining)}`}</span>
       </div>
      </div>
     </div>
    </div>
   )}
  </footer>
 </main>;
}
