import {useEffect,useRef,useState} from 'react';
import {applyPreferences,readPreferences,savePreferences} from '../lib/passengerPreferences';
import {clearJourney,DATASET_VERSION} from '../lib/journeySession';
import {localRecordPreference,setLocalRecordPreference,readLocalRecords} from '../lib/localRecords';
import {readWaiting} from '../lib/waitingRecords';
import {routeReportGeoJSON,type RouteReport} from '../lib/routeReport';
export default function PassengerSettings(){
 const [open,setOpen]=useState(false),[prefs,setPrefs]=useState({voice:false,lessEffects:false}),[notice,setNotice]=useState('');const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const [recording,setRecording]=useState(false);
 useEffect(()=>{setPrefs(readPreferences());applyPreferences()},[]);
 useEffect(()=>{if(open){setRecording(localRecordPreference()===true);dialog.current?.showModal()}else dialog.current?.close()},[open]);
 function change(key:'voice'|'lessEffects',checked:boolean){const next={...prefs,[key]:checked};setPrefs(next);savePreferences(next);}
 function close(){setOpen(false);trigger.current?.focus()}
 function changeRecording(allowed:boolean){
  if(!allowed&&!window.confirm('¿Desactivar el guardado y borrar las esperas y reportes locales de este perfil? No cambia tu viaje ni tus lugares privados.'))return;
  const ok=setLocalRecordPreference(allowed);setRecording(localRecordPreference()===true);
  setNotice(ok?allowed?'Guardado local activado, hasta 7 días. No se envía al administrador.':'Registros locales borrados y guardado desactivado.':'No se pudo cambiar el guardado. Revisa los permisos de almacenamiento.');
 }
 function exportRecords(){
  if(!window.confirm('El archivo incluye tus esperas y los tramos GPS que hayas registrado. Revísalo antes de compartirlo. ¿Exportarlo a este dispositivo?'))return;
  try{
   const data={version:1,realTime:false,waiting:readWaiting(),reports:readLocalRecords<RouteReport>('route-reports').map(routeReportGeoJSON)};
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='pordondepasa-registros-locales.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{setNotice('No se pudieron exportar los registros locales.')}
 }
 return <><button ref={trigger} type="button" className="passenger-settings-trigger" onClick={()=>setOpen(true)} aria-label="Abrir ayuda y ajustes">Ajustes</button>
  <dialog ref={dialog} className="passenger-settings" aria-labelledby="passenger-settings-title" onCancel={e=>{e.preventDefault();close()}}>
   <header><h2 id="passenger-settings-title">Ayuda y ajustes</h2><button onClick={close} aria-label="Cerrar ajustes">×</button></header>
   <label><span>Avisos de bajada por voz</span><input type="checkbox" checked={prefs.voice} onChange={e=>change('voice',e.target.checked)}/></label>
   <label><span>Menos transparencia y efectos</span><input type="checkbox" checked={prefs.lessEffects} onChange={e=>change('lessEffects',e.target.checked)}/></label>
   <h3>Registros en este dispositivo</h3>
   <label><span>Guardar esperas y reportes locales</span><input type="checkbox" checked={recording} onChange={e=>changeRecording(e.target.checked)}/></label>
   <p>Opcional, hasta 7 días; los vencidos se eliminan al abrir o consultar la app. Los reportes incluyen el tramo GPS que decidas registrar. No se envían al administrador ni se mezclan con otros perfiles. Desactivar borra estos registros guardados.</p>
   <button type="button" onClick={exportRecords}>Exportar registros locales</button>
   <h3>Transporte en Tepic y Xalisco</h3><p>Los tiempos, esperas y tarifas son estimaciones, no unidades en vivo. El buscador permite hasta un transbordo.</p>
   <p>Muchos puntos son referencias o abordajes sugeridos, no paradas oficiales. Verifica el sentido y acuerda la bajada con el chofer.</p>
   <h3>Ubicación y conexión</h3><p>Con GPS aproximado conservamos el último avance confirmado. La señal perdida no significa tráfico. Puedes continuar los pasos manualmente.</p>
   <p>En la web, mantén la app visible para recibir avisos. El mapa base necesita internet; las indicaciones del viaje guardado pueden consultarse sin mapa.</p>
   <p><a href={`${import.meta.env.BASE_URL}privacidad/`} target="_blank" rel="noopener">Privacidad y datos</a> · <a href={`${import.meta.env.BASE_URL}ayuda/`} target="_blank" rel="noopener">Ayuda y cobertura</a></p>
   <button onClick={()=>{if(window.confirm('¿Descartar el viaje guardado en este dispositivo?')){clearJourney();setNotice('Viaje guardado eliminado.')}}}>Eliminar viaje guardado</button>
   {notice&&<p role="status">{notice}</p>}<small>Datos: {DATASET_VERSION} · Beta de navegación estimada</small>
  </dialog></>;
}
