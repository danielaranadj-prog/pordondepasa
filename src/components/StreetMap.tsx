import {useEffect,useRef,useState} from 'react';
import type {Map,Marker,Popup,GeoJSONSource} from 'maplibre-gl';
import type {Option,Point} from '../lib/router';
import type {RouteStop} from '../lib/navigation';
import {projectProgress} from '../lib/navigation';
import {visibleMapPadding,navigationCamera,mapFocus,shouldFitTripCamera,sameMapPadding,tripBoundsOptions} from '../lib/mapCamera';
import type {MapSelection} from '../lib/mapSelection';
import {headingDelta} from '../lib/heading';
import {mapAppearance} from '../lib/mapAppearance';
import {closedColosioLines,closedColosioLabel} from '../lib/closedColosio';
import {getPlaceCategoryIcon, type Place} from '../lib/places';
import {getVisiblePinAds, type AdCampaign} from '../lib/ads';
import {adImage,safeAdUrl} from '../lib/adMedia';
import {trackAd} from '../lib/adEvents';
import '../styles/vector-map.css';
type Props={origin:Point;destination?:Point;access?:Point;place?:Place;option?:Option;adOption?:Option;onPick?:(point:Point)=>void;onDestinationChange?:(point:Point)=>void;onAdDestinationChange?:(point:Point,name:string)=>void;fullscreen?:boolean;stops?:RouteStop[];activeStop?:RouteStop;live?:Point;follow?:boolean;onPan?:()=>void;navigation?:boolean;heading?:number;activeLeg?:number;accuracy?:number;stale?:boolean;remaining?:number;ads?:AdCampaign[]};
const coord=(p:Point):[number,number]=>[p.lng,p.lat];
export default function StreetMap(props:Props & {locationPicker?:boolean;hideOrigin?:boolean;centerPicker?:MapSelection;onPickerChange?:(id:number,point:Point,moving:boolean)=>void;cameraRequest?:number}){
 const container=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),latest=useRef(props),markers=useRef<Marker[]>([]),liveMarker=useRef<Marker|null>(null);
 latest.current=props;
 const draw=useRef<()=>void>(()=>{}),updateAccuracy=useRef<()=>void>(()=>{}),camera=useRef<(reason?:'data'|'resize'|'reset'|'picker')=>void>(()=>{}),updateMarkers=useRef<()=>void>(()=>{}),updateAds=useRef<()=>void>(()=>{}),wakeAnimation=useRef<()=>void>(()=>{});
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 const activeStopMarker=useRef<Marker|null>(null);
 function padding(){
  const rect=container.current!.getBoundingClientRect(),main=container.current!.closest('main');
  const top=main?.querySelector('.dynamic-island, .navigation-top, .nav-top-card, .map-top-minimal')?.getBoundingClientRect(),bottom=main?.querySelector('.map-sheet')?.getBoundingClientRect();
  // The control container includes its margins; reserve those too, not just text.
  const creditHeight=container.current!.querySelector('.maplibregl-ctrl-bottom-right')?.getBoundingClientRect().height??44;
  const p=visibleMapPadding(rect,top,bottom,creditHeight);
  const focus=mapFocus(rect.width,rect.height,p),wrap=container.current!.parentElement;
  wrap?.style.setProperty('--map-focus-x',`${focus.x}px`);wrap?.style.setProperty('--map-focus-y',`${focus.y}px`);
  main?.style.setProperty('--map-header-bottom',`${Math.max(16,(top?.bottom??rect.top+50)-rect.top)}px`);
  const attribution=bottom&&bottom.right>rect.right-100&&bottom.top<rect.bottom?rect.bottom-bottom.top+8:12;
  wrap?.style.setProperty('--map-attribution-bottom',`${Math.min(attribution,Math.max(12,rect.height-48))}px`);
  if(latest.current.navigation){
   const freeTop=(top?.bottom??rect.top+50)-rect.top+10,freeBottom=(bottom?.top??rect.bottom)-rect.top-creditHeight-12;
   const compact=freeBottom-freeTop<118,size=compact?40:46,controlsHeight=compact?size:size*2+8;
   main?.style.setProperty('--nav-tool-size',`${size}px`);
   main?.style.setProperty('--nav-map-secondary-display',compact?'none':'grid');
   main?.style.setProperty('--nav-compact-controls-display',compact?'flex':'none');
   main?.style.setProperty('--nav-controls-top',`${Math.max(freeTop,(freeTop+freeBottom-controlsHeight)/2)}px`);
  }
  return p;
 }
 useEffect(()=>{let disposed=false;let instance:Map|undefined;let observer:ResizeObserver|undefined;let frame=0,lastFrame=0,initialized=false,exploring=false;
  let sponsorPopup:{id:string;popup:Popup}|undefined;
  let pickerId:number|undefined,beforePicker:{center:[number,number];zoom:number;bearing:number;pitch:number;exploring:boolean}|undefined;
  const adTimer=window.setInterval(()=>updateAds.current(),60000);
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
   instance.addControl(new M.AttributionControl({compact:true}),'bottom-right');
   theme.addEventListener('change',change);
   const manual=()=>{exploring=true;latest.current.onPan?.()};
   instance.on('dragstart',event=>{if(event.originalEvent)manual()});
   instance.on('zoomstart',event=>{if(event.originalEvent)manual()});
   function emitPicker(moving:boolean){
    const current=latest.current;if(!instance||!current.centerPicker||current.centerPicker.id!==pickerId)return;
    const focus=mapFocus(instance.getContainer().clientWidth,instance.getContainer().clientHeight,cameraPadding),point=instance.unproject([focus.x,focus.y]);
    current.onPickerChange?.(pickerId,{lat:point.lat,lng:point.lng},moving);
   }
   instance.on('movestart',()=>emitPicker(true));instance.on('moveend',()=>emitPicker(false));
   instance.on('error',()=>{if(!disposed)setError('No se pudieron cargar algunas calles. Revisa tu conexión.')});
   instance.on('idle',()=>{if(!disposed)setError('')});
   draw.current=()=>{
    if(!instance?.getStyle()?.layers)return;
    const current=latest.current,features=current.option?.legs.flatMap((leg,index)=>{
     if(leg.kind==='walk'&&!leg.geometry)return [];
     const coordinates=(leg.geometry??[leg.from,leg.to]).map(coord);if(coordinates.length<2)return [];
     return [{type:'Feature' as const,geometry:{type:'LineString' as const,coordinates},properties:{color:leg.kind==='bus'?leg.route?.color??'#0a9364':mapAppearance(theme.matches).walking,walk:leg.kind==='walk',width:(!current.navigation||index===(current.activeLeg??0))?6:4}}];
    })??[],data={type:'FeatureCollection' as const,features};
    const source=instance.getSource('trip-lines') as GeoJSONSource|undefined;
    if(source)source.setData(data);else{
     instance.addSource('trip-lines',{type:'geojson',data});
     instance.addLayer({id:'trip-halo',type:'line',source:'trip-lines',filter:['==',['get','walk'],false],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':mapAppearance(theme.matches).routeHalo,'line-opacity':.95,'line-width':['interpolate',['linear'],['zoom'],12,5,18,['+',['get','width'],3]]}});
     for(const walk of [false,true])instance.addLayer({id:walk?'trip-walk':'trip-bus',type:'line',source:'trip-lines',filter:['==',['get','walk'],walk],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','color'],'line-width':['interpolate',['linear'],['zoom'],12,2.5,18,walk?4:['get','width']],...(walk?{'line-dasharray':[.2,1.7]}:{})}});
    }
   };
   updateAccuracy.current=()=>{
    if(!instance?.getStyle()?.layers)return;
    const current=latest.current,point=current.live,radius=current.accuracy??0;
    const ring=point?Array.from({length:65},(_,i)=>{const angle=i*Math.PI/32;return [point.lng+Math.cos(angle)*radius/(111320*Math.cos(point.lat*Math.PI/180)),point.lat+Math.sin(angle)*radius/111320]}):[];
    const area={type:'FeatureCollection' as const,features:ring.length?[{type:'Feature' as const,properties:{},geometry:{type:'Polygon' as const,coordinates:[ring]}}]:[]};
    const uncertainty=instance.getSource('location-accuracy') as GeoJSONSource|undefined;
    if(uncertainty)uncertainty.setData(area);else{instance.addSource('location-accuracy',{type:'geojson',data:area});instance.addLayer({id:'location-accuracy',type:'fill',source:'location-accuracy',paint:{'fill-color':'#2684ff','fill-opacity':.09}},instance.getLayer('trip-halo')?'trip-halo':undefined)}
   };
   function drawClosure(){
    if(!instance?.getStyle()?.layers)return;
    const labelFont=instance.getStyle().layers.flatMap(layer=>{const font=layer.type==='symbol'?layer.layout?.['text-font']:undefined;return Array.isArray(font)&&font.every(name=>typeof name==='string')?[font as string[]]:[]})[0]??['Noto Sans Regular'];
    // Keep this independent of the selected transit option and GPS updates.
    if(!instance.getSource('closed-colosio'))instance.addSource('closed-colosio',{type:'geojson',data:{type:'FeatureCollection',features:closedColosioLines.map(coordinates=>({type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates:coordinates.map(point=>[...point])}}))}});
    if(!instance.getLayer('closed-colosio-base'))instance.addLayer({id:'closed-colosio-base',type:'line',source:'closed-colosio',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':theme.matches?'#351d1d':'#fff','line-width':['interpolate',['linear'],['zoom'],11,4,16,12,19,18]}});
    if(!instance.getLayer('closed-colosio-line'))instance.addLayer({id:'closed-colosio-line',type:'line',source:'closed-colosio',layout:{'line-cap':'butt','line-join':'round'},paint:{'line-color':theme.matches?'#ff796b':'#d83c32','line-width':['interpolate',['linear'],['zoom'],11,2.5,16,7,19,11],'line-dasharray':[2,1.3]}});
    if(!instance.getSource('closed-colosio-label'))instance.addSource('closed-colosio-label',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[...closedColosioLabel]}}});
    if(!instance.getLayer('closed-colosio-label'))instance.addLayer({id:'closed-colosio-label',type:'symbol',source:'closed-colosio-label',minzoom:12,layout:{'text-field':'Tramo en construcción','text-font':labelFont,'text-size':['interpolate',['linear'],['zoom'],12,11,16,14],'text-anchor':'bottom','text-offset':[0,-.8],'text-allow-overlap':true},paint:{'text-color':theme.matches?'#ffb4a8':'#9b251c','text-halo-color':theme.matches?'#202328':'#fff','text-halo-width':2.5}});
   }
   instance.on('style.load',()=>{
    if(!instance)return;
    const palette=mapAppearance(theme.matches);
    for(const item of instance.getStyle().layers??[]){
     if(item.type==='fill'&&item.paint?.['fill-pattern'])instance.setPaintProperty(item.id,'fill-pattern',undefined);
     if(latest.current.navigation&&item.type==='symbol'&&/^highway-name/.test(item.id)){
      instance.setLayoutProperty(item.id,'text-size',['interpolate',['linear'],['zoom'],14,10,17,13,19,16]);
      instance.setPaintProperty(item.id,'text-color',palette.text);
      instance.setPaintProperty(item.id,'text-halo-color',palette.halo);instance.setPaintProperty(item.id,'text-halo-width',2);
     }
     if(item.type==='background')instance.setPaintProperty(item.id,'background-color',palette.background);
     if(item.type==='line'&&/highway/.test(item.id))instance.setPaintProperty(item.id,'line-color',/casing/.test(item.id)?palette.casing:/minor|path/.test(item.id)?palette.minor:palette.road);
     if(item.type==='fill'&&/^water/.test(item.id))instance.setPaintProperty(item.id,'fill-color',palette.water);
     if(item.type==='fill'&&/park|landcover_grass/.test(item.id))instance.setPaintProperty(item.id,'fill-color',palette.park);
     if(item.type==='fill'&&/^building/.test(item.id))instance.setPaintProperty(item.id,'fill-color',palette.building);
     if(item.type==='symbol'&&item.layout?.['text-field']&&!(latest.current.navigation&&/^highway-name/.test(item.id))){instance.setPaintProperty(item.id,'text-color',palette.text);instance.setPaintProperty(item.id,'text-halo-color',palette.halo);instance.setPaintProperty(item.id,'text-halo-width',1.2)}
    }
    draw.current();
    updateAccuracy.current();
    drawClosure();
    updateAds.current();
   });
   function marker(point:Point,className:string,label:string,draggable=false){
    const element=document.createElement('div');element.className=className;element.setAttribute('aria-label',label);element.title=label;element.appendChild(document.createElement('span'));element.addEventListener('click',event=>event.stopPropagation());
    return new M.Marker({element,draggable}).setLngLat(coord(point)).addTo(instance!);
   }
   updateMarkers.current=()=>{
    markers.current.forEach(item=>item.remove());markers.current=[];const current=latest.current;
    if(!current.locationPicker&&!current.hideOrigin&&current.centerPicker?.target!=='origin'&&(!current.navigation||!current.live))markers.current.push(marker(current.origin,'vector-origin','Origen'));
    if(current.destination&&current.centerPicker?.target!=='destination'){
     const placeIcon=current.place?getPlaceCategoryIcon(current.place):undefined;
     const item=marker(current.destination,`destination-drag-marker ${placeIcon?'with-icon':''}`,current.locationPicker?'Ubicación privada: arrastra para ajustar':current.place?.name?`Destino: ${current.place.name}`:'Destino: arrastra para cambiarlo',!!current.onDestinationChange);
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
   updateAds.current=()=>{
    if(!instance?.getStyle()?.layers)return;
    const current=latest.current;
    const visible=getVisiblePinAds(current.ads,current.adOption??current.option,current.stops);
    if(sponsorPopup&&!visible.some(ad=>ad.id===sponsorPopup?.id)){sponsorPopup.popup.remove();sponsorPopup=undefined;}
    const data={type:'FeatureCollection' as const,features:visible.map(ad=>({type:'Feature' as const,geometry:{type:'Point' as const,coordinates:coord(ad.coordinates!)},properties:{id:ad.id,title:ad.title}}))};
    const source=instance.getSource('sponsor-pins') as GeoJSONSource|undefined;
    if(source){source.setData(data);return}
    instance.addSource('sponsor-pins',{type:'geojson',data});
    instance.addLayer({id:'sponsor-pin-halo',type:'circle',source:'sponsor-pins',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,8,16,18],'circle-color':'#b45309','circle-opacity':.15,'circle-blur':.45}});
    instance.addLayer({id:'sponsor-pin-point',type:'circle',source:'sponsor-pins',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,6,16,12],'circle-color':'#b77908','circle-stroke-color':'#fff','circle-stroke-width':2.5}});
    instance.addLayer({id:'sponsor-pin-core',type:'circle',source:'sponsor-pins',paint:{'circle-radius':['interpolate',['linear'],['zoom'],11,2,16,4],'circle-color':'#fff'}});
   };
   function openSponsor(ad:AdCampaign){
    if(!ad.coordinates||!instance)return;
    sponsorPopup?.popup.remove();
    const popupEl=document.createElement('div');popupEl.className='golden-pin-popup';
    const tag=document.createElement('span');tag.className='golden-pin-tag';tag.textContent='Patrocinado';popupEl.appendChild(tag);
    const titleRow=document.createElement('div');titleRow.className='golden-pin-title-row';
    const emoji=document.createElement('span');emoji.textContent=ad.icon||'📍';
    const titleText=document.createElement('strong');titleText.textContent=ad.title;titleRow.append(emoji,titleText);popupEl.appendChild(titleRow);
    const trip=latest.current.adOption??latest.current.option;
    const routeId=trip?.legs.find(leg=>leg.route&&(!ad.routeIds?.length||ad.routeIds.includes(leg.route.id)))?.route?.id;
    trackAd(ad.id,'click',routeId);
    const creative=adImage(ad.image);
    if(creative){const img=document.createElement('img');img.className='ad-creative-image';img.src=creative.url;img.alt=creative.alt;img.width=creative.width;img.height=creative.height;img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});popupEl.appendChild(img)}
    const distances=trip?.legs.filter(leg=>leg.kind==='bus'&&leg.route&&(!ad.routeIds?.length||ad.routeIds.includes(leg.route.id))).map(leg=>projectProgress(ad.coordinates!,leg.geometry??[leg.from,leg.to]).distance)??[];
    if(distances.length){const distance=Math.min(...distances);const detail=document.createElement('small');detail.className='golden-pin-distance';detail.textContent=distance<30?'Sobre el recorrido':`A ~${Math.round(distance/10)*10} m del recorrido`;popupEl.appendChild(detail)}
    if(ad.description){const desc=document.createElement('p');desc.className='golden-pin-desc';desc.textContent=ad.description;popupEl.appendChild(desc)}
    if(ad.promoText){const promo=document.createElement('p');promo.className='golden-pin-discount';promo.textContent=ad.promoText;popupEl.appendChild(promo)}
    if(safeAdUrl(ad.ctaUrl)){const link=document.createElement('a');link.className='ad-commercial-link';link.href=ad.ctaUrl;link.target='_blank';link.rel='noopener noreferrer sponsored';link.textContent=`${ad.callToAction?.trim()||'Ver promoción'} ↗`;link.addEventListener('click',event=>{event.stopPropagation();trackAd(ad.id,'click',routeId)});popupEl.appendChild(link)}
    const action=latest.current.onAdDestinationChange??(latest.current.onDestinationChange?((point:Point)=>latest.current.onDestinationChange?.(point)):undefined);
    if(action){const cta=document.createElement('button');cta.type='button';cta.className='golden-pin-cta-btn';cta.textContent='Crear ruta a este negocio →';cta.title='Cambiar destino a este negocio';cta.addEventListener('click',event=>{event.stopPropagation();trackAd(ad.id,'route',routeId);popup.remove();action(ad.coordinates!,ad.title)});popupEl.appendChild(cta)}
    const popup=new M.Popup({offset:18,closeButton:true,className:'golden-pin-popup-wrapper'}).setLngLat(coord(ad.coordinates)).setDOMContent(popupEl).addTo(instance);
    sponsorPopup={id:ad.id,popup};
    const timer=window.setTimeout(()=>{if(!document.hidden&&popupEl.isConnected)trackAd(ad.id,'view',routeId)},1000);
    popup.on('close',()=>{window.clearTimeout(timer);if(sponsorPopup?.popup===popup)sponsorPopup=undefined;});
   }
   instance.on('click',event=>{
    if(!instance)return;
    if(latest.current.centerPicker)return;
    const hit=instance.getLayer('sponsor-pin-point')?instance.queryRenderedFeatures(event.point,{layers:['sponsor-pin-point']})[0]:undefined;
    const ad=hit&&getVisiblePinAds(latest.current.ads,latest.current.adOption??latest.current.option,latest.current.stops).find(item=>item.id===hit.properties?.id);
    if(ad){openSponsor(ad);return}
    latest.current.onPick?.({lat:event.lngLat.lat,lng:event.lngLat.lng});
   });
   camera.current=(reason='data')=>{
    if(!instance||!container.current)return;const current=latest.current,nextPadding=padding();
    if(reason==='resize'&&sameMapPadding(cameraPadding,nextPadding))return;
    cameraPadding=nextPadding;
    if(current.centerPicker){
     if(pickerId!==current.centerPicker.id){
      const center=instance.getCenter();beforePicker={center:[center.lng,center.lat],zoom:instance.getZoom(),bearing:instance.getBearing(),pitch:instance.getPitch(),exploring};pickerId=current.centerPicker.id;
      instance.stop();instance.jumpTo({center:coord(current.centerPicker.initial),zoom:Math.max(instance.getZoom(),15.5),pitch:0,bearing:0,padding:cameraPadding});
     }else if(reason==='resize')instance.setPadding(cameraPadding);
     emitPicker(instance.isMoving());return;
    }
    if(pickerId!==undefined){pickerId=undefined;if(beforePicker&&reason!=='reset'){exploring=beforePicker.exploring;instance.jumpTo({...beforePicker,padding:cameraPadding});if(reason==='picker')return;}beforePicker=undefined;}
    // Only the account picker opts in: selecting a pin never resets its viewport
    // or adds an unrelated origin. Existing trip/navigation cameras are unchanged.
    if(current.locationPicker){if(!initialized){instance.jumpTo({center:coord(current.destination??current.origin),zoom:15,padding:{top:16,bottom:16,left:16,right:16}});initialized=true;}return;}
    if(current.navigation){
     if(reason==='reset'&&!current.follow){const journey=current.adOption??current.option,bounds=new M.LngLatBounds(coord(current.origin),coord(current.destination??current.origin));journey?.legs.forEach(leg=>{bounds.extend(coord(leg.from));bounds.extend(coord(leg.to));leg.geometry?.forEach(point=>bounds.extend(coord(point)))});instance.fitBounds(bounds,{...tripBoundsOptions(cameraPadding,!window.matchMedia('(prefers-reduced-motion: reduce)').matches),bearing:0,pitch:0})}
     else if(current.follow&&!initialized){instance.jumpTo({center:coord(current.live??current.origin),zoom:17.5,bearing:current.heading??0,pitch:35,padding:padding()});initialized=true}
    }
    else if(shouldFitTripCamera(exploring,reason)){
     exploring=false;
     if(current.destination){const bounds=new M.LngLatBounds(coord(current.hideOrigin?current.destination:current.origin),coord(current.destination));if(current.access)bounds.extend(coord(current.access));current.option?.legs.forEach(leg=>{bounds.extend(coord(leg.from));bounds.extend(coord(leg.to));leg.geometry?.forEach(p=>bounds.extend(coord(p)))});current.stops?.forEach(stop=>bounds.extend(coord(stop.coordinates)));instance.fitBounds(bounds,tripBoundsOptions(cameraPadding,reason==='reset'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches))}
     else instance.jumpTo({center:coord(current.origin),zoom:13,padding:cameraPadding});
    }else if(reason==='resize')instance.setPadding(cameraPadding);
   };
   observer=new ResizeObserver(()=>{instance?.resize();camera.current('resize');wakeAnimation.current()});observer.observe(container.current);
   const main=container.current.closest('main');for(const selector of ['.map-sheet','.navigation-top','.nav-top-card','.dynamic-island','.maplibregl-ctrl-attrib']){const item=main?.querySelector(selector);if(item)observer.observe(item)}
   instance.on('load',()=>{if(disposed)return;draw.current();updateAccuracy.current();drawClosure();updateMarkers.current();updateAds.current();camera.current();setReady(true)});
   function animate(now:number){
    frame=0;
    if(disposed||!instance||document.hidden||!latest.current.navigation)return;
    const dt=Math.min(64,now-lastFrame||16);lastFrame=now;
    const current=latest.current,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,a=reduced?1:1-Math.exp(-dt/240);
    const target=current.live??current.origin;
    visual=visual?{lat:visual.lat+(target.lat-visual.lat)*a,lng:visual.lng+(target.lng-visual.lng)*a}:target;
    visualHeading+=headingDelta(visualHeading,current.heading??visualHeading)*a;
    if(current.live&&liveMarker.current){liveMarker.current.setLngLat(coord(visual)).setRotation(visualHeading);liveMarker.current.getElement().classList.toggle('gps-stale',!!current.stale)}
    let cameraMoving=false;
    if(current.navigation&&current.follow&&initialized){
     const mode=current.option?.legs[current.activeLeg??0]?.kind==='bus'?'bus':'walk';
     const {zoom,pitch}=navigationCamera(mode,current.remaining??Infinity,reduced),c=instance.getCenter(),p=instance.getPadding(),goal=cameraPadding;
     const moving=Math.abs(c.lng-visual.lng)+Math.abs(c.lat-visual.lat)>1e-8||Math.abs(headingDelta(instance.getBearing(),current.heading??instance.getBearing()))>.03||Math.abs(zoom-instance.getZoom())>.002||Math.abs(pitch-instance.getPitch())>.03||Math.abs(goal.top-(p.top??0))+Math.abs(goal.bottom-(p.bottom??0))>.1;
     cameraMoving=moving;if(moving)instance.jumpTo({center:[c.lng+(visual.lng-c.lng)*a,c.lat+(visual.lat-c.lat)*a],bearing:instance.getBearing()+headingDelta(instance.getBearing(),current.heading??instance.getBearing())*a,zoom:instance.getZoom()+(zoom-instance.getZoom())*a,pitch:instance.getPitch()+(pitch-instance.getPitch())*a,padding:{top:(p.top??0)+(goal.top-(p.top??0))*a,bottom:(p.bottom??0)+(goal.bottom-(p.bottom??0))*a,left:(p.left??0)+(goal.left-(p.left??0))*a,right:(p.right??0)+(goal.right-(p.right??0))*a}});
    }
    if(cameraMoving||Math.abs(visual.lat-target.lat)+Math.abs(visual.lng-target.lng)>1e-8||Math.abs(headingDelta(visualHeading,current.heading??visualHeading))>.03)frame=requestAnimationFrame(animate);
   }
   wakeAnimation.current=()=>{if(!disposed&&!frame&&!document.hidden&&latest.current.navigation)frame=requestAnimationFrame(animate)};
   wakeAnimation.current();
  }).catch(cause=>{console.error('No se pudo iniciar MapLibre',cause);if(!disposed)setError('No se pudo abrir el mapa. Revisa tu conexión o la compatibilidad WebGL del dispositivo.')});
  const wake=()=>wakeAnimation.current();document.addEventListener('visibilitychange',wake);
  return()=>{disposed=true;window.clearInterval(adTimer);cancelAnimationFrame(frame);wakeAnimation.current=()=>{};document.removeEventListener('visibilitychange',wake);theme.removeEventListener('change',change);observer?.disconnect();activeStopMarker.current?.remove();activeStopMarker.current=null;instance?.remove();map.current=null;liveMarker.current=null;markers.current=[]};
 },[props.navigation]);
 useEffect(()=>{if(!ready)return;draw.current();if(!props.navigation)camera.current()},[ready,props.origin,props.destination,props.option,props.navigation,props.activeLeg,props.hideOrigin]);
 useEffect(()=>{if(ready)updateAccuracy.current()},[ready,props.live,props.accuracy]);
 useEffect(()=>{if(ready)camera.current('picker')},[ready,props.centerPicker?.id]);
 useEffect(()=>{if(ready&&props.cameraRequest!==undefined)camera.current('reset')},[ready,props.cameraRequest]);
 useEffect(()=>{wakeAnimation.current()},[ready,props.live,props.heading,props.follow,props.remaining,props.stale]);
 useEffect(()=>{if(ready)updateMarkers.current()},[ready,props.origin,props.destination,props.access,props.stops,!!props.onDestinationChange,props.navigation,!!props.live,props.hideOrigin,props.centerPicker?.id]);
 useEffect(()=>{if(ready)updateAds.current()},[ready,props.ads,props.navigation?props.adOption:props.option,props.stops]);
 useEffect(()=>{let cancelled=false;const stop=props.navigation?props.activeStop:undefined;
  if(!ready||!map.current||!stop){activeStopMarker.current?.remove();activeStopMarker.current=null;return;}
  import('maplibre-gl').then(M=>{if(cancelled||!map.current)return;
   if(!activeStopMarker.current){const element=document.createElement('div');element.className='active-stop-label';element.addEventListener('click',event=>event.stopPropagation());element.append(document.createElement('small'),document.createElement('strong'));activeStopMarker.current=new M.Marker({element,anchor:'bottom',offset:[0,-12]}).setLngLat(coord(stop.coordinates)).addTo(map.current);}
   const element=activeStopMarker.current.getElement();element.querySelector('small')!.textContent=stop.type==='oficial'?'Próxima parada':'Próxima referencia';element.querySelector('strong')!.textContent=stop.name;
   element.style.setProperty('--stop-route-color',latest.current.option?.legs[stop.legIndex]?.route?.color??'#2563eb');element.setAttribute('aria-label',`Próxima referencia: ${stop.name}`);activeStopMarker.current.setLngLat(coord(stop.coordinates));
  });return()=>{cancelled=true};
 },[ready,props.navigation,props.activeStop?.id,props.activeStop?.legIndex]);
 useEffect(()=>{if(!ready||!map.current)return;let cancelled=false;
  import('maplibre-gl').then(M=>{if(cancelled||!map.current)return;const {live,heading,navigation,follow}=latest.current;
   if(live){if(!liveMarker.current){const element=document.createElement('div');element.className='tracking-arrow';element.setAttribute('aria-label','Tu ubicación');element.appendChild(document.createElement('span'));liveMarker.current=new M.Marker({element,rotationAlignment:'map'}).setLngLat(coord(live)).addTo(map.current)}liveMarker.current.getElement().classList.toggle('directional',heading!==undefined);liveMarker.current.getElement().title=latest.current.stale?'Ubicación sin actualizar':`Precisión aproximada: ${Math.round(latest.current.accuracy??0)} m`}
   if(navigation&&follow)camera.current();
  });return()=>{cancelled=true};
 },[ready,props.live,props.heading,props.follow,props.navigation,props.origin]);
 return <div className="street-map-wrap"><div ref={container} className="street-map" aria-label="Mapa de calles de Tepic"/>{props.centerPicker&&<div className={`map-center-pin ${props.centerPicker.moving?'is-moving':''} ${props.centerPicker.target==='origin'?'is-origin':''}`} aria-hidden="true"><span/><i/></div>}{error&&<p role="status" className="vector-map-error">{error}</p>}</div>;
}
