import type {Option,Point} from '../lib/router';
import {routeTextColor} from '../lib/router';
import type {TransitStop} from '../lib/navigation';
import JourneySteps from './JourneySteps';
import UberAlternative from './UberAlternative';
import UiIcon from './UiIcon';
export default function RouteChoiceCard({option,stops,label,selected,starting,onSelect,onStart,origin,destination,originName,destinationName}:{option:Option;stops:TransitStop[];label:string;selected:boolean;starting:boolean;onSelect:()=>void;onStart:()=>void;origin:Point;destination?:Point;originName:string;destinationName:string}){
 return <>
  <button type="button" className="option-select" onClick={onSelect} aria-pressed={selected}>
   <div className="time"><strong>{option.minutes}<span> min</span></strong><small>{label}</small></div>
   <div className="legs" aria-label="Etapas del viaje">{option.legs.map((leg,i)=><span key={i} className={leg.kind} style={leg.kind==='bus'?{backgroundColor:leg.route?.color,color:routeTextColor(leg.route?.color??'#0a9364')}:undefined}><UiIcon name={leg.kind==='walk'?'walk':'bus'}/>{leg.kind==='walk'?(leg.minutes?`${leg.minutes} min`:'Muy cerca'):leg.route?.name??'Transporte'}</span>)}</div>
   <div className="route-metrics"><div><small>Costo aprox.</small><strong>${option.fare}<span> MXN</span></strong></div><div><small>Caminata</small><strong>{option.walk}<span> min a pie</span></strong></div><div><small>Transbordos</small><strong>{option.transfers===0?'Sin cambios':option.transfers}</strong></div></div>
  </button>
  <details className="journey-details"><summary>Dónde subir y bajar <UiIcon name="chevron-down"/></summary><JourneySteps option={option} stops={stops}/></details>
  <button type="button" className="start-follow card-primary" disabled={starting} onClick={onStart}>{starting?'Preparando tu viaje…':option.legs.some(leg=>leg.kind==='bus')?'Empezar mi viaje':'Empezar caminata'}<UiIcon name="arrow"/></button>
  {destination&&<UberAlternative origin={origin} destination={destination} originName={originName} destinationName={destinationName}/>}
 </>;
}
