import {useEffect,useRef,useState} from 'react';
import {compassHeading,normalHeading,headingDelta,smoothHeading} from '../lib/heading';
type PermissionOrientation=typeof DeviceOrientationEvent&{requestPermission?:(absolute?:boolean)=>Promise<string>};
export async function requestCompass():Promise<{enabled:boolean;issue:string}>{
 if(!window.isSecureContext)return {enabled:false,issue:'La brújula necesita HTTPS. Usaremos la dirección del GPS.'};
 if(typeof DeviceOrientationEvent==='undefined')return {enabled:false,issue:'Este dispositivo no ofrece brújula. Usaremos la dirección del GPS.'};
 try{
  const api=DeviceOrientationEvent as PermissionOrientation;
  if(api.requestPermission&&await api.requestPermission(true)!=='granted')return {enabled:false,issue:'No se permitió la brújula. Puedes seguir con el GPS.'};
  return {enabled:true,issue:''};
 }catch{return {enabled:false,issue:'No pudimos activar la brújula. Puedes seguir con el GPS.'};}
}
export function useCompass(active=true,initial={enabled:false,issue:''}){
 const [enabled,setEnabled]=useState(initial.enabled),[heading,setHeading]=useState<number>(),[issue,setIssue]=useState(initial.issue);
 const last=useRef(0);
 async function enable(){
  if(enabled){setEnabled(false);setHeading(undefined);setIssue('');return;}
  if(!window.isSecureContext){setIssue('La brújula necesita una conexión segura (HTTPS). El GPS seguirá mostrando tu avance.');return;}
  if(typeof DeviceOrientationEvent==='undefined'){setIssue('Este dispositivo no ofrece brújula. El mapa usará tu dirección al avanzar.');return;}
  try{const api=DeviceOrientationEvent as PermissionOrientation;if(api.requestPermission&&await api.requestPermission(true)!=='granted'){setIssue('No se permitió usar la brújula. Puedes seguir con el GPS.');return;}setIssue('');setEnabled(true)}catch{setIssue('No pudimos activar la brújula. Puedes seguir con el GPS.')}
 }
 useEffect(()=>{
  if(!enabled||!active)return;
  let received=false,previous:number|undefined,lastValid=Date.now();
  const expiry=setInterval(()=>{if(Date.now()-lastValid>4000){setHeading(undefined);previous=undefined;setIssue('Orientación no disponible. Seguimos con tu desplazamiento.')}},1000);
  const timer=setTimeout(()=>{if(!received)setIssue('No recibimos una orientación fiable. El mapa usará tu dirección al avanzar.')},5000);
  function update(event:DeviceOrientationEvent){const raw=compassHeading(event);if(raw===undefined)return;received=true;setIssue('');const now=Date.now();lastValid=now;if(now-last.current<50)return;
   const elapsed=Math.min(500,now-last.current);last.current=now;
   const value=normalHeading(raw+(window.screen.orientation?.angle??(window as Window&{orientation?:number}).orientation??0));
   if(previous!==undefined&&Math.abs(headingDelta(previous,value))<2)return;
   previous=previous===undefined?value:smoothHeading(previous,value,1-Math.exp(-elapsed/180));setHeading(previous);
  }
  window.addEventListener('deviceorientation',update);window.addEventListener('deviceorientationabsolute',update);
  return()=>{clearTimeout(timer);clearInterval(expiry);window.removeEventListener('deviceorientation',update);window.removeEventListener('deviceorientationabsolute',update)};
 },[enabled,active]);
 return {enabled,heading,issue,enable};
}
