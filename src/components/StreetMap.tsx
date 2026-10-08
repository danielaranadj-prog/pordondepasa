import { useEffect, useRef, useState } from 'react';
import type { Map, LayerGroup, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Option, Point } from '../lib/router';
import type {RouteStop} from '../lib/navigation';

export default function StreetMap({origin,destination,option,onPick,onDestinationChange,fullscreen=false,stops,live,follow,onPan,navigation=false,heading,activeLeg=0}: {origin:Point;destination?:Point;option?:Option;onPick?:(point:Point)=>void;onDestinationChange?:(point:Point)=>void;fullscreen?:boolean;stops?:RouteStop[];live?:Point;follow?:boolean;onPan?:()=>void;navigation?:boolean;heading?:number;activeLeg?:number}) {
  const container=useRef<HTMLDivElement>(null), map=useRef<Map|null>(null), layers=useRef<LayerGroup|null>(null), callback=useRef(onPick);
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  const pan=useRef(onPan),liveMarker=useRef<Marker|null>(null);pan.current=onPan;
  const destinationCallback=useRef(onDestinationChange);destinationCallback.current=onDestinationChange;
  const draggable=!!onDestinationChange;
  const fitVisible=useRef<()=>void>(()=>{});
  useEffect(()=>{
    if(!ready||navigation)return;
    const sheet=container.current?.closest('main')?.querySelector('.trip-bottom');
    if(!sheet)return;
    const observer=new ResizeObserver(()=>fitVisible.current());
    observer.observe(sheet);
    return()=>observer.disconnect();
  },[ready,navigation]);
  function navigationCenter(point:Point,_instance:Map){
    // Keep the actual coordinate at the centre; projected offsets drift when
    // the compass rotates the map.
    return [point.lat,point.lng] as [number,number];
  }
  callback.current=onPick;
  useEffect(()=>{let disposed=false;let instance:Map|undefined;let cleanupBasemap:(()=>void)|undefined;
    import('leaflet').then(async L=>{if(navigation)await import('@tomickigrzegorz/leaflet-rotate');if(disposed||!container.current)return;
      instance=L.map(container.current,{rotate:navigation,dragRotate:false,touchRotate:false,rotateControl:false}).setView([origin.lat,origin.lng],navigation?18:13);map.current=instance;
      instance.setMaxZoom(19);
      try{
       const {addVectorBasemap}=await import('../lib/vectorBasemap');
       if(disposed)return;
       cleanupBasemap=await addVectorBasemap(instance,message=>{if(!disposed)setError(message)});
       if(disposed){cleanupBasemap();return;}
      }catch{
       if(disposed)return;
       // Older devices without WebGL can still plan trips on the original map.
       L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(instance);
       setError('Tu dispositivo usa el mapa básico.');
      }
      layers.current=L.layerGroup().addTo(instance);
      instance.on('click',event=>callback.current?.({lat:event.latlng.lat,lng:event.latlng.lng}));
      instance.on('dragstart',()=>pan.current?.());
      setReady(true);
    }).catch(()=>setError('No se pudo abrir el mapa. Recarga la página.'));
    return()=>{disposed=true;cleanupBasemap?.();instance?.remove();map.current=null;layers.current=null};
  },[]);
  useEffect(()=>{if(!ready)return;import('leaflet').then(L=>{if(!map.current||!layers.current)return;const group=layers.current;group.clearLayers();
    L.circleMarker([origin.lat,origin.lng],{radius:8,color:'#fff',weight:3,fillColor:'#101827',fillOpacity:1}).bindTooltip('Origen').addTo(group);
    if(destination){
      const marker=L.marker([destination.lat,destination.lng],{draggable,bubblingMouseEvents:false,title:draggable?'Destino: arrastra para cambiarlo':'Destino',icon:L.divIcon({className:'destination-drag-marker',html:'<span></span>',iconSize:[32,32],iconAnchor:[16,16]})}).bindTooltip(draggable?'Arrastra para mover tu destino':'Destino').addTo(group);
      marker.on('dragend',()=>{const point=marker.getLatLng();destinationCallback.current?.({lat:point.lat,lng:point.lng});});
    }
    const points: [number,number][]=[[origin.lat,origin.lng]];
    if(destination)points.push([destination.lat,destination.lng]);
    option?.legs.forEach((leg,legIndex)=>{if(leg.kind==='walk'&&!leg.geometry)return;const geometry=(leg.geometry??[leg.from,leg.to]).map(p=>[p.lat,p.lng] as [number,number]);points.push(...geometry);
      const active=!navigation||legIndex===activeLeg,weight=active?(navigation?9:7):6,opacity=active?1:.8;
      L.polyline(geometry,{color:'#fff',weight:weight+6,opacity:1,lineCap:'round',lineJoin:'round',interactive:false}).addTo(group);
      L.polyline(geometry,{color:'#172124',weight:weight+2,opacity:.65,lineCap:'round',lineJoin:'round',interactive:false}).addTo(group);
      L.polyline(geometry,{color:leg.kind==='bus'?(leg.route?.color??'#0a9364'):'#2563eb',weight,opacity,lineCap:'round',lineJoin:'round',dashArray:leg.kind==='walk'?'10 6':undefined}).addTo(group);
    });
    stops?.forEach(stop=>{
      const color=option?.legs[stop.legIndex]?.route?.color??'#0a9364';
      const popup=document.createElement('div');const name=document.createElement('strong');name.textContent=stop.name;popup.append(name,document.createElement('br'));
      const detail=document.createElement('small');detail.textContent=(stop.type==='oficial'?'Parada oficial':stop.type==='base'?'Base':'Bajada habitual')+(stop.inferred?' · Referencia cercana al trazo':'');popup.append(detail);
      const safeColor=/^#[0-9a-f]{6}$/i.test(color)?color:'#0a9364';
      L.marker([stop.coordinates.lat,stop.coordinates.lng],{icon:L.divIcon({className:`stop-pin ${stop.type==='oficial'?'official':'habitual'}`,html:`<div style="background:${safeColor};width:100%;height:100%;border-radius:inherit"></div>`,iconSize:[14,14],iconAnchor:[7,7]})}).bindPopup(popup).addTo(group);
    });
    map.current.invalidateSize();
    if(navigation){if(!live&&follow)map.current.setView(navigationCenter(origin,map.current),18,{animate:false});return;}
    fitVisible.current=()=>{
      if(!map.current||!destination)return;
      const rect=container.current?.getBoundingClientRect(),panel=container.current?.closest('main')?.querySelector('.trip-bottom')?.getBoundingClientRect();
      const side=!!rect&&!!panel&&rect.width>=760;
      const bottom=!side&&rect&&panel?Math.max(0,rect.bottom-panel.top)+24:35;
      const left=side&&rect&&panel?panel.right-rect.left+24:35;
      map.current.fitBounds(points,{paddingTopLeft:fullscreen?[left,85]:[35,35],paddingBottomRight:fullscreen?[35,bottom]:[35,35],maxZoom:16,animate:false});
    };
    if(destination)fitVisible.current();else map.current.setView([origin.lat,origin.lng],13);
  })},[ready,origin,destination,option,fullscreen,stops,draggable,navigation,activeLeg]);
  useEffect(()=>{if(!ready||(!live&&!navigation))return;let active=true;import('leaflet').then(L=>{if(!active||!map.current)return;
    if(live){
     const icon=L.divIcon({className:'tracking-arrow '+(heading!==undefined?'directional':''),html:'<span></span>',iconSize:[22,22],iconAnchor:[11,11]});
     if(!liveMarker.current)liveMarker.current=L.marker([live.lat,live.lng],{icon}).bindTooltip('Tu ubicación').addTo(map.current);
     else liveMarker.current.setLatLng([live.lat,live.lng]).setIcon(icon);
     if(navigation){liveMarker.current.options.rotation=heading??0;liveMarker.current.setLatLng([live.lat,live.lng]);}
    }
    if(follow){const point=live??origin;map.current.setView(navigation?navigationCenter(point,map.current):[point.lat,point.lng],navigation?18:16,{animate:!!live&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches});}
    if(navigation){if(follow&&heading!==undefined)map.current.setHeading(heading,{ease:.15,deadzone:2});else{map.current.stopHeadingUp();map.current.setBearing(0);}}
  });return()=>{active=false};},[ready,live,follow,navigation,origin]);
  useEffect(()=>{if(!ready||!navigation||!map.current)return;
    if(follow&&heading!==undefined)map.current.setHeading(heading,{ease:.15,deadzone:2});
    else{map.current.stopHeadingUp();map.current.setBearing(0);}
    if(liveMarker.current){liveMarker.current.options.rotation=heading??0;liveMarker.current.setLatLng(liveMarker.current.getLatLng());}
  },[ready,navigation,follow,heading]);
  return <div className="street-map-wrap"><div ref={container} className="street-map" aria-label="Mapa de calles de Tepic" />{error&&<p role="status">{error}</p>}</div>;
}
