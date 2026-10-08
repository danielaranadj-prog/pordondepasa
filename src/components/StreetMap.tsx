import {useEffect,useRef,useState} from 'react';
import type {Map,Marker,GeoJSONSource} from 'maplibre-gl';
import type {Option,Point} from '../lib/router';
import type {RouteStop} from '../lib/navigation';
import {visibleMapPadding} from '../lib/mapCamera';
import '../styles/vector-map.css';
type Props={origin:Point;destination?:Point;option?:Option;onPick?:(point:Point)=>void;onDestinationChange?:(point:Point)=>void;fullscreen?:boolean;stops?:RouteStop[];live?:Point;follow?:boolean;onPan?:()=>void;navigation?:boolean;heading?:number;activeLeg?:number};
const coord=(p:Point):[number,number]=>[p.lng,p.lat];
export default function StreetMap(props:Props){
 const container=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),latest=useRef(props),markers=useRef<Marker[]>([]),liveMarker=useRef<Marker|null>(null);
 latest.current=props;
 const draw=useRef<()=>void>(()=>{}),camera=useRef<()=>void>(()=>{}),updateMarkers=useRef<()=>void>(()=>{});
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 function padding(){const rect=container.current!.getBoundingClientRect(),main=container.current!.closest('main');return visibleMapPadding(rect,main?.querySelector('.navigation-top')?.getBoundingClientRect(),main?.querySelector('.map-sheet')?.getBoundingClientRect())}
 useEffect(()=>{let disposed=false;let instance:Map|undefined;let observer:ResizeObserver|undefined;
  const theme=window.matchMedia('(prefers-color-scheme: dark)'),style=()=>`https://tiles.openfreemap.org/styles/${theme.matches?'dark':'positron'}`;
  const change=()=>instance?.setStyle(style());
  Promise.all([import('maplibre-gl'),import('../lib/vectorBasemap')]).then(([M,base])=>{
   if(disposed||!container.current)return;
   M.setWorkerUrl(base.workerUrl);
   instance=new M.Map({container:container.current,style:style(),center:coord(latest.current.origin),zoom:props.navigation?18:13,maxZoom:19,attributionControl:false,dragRotate:false,pitchWithRotate:false});map.current=instance;
   instance.touchZoomRotate.disableRotation();
   instance.addControl(new M.NavigationControl({showCompass:false}),'top-left');
   instance.addControl(new M.AttributionControl({compact:true,customAttribution:'<a href="https://openfreemap.org/">OpenFreeMap</a>'}),'bottom-right');
   theme.addEventListener('change',change);
   instance.on('click',event=>latest.current.onPick?.({lat:event.lngLat.lat,lng:event.lngLat.lng}));
   instance.on('dragstart',event=>{if(event.originalEvent)latest.current.onPan?.()});
   instance.on('error',()=>{if(!disposed)setError('No se pudieron cargar algunas calles. Revisa tu conexión.')});
   instance.on('idle',()=>{if(!disposed)setError('')});
   draw.current=()=>{
    if(!instance?.getStyle()?.layers)return;
    const current=latest.current,features=current.option?.legs.flatMap((leg,index)=>{
     if(leg.kind==='walk'&&!leg.geometry)return [];
     const coordinates=(leg.geometry??[leg.from,leg.to]).map(coord);if(coordinates.length<2)return [];
     return [{type:'Feature' as const,geometry:{type:'LineString' as const,coordinates},properties:{color:leg.kind==='bus'?leg.route?.color??'#0a9364':'#2563eb',walk:leg.kind==='walk',width:(!current.navigation||index===(current.activeLeg??0))?(current.navigation?9:7):5}}];
    })??[],data={type:'FeatureCollection' as const,features};
    const source=instance.getSource('trip-lines') as GeoJSONSource|undefined;
    if(source)source.setData(data);else{
     instance.addSource('trip-lines',{type:'geojson',data});
     instance.addLayer({id:'trip-halo',type:'line',source:'trip-lines',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':['+',['get','width'],5]}});
     for(const walk of [false,true])instance.addLayer({id:walk?'trip-walk':'trip-bus',type:'line',source:'trip-lines',filter:['==',['get','walk'],walk],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':['get','width'],...(walk?{'line-dasharray':[1.5,1]}:{})}});
    }
   };
   instance.on('style.load',()=>{
    if(!instance)return;
    for(const item of instance.getStyle().layers??[]){
     if(item.type==='fill'&&item.paint?.['fill-pattern'])instance.setPaintProperty(item.id,'fill-pattern',undefined);
     if(!theme.matches)continue;
     if(item.type==='background')instance.setPaintProperty(item.id,'background-color','#202328');
     if(item.type==='line'&&/highway/.test(item.id))instance.setPaintProperty(item.id,'line-color',/casing/.test(item.id)?'#30343b':/minor|path/.test(item.id)?'#454b54':'#626b76');
     if(item.type==='symbol'&&item.layout?.['text-field']){instance.setPaintProperty(item.id,'text-color','#bdc6d2');instance.setPaintProperty(item.id,'text-halo-color','#202328');instance.setPaintProperty(item.id,'text-halo-width',1.2)}
    }draw.current();
   });
   function marker(point:Point,className:string,label:string,draggable=false){
    const element=document.createElement('div');element.className=className;element.setAttribute('aria-label',label);element.title=label;element.appendChild(document.createElement('span'));element.addEventListener('click',event=>event.stopPropagation());
    return new M.Marker({element,draggable}).setLngLat(coord(point)).addTo(instance!);
   }
   updateMarkers.current=()=>{
    markers.current.forEach(item=>item.remove());markers.current=[];const current=latest.current;
    if(!current.navigation||!current.live)markers.current.push(marker(current.origin,'vector-origin','Origen'));
    if(current.destination){const item=marker(current.destination,'destination-drag-marker','Destino: arrastra para cambiarlo',!!current.onDestinationChange);item.on('dragend',()=>{const p=item.getLngLat();latest.current.onDestinationChange?.({lat:p.lat,lng:p.lng})});markers.current.push(item)}
    current.stops?.forEach(stop=>{
     const item=marker(stop.coordinates,`stop-pin ${stop.type==='oficial'?'official':'habitual'}`,stop.name);item.getElement().style.background=current.option?.legs[stop.legIndex]?.route?.color??'#2563eb';
     const content=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=stop.name;detail.textContent=stop.type==='oficial'?'Parada oficial':stop.type==='base'?'Base':'Bajada habitual';content.append(name,document.createElement('br'),detail);item.setPopup(new M.Popup({offset:12}).setDOMContent(content));markers.current.push(item);
    });
   };
   camera.current=()=>{
    if(!instance||!container.current)return;const current=latest.current;
    if(current.navigation){if(current.follow)instance.jumpTo({center:coord(current.live??current.origin),zoom:18,bearing:current.heading??0,padding:padding()})}
    else if(current.destination){const bounds=new M.LngLatBounds(coord(current.origin),coord(current.destination));current.option?.legs.forEach(leg=>leg.geometry?.forEach(p=>bounds.extend(coord(p))));instance.fitBounds(bounds,{padding:padding(),maxZoom:16,duration:0})}
    else instance.jumpTo({center:coord(current.origin),zoom:13,padding:padding()});
   };
   observer=new ResizeObserver(()=>{instance?.resize();camera.current()});observer.observe(container.current);
   const main=container.current.closest('main');for(const selector of ['.map-sheet','.navigation-top']){const item=main?.querySelector(selector);if(item)observer.observe(item)}
   instance.on('load',()=>{if(disposed)return;draw.current();updateMarkers.current();camera.current();setReady(true)});
  }).catch(()=>{if(!disposed)setError('No se pudo abrir el mapa. Revisa tu conexión o la compatibilidad WebGL del dispositivo.')});
  return()=>{disposed=true;theme.removeEventListener('change',change);observer?.disconnect();instance?.remove();map.current=null;liveMarker.current=null;markers.current=[]};
 },[props.navigation]);
 useEffect(()=>{if(!ready)return;draw.current();updateMarkers.current();if(!props.navigation)camera.current()},[ready,props.origin,props.destination,props.option,props.stops,!!props.onDestinationChange,props.navigation,props.activeLeg,!!props.live]);
 useEffect(()=>{if(!ready||!map.current)return;let cancelled=false;
  import('maplibre-gl').then(M=>{if(cancelled||!map.current)return;const {live,heading,navigation,follow}=latest.current;
   if(live){if(!liveMarker.current){const element=document.createElement('div');element.className='tracking-arrow';element.setAttribute('aria-label','Tu ubicación');element.appendChild(document.createElement('span'));liveMarker.current=new M.Marker({element,rotationAlignment:'map'}).setLngLat(coord(live)).addTo(map.current)}liveMarker.current.setLngLat(coord(live)).setRotation(heading??0);liveMarker.current.getElement().classList.toggle('directional',heading!==undefined)}
   if(navigation&&follow)camera.current();else if(navigation)map.current.setBearing(0);
  });return()=>{cancelled=true};
 },[ready,props.live,props.heading,props.follow,props.navigation,props.origin]);
 return <div className="street-map-wrap"><div ref={container} className="street-map" aria-label="Mapa de calles de Tepic"/>{error&&<p role="status" className="vector-map-error">{error}</p>}</div>;
}
