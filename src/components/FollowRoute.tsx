import {useEffect,useMemo,useRef,useState} from 'react';
import type {Option,Point} from '../lib/router';
import {meters,routeTextColor} from '../lib/router';
import {projectProgress,remainingGeometry,stopsForOption,type TransitStop} from '../lib/navigation';
import StreetMap from './StreetMap';
import WalkingSafety from './WalkingSafety';
import MapSheet from './MapSheet';
import MapIcon from './MapIcon';
import {useCompass} from './useCompass';
import {movementHeading} from '../lib/heading';
import '../styles/navigation.css';
import '../styles/route-tags.css';
const distanceLabel=(n:number)=>n>=1000?`${(n/1000).toFixed(1)} km`:`${Math.round(n)} m`;
export default function FollowRoute({option,stops,origin,destination,destinationName,compassStart,onExit}:{option:Option;stops:TransitStop[];origin:Point;destination:Point;destinationName:string;compassStart:{enabled:boolean;issue:string};onExit:()=>void}){
 const [step,setStep]=useState(0),[live,setLive]=useState<Point>(),[accuracy,setAccuracy]=useState<number>(),[locationIssue,setLocationIssue]=useState(''),[follow,setFollow]=useState(true),[arrived,setArrived]=useState(false);
 const compass=useCompass(!arrived,compassStart);
 const [course,setCourse]=useState<number>(),[northUp,setNorthUp]=useState(false);
 const previous=useRef<{point:Point;accuracy:number}|undefined>(undefined);
 const startedAtOrigin=useRef(false);
 const heading=northUp?undefined:compass.heading??course;
 const rides=option.legs.flatMap((leg,index)=>leg.kind==='bus'&&leg.route?[{route:leg.route,index}]:[]);
 const routeStops=useMemo(()=>stopsForOption(option,stops),[option,stops]);
 const leg=option.legs[step],line=leg.geometry??[leg.from,leg.to];
 const progress=live?projectProgress(live,line):undefined;
 const confident=!!live&&accuracy!==undefined&&accuracy<=60;
 const [accepted,setAccepted]=useState({step:0,along:0});
 const acceptedAt=useRef(0);
 useEffect(()=>{
  if(accepted.step!==step){setAccepted({step,along:0});acceptedAt.current=0;return;}
  if(arrived||!progress||accuracy===undefined||accuracy>35||progress.distance>40)return;
  const now=Date.now(),elapsed=acceptedAt.current?(now-acceptedAt.current)/1000:0;
  const limit=acceptedAt.current?Math.max(50,elapsed*(leg.kind==='bus'?25:3)+accuracy):150;
  if(progress.along<accepted.along||progress.along-accepted.along>limit)return;
  acceptedAt.current=now;
  if(progress.along>accepted.along+2)setAccepted({step,along:progress.along});
 },[live,accuracy,step,arrived]);
 const displayedOption=useMemo(()=>({...option,legs:option.legs.map((item,index)=>({
  ...item,geometry:arrived||index<step?[]:index===step?remainingGeometry(item.geometry??[item.from,item.to],accepted.step===step?accepted.along:0):item.geometry
 }))}),[option,step,accepted,arrived]);
 const close=confident&&meters(live!,leg.to)<60;
 const nearAlighting=leg.kind==='bus'&&confident&&progress&&progress.distance<=100&&progress.remaining<=350;
 const currentStops=routeStops.filter(s=>s.legIndex===step);
 const nextStop=confident&&progress&&progress.distance<=100?currentStops.find(s=>s.along>progress.along+20):undefined;
 useEffect(()=>{
  if(arrived)return;
  if(!navigator.geolocation){setLocationIssue('Tu ubicación no está disponible. Sigue los pasos en el mapa.');return;}
  const id=navigator.geolocation.watchPosition(p=>{const point={lat:p.coords.latitude,lng:p.coords.longitude};
   if(p.coords.accuracy>60){setLocationIssue('GPS aproximado. Mantendremos el mapa en el último punto fiable.');return;}
   if(!startedAtOrigin.current&&meters(point,origin)>150){
    setLocationIssue('Tu GPS está lejos del origen elegido. El mapa permanece en el punto de partida; revisa el origen si es necesario.');
    return;
   }
   startedAtOrigin.current=true;
   if(p.coords.accuracy<=35){
    if(p.coords.heading!==null&&Number.isFinite(p.coords.heading)&&p.coords.speed!==null&&p.coords.speed>.8)setCourse(p.coords.heading);
    else if(previous.current&&previous.current.accuracy<=35&&meters(previous.current.point,point)>=Math.max(12,p.coords.accuracy,previous.current.accuracy)){setCourse(movementHeading(previous.current.point,point));previous.current={point,accuracy:p.coords.accuracy};}
    if(!previous.current)previous.current={point,accuracy:p.coords.accuracy};
   }
   setLive(point);setAccuracy(p.coords.accuracy);setLocationIssue(p.coords.accuracy>60?'Tu ubicación es aproximada. Confirma el punto de bajada en el mapa.':'')},error=>setLocationIssue(error.code===1?'Permite tu ubicación para seguir tu avance. Puedes continuar con los pasos.':'No pudimos actualizar tu ubicación. Sigue los pasos en el mapa.'),{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  return()=>navigator.geolocation.clearWatch(id);
 },[arrived]);
 function advance(){if(step<option.legs.length-1)setStep(step+1);else setArrived(true)}
 const title=arrived?'Llegaste a tu destino':leg.kind==='bus'?(nearAlighting?'Prepárate para bajar':`Viaja en ${leg.route?.name}`):step===option.legs.length-1?'Camina a tu destino':step===0?'Camina al punto de abordaje':'Camina al siguiente abordaje';
 return <main className="trip-screen navigation-screen">
  <StreetMap fullscreen origin={origin} destination={destination} option={displayedOption} stops={routeStops} live={live} follow={follow&&!arrived} navigation heading={heading} activeLeg={step} onPan={()=>setFollow(false)}/>
  <section className="navigation-top"><button className="back-button" onClick={onExit} aria-label="Salir del seguimiento">←</button><div className="navigation-banner" role="status"><small>{arrived?'VIAJE FINALIZADO':`PASO ${step+1} DE ${option.legs.length}`}</small><h1>{title}</h1><p>{arrived?destinationName:leg.kind==='bus'?`Bajada ${progress&&confident?`a ${distanceLabel(progress.remaining)}`:'marcada en el mapa'}`:destinationName}</p></div></section>
  {!arrived&&<div className="navigation-tools apple-map-controls"><button onClick={()=>{setNorthUp(false);void compass.enable()}} aria-label={compass.enabled?'Desactivar brújula':'Activar brújula'} title={compass.enabled?'Desactivar brújula':'Activar brújula'} aria-pressed={compass.enabled}><MapIcon kind="compass"/></button><button onClick={()=>setNorthUp(!northUp)} aria-label={northUp?'Orientar al avanzar':'Norte arriba'} title={northUp?'Orientar al avanzar':'Norte arriba'} aria-pressed={northUp}><MapIcon kind="north"/></button><button onClick={()=>setFollow(true)} disabled={!live} aria-label={!live?'Esperando ubicación':'Centrar en mí'} title={!live?'Esperando ubicación':'Centrar en mí'} aria-pressed={follow}><MapIcon kind="location"/></button></div>}
  <MapSheet className="navigation-panel" title={arrived?"Llegaste":"Tu recorrido"}><div className="navigation-route-tags" aria-label="Rutas de tu viaje">{rides.length?rides.map(({route,index},i)=><span className="navigation-route-item" key={`${route.id}-${index}`}>{i>0&&<span className="transfer-arrow" aria-label="Transbordo">→</span>}<span className="navigation-route-tag" style={{backgroundColor:route.color,color:routeTextColor(route.color)}} aria-current={step===index?'step':undefined}>{route.name}{step===index&&<small> · Ahora</small>}</span></span>):<span className="walking-tag">🚶 Viaje a pie</span>}</div>
   {compass.issue&&!arrived&&<p className="compass-issue" role="status">{compass.issue}</p>}
   {!live&&!arrived&&!locationIssue&&<p className="tracking-notice" role="status">Buscando tu ubicación para acompañarte…</p>}
   {locationIssue&&<p className="location-issue" role="status">{locationIssue}</p>}
   {!arrived&&<><div className="navigation-progress"><strong>{leg.kind==='bus'?'🚌':'🚶'} {leg.kind==='bus'?leg.route?.name:'A pie'}</strong><span>{progress&&confident?distanceLabel(progress.remaining):`${leg.minutes} min estimados`}</span></div>
   {nextStop&&<p className="next-stop">Siguiente referencia: <b>{nextStop.name}</b></p>}
   {leg.kind==='bus'&&<p>{nearAlighting?'Solicita tu bajada con anticipación.': 'Las paradas son referencias; la unidad no se detiene automáticamente en todas.'}</p>}
   {leg.kind==='walk'&&<><WalkingSafety/><p>{leg.instruction??'Camina al punto marcado usando calles y cruces permitidos.'}</p></>}
   {confident&&progress&&progress.distance>100&&<p className="off-route">Tu ubicación está alejada del trazo. Comprueba el recorrido.</p>}
   <button className="search" onClick={advance}>{step===option.legs.length-1?'Ya llegué':leg.kind==='bus'?'Ya bajé de la unidad':option.legs[step+1]?.kind==='bus'?'Ya abordé la unidad':'Continuar al siguiente paso'}</button>
   {close&&<small>Estás cerca del final de este tramo. Confirma para continuar.</small>}</>}
   {arrived&&<button className="search" onClick={onExit}>Volver a las opciones</button>}
   <details className="navigation-stops"><summary>Paradas de este recorrido ({routeStops.length})</summary>{!routeStops.length?<p>No hay paradas registradas sobre este tramo. La bajada sigue marcada en el mapa.</p>:routeStops.map(s=><div key={`${s.legIndex}-${s.id}`}><span className="stop-type-dot" style={{backgroundColor:option.legs[s.legIndex].route?.color}}/><div><strong>{s.name}</strong><small>{option.legs[s.legIndex].route?.name} · {s.type==='oficial'?'Oficial':s.type==='base'?'Base':'Bajada habitual'}{s.inferred?' · Coincide con el trazo':''}</small></div></div>)}</details>
  </MapSheet>
 </main>;
}
