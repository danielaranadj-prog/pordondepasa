import {useEffect,useRef,useState} from 'react';
import type {AdCampaign} from '../lib/ads';
import type {Point as RouterPoint,Option as RouterOption} from '../lib/router';
import {findDestinationBanner} from '../lib/ads';
import {adImage} from '../lib/adMedia';
import {trackAd} from '../lib/adEvents';
import {observeAdImpression} from '../lib/adImpression';
import '../styles/ad-creative.css';
export function useAdImpression(adId?:string,routeId?:string,onView?:(adId:string)=>void,onceKey?:string){
 const ref=useRef<HTMLDivElement>(null),callback=useRef(onView),counted=useRef(new Set<string>());callback.current=onView;
 useEffect(()=>{
  const target=ref.current,key=onceKey&&adId?`${onceKey}:${adId}`:undefined;
  if(!target||!adId||key&&counted.current.has(key))return;
  return observeAdImpression(target,()=>{
   if(key){if(counted.current.has(key))return;counted.current.add(key)}
   try{callback.current?.(adId)}catch{/* The local frequency cap must not interrupt navigation. */}
   trackAd(adId,'view',routeId);
  });
 },[adId,routeId,onceKey]);return ref;
}
export function AdImage({ad,className=''}:{ad:AdCampaign;className?:string}){const image=adImage(ad.image),[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[image?.url]);return image&&!failed?<img className={'ad-creative-image '+className} src={image.url} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:null}
export function DestinationBanner({destination,option,ads,selected}:{destination:RouterPoint;option:RouterOption;ads:AdCampaign[];selected:boolean}){const ad=selected?findDestinationBanner(destination,option,ads):undefined,routeId=option.legs.find(l=>l.route&&(!ad?.routeIds?.length||ad.routeIds.includes(l.route.id)))?.route?.id,ref=useAdImpression(ad?.id,routeId);if(!ad)return null;let safe=false;try{const u=new URL(ad.ctaUrl??'');safe=u.protocol==='https:'&&!u.username&&!u.password}catch{}return <div className="destination-banner" ref={ref}><small>PUBLICIDAD · CERCA DE TU DESTINO</small><AdImage ad={ad}/><strong>{ad.title}</strong><p>{ad.promoText||ad.description}</p>{safe&&<a href={ad.ctaUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={()=>trackAd(ad.id,'click',routeId)}>{ad.callToAction||'Conocer la promoción'} →</a>}</div>}
