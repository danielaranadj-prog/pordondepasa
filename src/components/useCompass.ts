import {useEffect,useRef,useState} from 'react';
import {compassHeading,normalHeading} from '../lib/heading';
type PermissionOrientation=typeof DeviceOrientationEvent&{requestPermission?:(absolute?:boolean)=>Promise<string>};
export function useCompass(active=true){
 const [enabled,setEnabled]=useState(false),[heading,setHeading]=useState<number>(),[issue,setIssue]=useState('');
 const last=useRef(0);
 async function enable(){
  if(enabled){setEnabled(false);setHeading(undefined);setIssue('');return;}
  if(!window.isSecureContext){setIssue('La brújula necesita una conexión segura (HTTPS). El GPS seguirá mostrando tu avance.');return;}
  if(typeof DeviceOrientationEvent==='undefined'){setIssue('Este dispositivo no ofrece brújula. El mapa usará tu dirección al avanzar.');return;}
  try{const api=DeviceOrientationEvent as PermissionOrientation;if(api.requestPermission&&await api.requestPermission(true)!=='granted'){setIssue('No se permitió usar la brújula. Puedes seguir con el GPS.');return;}setIssue('');setEnabled(true)}catch{setIssue('No pudimos activar la brújula. Puedes seguir con el GPS.')}
 }
 useEffect(()=>{
  if(!enabled||!active)return;
  let received=false,previous:number|undefined;
  const timer=setTimeout(()=>{if(!received)setIssue('No recibimos una orientación fiable. El mapa usará tu dirección al avanzar.')},5000);
  function update(event:DeviceOrientationEvent){const value=compassHeading(event);if(value===undefined)return;received=true;setIssue('');const now=Date.now();if(now-last.current<100)return;last.current=now;
   previous=previous===undefined?value:previous+(((value-previous+540)%360)-180)*.25;setHeading(normalHeading(previous));
  }
  window.addEventListener('deviceorientation',update);window.addEventListener('deviceorientationabsolute',update);
  return()=>{clearTimeout(timer);window.removeEventListener('deviceorientation',update);window.removeEventListener('deviceorientationabsolute',update)};
 },[enabled,active]);
 return {enabled,heading,issue,enable};
}
