import {useEffect,useMemo,useRef,useState} from 'react';
import type {Point} from '../lib/router';
import {searchPlaces,getPlaceCategoryLabel,type Place} from '../lib/places';
import UiIcon from './UiIcon';
import type {TransitStop as Stop} from '../lib/navigation';
import type {Endpoint} from '../lib/mapSelection';

type Props={originLabel:string;destinationLabel:string;pickOrigin?:boolean;pickDestination?:boolean;compact?:boolean;places:Place[];stops:Stop[];onSelect:(point:Point,name:string,place?:Place,target?:Endpoint)=>void;onPickOnMap:(target:Endpoint)=>void;onUseCurrentOrigin?:()=>Promise<boolean>;editLocating?:boolean;locationMessage?:string;onSwap?:()=>void;canSwap?:boolean;onBack:()=>void};
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

export default function DynamicIsland({originLabel,destinationLabel,pickOrigin,pickDestination,compact,places,stops,onSelect,onPickOnMap,onUseCurrentOrigin,editLocating,locationMessage,onSwap,canSwap,onBack}:Props){
 const [collapsed,setCollapsed]=useState(false),[target,setTarget]=useState<Endpoint|null>(null),[query,setQuery]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 const filteredPlaces=useMemo(()=>target?searchPlaces(places,query,5):[],[target,places,query]);
 const filteredStops=useMemo(()=>{const term=normalize(query.trim());if(!target||term.length<2)return [];const seen=new Set<string>();return stops.filter(stop=>{if(!normalize(stop.name).includes(term)||seen.has(stop.name))return false;seen.add(stop.name);return true}).slice(0,Math.max(0,7-filteredPlaces.length))},[target,stops,query,filteredPlaces.length]);
 useEffect(()=>{
  if(target){dialog.current?.showModal();input.current?.focus();}
  else{dialog.current?.close();returnFocus.current?.focus();}
 },[target]);
 useEffect(()=>{if(pickOrigin||pickDestination)setCollapsed(false)},[pickOrigin,pickDestination]);
 useEffect(()=>{if(compact&&!pickOrigin&&!pickDestination)setCollapsed(true)},[compact,pickOrigin,pickDestination]);
 function open(next:Endpoint){returnFocus.current=document.activeElement as HTMLElement;setQuery('');setTarget(next);setCollapsed(false)}
 function close(){setTarget(null)}
 function select(point:Point,name:string,place?:Place){if(!target)return;onSelect(point,name,place,target);close()}
 return <>
  <header className={`dynamic-island dynamic-island--${collapsed?'compact':'twolines'}`}>
   <button type="button" className="di-back" onClick={onBack} aria-label="Volver al inicio"><UiIcon name="back"/></button>
   {collapsed?<button type="button" className="di-compact-label" onClick={()=>setCollapsed(false)} aria-label="Ver origen y destino"><span className="di-dot di-dot--destination" aria-hidden="true"/><strong>{destinationLabel||'Elige tu destino'}</strong><UiIcon name="chevron-down"/></button>:<>
    <div className="di-rows">
     <button type="button" className="di-row-btn" onClick={()=>open('origin')} aria-label="Cambiar origen"><span className="di-dot di-dot--origin" aria-hidden="true"/><span className="di-row-label"><span className="di-row-tag">Desde</span><strong className="di-row-value">{pickOrigin?'Ajustando origen en mapa':originLabel}</strong></span></button>
     <div className="di-row-divider"/>
     <button type="button" className="di-row-btn di-row-btn--dest" onClick={()=>open('destination')} aria-label="Cambiar destino"><span className="di-dot di-dot--destination" aria-hidden="true"/><span className="di-row-label"><span className="di-row-tag">Hasta</span><strong className="di-row-value di-row-value--dest">{pickDestination?'Ajustando destino en mapa':destinationLabel||'Elegir destino'}</strong></span></button>
    </div>
    <div className="di-controls">{canSwap&&onSwap&&<button type="button" className="di-ctrl-btn" onClick={onSwap} aria-label="Invertir origen y destino"><UiIcon name="swap"/></button>}<button type="button" className="di-ctrl-btn" onClick={()=>setCollapsed(true)} aria-label="Recoger origen y destino"><UiIcon name="chevron-up"/></button></div>
   </>}
  </header>
  <dialog ref={dialog} className="dynamic-island dynamic-island--search endpoint-search-dialog" aria-labelledby="endpoint-search-title" onCancel={event=>{event.preventDefault();close()}}>
   <div className="di-search-header"><h2 id="endpoint-search-title" className="di-search-title">{target==='origin'?'¿Desde dónde sales?':'¿A dónde vas?'}</h2><button type="button" className="di-close-btn" onClick={close} aria-label="Cerrar buscador"><UiIcon name="close"/></button></div>
   <div className="di-input-wrap"><input ref={input} type="search" className="di-search-input" aria-label={target==='origin'?'Buscar origen':'Buscar destino'} placeholder="Busca un lugar o referencia…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
   <div className="di-quick-actions">
    {target==='origin'&&onUseCurrentOrigin&&<button type="button" className="di-action-btn di-action-btn--gps" disabled={editLocating} onClick={async()=>{if(await onUseCurrentOrigin())close()}}><UiIcon name="locate"/>{editLocating?'Buscando GPS…':'Mi ubicación actual'}</button>}
    <button type="button" className="di-action-btn di-action-btn--map" onClick={()=>{if(target)onPickOnMap(target);close()}}><UiIcon name="pin"/>Elegir en el mapa</button>
   </div>
   {target==='origin'&&locationMessage&&<p className="di-location-message" role="status">{locationMessage}</p>}
   <div className="di-results-list" aria-label="Coincidencias">
    {filteredPlaces.map(place=><button key={`place-${place.id}`} type="button" className="di-result-item" onClick={()=>select(place.coordinates,place.name,place)}><span className="di-item-icon"><UiIcon name="pin"/></span><span className="di-item-text"><strong>{place.name}</strong><small>{place.neighborhood||place.municipality||getPlaceCategoryLabel(place.category)}{place.status!=='verificado'?' · Por verificar':''}</small></span></button>)}
    {filteredStops.map(stop=><button key={`stop-${stop.id}`} type="button" className="di-result-item" onClick={()=>select(stop.coordinates,stop.name)}><span className="di-item-icon"><UiIcon name="bus"/></span><span className="di-item-text"><strong>{stop.name}</strong><small>Referencia de transporte</small></span></button>)}
    {query.trim().length>=2&&!filteredPlaces.length&&!filteredStops.length&&<p className="di-no-results">No encontramos ese lugar. Puedes ubicarlo en el mapa.</p>}
   </div>
  </dialog>
 </>;
}
