import {useEffect,useMemo,useRef,useState} from 'react';
import type {Option,Point} from '../lib/router';
import type {Place} from '../lib/places';
import {meters,routeTextColor} from '../lib/router';
import {projectProgress,remainingGeometry,stopsForOption,type TransitStop} from '../lib/navigation';
import StreetMap from './StreetMap';
import MapIcon from './MapIcon';
import {useCompass} from './useCompass';
import {movementHeading} from '../lib/heading';
import {nextManeuver} from '../lib/maneuver';
import {remainingTripMinutes} from '../lib/tripEstimate';
import {ambiguousProjection,confirmsProgress,reliableProgressSample,type ProgressSample} from '../lib/progressGuard';
import '../styles/navigation.css';
import '../styles/route-tags.css';
import '../styles/navigation-refined.css';
import '../styles/dynamic-island.css';
const distanceLabel=(n:number)=>n>=1000?`${(n/1000).toFixed(1)} km`:`${Math.round(n)} m`;
export default function FollowRoute({option,stops,origin,destination,originName,destinationName,placeAccess,place,compassStart,onExit,initialStep=0,initialArrived=false,onProgress}:{option:Option;stops:TransitStop[];origin:Point;destination:Point;originName?:string;destinationName:string;placeAccess?:{meters:number;entrance:string};place?:Place;compassStart:{enabled:boolean;issue:string};onExit:()=>void;initialStep?:number;initialArrived?:boolean;onProgress?:(step:number,arrived:boolean)=>void}){
 const [step,setStep]=useState(initialStep),[live,setLive]=useState<Point>(),[accuracy,setAccuracy]=useState<number>(),[locationIssue,setLocationIssue]=useState(''),[follow,setFollow]=useState(true),[arrived,setArrived]=useState(initialArrived),[showStops,setShowStops]=useState(false);
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
 const [accepted,setAccepted]=useState({step:0,along:0});
 const [painted,setPainted]=useState({step:0,along:0});
 const pendingProgress=useRef<ProgressSample|undefined>(undefined);
 useEffect(()=>{
  const timer=setInterval(()=>setPainted(previous=>{
   if(previous.step!==accepted.step)return {...accepted,along:0};
   const gap=accepted.along-previous.along;
   return gap<=.2?accepted:{step:accepted.step,along:previous.along+gap*.35};
  }),80);
  return()=>clearInterval(timer);
 },[accepted]);
 const acceptedAt=useRef(0);
 // Never trim from a lone fix or a projection that could belong to a nearby return pass.
 useEffect(()=>{
  if(accepted.step!==step){setAccepted({step,along:0});acceptedAt.current=0;pendingProgress.current=undefined;return;}
  if(arrived||stale||!live||accuracy===undefined||!fixAt){pendingProgress.current=undefined;return;}
  const sample=reliableProgressSample(live,line,accuracy,fixAt);
  if(!sample){pendingProgress.current=undefined;return;}
  const previous=pendingProgress.current;
  if(!confirmsProgress(previous,sample,leg.kind)){
   if(!previous||sample.time-previous.time>15000)pendingProgress.current=sample;
   return;
  }
  pendingProgress.current=sample;
  const now=Date.now(),elapsed=acceptedAt.current?(now-acceptedAt.current)/1000:0;
  const limit=acceptedAt.current?Math.max(50,elapsed*(leg.kind==='bus'?25:3)+accuracy):150;
  if(sample.along<accepted.along||sample.along-accepted.along>limit)return;
  acceptedAt.current=now;
  if(sample.along>accepted.along+2)setAccepted({step,along:sample.along});
 },[live,accuracy,fixAt,step,arrived,stale]);
 const displayedOption=useMemo(()=>({...option,legs:option.legs.map((item,index)=>({
  ...item,geometry:arrived||index<step?[]:index===step?remainingGeometry(item.geometry??[item.from,item.to],painted.step===step?painted.along:0):item.geometry
 }))}),[option,step,painted,arrived]);
 const projectionSafe=useMemo(()=>!!progress&&accuracy!==undefined&&accuracy<=25&&progress.distance<=25&&!ambiguousProjection(live!,line,accuracy,progress.along,progress.distance),[live,line,accuracy,progress]);
 const trusted=projectionSafe&&confident&&accepted.step===step&&acceptedAt.current>0;
 const close=!!progress&&trusted&&accepted.along>=progress.length-70&&meters(live!,leg.to)<60;
 const nearAlighting=leg.kind==='bus'&&!!progress&&trusted&&accepted.along>=progress.length-350&&progress.remaining<=350;
 const currentStops=routeStops.filter(s=>s.legIndex===step);
 const nextStop=trusted?currentStops.find(s=>s.along>accepted.along+20):undefined;
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
   setLive(point);setFixAt(p.timestamp);setAccuracy(p.coords.accuracy);setLocationIssue('')},error=>setLocationIssue(error.code===1?'Permite tu ubicación para seguir tu avance. Puedes continuar con los pasos.':'No pudimos actualizar tu ubicación. Sigue los pasos en el mapa.'),{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  return()=>navigator.geolocation.clearWatch(id);
 },[arrived]);
 function advance(){if(step<option.legs.length-1){setStep(step+1);onProgress?.(step+1,false)}else{setArrived(true);onProgress?.(step,true)}}
 const title=arrived?'Viaje finalizado':leg.kind==='bus'?(nearAlighting?'Prepárate para bajar':`Viaja en ${leg.route?.name}`):step===option.legs.length-1?(placeAccess?'Camina al acceso del destino':'Camina a tu destino'):step===0?'Camina al punto de abordaje':'Camina al siguiente abordaje';
 const remaining=trusted&&progress?Math.max(0,progress.length-accepted.along):leg.meters;
 const maneuver=leg.kind==='walk'&&trusted?nextManeuver(line,accepted.along):undefined;
 const totalMeters=remaining+option.legs.slice(step+1).reduce((sum,l)=>sum+l.meters,0);
 const totalMinutes=remainingTripMinutes(option,step,remaining);
 const action=arrived?'Finalizar viaje':step===option.legs.length-1?'Ya llegué':leg.kind==='bus'?'Ya bajé de la unidad':option.legs[step+1]?.kind==='bus'?'Ya abordé la unidad':'Continuar';
 const currentBusRoute=leg.kind==='bus'?leg.route:undefined;
 const nextBusRoute=option.legs[step+1]?.kind==='bus'?option.legs[step+1]?.route:undefined;
 function formatNavInstruction():string{
  if(arrived)return destinationName?`Llegaste a ${destinationName}.`:'Has llegado a tu destino.';
  if(leg.kind==='bus'){
   if(nearAlighting)return 'Prepárate para bajar en la próxima parada. Solicita tu bajada con anticipación.';
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
  if(leg.kind==='bus'){
   if(nearAlighting)return nextStop?`Próxima bajada: ${nextStop.name}`:'Solicita tu bajada con anticipación';
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
 },[arrived,leg,nearAlighting,nextStop,destinationName,originName]);
 const routeForDock=currentBusRoute??nextBusRoute;
 const dockRouteLabel=routeForDock?(routeForDock.name.replace(/^(ruta|camión)\s*[:.-]?\s*/i,'').trim()||routeForDock.name):'A pie';
 const displayStops=useMemo(()=>{
  if(routeStops.length>0)return routeStops;
  const synthetic:Array<{id:string;name:string;coordinates:Point;legIndex:number;color?:string}>=[];
  option.legs.forEach((l,idx)=>{
   if(l.kind==='bus'){
    synthetic.push({id:`board-${idx}`,name:`Abordaje: ${l.route?.name??'Ruta'}`,coordinates:l.from,legIndex:idx,color:l.route?.color});
    synthetic.push({id:`alight-${idx}`,name:`Bajada de ${l.route?.name??'Ruta'}`,coordinates:l.to,legIndex:idx,color:l.route?.color});
   }
  });
  return synthetic;
 },[routeStops,option]);
 return <main className="trip-screen navigation-screen">
  <StreetMap fullscreen origin={origin} destination={destination} access={placeAccess?option.legs.at(-1)?.to:undefined} place={place} option={displayedOption} stops={routeStops} live={live} follow={follow&&!arrived} navigation heading={heading} activeLeg={step} accuracy={accuracy} stale={stale} remaining={remaining} onPan={()=>setFollow(false)}/>
  <section className="nav-top-card" role="region" aria-label="Indicaciones de viaje">
   <div className="nav-top-icon-circle" style={leg.kind==='bus'&&leg.route?{backgroundColor:leg.route.color,color:routeTextColor(leg.route.color)}:arrived?{backgroundColor:'#10b981',color:'#fff'}:undefined} aria-hidden="true">
    {arrived?'✓':leg.kind==='bus'?'🚌':(maneuver?.icon??'🚶')}
   </div>
   <div className="nav-top-content">
    <div className="nav-top-meta-line">
     <span className="nav-top-dist">{arrived?'FINALIZADO':distanceLabel(maneuver?.distance??remaining)}</span>
     <span className="nav-top-dot">·</span>
     <span className="nav-top-step">Paso {step+1} de {option.legs.length}</span>
    </div>
    <h1 className="nav-top-title">{title}</h1>
    <p className="nav-top-subtitle">{streetSubtitle}</p>
   </div>
   <button className="nav-top-back" onClick={onExit} aria-label="Salir del seguimiento" title="Salir">✕</button>
  </section>
  {!arrived&&<div className="navigation-tools apple-map-controls"><button onClick={()=>{setNorthUp(false);void compass.enable()}} aria-label={compass.enabled?'Desactivar brújula':'Activar brújula'} title={compass.enabled?'Desactivar brújula':'Activar brújula'} aria-pressed={compass.enabled}><MapIcon kind="compass"/></button><button onClick={()=>setNorthUp(!northUp)} aria-label={northUp?'Orientar al avanzar':'Norte arriba'} title={northUp?'Orientar al avanzar':'Norte arriba'} aria-pressed={northUp}><MapIcon kind="north"/></button><button onClick={()=>setFollow(true)} disabled={!live} aria-label={!live?'Esperando ubicación':'Centrar en mí'} title={!live?'Esperando ubicación':'Centrar en mí'} aria-pressed={follow}><MapIcon kind="location"/></button></div>}
  <footer className={`nav-bottom-sheet map-sheet ${showStops?'is-expanded':''}`} role="region" aria-label="Control del viaje">
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
     onClick={arrived?onExit:advance}
     aria-label={action}
    >
     <span className="nav-btn-action-text">{action}</span>
     <span className="nav-btn-action-arrow" aria-hidden="true">{arrived?'✓':'→'}</span>
    </button>
    <button
     type="button"
     className="nav-btn-metrics"
     onClick={()=>setShowStops(!showStops)}
     aria-expanded={showStops}
     aria-label={`${arrived?'Destino alcanzado':`${totalMinutes} min, ${distanceLabel(totalMeters)}`}. Toca para ver paradas.`}
    >
     <div className="nav-btn-metrics-stack">
      <strong className="nav-btn-metrics-time">{arrived?'✓':`${totalMinutes} min`}</strong>
      <span className="nav-btn-metrics-dist">{arrived?'Destino':distanceLabel(totalMeters)}</span>
     </div>
    </button>
   </div>
   {(stale||locationIssue)&&!arrived&&(
    <div className="nav-dock-status-chip">
     <span className="nav-dock-status-dot"/>
     <span>{stale?'Ubicación sin actualizar':locationIssue}</span>
    </div>
   )}
   {showStops&&(
    <div className="nav-sheet-timeline-drawer">
     <div className="nav-timeline-list">
      {displayStops.map((s,idx)=>{
       const isNext=trusted&&nextStop&&nextStop.id===s.id;
       const stopLeg=option.legs[s.legIndex];
       const stopAlong='along' in s?s.along:stopLeg?projectProgress(s.coordinates,stopLeg.geometry??[stopLeg.from,stopLeg.to]).along:undefined;
       const dist=stopAlong===undefined||s.legIndex<step?undefined:s.legIndex===step?Math.max(0,stopAlong-(trusted?accepted.along:0)):remaining+option.legs.slice(step+1,s.legIndex).reduce((sum,item)=>sum+item.meters,0)+stopAlong;
       const stopColor=('legIndex' in s?option.legs[s.legIndex]?.route?.color:undefined)??'#06b6d4';
       return (
        <div key={`${'legIndex' in s?s.legIndex:idx}-${s.id}`} className={`nav-timeline-row ${isNext?'is-next':''}`}>
         <div className="nav-timeline-indicator">
          <span className="nav-timeline-dot" style={{backgroundColor:stopColor}}/>
          <span className="nav-timeline-track"/>
         </div>
         <div className="nav-timeline-info">
          <span className="nav-timeline-name">{s.name}</span>
          {dist!==undefined&&<span className="nav-timeline-dist">{distanceLabel(dist)}</span>}
         </div>
        </div>
       );
      })}
      <div className="nav-timeline-row is-destination">
       <div className="nav-timeline-indicator">
        <span className="nav-timeline-flag">🏁</span>
       </div>
       <div className="nav-timeline-info">
        <strong className="nav-timeline-name">Baja cerca de {destinationName||'Catedral'}</strong>
        <span className="nav-timeline-dist">{distanceLabel(totalMeters)}</span>
       </div>
      </div>
     </div>
    </div>
   )}
  </footer>
 </main>;
}
