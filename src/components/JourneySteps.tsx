import {useMemo} from 'react';
import {meters,type Option} from '../lib/router';
import {stopsForOption,type TransitStop} from '../lib/navigation';
import WalkingSafety from './WalkingSafety';

export default function JourneySteps({option,stops}:{option:Option;stops:TransitStop[]}){
 const references=useMemo(()=>stopsForOption(option,stops),[option,stops]);
 function reference(index:number,end:boolean){
  const leg=option.legs[index],point=end?leg.to:leg.from;
  const nearest=references.filter(s=>s.legIndex===index).sort((a,b)=>meters(a.coordinates,point)-meters(b.coordinates,point))[0];
  return nearest&&meters(nearest.coordinates,point)<=60?`cerca de ${nearest.name}`:'en el punto marcado en el mapa';
 }
 return <>{option.legs.some(leg=>leg.kind==='walk'&&leg.minutes>0)&&<WalkingSafety/>}<ol className="journey-steps" aria-label="Cómo hacer este viaje">{option.legs.map((leg,index)=>{
  if(leg.kind==='bus')return <li key={index}><strong>Toma {leg.route?.name}</strong><span>Sube {reference(index,false)}. Baja {reference(index,true)}.</span></li>;
  if(leg.minutes===0)return null;
  const next=option.legs[index+1];
  const streets=leg.streetNames?.length?`por ${leg.streetNames.join(' → ')} `:'' ;
  const walkInfo=next?.kind==='bus'?`Camina ${streets}hasta llegar a ${reference(index+1,false)} donde pasa ${next.route?.name?.toLowerCase().startsWith('ruta')?next.route?.name:`la Ruta ${next.route?.name}`}.`:`Camina ${streets}hasta llegar a tu destino.`;
  return <li key={index}><strong>{next?.kind==='bus'?`${index===0?'Camina para subir':'Cambia de unidad'} · ${leg.minutes} min`:`Camina hasta tu destino · ${leg.minutes} min`}</strong><span>{walkInfo}</span></li>;
 })}</ol></>;
}
