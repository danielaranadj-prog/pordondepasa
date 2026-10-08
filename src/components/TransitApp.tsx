import { useEffect, useMemo, useRef, useState } from 'react';
import { routeTextColor, type Option, type Point } from '../lib/router';
import {planRoutes} from '../lib/workerClient';
import StreetMap from './StreetMap';
import JourneySteps from './JourneySteps';
import UberAlternative from './UberAlternative';
import '../styles/map.css';
import FollowRoute from './FollowRoute';
import MapSheet from './MapSheet';
import HomeScreen from './HomeScreen';
import {requestCompass} from './useCompass';
import type {TransitStop as Stop} from '../lib/navigation';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function TransitApp(){
 const [welcomeReady,setWelcomeReady]=useState(false);
 const [compassStart,setCompassStart]=useState({enabled:false,issue:''}),[starting,setStarting]=useState(false);
 async function startTrip(index:number){
  if(starting)return;
  setStarting(true);
  // Request within the user's button gesture, before mounting navigation.
  const result=await requestCompass();
  setCompassStart(result);setSelected(index);setView('follow');setStarting(false);
 }
 const [welcome,setWelcome]=useState(true),[view,setView]=useState<'search'|'trip'|'follow'>('search');
 const [pickDestination,setPickDestination]=useState(false);
 const showAll=false;
 const drag=useRef<{x:number;scroll:number}|null>(null),moved=useRef(false);
 const locationRequest=useRef<Promise<Point|null>|null>(null),originConfirmed=useRef(false),manualOrigin=useRef(false),originValue=useRef<Point>({lat:21.5055,lng:-104.893});
 const carousel=useRef<HTMLDivElement>(null),request=useRef(0);
 useEffect(()=>{try{setWelcome(localStorage.getItem('pordondepasa.welcome.v2')!=='seen')}catch{}setWelcomeReady(true)},[]);
 useEffect(()=>{if(!welcome||!welcomeReady)return;const timer=setTimeout(()=>{try{localStorage.setItem('pordondepasa.welcome.v2','seen')}catch{}setWelcome(false)},2500);return()=>clearTimeout(timer)},[welcome,welcomeReady]);
 function followCards(){if(showAll)return;const list=carousel.current;if(!list)return;const middle=list.scrollLeft+list.clientWidth/2;let nearest=0,distance=Infinity;
 Array.from(list.children).forEach((node,i)=>{const card=node as HTMLElement;const d=Math.abs(card.offsetLeft+card.offsetWidth/2-middle);if(d<distance){distance=d;nearest=i}});setSelected(nearest)}
 function selectCard(i:number){setSelected(i);if(showAll)return;const list=carousel.current,card=list?.children[i] as HTMLElement|undefined;if(list&&card)list.scrollTo({left:card.offsetLeft-list.clientWidth/2+card.offsetWidth/2,behavior:'smooth'})}
 const [origin,setOrigin]=useState<Point>({lat:21.5055,lng:-104.893}),[originLabel,setOriginLabel]=useState('Buscando tu ubicación…');
 const [destination,setDestination]=useState<Point>(),[query,setQuery]=useState(''),[stops,setStops]=useState<Stop[]>([]);
 const [options,setOptions]=useState<Option[]>([]),[selected,setSelected]=useState(0),[busy,setBusy]=useState(false),[pickOrigin,setPickOrigin]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;Promise.all(['general','insurgentes','mexico'].map(async name=>{const r=await fetch(`${import.meta.env.BASE_URL}data/stops/${name}-stops.json`);if(!r.ok)throw new Error();const d=await r.json();return (d.stops??[]).map((s:Stop)=>({...s,source:name}))})).then(lists=>{if(active)setStops(lists.flat())}).catch(()=>{if(active)setMessage('No se pudieron cargar las sugerencias. Puedes usar el mapa.')});return()=>{active=false}},[]);
 const suggestions=useMemo(()=>{if(destination||query.trim().length<2)return [];const term=normalize(query.trim());const seen=new Set<string>();return stops.filter(s=>{if(!normalize(s.name).includes(term)||seen.has(s.name))return false;seen.add(s.name);return true}).slice(0,8)},[query,stops,destination]);
 function choose(point:Point,name:string){request.current++;setDestination(point);setQuery(name);setOptions([]);setMessage('');setBusy(false);}
 function locate(retry=false):Promise<Point|null>{
  if(retry){locationRequest.current=null;manualOrigin.current=false;setOriginLabel('Buscando tu ubicación…');}
  if(locationRequest.current)return locationRequest.current;
  locationRequest.current=new Promise(resolve=>{
   if(!navigator.geolocation){if(!manualOrigin.current)setOriginLabel('Selecciona tu origen');resolve(null);return;}
   navigator.geolocation.getCurrentPosition(p=>{
    const point={lat:p.coords.latitude,lng:p.coords.longitude};
    if(!manualOrigin.current){originValue.current=point;originConfirmed.current=true;setOrigin(point);setOriginLabel('Mi ubicación actual');}
    resolve(point);
   },()=>{if(!manualOrigin.current)setOriginLabel('Selecciona tu origen');resolve(null);},{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
  });
  return locationRequest.current;
 }
 useEffect(()=>{if(!welcome)void locate();},[welcome]);
 async function calculate(target:Point){const id=++request.current;setView('trip');setBusy(true);setMessage('');setOptions([]);
  try{
   if(!originConfirmed.current)await locate();
   if(id!==request.current)return;
   if(!originConfirmed.current){setPickOrigin(true);setMessage('No pudimos obtener tu ubicación. Toca el mapa para elegir tu punto de partida.');return;}
   setPickOrigin(false);
   const next=await planRoutes(originValue.current,target);if(id!==request.current)return;setOptions(next);setSelected(0);if(!next.length)setMessage('No encontramos un recorrido conectado por calles con los datos actuales. Prueba un punto cercano sobre una calle pública.');
  }catch{if(id===request.current)setMessage('No se pudieron cargar las rutas. Intenta de nuevo.');}
  finally{if(id===request.current)setBusy(false)}
 }
 function plan(){if(destination)void calculate(destination)}
 function moveDestination(point:Point){choose(point,'Destino ajustado en el mapa');setPickDestination(false);void calculate(point);}
 function back(){request.current++;setBusy(false);setMessage('');setView('search');setPickOrigin(false);setPickDestination(false)}
 if(view==='follow'&&options[selected]&&destination)return <FollowRoute option={options[selected]} stops={stops} origin={origin} destination={destination} destinationName={query} compassStart={compassStart} onExit={()=>setView('trip')}/>;
 if(welcome)return <main className="welcome-screen"><div className="welcome-brand"><svg viewBox="0 0 80 80" aria-hidden="true"><path d="M20 60V26a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v34M20 40h40M28 53h1m22 0h1M28 62v4m24-4v4" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><path d="M34 10h12" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg><h1>PorDóndePasa</h1><p>Muévete por Tepic.</p><span>Tu destino. Tu ruta. Tu ciudad.</span></div><div className="welcome-action"><div className="welcome-progress" aria-hidden="true"><span/></div><small>Tepic · Xalisco</small></div></main>;
 if(view==='trip')return <main className="trip-screen">
  <StreetMap fullscreen origin={origin} destination={destination} option={options[selected]} onDestinationChange={!pickOrigin?moveDestination:undefined} onPick={pickOrigin?point=>{request.current++;manualOrigin.current=true;originConfirmed.current=true;originValue.current=point;setOrigin(point);setOriginLabel('Origen seleccionado');setPickOrigin(false);setOptions([]);setBusy(false);setMessage('');if(destination)void calculate(destination);}:pickDestination||(!options.length&&!busy)?moveDestination:undefined}/>
  <section className="trip-top map-top-minimal"><button className="back-button" onClick={back} aria-label="Volver al buscador">←</button></section>
  {pickDestination&&<p className="map-hint">Toca el nuevo destino o arrastra el marcador naranja.</p>}
  {pickOrigin&&<p className="map-hint">Toca el mapa para fijar tu origen.</p>}
  <MapSheet className="trip-bottom" title="Cómo llegar">
   <div className="sheet-endpoints compact-endpoints"><div className="trip-endpoints"><button className="endpoint-edit" aria-label="Cambiar origen" aria-pressed={pickOrigin} onClick={()=>{setPickOrigin(!pickOrigin);setPickDestination(false)}}><span className="origin-dot"/><small>Origen</small><strong>{pickOrigin?'Toca el mapa para moverlo':originLabel}</strong><span className="endpoint-pencil" aria-hidden="true">⌁</span></button><button className="endpoint-edit" aria-label="Cambiar destino" aria-pressed={pickDestination} onClick={()=>{setPickDestination(!pickDestination);setPickOrigin(false)}}><span className="destination-dot"/><small>Destino</small><strong>{pickDestination?'Toca el mapa para moverlo':query}</strong><span className="endpoint-pencil" aria-hidden="true">⌁</span></button></div></div>
   {busy&&<div className="trip-status" role="status"><span className="loading-dot"/>Buscando tu ruta…</div>}
   {message&&<div className="trip-status" role="status">{message}<button className="text-button" onClick={plan}>Buscar de nuevo</button></div>}
{!!options.length&&<><div className="carousel-heading"><strong>{selected+1} de {options.length} opciones</strong></div><div ref={carousel} onScroll={followCards} onPointerDown={e=>{if(showAll)return;if((e.target as HTMLElement).closest('a,button,summary')){moved.current=false;return;}if(e.pointerType!=='mouse')return;drag.current={x:e.clientX,scroll:e.currentTarget.scrollLeft};moved.current=false;e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{if(!drag.current)return;const delta=e.clientX-drag.current.x;if(Math.abs(delta)>5){moved.current=true;e.currentTarget.scrollLeft=drag.current.scroll-delta}}} onPointerUp={e=>{drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(moved.current)selectCard(selected)}} onPointerCancel={()=>{drag.current=null}} onClickCapture={e=>{if(moved.current){e.preventDefault();e.stopPropagation();moved.current=false}}} className={'route-carousel '+(showAll?'route-list-view':'')}>{options.map((o,index)=><article key={o.id} className={'route-slide '+(selected===index?'active':'')}><button className="option-select" onClick={()=>selectCard(index)} aria-pressed={selected===index}><div className="time"><strong>{o.minutes} min</strong><small>{index===0?'Mejor equilibrio':'Alternativa'}</small></div><div className="legs">{o.legs.map((leg,i)=><span key={i} className={leg.kind} style={leg.kind==='bus'?{backgroundColor:leg.route?.color,color:routeTextColor(leg.route?.color??'#0a9364')}:undefined}>{leg.kind==='walk'?`🚶 ${leg.minutes} min`:`Ruta ${leg.route?.name}`}</span>)}</div><div className="route-metrics"><div><small>Total aprox.</small><strong>${o.fare}<span> MXN</span></strong></div><div><small>A pie</small><strong>{o.walk}<span> min</span></strong></div><div><small>Transbordos</small><strong>{o.transfers===0?'Sin cambios':o.transfers}</strong></div></div></button><details className="journey-details"><summary>Dónde subir y bajar <span aria-hidden="true">⌄</span></summary><JourneySteps option={o} stops={stops}/></details><button className="start-follow card-primary" disabled={starting} onClick={()=>void startTrip(index)}>{o.legs.some(l=>l.kind==='bus')?'Elegir este viaje →':'Ver pasos para caminar →'}</button>{destination&&<UberAlternative origin={origin} destination={destination} originName={originLabel} destinationName={query}/>}</article>)}</div><div className="carousel-dots">{options.map((o,i)=><button key={o.id} aria-label={`Ver opción ${i+1}`} aria-pressed={i===selected} onClick={()=>selectCard(i)}/>)}</div><small className="trip-estimate">Tiempo, espera, tarifa y caminata estimados; no son datos en tiempo real.</small></>}
   {!busy&&!options.length&&!message&&<div className="trip-status">Elige un punto en el mapa.<button className="search" disabled={!destination} onClick={plan}>Buscar cómo llegar →</button></div>}
  </MapSheet>
 </main>;
 return <HomeScreen query={query} ready={!!destination} stops={suggestions} message={message} onQuery={value=>{request.current++;setQuery(value);setDestination(undefined);setOptions([]);setMessage('')}} onChoose={stop=>choose(stop.coordinates,stop.name)} onSearch={plan} onMap={()=>{setView('trip');setPickOrigin(false)}}/>;
}
