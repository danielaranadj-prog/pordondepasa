import ServiceHoursNotice from './ServiceHoursNotice';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {TransitStop} from '../lib/navigation';
import type {Point} from '../lib/router';
import {type Place,getPlaceCategoryLabel} from '../lib/places';
import UiIcon from './UiIcon';
import PassengerSettings from './PassengerSettings';
import '../styles/passenger-settings.css';
import StreetMap from './StreetMap';
import {TEPIC_MAP_CENTER} from '../lib/mapSelection';
import {homeKeyboardViewport} from '../lib/homeKeyboardViewport';
import {loadTransitShapes} from '../lib/transitShapes';
import {routePreview,type RoutePreview} from '../lib/routeExplorer';
import type {Shape} from '../lib/router';
import '../styles/home.css';
import '../styles/blue-glass.css';
// Presentation contract: optional saved destinations do not depend on an auth provider.
export type HomeSavedPlace={kind:string;label:string;point:Point};
type SavedPlace=HomeSavedPlace;
type Props={serviceNow:number;query:string;ready:boolean;stops:TransitStop[];places:Place[];message:string;dataNotice?:ReactNode;onQuery:(value:string)=>void;onChoose:(stop:TransitStop)=>void;onChoosePlace:(place:Place)=>void;onSearch:()=>void;onMap:()=>void;savedPlaces?:SavedPlace[];onChooseSaved?:(place:SavedPlace)=>void;onOpenAccount?:()=>void};
type CatalogRoute={id:string;name:string;color:string;groupName?:string};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function HomeScreen({serviceNow,query,ready,stops,places,message,dataNotice,onQuery,onChoose,onChoosePlace,onSearch,onMap,savedPlaces=[],onChooseSaved,onOpenAccount}:Props){
 const [catalogOpen,setCatalogOpen]=useState(false),[catalogQuery,setCatalogQuery]=useState(''),[catalog,setCatalog]=useState<CatalogRoute[]|null>(null),[catalogIssue,setCatalogIssue]=useState(''),[retry,setRetry]=useState(0);
 const [selectedRoute,setSelectedRoute]=useState<CatalogRoute|null>(null),[preview,setPreview]=useState<RoutePreview>(),[previewIssue,setPreviewIssue]=useState(''),[previewRetry,setPreviewRetry]=useState(0),[cameraRequest,setCameraRequest]=useState(0);
 const shapes=useRef<Shape[]|null>(null);
 const root=useRef<HTMLElement>(null),dialog=useRef<HTMLDialogElement>(null),filter=useRef<HTMLInputElement>(null),search=useRef<HTMLInputElement>(null),lastFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const viewport=window.visualViewport;
  let frame=0,baseline=window.innerHeight;
  const update=()=>{
   frame=0;const element=root.current;if(!element)return;
   const focused=!!search.current?.closest('form')?.contains(document.activeElement);
   if(!focused)baseline=window.innerHeight;
   const state=homeKeyboardViewport({layoutHeight:window.innerHeight,baselineHeight:baseline,visualHeight:viewport?.height??window.innerHeight,offsetTop:viewport?.offsetTop??0,scale:viewport?.scale??1,focused});
   element.style.setProperty('--home-visible-bottom',`${state.bottom}px`);
   element.style.setProperty('--home-visible-height',`${state.height}px`);
   element.setAttribute('data-keyboard-open',String(state.keyboard));
   element.setAttribute('data-searching',String(focused));
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
  update();viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);window.addEventListener('resize',schedule);document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);
  return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);document.removeEventListener('focusin',schedule);document.removeEventListener('focusout',schedule)};
 },[]);
 const [mapMounted,setMapMounted]=useState(false);
 useEffect(()=>{
  // Keep the search usable immediately; hydrate the real map when the browser is idle.
  if('requestIdleCallback' in window){const id=window.requestIdleCallback(()=>setMapMounted(true),{timeout:1200});return()=>window.cancelIdleCallback(id)}
  const timer=setTimeout(()=>setMapMounted(true),120);return()=>clearTimeout(timer);
 },[]);
 const hasSuggestions=places.length+stops.length>0;
 function openCatalog(value=''){lastFocus.current=document.activeElement as HTMLElement;setCatalogQuery(value);setCatalogOpen(true)}
 function selectRoute(route:CatalogRoute){setPreview(undefined);setPreviewIssue('');setSelectedRoute(route);setCatalogOpen(false)}
 function closePreview(){setSelectedRoute(null);setPreview(undefined);setPreviewIssue('')}
 useEffect(()=>{
  if(!selectedRoute)return;let active=true;setPreviewIssue('');
  void (shapes.current?Promise.resolve(shapes.current):loadTransitShapes()).then(data=>{
   if(!active)return;shapes.current=data;
   const result=routePreview(data,selectedRoute.id);if(!result)throw new Error('Sin trazo');setPreview(result);
  }).catch(()=>{if(active)setPreviewIssue('No pudimos cargar este recorrido. Revisa tu conexión y vuelve a intentar.')});
  return()=>{active=false};
 },[selectedRoute,previewRetry]);
 useEffect(()=>{if(catalogOpen){dialog.current?.showModal();filter.current?.focus()}else{dialog.current?.close();lastFocus.current?.focus()}},[catalogOpen]);
 useEffect(()=>{if(!catalogOpen||catalog)return;const controller=new AbortController();setCatalogIssue('');
  fetch(`${import.meta.env.BASE_URL}data/route-catalog.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{
   if(!Array.isArray(data.routes))throw new Error();
   setCatalog(data.routes.filter((r:CatalogRoute)=>r&&typeof r.id==='string'&&typeof r.name==='string').map(({id,name,color,groupName}:CatalogRoute)=>({id,name,color,groupName})));
  }).catch(()=>{if(!controller.signal.aborted)setCatalogIssue('No pudimos cargar las rutas. Revisa tu conexión e intenta de nuevo.')});
  return()=>controller.abort();
 },[catalogOpen,catalog,retry]);
 const filtered=(catalog??[]).filter(route=>normalize(route.name).includes(normalize(catalogQuery)));
 return <main ref={root} className="pdp-home pdp-blue-glass" data-screen="inicio">
  <div className="home-map-background">
   <img className="home-map-fallback" src={`${import.meta.env.BASE_URL}media/tepic-preview.svg`} alt="" width="360" height="160" decoding="async"/>
   {mapMounted&&<StreetMap origin={TEPIC_MAP_CENTER} routePreview={preview} cameraRequest={cameraRequest} hideOrigin fullscreen/>}
  </div>
  <header className="home-brand-row"><div><div className="home-wordmark"><span className="home-logo"><UiIcon name="route"/></span><strong>PorDóndePasa</strong></div><p className="home-city-label">TEPIC · XALISCO</p></div>{onOpenAccount&&<button type="button" className="home-profile" onClick={onOpenAccount} aria-label="Abrir mi cuenta"><UiIcon name="user"/></button>}</header>
  <div className="home-map-actions"><PassengerSettings/><button type="button" className="home-map-launch" onClick={onMap}><UiIcon name="pin"/>Elegir en mapa</button></div>
  <div className="home-content">
   {selectedRoute?<section className="home-route-preview" aria-label={`Recorrido de ${selectedRoute.name}`}>
    <header><span className="home-route-identity"><UiIcon name="bus" style={{color:selectedRoute.color}}/><h1>{selectedRoute.name}</h1></span><button type="button" className="home-profile" onClick={closePreview} aria-label="Cerrar recorrido"><UiIcon name="close"/></button></header>
    <ServiceHoursNotice now={serviceNow} route={selectedRoute}/>
    <p role="status">{previewIssue||(!preview?'Cargando recorrido…':preview.incomplete?'Recorrido registrado con tramos pendientes de verificar. Los espacios sin datos no se conectan.':'Recorrido completo registrado. Acerca el mapa para ver las calles por donde pasa.')}</p>
    <div className="home-route-preview-actions"><button type="button" onClick={()=>openCatalog()}>Ver otra ruta</button>{previewIssue?<button type="button" onClick={()=>setPreviewRetry(n=>n+1)}>Reintentar</button>:<button type="button" disabled={!preview} onClick={()=>setCameraRequest(n=>n+1)}><UiIcon name="route"/>Ver recorrido completo</button>}</div>
   </section>:<><section className="home-intro"><h1>Tu próxima ruta, a un toque.</h1><p>Tu ciudad. Tu camino.</p></section>
   <ServiceHoursNotice now={serviceNow}/>
   <form className="home-search" aria-label="Buscar destino" onSubmit={event=>{event.preventDefault();if(ready)onSearch()}}>
    <div className="home-search-row"><label className="home-field"><UiIcon name="search"/><input ref={search} type="search" aria-label="¿A dónde vamos?" placeholder="¿A dónde vamos?" value={query} autoComplete="off" onChange={event=>onQuery(event.target.value)}/></label>{ready&&<button className="home-submit" type="submit" aria-label="Buscar cómo llegar"><UiIcon name="arrow"/></button>}</div>
    {hasSuggestions&&<div className="home-suggestions" aria-label="Sugerencias de destino">{places.map(place=><button type="button" key={`place:${place.id}`} onClick={()=>onChoosePlace(place)}><span className="home-suggestion-icon"><UiIcon name="pin"/></span><span className="home-suggestion-text"><strong>{place.name}</strong><small>{place.neighborhood||place.municipality||getPlaceCategoryLabel(place.category)}{place.status!=='verificado'?' · Por verificar':''}</small></span><UiIcon name="up-right"/></button>)}{stops.map(stop=><button type="button" key={`stop:${stop.id}`} onClick={()=>onChoose(stop)}><span className="home-suggestion-icon"><UiIcon name="bus"/></span><span className="home-suggestion-text"><strong>{stop.name}</strong><small>Referencia · Tepic y Xalisco</small></span><UiIcon name="up-right"/></button>)}</div>}
    {!ready&&query.trim().length>=2&&!hasSuggestions&&<p className="home-message" role="status">Sin coincidencias. Puedes elegir el destino en el mapa.</p>}
    {message&&<p className="home-message" role="status">{message}</p>}
   </form>
   {dataNotice}
   {onOpenAccount&&<div className="home-private-shortcuts" aria-label="Mis destinos privados">{(['home','work'] as const).map(kind=>{const place=savedPlaces.find(item=>item.kind===kind);return <button type="button" key={kind} onClick={()=>place&&onChooseSaved?onChooseSaved(place):onOpenAccount()}><UiIcon name={kind==='home'?'home':'work'}/><span>{kind==='home'?'Casa':'Trabajo'}<small>{place?'Ir ahora':'Agregar'}</small></span></button>})}</div>}
   </>}
   <nav className="home-navigation" aria-label="Navegación principal"><button type="button" aria-current={!selectedRoute?'page':undefined} onClick={()=>{if(selectedRoute)closePreview();else search.current?.focus()}}><UiIcon name="home"/>Inicio</button><button type="button" aria-current={selectedRoute?'page':undefined} onClick={()=>openCatalog()}><UiIcon name="bus"/>Rutas</button>{onOpenAccount&&<><button type="button" onClick={onOpenAccount}><UiIcon name="bookmark"/>Guardados</button><button type="button" onClick={onOpenAccount}><UiIcon name="user"/>Cuenta</button></>}</nav>
  </div>
  <dialog ref={dialog} className="home-catalog" aria-labelledby="home-catalog-title" onCancel={event=>{event.preventDefault();setCatalogOpen(false)}}>
   <header><div><small>TEPIC · XALISCO</small><h2 id="home-catalog-title">Encuentra tu ruta</h2></div><button type="button" className="home-profile" onClick={()=>setCatalogOpen(false)} aria-label="Cerrar catálogo"><UiIcon name="close"/></button></header>
   <label className="home-field"><UiIcon name="search"/><input ref={filter} type="search" aria-label="Filtrar rutas por nombre" placeholder="Busca México, Río Suchiate…" value={catalogQuery} onChange={e=>setCatalogQuery(e.target.value)}/></label>
   <p className="home-catalog-hint">Toca una ruta para ver su recorrido en el mapa. Para buscar cómo llegar a un lugar, usa Planear un viaje.</p>
   <div className="home-catalog-list" aria-live="polite">{!catalog&&!catalogIssue&&<p>Cargando rutas…</p>}{catalogIssue&&<p role="status">{catalogIssue}<button type="button" onClick={()=>setRetry(n=>n+1)}>Intentar de nuevo</button></p>}{catalog&&filtered.length===0&&<p>No encontramos rutas con ese nombre.</p>}{filtered.map(route=><button type="button" className="home-catalog-route" key={route.id} aria-label={`Ver recorrido de ${route.name}`} aria-pressed={selectedRoute?.id===route.id} onClick={()=>selectRoute(route)}><span style={{color:route.color}}><UiIcon name="bus"/></span><span className="home-catalog-route-name"><strong>{route.name}</strong>{route.groupName&&<small>{route.groupName}</small>}</span><UiIcon name="up-right"/></button>)}</div>
   <button type="button" className="home-catalog-plan" onClick={()=>{setCatalogOpen(false);closePreview();onMap()}}>Planear un viaje<UiIcon name="arrow"/></button>
  </dialog>
 </main>;
}
