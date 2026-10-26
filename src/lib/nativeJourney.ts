import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import type {Leg} from './router';
type Fix={coords:{latitude:number;longitude:number;accuracy:number;heading:number|null;speed:number|null};timestamp:number};
type NativeJourney={start(input:{owner:string;kind:string;name:string;line:NonNullable<Leg['geometry']>}):Promise<void>;stop(input:{owner:string}):Promise<void>;addListener(name:string,listener:(event:any)=>void):Promise<PluginListenerHandle>};
const native=registerPlugin<NativeJourney>('JourneyNavigation');
let sessionConsent:boolean|undefined;
/** Return cleanup synchronously even while native permission UI is pending. */
export function watchJourneyPosition(leg:Leg,onFix:(fix:Fix)=>void,onIssue:(message:string)=>void,onStop:()=>void):()=>void{
 if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=='android'){
  if(!navigator.geolocation){onIssue('Tu ubicación no está disponible. Sigue los pasos en el mapa.');return()=>{};}
  const id=navigator.geolocation.watchPosition(onFix,error=>onIssue(error.code===1?'Permite tu ubicación para seguir tu avance. Puedes continuar con los pasos.':'No pudimos actualizar tu ubicación. Sigue los pasos en el mapa.'),{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
  return()=>navigator.geolocation.clearWatch(id);
 }
 if(sessionConsent===undefined){
  sessionConsent=window.confirm('Durante este viaje, PorDóndePasa usará tu ubicación precisa incluso con la pantalla bloqueada para avisarte de tu bajada. Verás una notificación para terminar el seguimiento. No enviamos tu GPS a anunciantes. Puedes cancelar y usar los pasos manualmente. ¿Activar seguimiento durante el viaje?');
 }
 if(!sessionConsent){onIssue('Seguimiento desactivado. Usa los pasos manuales; vuelve a abrir la app si quieres activarlo.');return()=>{};}
 const owner=crypto.randomUUID(),handles:PluginListenerHandle[]=[];let cancelled=false;
 void (async()=>{
  for(const [name,callback]of [['location',onFix],['issue',(event:{message:string})=>onIssue(event.message)],['stopped',onStop]] as const){
   const handle=await native.addListener(name,event=>{if(!cancelled&&event.owner===owner)callback(event)});if(cancelled){await handle.remove();return;}handles.push(handle);
  }
  await native.start({owner,kind:leg.kind,name:leg.route?.name??'Caminata',line:leg.geometry??[leg.from,leg.to]});
  if(cancelled)await native.stop({owner});
 })().catch(()=>{if(!cancelled)onIssue('No se pudo activar el seguimiento Android. Abre la app y revisa ubicación precisa y notificaciones; usa los pasos manuales.');});
 return()=>{cancelled=true;for(const handle of handles)void handle.remove();void native.stop({owner}).catch(()=>{});};
}
