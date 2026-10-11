import {useEffect,useRef,useState} from 'react';
import type {Map,Marker,GeoJSONSource} from 'maplibre-gl';
import type {Option,Point} from '../lib/router';
import type {RouteStop} from '../lib/navigation';
import {visibleMapPadding} from '../lib/mapCamera';
import {headingDelta} from '../lib/heading';
import {closedColosioLines,closedColosioLabel} from '../lib/closedColosio';
import {getPlaceCategoryIcon, type Place} from '../lib/places';
import '../styles/vector-map.css';
type Props={origin:Point;destination?:Point;access?:Point;place?:Place;option?:Option;onPick?:(point:Point)=>void;onDestinationChange?:(point:Point)=>void;fullscreen?:boolean;stops?:RouteStop[];live?:Point;follow?:boolean;onPan?:()=>void;navigation?:boolean;heading?:number;activeLeg?:number;accuracy?:number;stale?:boolean;remaining?:number};
const coord=(p:Point):[number,number]=>[p.lng,p.lat];
export default function StreetMap(props:Props){
 const container=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),latest=useRef(props),markers=useRef<Marker[]>([]),liveMarker=useRef<Marker|null>(null);
 latest.current=props;
 const draw=useRef<()=>void>(()=>{}),camera=useRef<()=>void>(()=>{}),updateMarkers=useRef<()=>void>(()=>{});
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 function padding(){const rect=container.current!.getBoundingClientRect(),main=container.current!.closest('main');const p=visibleMapPadding(rect,main?.querySelector('.navigation-top')?.getBoundingClientRect(),main?.querySelector('.map-sheet')?.getBoundingClientRect());if(latest.current.navigation)p.top+=Math.max(0,rect.height-p.top-p.bottom)*.22;return p}
 useEffect(()=>{let disposed=false;let instance:Map|undefined;let observer:ResizeObserver|undefined;let frame=0,lastFrame=0,initialized=false;
  let visual:Point|undefined,visualHeading=0;
  let cameraPadding=padding();
  const theme=window.matchMedia('(prefers-color-scheme: dark)'),style=()=>`https://tiles.openfreemap.org/styles/${theme.matches?'dark':'positron'}`;
  const change=()=>instance?.setStyle(style());
  Promise.all([import('maplibre-gl'),import('../lib/vectorBasemap')]).then(([M,base])=>{
   if(disposed||!container.current)return;
   M.setWorkerUrl(base.workerUrl);
   instance=new M.Map({container:container.current,style:style(),center:coord(latest.current.origin),zoom:props.navigation?18:13,maxZoom:19,attributionControl:false,dragRotate:false,pitchWithRotate:false});map.current=instance;
   instance.touchZoomRotate.enable();
   instance.touchZoomRotate.disableRotation();
   instance.addControl(new M.AttributionControl({compact:true,customAttribution:'<a href="https://openfreemap.org/">OpenFreeMap</a>'}),'bottom-right');
   theme.addEventListener('change',change);
   instance.on('click',event=>latest.current.onPick?.({lat:event.lngLat.lat,lng:event.lngLat.lng}));
   instance.on('dragstart',event=>{if(event.originalEvent)latest.current.onPan?.()});
   instance.on('zoomstart',event=>{if(event.originalEvent)latest.current.onPan?.()});
   instance.on('error',()=>{if(!disposed)setError('No se pudieron cargar algunas calles. Revisa tu conexión.')});
   instance.on('idle',()=>{if(!disposed)setError('')});
   draw.current=()=>{
    if(!instance?.getStyle()?.layers)return;
    const current=latest.current,features=current.option?.legs.flatMap((leg,index)=>{
     if(leg.kind==='walk'&&!leg.geometry)return [];
     const coordinates=(leg.geometry??[leg.from,leg.to]).map(coord);if(coordinates.length<2)return [];
     return [{type:'Feature' as const,geometry:{type:'LineString' as const,coordinates},properties:{color:leg.kind==='bus'?leg.route?.color??'#0a9364':'#2563eb',walk:leg.kind==='walk',width:(!current.navigation||index===(current.activeLeg??0))?6:4}}];
    })??[],data={type:'FeatureCollection' as const,features};
    const source=instance.getSource('trip-lines') as GeoJSONSource|undefined;
    if(source)source.setData(data);else{
     instance.addSource('trip-lines',{type:'geojson',data});
     instance.addLayer({id:'trip-halo',type:'line',source:'trip-lines',filter:['==',['get','walk'],false],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#123459','line-opacity':.85,'line-width':['interpolate',['linear'],['zoom'],12,4,18,['+',['get','width'],2]]}});
     for(const walk of [false,true])instance.addLayer({id:walk?'trip-walk':'trip-bus',type:'line',source:'trip-lines',filter:['==',['get','walk'],walk],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],12,2.5,18,walk?4:['get','width']],...(walk?{'line-dasharray':[.2,1.7]}:{})}});
    }
    const point=current.live,radius=current.accuracy??0;
    const ring=point?Array.from({length:65},(_,i)=>{const angle=i*Math.PI/32;return [point.lng+Math.cos(angle)*radius/(111320*Math.cos(point.lat*Math.PI/180)),point.lat+Math.sin(angle)*radius/111320]}):[];
    const area={type:'FeatureCollection' as const,features:ring.length?[{type:'Feature' as const,properties:{},geometry:{type:'Polygon' as const,coordinates:[ring]}}]:[]};
    const uncertainty=instance.getSource('location-accuracy') as GeoJSONSource|undefined;
    if(uncertainty)uncertainty.setData(area);else{instance.addSource('location-accuracy',{type:'geojson',data:area});instance.addLayer({id:'location-accuracy',type:'fill',source:'location-accuracy',paint:{'fill-color':'#2684ff','fill-opacity':.09}},'trip-halo')}
   };
   function drawClosure(){
    if(!instance?.getStyle()?.layers)return;
    // Keep this independent of the selected transit option and GPS updates.
    if(!instance.getSource('closed-colosio'))instance.addSource('closed-colosio',{type:'geojson',data:{type:'FeatureCollection',features:closedColosioLines.map(coordinates=>({type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates:coordinates.map(point=>[...point])}}))}});
    if(!instance.getLayer('closed-colosio-base'))instance.addLayer({id:'closed-colosio-base',type:'line',source:'closed-colosio',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':theme.matches?'#351d1d':'#fff','line-width':['interpolate',['linear'],['zoom'],11,4,16,12,19,18]}});
    if(!instance.getLayer('closed-colosio-line'))instance.addLayer({id:'closed-colosio-line',type:'line',source:'closed-colosio',layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':theme.matches?'#ff796b':'#d83c32','line-width':['interpolate',['linear'],['zoom'],11,2.5,16,7,19,11],'line-dasharray':[2,1.3]}});
    if(!instance.getSource('closed-colosio-label'))instance.addSource('closed-colosio-label',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[...closedColosioLabel]}}});
    if(!instance.getLayer('closed-colosio-label'))instance.addLayer({id:'closed-colosio-label',type:'symbol',source:'closed-colosio-label',minzoom:12,layout:{'text-field':'Tramo en construcción','text-size':['interpolate',['linear'],['zoom'],12,11,16,14],'text-anchor':'bottom','text-offset':[0,-.8],'text-allow-overlap':true},paint:{'text-color':theme.matches?'#ffb4a8':'#9b251c','text-halo-color':theme.matches?'#202328':'#fff','text-halo-width':2.5}});
   }
   instance.on('style.load',()=>{
    if(!instance)return;
    for(const item of instance.getStyle().layers??[]){
     if(item.type==='fill'&&item.paint?.['fill-pattern'])instance.setPaintProperty(item.id,'fill-pattern',undefined);
     if(!theme.matches)continue;
     if(item.type==='background')instance.setPaintProperty(item.id,'background-color','#202328');
     if(item.type==='line'&&/highway/.test(item.id))instance.setPaintProperty(item.id,'line-color',/casing/.test(item.id)?'#30343b':/minor|path/.test(item.id)?'#454b54':'#626b76');
     if(item.type==='symbol'&&item.layout?.['text-field']){instance.setPaintProperty(item.id,'text-color','#bdc6d2');instance.setPaintProperty(item.id,'text-halo-color','#202328');instance.setPaintProperty(item.id,'text-halo-width',1.2)}
    }
    draw.current();
    drawClosure();
   });
   function marker(point:Point,className:string,label:string,draggable=false){
    const element=document.createElement('div');element.className=className;element.setAttribute('aria-label',label);element.title=label;element.appendChild(document.createElement('span'));element.addEventListener('click',event=>event.stopPropagation());
    return new M.Marker({element,draggable}).setLngLat(coord(point)).addTo(instance!);
   }
   updateMarkers.current=()=>{
    markers.current.forEach(item=>item.remove());markers.current=[];const current=latest.current;
    if(!current.navigation||!current.live)markers.current.push(marker(current.origin,'vector-origin','Origen'));
    if(current.destination){
     const placeIcon=current.place?getPlaceCategoryIcon(current.place):undefined;
     const item=marker(current.destination,`destination-drag-marker ${placeIcon?'with-icon':''}`,current.place?.name?`Destino: ${current.place.name}`:'Destino: arrastra para cambiarlo',!!current.onDestinationChange);
     if(placeIcon){const span=item.getElement().querySelector('span');if(span)span.textContent=placeIcon}
     item.on('dragend',()=>{const p=item.getLngLat();latest.current.onDestinationChange?.({lat:p.lat,lng:p.lng})});
     markers.current.push(item);
    }
    if(current.access)markers.current.push(marker(current.access,'place-access-marker','Fin de ruta en calle; acceso al lugar estimado'));
    current.stops?.forEach(stop=>{
     const item=marker(stop.coordinates,`stop-pin ${stop.type==='oficial'?'official':'habitual'}`,stop.name);item.getElement().style.background=current.option?.legs[stop.legIndex]?.route?.color??'#2563eb';
     const content=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=stop.name;detail.textContent=stop.type==='oficial'?'Parada oficial':stop.type==='base'?'Base':'Bajada habitual';content.append(name,document.createElement('br'),detail);item.setPopup(new M.Popup({offset:12}).setDOMContent(content));markers.current.push(item);
    });
   };
   camera.current=()=>{
    if(!instance||!container.current)return;const current=latest.current;cameraPadding=padding();
    if(current.navigation){if(current.follow&&!initialized){instance.jumpTo({center:coord(current.live??current.origin),zoom:17.5,bearing:current.heading??0,pitch:35,padding:padding()});initialized=true}}
    else if(current.destination){const bounds=new M.LngLatBounds(coord(current.origin),coord(current.origin));bounds.extend(coord(current.destination));current.option?.legs.forEach(leg=>leg.geometry?.forEach(p=>bounds.extend(coord(p))));instance.fitBounds(bounds,{padding:padding(),maxZoom:16,duration:800})}
    else instance.jumpTo({center:coord(current.origin),zoom:13,padding:padding()});
   };
   observer=new ResizeObserver(()=>{instance?.resize();camera.current()});observer.observe(container.current);
   const main=container.current.closest('main');for(const selector of ['.map-sheet','.navigation-top']){const item=main?.querySelector(selector);if(item)observer.observe(item)}
   instance.on('load',()=>{if(disposed)return;draw.current();drawClosure();updateMarkers.current();camera.current();setReady(true)});
   function animate(now:number){
    if(disposed||!instance)return;
    const dt=Math.min(64,now-lastFrame||16);lastFrame=now;
    const current=latest.current,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,a=reduced?1:1-Math.exp(-dt/240);
    const target=current.live??current.origin;
    visual=visual?{lat:visual.lat+(target.lat-visual.lat)*a,lng:visual.lng+(target.lng-visual.lng)*a}:target;
    visualHeading+=headingDelta(visualHeading,current.heading??visualHeading)*a;
    if(current.live&&liveMarker.current){liveMarker.current.setLngLat(coord(visual)).setRotation(visualHeading);liveMarker.current.getElement().classList.toggle('gps-stale',!!current.stale)}
    if(current.navigation&&current.follow&&initialized){
     const bus=current.option?.legs[current.activeLeg??0]?.kind==='bus',near=(current.remaining??Infinity)<120;
     const zoom=near?18:bus?16.8:17.5,pitch=reduced?0:bus?42:30,c=instance.getCenter(),p=instance.getPadding(),goal=cameraPadding;
     const moving=Math.abs(c.lng-visual.lng)+Math.abs(c.lat-visual.lat)>1e-8||Math.abs(headingDelta(instance.getBearing(),current.heading??instance.getBearing()))>.03||Math.abs(zoom-instance.getZoom())>.002||Math.abs(pitch-instance.getPitch())>.03||Math.abs(goal.top-(p.top??0))+Math.abs(goal.bottom-(p.bottom??0))>.1;
     if(moving)instance.jumpTo({center:[c.lng+(visual.lng-c.lng)*a,c.lat+(visual.lat-c.lat)*a],bearing:instance.getBearing()+headingDelta(instance.getBearing(),current.heading??instance.getBearing())*a,zoom:instance.getZoom()+(zoom-instance.getZoom())*a,pitch:instance.getPitch()+(pitch-instance.getPitch())*a,padding:{top:(p.top??0)+(goal.top-(p.top??0))*a,bottom:(p.bottom??0)+(goal.bottom-(p.bottom??0))*a,left:(p.left??0)+(goal.left-(p.left??0))*a,right:(p.right??0)+(goal.right-(p.right??0))*a}});
    }
    frame=requestAnimationFrame(animate);
   }
   frame=requestAnimationFrame(animate);
  }).catch(cause=>{console.error('No se pudo iniciar MapLibre',cause);if(!disposed)setError('No se pudo abrir el mapa. Revisa tu conexión o la compatibilidad WebGL del dispositivo.')});
  return()=>{disposed=true;cancelAnimationFrame(frame);theme.removeEventListener('change',change);observer?.disconnect();instance?.remove();map.current=null;liveMarker.current=null;markers.current=[]};
 },[props.navigation]);
 useEffect(()=>{if(!ready)return;draw.current();if(!props.navigation)camera.current()},[ready,props.origin,props.destination,props.option,props.navigation,props.activeLeg,props.live,props.accuracy]);
 useEffect(()=>{if(ready)updateMarkers.current()},[ready,props.origin,props.destination,props.access,props.stops,!!props.onDestinationChange,props.navigation,!!props.live]);
 useEffect(()=>{if(!ready||!map.current)return;let cancelled=false;
  import('maplibre-gl').then(M=>{if(cancelled||!map.current)return;const {live,heading,navigation,follow}=latest.current;
   if(live){if(!liveMarker.current){const element=document.createElement('div');element.className='tracking-arrow';element.setAttribute('aria-label','Tu ubicación');element.appendChild(document.createElement('span'));liveMarker.current=new M.Marker({element,rotationAlignment:'map'}).setLngLat(coord(live)).addTo(map.current)}liveMarker.current.getElement().classList.toggle('directional',heading!==undefined);liveMarker.current.getElement().title=latest.current.stale?'Ubicación sin actualizar':`Precisión aproximada: ${Math.round(latest.current.accuracy??0)} m`}
   if(navigation&&follow)camera.current();
  });return()=>{cancelled=true};
 },[ready,props.live,props.heading,props.follow,props.navigation,props.origin]);
 return <div className="street-map-wrap"><div ref={container} className="street-map" aria-label="Mapa de calles de Tepic"/>{error&&<p role="status" className="vector-map-error">{error}</p>}</div>;
}
