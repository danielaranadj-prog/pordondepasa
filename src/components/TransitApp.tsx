import { useEffect, useMemo, useRef, useState } from 'react';
import { routeTextColor, type Option, type Point } from '../lib/router';
import {planRoutes,RoutePlanError} from '../lib/workerClient';
import StreetMap from './StreetMap';
import JourneySteps from './JourneySteps';
import UberAlternative from './UberAlternative';
import '../styles/map.css';
import FollowRoute from './FollowRoute';
import MapSheet from './MapSheet';
import HomeScreen from './HomeScreen';
import AnimatedTagline from './AnimatedTagline';
import {requestCompass} from './useCompass';
import type {TransitStop as Stop} from '../lib/navigation';
import {searchPlaces,type Place} from '../lib/places';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function TransitApp(){
 const [compassStart,setCompassStart]=useState({enabled:false,issue:''}),[starting,setStarting]=useState(false);
 const [journeyProgress,setJourneyProgress]=useState<{optionId:string;step:number;arrived:boolean}|null>(null);
 async function startTrip(index:number){
  if(starting)return;
  setStarting(true);
  // Request within the user's button gesture, before mounting navigation.
  const result=await requestCompass();
  if(journeyProgress?.optionId!==options[index]?.id)setJourneyProgress(null);
  setCompassStart(result);setSelected(index);setView('follow');setStarting(false);
 }
 const [welcome,setWelcome]=useState(true),[view,setView]=useState<'search'|'trip'|'follow'>('search');
 const [pickDestination,setPickDestination]=useState(false);
 const [editing,setEditing]=useState<'origin'|'destination'|null>(null),[editQuery,setEditQuery]=useState(''),[editMessage,setEditMessage]=useState(''),[editLocating,setEditLocating]=useState(false);
 const editorRequest=useRef(0);
 const showAll=false;
 const drag=useRef<{x:number;scroll:number}|null>(null),moved=useRef(false);
 const locationRequest=useRef<Promise<Point|null>|null>(null),originConfirmed=useRef(false),manualOrigin=useRef(false),originValue=useRef<Point>({lat:21.5055,lng:-104.893});
 const carousel=useRef<HTMLDivElement>(null),request=useRef(0);
 useEffect(()=>{const timer=setTimeout(()=>setWelcome(false),2500);return()=>clearTimeout(timer)},[]);
 function followCards(){if(showAll)return;const list=carousel.current;if(!list)return;const middle=list.scrollLeft+list.clientWidth/2;let nearest=0,distance=Infinity;
 Array.from(list.children).forEach((node,i)=>{const card=node as HTMLElement;const d=Math.abs(card.offsetLeft+card.offsetWidth/2-middle);if(d<distance){distance=d;nearest=i}});setSelected(nearest)}
 function selectCard(i:number){setSelected(i);if(showAll)return;const list=carousel.current,card=list?.children[i] as HTMLElement|undefined;if(list&&card)list.scrollTo({left:card.offsetLeft-list.clientWidth/2+card.offsetWidth/2,behavior:'smooth'})}
 const [origin,setOrigin]=useState<Point>({lat:21.5055,lng:-104.893}),[originLabel,setOriginLabel]=useState('Buscando tu ubicación…');
 const [destination,setDestination]=useState<Point>(),[query,setQuery]=useState(''),[stops,setStops]=useState<Stop[]>([]),[places,setPlaces]=useState<Place[]>([]),[chosenPlace,setChosenPlace]=useState<Place|undefined>();
 const originAccess=useRef<Point|undefined>(undefined);
 const originPlace=useRef<Place|undefined>(undefined);
 const [options,setOptions]=useState<Option[]>([]),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[pickOrigin,setPickOrigin]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;Promise.all(['general','insurgentes','mexico'].map(async name=>{const r=await fetch(`${import.meta.env.BASE_URL}data/stops/${name}-stops.json`);if(!r.ok)throw new Error();const d=await r.json();return (d.stops??[]).map((s:Stop)=>({...s,source:name}))})).then(lists=>{if(active)setStops(lists.flat())}).catch(()=>{if(active)setMessage('No se pudieron cargar las sugerencias. Puedes usar el mapa.')});return()=>{active=false}},[]);
 useEffect(()=>{let active=true;fetch(`${import.meta.env.BASE_URL}data/places.json`).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{if(active&&Array.isArray(data.places))setPlaces(data.places)}).catch(()=>{});return()=>{active=false}},[]);
 const suggestions=useMemo(()=>{if(destination||query.trim().length<2)return [];const term=normalize(query.trim());const seen=new Set<string>();return stops.filter(s=>{if(!normalize(s.name).includes(term)||seen.has(s.name))return false;seen.add(s.name);return true}).slice(0,8)},[query,stops,destination]);
 const placeSuggestions=useMemo(()=>destination?[]:searchPlaces(places,query,8),[destination,places,query]);
 const editPlaces=useMemo(()=>searchPlaces(places,editQuery,6),[places,editQuery]);
 const editStops=useMemo(()=>{const term=normalize(editQuery.trim());if(term.length<2)return [];const seen=new Set<string>();return stops.filter(stop=>{if(!normalize(stop.name).includes(term)||seen.has(stop.name))return false;seen.add(stop.name);return true}).slice(0,Math.max(0,8-editPlaces.length))},[stops,editQuery,editPlaces.length]);
 function closeEditor(){editorRequest.current++;setEditing(null);setEditLocating(false)}
 function openEditor(target:'origin'|'destination'){editorRequest.current++;setEditing(target);setEditQuery('');setEditMessage('');setPickOrigin(false);setPickDestination(false)}
 function selectEdited(point:Point,name:string,place?:Place){
  editorRequest.current++;
  if(editing==='origin'){
   request.current++;manualOrigin.current=true;originConfirmed.current=true;originValue.current=point;originAccess.current=place?.access;originPlace.current=place;
   setOrigin(point);setOriginLabel(name);closeEditor();setOptions([]);setMessage('');
   if(destination)void calculate(chosenPlace?.access??destination);
  }else if(editing==='destination'){
   choose(point,name,place);closeEditor();void calculate(place?.access??point);
  }
 }
 function useCurrentOrigin(){
  if(editLocating)return;
  if(!navigator.geolocation){setEditMessage('Este navegador no ofrece ubicación. Elige un lugar o usa el mapa.');return}
  const attempt=++editorRequest.current;setEditLocating(true);setEditMessage('');
  navigator.geolocation.getCurrentPosition(position=>{
   if(attempt!==editorRequest.current)return;
   setEditLocating(false);selectEdited({lat:position.coords.latitude,lng:position.coords.longitude},'Mi ubicación actual');
  },()=>{if(attempt!==editorRequest.current)return;setEditLocating(false);setEditMessage('No pudimos obtener tu ubicación. Elige un lugar o usa el mapa.')},{enableHighAccuracy:true,timeout:10000,maximumAge:30000});
 }
 function choose(point:Point,name:string,place?:Place){request.current++;setDestination(point);setChosenPlace(place);setQuery(name);setOptions([]);setJourneyProgress(null);setMessage('');setBusy(false);}
 function locate(retry=false):Promise<Point|null>{
  if(retry){locationRequest.current=null;manualOrigin.current=false;setOriginLabel('Buscando tu ubicación…');}
  if(locationRequest.current)return locationRequest.current;
  locationRequest.current=new Promise(resolve=>{
   if(!navigator.geolocation){if(!manualOrigin.current)setOriginLabel('Selecciona tu origen');resolve(null);return;}
   navigator.geolocation.getCurrentPosition(p=>{
    const point={lat:p.coords.latitude,lng:p.coords.longitude};
    if(!manualOrigin.current){originValue.current=point;originAccess.current=undefined;originPlace.current=undefined;originConfirmed.current=true;setOrigin(point);setOriginLabel('Mi ubicación actual');}
    resolve(point);
   },()=>{if(!manualOrigin.current)setOriginLabel('Selecciona tu origen');resolve(null);},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  });
  return locationRequest.current;
 }
 useEffect(()=>{if(!welcome)void locate();},[welcome]);
 async function calculate(target:Point){const id=++request.current;setView('trip');setBusy(true);setMessage('');setOptions([]);setJourneyProgress(null);
  try{
   if(!originConfirmed.current)await locate();
   if(id!==request.current)return;
   if(!originConfirmed.current){setPickOrigin(true);setMessage('No pudimos obtener tu ubicación. Toca el mapa para elegir tu punto de partida.');return;}
   setPickOrigin(false);
   const next=await planRoutes(originAccess.current??originValue.current,target);if(id!==request.current)return;setOptions(next);setSelected(0);if(!next.length)setMessage('No encontramos un recorrido conectado por calles con los datos actuales. Prueba un punto cercano sobre una calle pública.');
  }catch(error){if(id===request.current){
   if(error instanceof RoutePlanError){setPickOrigin(error.issue==='origin_off_street');setPickDestination(error.issue==='destination_off_street');setMessage(error.message)}
   else setMessage('No se pudieron cargar las rutas. Intenta de nuevo.');
  }}
  finally{if(id===request.current)setBusy(false)}
 }
 function plan(){if(destination)void calculate(chosenPlace?.access??destination)}
 function moveDestination(point:Point){choose(point,'Destino ajustado en el mapa');setPickDestination(false);void calculate(point);}
 function swapEndpoints(){
  if(!destination||!originConfirmed.current)return;
  const previousOrigin=originValue.current,previousDestination=destination,previousOriginPlace=originPlace.current;
  const previousOriginLabel=originLabel==='Mi ubicación actual'?'Ubicación inicial':originLabel;
  request.current++;manualOrigin.current=true;originConfirmed.current=true;originValue.current=previousDestination;originAccess.current=chosenPlace?.access;originPlace.current=chosenPlace;setChosenPlace(previousOriginPlace);
  setOrigin(previousDestination);setOriginLabel(query||'Origen seleccionado');
  setDestination(previousOrigin);setQuery(previousOriginLabel);
  setPickOrigin(false);setPickDestination(false);setOptions([]);setSelected(0);setMessage('');
  void calculate(previousOriginPlace?.access??previousOrigin);
 }
 function back(){request.current++;setBusy(false);setMessage('');setView('search');closeEditor();setPickOrigin(false);setPickDestination(false)}
 if(view==='follow'&&options[selected]&&destination)return <FollowRoute option={options[selected]} stops={stops} origin={origin} destination={destination} destinationName={query} placeAccess={chosenPlace?{meters:chosenPlace.accessMeters,entrance:chosenPlace.entrance}:undefined} compassStart={compassStart} initialStep={journeyProgress?.optionId===options[selected].id?journeyProgress.step:0} initialArrived={journeyProgress?.optionId===options[selected].id?journeyProgress.arrived:false} onProgress={(step,arrived)=>setJourneyProgress({optionId:options[selected].id,step,arrived})} onExit={()=>setView('trip')}/>;
 if(welcome)return <main className="welcome-screen"><div className="welcome-brand"><svg viewBox="0 0 80 80" aria-hidden="true"><path d="M20 60V26a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v34M20 40h40M28 53h1m22 0h1M28 62v4m24-4v4" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><path d="M34 10h12" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg><h1>PorDóndePasa</h1><p>Muévete por Tepic.</p><AnimatedTagline/></div><div className="welcome-action"><div className="welcome-progress" aria-hidden="true"><span/></div><small>Tepic · Xalisco</small></div></main>;
 if(view==='trip')return <main className="trip-screen">
  <StreetMap fullscreen origin={origin} destination={destination} access={chosenPlace?.access} option={options[selected]} onDestinationChange={!pickOrigin?moveDestination:undefined} onPick={pickOrigin?point=>{request.current++;manualOrigin.current=true;originConfirmed.current=true;originValue.current=point;originAccess.current=undefined;originPlace.current=undefined;setOrigin(point);setOriginLabel('Origen seleccionado');setPickOrigin(false);setOptions([]);setBusy(false);setMessage('');if(destination)void calculate(chosenPlace?.access??destination);}:pickDestination||(!options.length&&!busy)?moveDestination:undefined}/>
  <section className="trip-top map-top-minimal"><button className="back-button" onClick={back} aria-label="Volver al buscador">←</button></section>
  {pickDestination&&<p className="map-hint">Toca una calle para mover el destino.</p>}
  {pickOrigin&&<p className="map-hint">Toca una calle para fijar tu origen.</p>}
  {!destination&&!pickOrigin&&!pickDestination&&<p className="map-hint">Toca una calle para ubicar tu destino.</p>}
  <MapSheet className="trip-bottom" title="Cómo llegar">
   <div className="sheet-endpoints compact-endpoints"><div className="trip-endpoints"><button className="endpoint-edit" aria-label="Cambiar origen" onClick={()=>openEditor('origin')}><span className="origin-dot"/><small>Origen</small><strong>{pickOrigin?'Toca el mapa para moverlo':originLabel}</strong></button><button className="endpoint-edit" aria-label="Cambiar destino" onClick={()=>openEditor('destination')}><span className="destination-dot"/><small>Destino</small><strong>{pickDestination?'Toca el mapa para moverlo':query||'Seleccionar destino'}</strong></button><button className="swap-endpoints" aria-label="Invertir origen y destino" title="Invertir origen y destino" disabled={!destination||!originConfirmed.current} onClick={swapEndpoints}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 20V4m0 0L4 7m3-3 3 3M17 4v16m0 0 3-3m-3 3-3-3"/></svg></button></div></div>
   {busy&&<div className="trip-status" role="status"><span className="loading-dot"/>Buscando tu ruta…</div>}
   {message&&<div className="trip-status" role="status">{message}<button className="text-button" onClick={plan}>Buscar de nuevo</button></div>}
   {chosenPlace&&<p className="place-access-note">La ruta termina en la calle más cercana. Acceso estimado a {chosenPlace.name}{chosenPlace.accessMeters>20?` (${chosenPlace.accessMeters} m del lugar)`:''}; verifica la entrada y cruces.</p>}
   {originPlace.current&&<p className="place-access-note">La ruta empieza en una calle cercana a {originPlace.current.name}. Acceso estimado; verifica la salida y cruces.</p>}
   {!!options.length&&<><div className="carousel-heading"><strong>{selected+1} de {options.length} opciones</strong></div><div ref={carousel} onScroll={followCards} onPointerDown={e=>{if(showAll)return;if((e.target as HTMLElement).closest('a,button,summary')){moved.current=false;return;}if(e.pointerType!=='mouse')return;drag.current={x:e.clientX,scroll:e.currentTarget.scrollLeft};moved.current=false;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const delta=e.clientX-drag.current.x;if(Math.abs(delta)>5){moved.current=true;e.currentTarget.scrollLeft=drag.current.scroll-delta}}} onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(moved.current)selectCard(selected)}} onPointerCancel={()=>{drag.current=null}} onClickCapture={e=>{if(moved.current){e.preventDefault();e.stopPropagation();moved.current=false}}} className={'route-carousel '+(showAll?'route-list-view':'')}>{options.map((o,index)=><article key={o.id} className={'route-slide '+(selected===index?'active':'')}><button className="option-select" onClick={()=>selectCard(index)} aria-pressed={selected===index}><div className="time"><strong>{o.minutes} min</strong><small>{index===0?'Mejor equilibrio':'Alternativa'}</small></div><div className="legs">{o.legs.map((leg,i)=><span key={i} className={leg.kind} style={leg.kind==='bus'?{backgroundColor:leg.route?.color,color:routeTextColor(leg.route?.color??'#0a9364')}:undefined}>{leg.kind==='walk'?`🚶 ${leg.minutes?`${leg.minutes} min`:'Muy cerca'}`:`Ruta ${leg.route?.name}`}</span>)}</div><div className="route-metrics"><div><small>Total aprox.</small><strong>${o.fare}<span> MXN</span></strong></div><div><small>A pie</small><strong>{o.walk}<span> min</span></strong></div><div><small>Transbordos</small><strong>{o.transfers===0?'Sin cambios':o.transfers}</strong></div></div></button><details className="journey-details"><summary>Dónde subir y bajar <span aria-hidden="true">⌄</span></summary><JourneySteps option={o} stops={stops}/></details><button className="start-follow card-primary" disabled={starting} onClick={()=>void startTrip(index)}>{o.legs.some(l=>l.kind==='bus')?'Elegir este viaje →':'Ver pasos para caminar →'}</button>{destination&&<UberAlternative origin={origin} destination={destination} originName={originLabel} destinationName={query}/>}</article>)}</div><div className="carousel-dots">{options.map((o,i)=><button key={o.id} aria-label={`Ver opción ${i+1}`} aria-pressed={i===selected} onClick={()=>selectCard(i)}/>)}</div><small className="trip-estimate">Tiempo, espera, tarifa y caminata estimados; no son datos en tiempo real.</small></>}
   {!busy&&!options.length&&!message&&<div className="trip-status">Elige un punto en el mapa.<button className="search" disabled={!destination} onClick={plan}>Buscar cómo llegar →</button></div>}
  </MapSheet>
  {editing&&<div className="endpoint-editor-backdrop" onClick={closeEditor}><section className="endpoint-editor" role="dialog" aria-modal="true" aria-label={editing==='origin'?'Elegir origen':'Elegir destino'} onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape')closeEditor()}}><header><div><small>{editing==='origin'?'ORIGEN':'DESTINO'}</small><h2>{editing==='origin'?'¿Desde dónde sales?':'¿A dónde vas?'}</h2></div><button type="button" aria-label="Cerrar búsqueda" onClick={closeEditor}>✕</button></header><input autoFocus aria-label={editing==='origin'?'Buscar origen':'Buscar destino'} placeholder="Escribe un lugar o una parada" autoComplete="off" value={editQuery} onChange={event=>{setEditQuery(event.target.value);setEditMessage('')}}/><div className="endpoint-editor-results">{editing==='origin'&&<button type="button" disabled={editLocating} onClick={useCurrentOrigin}><strong>⌖ Mi ubicación actual</strong><small>{editLocating?'Buscando ubicación…':'Usar GPS del teléfono'}</small></button>}{editPlaces.map(place=><button type="button" key={`place:${place.id}`} onClick={()=>selectEdited(place.coordinates,place.name,place)}><strong>{place.name}</strong><small>{place.neighborhood||place.municipality||'Lugar'}{place.status!=='verificado'?' · Por verificar':''}</small></button>)}{editStops.map(stop=><button type="button" key={`stop:${stop.id}`} onClick={()=>selectEdited(stop.coordinates,stop.name)}><strong>{stop.name}</strong><small>Parada · Tepic y Xalisco</small></button>)}{editQuery.trim().length>=2&&!editPlaces.length&&!editStops.length&&<p>No encontramos ese lugar. Puedes colocarlo en el mapa.</p>}</div>{editMessage&&<p className="endpoint-editor-message" role="status">{editMessage}</p>}<button type="button" className="endpoint-map-choice" onClick={()=>{setPickOrigin(editing==='origin');setPickDestination(editing==='destination');closeEditor()}}>⌖ Elegir {editing==='origin'?'origen':'destino'} en el mapa</button></section></div>}
 </main>;
 return <HomeScreen query={query} ready={!!destination} stops={suggestions.slice(0,Math.max(0,8-placeSuggestions.length))} places={placeSuggestions} message={message} onQuery={value=>{request.current++;setQuery(value);setDestination(undefined);setChosenPlace(undefined);setOptions([]);setMessage('')}} onChoose={stop=>choose(stop.coordinates,stop.name)} onChoosePlace={place=>choose(place.coordinates,place.name,place)} onSearch={plan} onMap={()=>{setView('trip');setPickOrigin(false)}}/>;
}
