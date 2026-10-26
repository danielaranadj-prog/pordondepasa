import {useEffect,useRef,useState} from 'react';
import {applyPreferences,readPreferences,savePreferences} from '../lib/passengerPreferences';
import {clearJourney,DATASET_VERSION} from '../lib/journeySession';
export default function PassengerSettings(){
 const [open,setOpen]=useState(false),[prefs,setPrefs]=useState({voice:false,lessEffects:false}),[notice,setNotice]=useState('');const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setPrefs(readPreferences());applyPreferences()},[]);
 useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close()},[open]);
 function change(key:'voice'|'lessEffects',checked:boolean){const next={...prefs,[key]:checked};setPrefs(next);savePreferences(next);}
 function close(){setOpen(false);trigger.current?.focus()}
 return <><button ref={trigger} type="button" className="passenger-settings-trigger" onClick={()=>setOpen(true)} aria-label="Abrir ayuda y ajustes">Ajustes</button>
  <dialog ref={dialog} className="passenger-settings" aria-labelledby="passenger-settings-title" onCancel={e=>{e.preventDefault();close()}}>
   <header><h2 id="passenger-settings-title">Ayuda y ajustes</h2><button onClick={close} aria-label="Cerrar ajustes">×</button></header>
   <label><span>Avisos de bajada por voz</span><input type="checkbox" checked={prefs.voice} onChange={e=>change('voice',e.target.checked)}/></label>
   <label><span>Menos transparencia y efectos</span><input type="checkbox" checked={prefs.lessEffects} onChange={e=>change('lessEffects',e.target.checked)}/></label>
   <h3>Transporte en Tepic y Xalisco</h3><p>Los tiempos, esperas y tarifas son estimaciones, no unidades en vivo. El buscador permite hasta un transbordo.</p>
   <p>Muchos puntos son referencias o abordajes sugeridos, no paradas oficiales. Verifica el sentido y acuerda la bajada con el chofer.</p>
   <h3>Ubicación y conexión</h3><p>Con GPS aproximado conservamos el último avance confirmado. La señal perdida no significa tráfico. Puedes continuar los pasos manualmente.</p>
   <p>En la web, mantén la app visible para recibir avisos. El mapa base necesita internet; las indicaciones del viaje guardado pueden consultarse sin mapa.</p>
   <p><a href={`${import.meta.env.BASE_URL}privacidad/`} target="_blank" rel="noopener">Privacidad y datos</a> · <a href={`${import.meta.env.BASE_URL}ayuda/`} target="_blank" rel="noopener">Ayuda y cobertura</a></p>
   <button onClick={()=>{if(window.confirm('¿Descartar el viaje guardado en este dispositivo?')){clearJourney();setNotice('Viaje guardado eliminado.')}}}>Eliminar viaje guardado</button>
   {notice&&<p role="status">{notice}</p>}<small>Datos: {DATASET_VERSION} · Beta de navegación estimada</small>
  </dialog></>;
}
