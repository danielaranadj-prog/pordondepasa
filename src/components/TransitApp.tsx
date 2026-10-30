import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Option, type Point } from '../lib/router';
import {planRoutes,RoutePlanError} from '../lib/workerClient';
import StreetMap from './StreetMap';
import RouteChoiceCard from './RouteChoiceCard';
import UiIcon from './UiIcon';
import '../styles/map.css';
import '../styles/dynamic-island.css';
import DynamicIsland from './DynamicIsland';
import FollowRoute from './FollowRoute';
import MapSheet from './MapSheet';
import HomeScreen,{type HomeSavedPlace as SavedPlace} from './HomeScreen';
import {requestCompass} from './useCompass';
import type {TransitStop as Stop} from '../lib/navigation';
import {searchPlaces,type Place} from '../lib/places';
import {currentTripSponsor,type AdCampaign} from '../lib/ads';
import {canShowSponsoredTrip} from '../lib/sponsoredTrip';
import {ADS_MODE,ADS_FEED_URL,ADS_API_KEY} from '../lib/adConfig';
import {loadPublicAds} from '../lib/adFeed';
import SponsoredTripIntro from './SponsoredTripIntro';
import JourneyRecovery from './JourneyRecovery';
import {readJourney,saveJourney,clearJourney,DATASET_VERSION,type JourneySession} from '../lib/journeySession';
import '../styles/passenger-settings.css';
import {replaceWalkingLeg} from '../lib/walkingReroute';
import type {UpdateWalkingLeg} from './useWalkingReroute';
import {installBoarding} from '../lib/boarding';
import {loadStopSources,mergeStopSources,STOP_SOURCES,type StopSource} from '../lib/stopFeed';
import {pruneLocalRecords} from '../lib/localRecords';
import type {UpdatePickup} from './useBoardingJourney';
import {TEPIC_MAP_CENTER,planningLocation,withinServiceArea,beginMapSelection,updateMapSelection,type Endpoint,type MapSelection} from '../lib/mapSelection';
import '../styles/planning.css';
import '../styles/identity.css';
import '../styles/blue-glass.css';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function optionLabel(option:Option,index:number,options:Option[]):string {
 if(index===0)return 'Más rápida';
 if(option.fare<options[0].fare&&option.fare===Math.min(...options.map(item=>item.fare)))return 'Menor costo';
 if(option.transfers===0&&options[0].transfers>0)return 'Sin transbordos';
 return 'Alternativa';
}
export default function TransitApp({savedPlaces=[],onOpenAccount}:{savedPlaces?:SavedPlace[];onOpenAccount?:()=>void}={}){
 const [compassStart,setCompassStart]=useState({enabled:false,issue:''}),[starting,setStarting]=useState(false);
 const [journeyProgress,setJourneyProgress]=useState<{optionId:string;step:number;arrived:boolean}|null>(null);
 const [recoverable,setRecoverable]=useState<JourneySession>();
 useEffect(()=>{pruneLocalRecords();if(!onOpenAccount)setRecoverable(readJourney());const clear=()=>setRecoverable(undefined);window.addEventListener('pdp:journey-cleared',clear);return()=>window.removeEventListener('pdp:journey-cleared',clear)},[]);
 const [restoredAccess,setRestoredAccess]=useState<{meters:number;entrance:string}>();
 async function startTrip(index:number){
  if(starting)return;
  setStarting(true);
  try{
  // Request within the user's button gesture, before mounting navigation.
  const result=await requestCompass().catch(()=>({enabled:false,issue:'La orientación no está disponible. Puedes usar el mapa.'}));
  if(journeyProgress?.optionId!==options[index]?.id)setJourneyProgress(null);
  const option=options[index];
  let match:typeof sponsorIntro;
  try{match=option?.legs.filter(leg=>leg.kind==='bus'&&leg.route).flatMap(leg=>
   ads.filter(ad=>canShowSponsoredTrip(ad,leg.route!.id)).map(ad=>({ad,routeName:leg.route!.name,routeId:leg.route!.id})))[0]}catch{/* Commercial content must never block a journey. */}
  setSponsorIntro(match);setSponsorViewed(false);setRecoverable(undefined);
  setCompassStart(result);setSelected(index);setView(match?'sponsor':'follow');
  }finally{setStarting(false)}
 }
 const [welcome,setWelcome]=useState(true),[view,setView]=useState<'search'|'trip'|'follow'|'sponsor'>('search');
 const [sponsorIntro,setSponsorIntro]=useState<{ad:AdCampaign;routeName:string;routeId:string}>();
 const [sponsorViewed,setSponsorViewed]=useState(false);
 const [pickDestination,setPickDestination]=useState(false);
 const [mapSelection,setMapSelection]=useState<MapSelection|null>(null),[cameraRequest,setCameraRequest]=useState(0);
 const selectionSequence=useRef(0);
 const [originStatus,setOriginStatus]=useState<'loading'|'confirmed'|'unavailable'>('unavailable'),[originIssue,setOriginIssue]=useState('');
 const [editMessage,setEditMessage]=useState(''),[editLocating,setEditLocating]=useState(false);
 const editorRequest=useRef(0);
 const showAll=false;
 const drag=useRef<{x:number;scroll:number}|null>(null),moved=useRef(false);
 const locationRequest=useRef<Promise<Point|null>|null>(null),locationGeneration=useRef(0),originConfirmed=useRef(false),manualOrigin=useRef(false),originValue=useRef<Point>({...TEPIC_MAP_CENTER});
 const carousel=useRef<HTMLDivElement>(null),request=useRef(0);
 useEffect(()=>{const timer=setTimeout(()=>setWelcome(false),800);return()=>clearTimeout(timer)},[]);
 function followCards(){if(showAll)return;const list=carousel.current;if(!list)return;const middle=list.scrollLeft+list.clientWidth/2;let nearest=0,distance=Infinity;
 Array.from(list.children).forEach((node,i)=>{const card=node as HTMLElement;const d=Math.abs(card.offsetLeft+card.offsetWidth/2-middle);if(d<distance){distance=d;nearest=i}});setSelected(nearest)}
 function selectCard(i:number){setSelected(i);if(showAll)return;const list=carousel.current,card=list?.children[i] as HTMLElement|undefined;if(list&&card)list.scrollTo({left:card.offsetLeft-list.clientWidth/2+card.offsetWidth/2,behavior:'smooth'})}
 const [origin,setOrigin]=useState<Point>({...TEPIC_MAP_CENTER}),[originLabel,setOriginLabel]=useState('Elige tu origen');
 const [destination,setDestination]=useState<Point>(),[query,setQuery]=useState(''),[stops,setStops]=useState<Stop[]>([]),[places,setPlaces]=useState<Place[]>([]),[ads,setAds]=useState<AdCampaign[]>([]),[chosenPlace,setChosenPlace]=useState<Place|undefined>();
 const activeSponsor=currentTripSponsor(sponsorIntro?.ad.id,ads,sponsorIntro?[sponsorIntro.routeId]:[]);
 useEffect(()=>{if(view==='sponsor'&&sponsorIntro&&!activeSponsor){setSponsorViewed(false);setView('follow')}},[view,sponsorIntro,activeSponsor]);
 const originAccess=useRef<Point|undefined>(undefined);
 const originPlace=useRef<Place|undefined>(undefined);
 const [options,setOptions]=useState<Option[]>([]),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[pickOrigin,setPickOrigin]=useState(false),[message,setMessage]=useState('');
 const [failedStopSources,setFailedStopSources]=useState<StopSource[]>([]),[stopsBusy,setStopsBusy]=useState(false),[stopRetry,setStopRetry]=useState(0);
 const failedStops=useRef<StopSource[]>([]);
 // Keep the keyboard/search dock stable between pointer-down and click. Keyboard activation is unchanged.
 const stopNotice=failedStopSources.length>0?<div className="stops-load-notice" role="status"><span>{failedStopSources.length===STOP_SOURCES.length?'Referencias de abordaje no disponibles.':'Referencias de abordaje incompletas.'} Puedes planear con el mapa; confirma el punto y el sentido con el chofer.</span><button type="button" disabled={stopsBusy} onPointerDown={event=>event.preventDefault()} onClick={()=>setStopRetry(value=>value+1)}>{stopsBusy?'Reintentando…':'Reintentar referencias'}</button></div>:undefined;
 useEffect(()=>{
  if(onOpenAccount||view!=='follow'||!options[selected]||!destination)return;
  if(journeyProgress?.arrived){clearJourney();return;}
  saveJourney({version:1,dataset:DATASET_VERSION,at:Date.now(),option:options[selected],step:journeyProgress?.optionId===options[selected].id?journeyProgress.step:0,origin,destination,originName:originLabel,destinationName:query,placeAccess:chosenPlace?{meters:chosenPlace.accessMeters,entrance:chosenPlace.entrance}:restoredAccess});
 },[view,options,selected,destination,origin,originLabel,query,journeyProgress,chosenPlace,restoredAccess,onOpenAccount]);
 function resumeJourney(){
  const session=readJourney();if(!session){setRecoverable(undefined);return;}
  commitOrigin(session.origin,session.originName);setDestination(session.destination);setQuery(session.destinationName);setOptions([session.option]);setSelected(0);
  setJourneyProgress({optionId:session.option.id,step:session.step,arrived:false});setChosenPlace(undefined);setRestoredAccess(session.placeAccess);setSponsorIntro(undefined);setRecoverable(undefined);setWelcome(false);setView('follow');
 }
 const updateWalkingLeg=useCallback<UpdateWalkingLeg>((index,expected,next)=>{
  setOptions(previous=>{
   const current=previous[selected];if(!current||current.legs[index]!==expected)return previous;
   const updated=replaceWalkingLeg(current,index,next);if(!updated)return previous;
   return previous.map((item,i)=>i===selected?updated:item);
  });
 },[selected]);
 const updatePickup=useCallback<UpdatePickup>((index,walk,previousBus,bus,point)=>{
  setOptions(previous=>{const current=previous[selected];if(!current)return previous;const updated=installBoarding(current,index,walk,previousBus,bus,point);return updated?previous.map((item,i)=>i===selected?updated:item):previous;});
 },[selected]);
 useEffect(()=>{
  const controller=new AbortController();setStopsBusy(true);
  void loadStopSources(import.meta.env.BASE_URL,fetch,stopRetry?failedStops.current:STOP_SOURCES,controller.signal).then(result=>{
   if(controller.signal.aborted)return;
   setStops(previous=>mergeStopSources(previous,result));failedStops.current=result.failedSources;setFailedStopSources(result.failedSources);setStopsBusy(false);
  });return()=>controller.abort();
 },[stopRetry]);
 useEffect(()=>{let active=true;fetch(`${import.meta.env.BASE_URL}data/places.json`).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{if(active&&Array.isArray(data.places))setPlaces(data.places)}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{let active=true,version=0;const refresh=()=>{const current=++version;void loadPublicAds(ADS_MODE,`${import.meta.env.BASE_URL}data/ads.json`,ADS_FEED_URL,fetch,ADS_API_KEY).then(data=>{if(active&&current===version)setAds(data)})};
  refresh();const timer=ADS_MODE==='remote'?window.setInterval(refresh,60000):undefined;
  const foreground=()=>{if(!document.hidden&&ADS_MODE==='remote')refresh()};
  document.addEventListener('visibilitychange',foreground);
  return()=>{active=false;if(timer)window.clearInterval(timer);document.removeEventListener('visibilitychange',foreground)}},[]);
 const suggestions=useMemo(()=>{if(destination||query.trim().length<2)return [];const term=normalize(query.trim());const seen=new Set<string>();return stops.filter(s=>{if(!normalize(s.name).includes(term)||seen.has(s.name))return false;seen.add(s.name);return true}).slice(0,8)},[query,stops,destination]);
 const placeSuggestions=useMemo(()=>destination?[]:searchPlaces(places,query,8),[destination,places,query]);
 function commitOrigin(point:Point,name:string,place?:Place){
  locationGeneration.current++;manualOrigin.current=true;originConfirmed.current=true;originValue.current=point;originAccess.current=place?.access;originPlace.current=place;
  setOrigin(point);setOriginLabel(name);setOriginStatus('confirmed');setOriginIssue('');
 }
 function beginPicker(target:Endpoint,point=target==='origin'?origin:destination??origin){
  request.current++;setBusy(false);setMapSelection({...beginMapSelection(++selectionSequence.current,target,point),moving:true});setPickOrigin(target==='origin');setPickDestination(target==='destination');setView('trip');
 }
 function cancelPicker(){setMapSelection(null);setPickOrigin(false);setPickDestination(false);setMessage('');}
 function confirmPicker(){
  if(!mapSelection||mapSelection.moving)return;
  const {draft:point,target}=mapSelection;
  if(!withinServiceArea(point)){setMessage('Ese punto está fuera de Tepic y Xalisco. Acerca el mapa a nuestra zona de servicio.');return;}
  cancelPicker();setCameraRequest(value=>value+1);
  if(target==='origin')selectEdited(point,'Origen elegido en el mapa',undefined,'origin');
  else selectEdited(point,'Destino elegido en el mapa',undefined,'destination');
 }
 function closeEditor(){editorRequest.current++;setEditLocating(false);setEditMessage('')}
 function selectEdited(point:Point,name:string,place?:Place,target:'origin'|'destination'='destination'){
  editorRequest.current++;
  setMapSelection(null);setPickOrigin(false);setPickDestination(false);setCameraRequest(value=>value+1);
  if(target==='origin'){
   request.current++;commitOrigin(point,name,place);closeEditor();setOptions([]);setMessage('');
   if(destination)void calculate(chosenPlace?.access??destination);
  }else{
   choose(point,name,place);closeEditor();void calculate(place?.access??point);
  }
 }
 async function useCurrentOrigin():Promise<boolean>{
  if(editLocating)return false;
  request.current++;setOptions([]);setBusy(false);
  const attempt=++editorRequest.current;
  setEditLocating(true);
  setEditMessage('');
  const point=await locate(true);
  if(attempt!==editorRequest.current)return false;
  setEditLocating(false);
  if(!point){setEditMessage('No pudimos confirmar tu ubicación. Elige el origen en el mapa.');return false;}
  selectEdited(point,'Mi ubicación actual',undefined,'origin');return true;
 }
 function choose(point:Point,name:string,place?:Place){request.current++;setDestination(point);setChosenPlace(place);setRestoredAccess(undefined);setQuery(name);setOptions([]);setJourneyProgress(null);setMessage('');setBusy(false);}
 function locate(retry=false):Promise<Point|null>{
  if(retry){locationRequest.current=null;manualOrigin.current=false;originConfirmed.current=false;setOriginStatus('loading');setOriginIssue('');setOriginLabel('Buscando tu ubicación…');}
  if(locationRequest.current)return locationRequest.current;
  const generation=++locationGeneration.current;
  locationRequest.current=new Promise(resolve=>{
   const unavailable=(reason:string)=>{
    if(generation===locationGeneration.current&&!manualOrigin.current){originConfirmed.current=false;setOriginStatus('unavailable');setOriginLabel('Elige tu origen');setOriginIssue(reason);}
    resolve(manualOrigin.current&&originConfirmed.current?originValue.current:null);
   };
   if(!navigator.geolocation){
    unavailable('Este dispositivo no ofrece ubicación. Confirma desde dónde sales.');
    return;
   }
   navigator.geolocation.getCurrentPosition(p=>{
    if(generation!==locationGeneration.current){resolve(originConfirmed.current?originValue.current:null);return;}
    const point=planningLocation({point:{lat:p.coords.latitude,lng:p.coords.longitude},accuracy:p.coords.accuracy,timestamp:p.timestamp});
    if(!point){unavailable('Tu ubicación está fuera de cobertura o no es suficientemente precisa. Elige tu origen.');return;}
    if(!manualOrigin.current){originValue.current=point;originAccess.current=undefined;originPlace.current=undefined;originConfirmed.current=true;setOrigin(point);setOriginLabel('Mi ubicación actual');setOriginStatus('confirmed');setOriginIssue('');}
    resolve(originConfirmed.current?originValue.current:null);
   },()=>{
    unavailable('No pudimos obtener tu GPS. El centro del mapa es solo una referencia, no tu ubicación.');
   },{enableHighAccuracy:true,timeout:4000,maximumAge:60000});
  });
  return locationRequest.current;
 }
 // Location is requested by explicit planning/location actions, not on launch.
 async function calculate(target:Point){const id=++request.current;setView('trip');setBusy(true);setMessage('');setOptions([]);setJourneyProgress(null);
  try{
   if(!originConfirmed.current)await locate();
   if(id!==request.current)return;
   if(!originConfirmed.current){
    return;
   }
   setPickOrigin(false);
   const next=await planRoutes(originAccess.current??originValue.current,target);if(id!==request.current)return;setOptions(next);setSelected(0);if(!next.length)setMessage('No encontramos un recorrido conectado por calles con los datos actuales. Prueba un punto cercano sobre una calle pública.');
  }catch(error){if(id===request.current){
   if(error instanceof RoutePlanError){if(error.issue==='dataset_changed')setMessage(error.message);else{const source=error.issue==='origin_off_street';beginPicker(source?'origin':'destination',source?originValue.current:target);setMessage(error.message)}}
   else setMessage('No se pudieron cargar las rutas. Intenta de nuevo.');
  }}
  finally{if(id===request.current)setBusy(false)}
 }
 function plan(){if(destination)void calculate(chosenPlace?.access??destination)}
 function replanFromLocation(point:Point){
  if(!destination)return;
  request.current++;commitOrigin(point,'Mi ubicación actual');
  void calculate(chosenPlace?.access??destination);
 }
 function moveDestination(point:Point,name='Destino ajustado en el mapa'){cancelPicker();setCameraRequest(value=>value+1);choose(point,name);void calculate(point);}
 function planSponsorTrip(point:Point,name:string,from:Point){
  request.current++;commitOrigin(from,'Punto de partida actual');
  moveDestination(point,name);
 }
 function swapEndpoints(){
  if(!destination||!originConfirmed.current)return;
  const previousOrigin=originValue.current,previousDestination=destination,previousOriginPlace=originPlace.current;
  const previousOriginLabel=originLabel==='Mi ubicación actual'?'Ubicación inicial':originLabel;
  request.current++;commitOrigin(previousDestination,query||'Origen seleccionado',chosenPlace);setChosenPlace(previousOriginPlace);
  setDestination(previousOrigin);setQuery(previousOriginLabel);
  cancelPicker();setCameraRequest(value=>value+1);setOptions([]);setSelected(0);setMessage('');
  void calculate(previousOriginPlace?.access??previousOrigin);
 }
 function back(){request.current++;setBusy(false);setMessage('');setView('search');closeEditor();cancelPicker()}
 if(view==='sponsor'&&sponsorIntro&&activeSponsor)return <SponsoredTripIntro ad={activeSponsor} routeName={sponsorIntro.routeName} routeId={sponsorIntro.routeId} onContinue={()=>{setSponsorViewed(true);setView('follow')}}/>;
 if(view==='follow'&&options[selected]&&destination)return <FollowRoute option={options[selected]} stops={stops} dataNotice={stopNotice} ads={ads} sponsoredTrip={sponsorViewed?activeSponsor:undefined} origin={origin} destination={destination} originName={originLabel} destinationName={query} placeAccess={chosenPlace?{meters:chosenPlace.accessMeters,entrance:chosenPlace.entrance}:restoredAccess} place={chosenPlace} compassStart={compassStart} initialStep={journeyProgress?.optionId===options[selected].id?journeyProgress.step:0} initialArrived={journeyProgress?.optionId===options[selected].id?journeyProgress.arrived:false} onProgress={(step,arrived)=>setJourneyProgress({optionId:options[selected].id,step,arrived})} onExit={()=>setView('trip')} onReplan={replanFromLocation} onWalkReroute={updateWalkingLeg} onPickup={updatePickup} onAdDestinationChange={planSponsorTrip}/>;
 if(welcome)return <main className="welcome-screen brand-welcome pdp-blue-glass"><div className="welcome-brand"><span className="welcome-mark"><UiIcon name="route"/></span><h1>PorDóndePasa</h1><p>Tu ciudad. Tu camino.</p></div><div className="welcome-action"><small>TEPIC · XALISCO</small><button type="button" onClick={()=>setWelcome(false)}>Empezar<UiIcon name="arrow"/></button></div></main>;
 if(view==='trip')return <main className="trip-screen pdp-blue-glass" data-screen={pickOrigin?'editar-origen':pickDestination?'editar-destino':'rutas-disponibles'}>
  <StreetMap fullscreen ads={ads} origin={origin} hideOrigin={originStatus!=='confirmed'} destination={destination} access={chosenPlace?.access} place={chosenPlace} option={options[selected]} cameraRequest={cameraRequest} centerPicker={mapSelection??undefined} onPickerChange={(id,point,moving)=>setMapSelection(current=>updateMapSelection(current,id,point,moving))} onDestinationChange={point=>beginPicker('destination',point)} onAdDestinationChange={moveDestination}/>
  <DynamicIsland
   originLabel={originLabel}
   destinationLabel={query}
   pickOrigin={pickOrigin}
   pickDestination={pickDestination}
   compact={!!options.length&&!mapSelection}
   places={places}
   stops={stops}
   onSelect={(point,name,place,target)=>selectEdited(point,name,place,target)}
   onPickOnMap={target=>{
    beginPicker(target);
   }}
   onUseCurrentOrigin={useCurrentOrigin}
   editLocating={editLocating}
   locationMessage={originIssue||editMessage}
   onSwap={swapEndpoints}
   canSwap={!!destination&&originConfirmed.current}
   onBack={back}
  />
  {!mapSelection&&!!options.length&&<button type="button" className="map-overview" onClick={()=>setCameraRequest(value=>value+1)}><UiIcon name="route"/>Ver viaje</button>}
  <MapSheet resetKey={mapSelection?.id} className={`trip-bottom${options.length&&!mapSelection?' has-route-options':''}`} title={mapSelection?(mapSelection.target==='origin'?'Elegir origen':'Elegir destino'):options.length?'Tus opciones':'Prepara tu viaje'}>
   {mapSelection?<div className="map-selection-panel">
    <strong>{mapSelection.target==='origin'?'¿Desde dónde sales?':'¿Hasta dónde quieres llegar?'}</strong>
    <p>Mueve el mapa debajo del pin. Tu viaje no cambia hasta confirmar.</p>
    <output aria-live="polite">{mapSelection.moving?'Ajustando el punto…':`${mapSelection.draft.lat.toFixed(5)}, ${mapSelection.draft.lng.toFixed(5)}`}</output>
    {message&&<p role="status">{message}</p>}
    <div className="map-selection-actions"><button type="button" className="selection-cancel" onClick={cancelPicker}>Cancelar</button><button type="button" className="selection-confirm" disabled={mapSelection.moving} onClick={confirmPicker}>Confirmar {mapSelection.target==='origin'?'origen':'destino'}<UiIcon name="arrow"/></button></div>
   </div>:<>
   {originStatus!=='confirmed'&&<div className="origin-confirmation" role="status"><strong>{originStatus==='loading'?'Buscando tu ubicación…':'Confirma desde dónde sales'}</strong><p>{originIssue||'Puedes elegir el punto de partida en el mapa mientras comprobamos tu GPS.'}</p><div><button type="button" disabled={editLocating||originStatus==='loading'} onClick={()=>void useCurrentOrigin()}>Usar mi ubicación</button><button type="button" onClick={()=>beginPicker('origin')}>Elegir origen en mapa</button></div></div>}
   {busy&&<div className="trip-status" role="status"><span className="loading-dot"/>Buscando tu ruta…</div>}
   {stopNotice}
   {message&&<div className="trip-status" role="status">{message}<button className="text-button" onClick={plan}>Buscar de nuevo</button></div>}
   
   
   {!!options.length&&<><div className="carousel-heading"><span>Así puedes llegar</span><strong>{selected+1} de {options.length}</strong></div>
    {options.length>1&&<nav className="route-option-switcher" aria-label="Comparar opciones de viaje">{options.map((o,i)=><button key={o.id} type="button" aria-pressed={selected===i} onClick={()=>selectCard(i)}><strong>{o.minutes} min</strong><span>{o.legs.filter(l=>l.kind==='bus').map(l=>l.route?.name).join(' + ')||'A pie'}</span></button>)}</nav>}
    <div ref={carousel} onScroll={followCards} onPointerDown={e=>{if(showAll)return;if((e.target as HTMLElement).closest('a,button,summary,.journey-details')){moved.current=false;return;}if(e.pointerType!=='mouse')return;drag.current={x:e.clientX,scroll:e.currentTarget.scrollLeft};moved.current=false;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const delta=e.clientX-drag.current.x;if(Math.abs(delta)>5){moved.current=true;e.currentTarget.scrollLeft=drag.current.scroll-delta}}} onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(moved.current)selectCard(selected)}} onPointerCancel={()=>{drag.current=null}} onClickCapture={e=>{if(moved.current){e.preventDefault();e.stopPropagation();moved.current=false}}} className={'route-carousel '+(showAll?'route-list-view':'')}>{options.map((o,index)=><article key={o.id} className={'route-slide '+(selected===index?'active':'')}><RouteChoiceCard option={o} stops={stops} ads={ads} label={optionLabel(o,index,options)} selected={selected===index} starting={starting} onSelect={()=>selectCard(index)} onStart={()=>void startTrip(index)} origin={origin} destination={destination} originName={originLabel} destinationName={query}/></article>)}</div>
    <div className="carousel-dots">{options.map((o,i)=><button key={o.id} aria-label={`Ver opción ${i+1}`} aria-pressed={i===selected} onClick={()=>selectCard(i)}/>)}</div><small className="trip-estimate">Tiempo, espera, tarifa y caminata estimados; no son datos en tiempo real.</small></>}
   {!busy&&!options.length&&!message&&<div className="trip-status">{destination?(originStatus==='confirmed'?'Destino listo. Busca tus opciones de viaje.':'Destino listo. Confirma el origen para continuar.'):'Elige a dónde quieres ir.'}<button type="button" className="search" onClick={()=>destination?plan():beginPicker('destination')}>{destination?'Buscar cómo llegar →':'Elegir destino en mapa →'}</button></div>}
   </>}
  </MapSheet>
 </main>;
 return <>{recoverable&&<JourneyRecovery session={recoverable} onResume={resumeJourney} onDiscard={()=>{clearJourney();setRecoverable(undefined)}}/>}<HomeScreen query={query} ready={!!destination} stops={suggestions.slice(0,Math.max(0,8-placeSuggestions.length))} places={placeSuggestions} message={message} dataNotice={stopNotice} savedPlaces={savedPlaces} onOpenAccount={onOpenAccount} onChooseSaved={place=>{choose(place.point,place.label);void calculate(place.point)}} onQuery={value=>{request.current++;setQuery(value);setDestination(undefined);setChosenPlace(undefined);setOptions([]);setMessage('')}} onChoose={stop=>{choose(stop.coordinates,stop.name);void calculate(stop.coordinates);}} onChoosePlace={place=>{choose(place.coordinates,place.name,place);void calculate(place.access??place.coordinates);}} onSearch={plan} onMap={()=>beginPicker('destination')}/></>;
}
