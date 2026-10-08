import type {Map as LeafletMap} from 'leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

/** Keep Leaflet overlays/navigation intact while replacing only the basemap. */
export async function addVectorBasemap(map:LeafletMap,onIssue:(message:string)=>void){
 const [{maplibreGL},{setWorkerUrl}]=await Promise.all([import('@maplibre/maplibre-gl-leaflet'),import('maplibre-gl')]);
 setWorkerUrl(workerUrl);
 const theme=window.matchMedia('(prefers-color-scheme: dark)');
 const style=()=>`https://tiles.openfreemap.org/styles/${theme.matches?'dark':'positron'}`;
 const layer=maplibreGL({style:style(),attributionControl:false}).addTo(map);
 const vector=layer.getMaplibreMap();
 vector.on('style.load',()=>{
  for(const item of vector.getStyle().layers??[]){
   // A quiet neutral palette with readable streets, rather than near-black roads.
   if(item.type==='fill'&&item.paint?.['fill-pattern'])vector.setPaintProperty(item.id,'fill-pattern',undefined);
   if(!theme.matches)continue;
   if(item.type==='background')vector.setPaintProperty(item.id,'background-color','#202328');
   if(item.type==='line'&&/highway/.test(item.id))vector.setPaintProperty(item.id,'line-color',/casing/.test(item.id)?'#30343b':/minor|path/.test(item.id)?'#454b54':'#626b76');
   if(item.type==='symbol'&&item.layout?.['text-field']){
    vector.setPaintProperty(item.id,'text-color','#bdc6d2');
    vector.setPaintProperty(item.id,'text-halo-color','#202328');
    vector.setPaintProperty(item.id,'text-halo-width',1.2);
   }
  }
 });
 const attribution='<a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
 map.attributionControl?.addAttribution(attribution);
 const change=()=>vector.setStyle(style());
 theme.addEventListener('change',change);
 vector.on('error',()=>onIssue('No se pudieron cargar algunas calles. Revisa tu conexión.'));
 vector.on('idle',()=>onIssue(''));
 return ()=>{theme.removeEventListener('change',change);map.attributionControl?.removeAttribution(attribution);};
}
