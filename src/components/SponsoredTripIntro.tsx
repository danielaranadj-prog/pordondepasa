import {useEffect,useRef,useState} from 'react';
import type {AdCampaign} from '../lib/ads.ts';
import {recordSponsoredTripEvent,sponsoredIntroTiming} from '../lib/sponsoredTrip.ts';
import {AdImage,useAdImpression} from './AdCreative';
import {trackAd} from '../lib/adEvents';
import '../styles/sponsored-trip.css';

export default function SponsoredTripIntro({ad,routeName,routeId,onContinue}:{ad:AdCampaign;routeName:string;routeId?:string;onContinue:()=>void}) {
  const impression=useAdImpression(ad.id,routeId);
  const config = ad.sponsoredTrip!;
  const {duration,skipAfter} = sponsoredIntroTiming(config);
  const started = useRef(Date.now());
  const lastTick = useRef(Date.now());
  const finished = useRef(false);
  const counted = useRef(false);
  const [elapsed,setElapsed] = useState(0);
  useEffect(() => {
    if (!counted.current) {recordSponsoredTripEvent(ad.id,'sponsored_trip_views',started.current);counted.current=true;}
    const resetTick=()=>{lastTick.current=Date.now()};
    document.addEventListener('visibilitychange',resetTick);
    const timer = window.setInterval(() => {const now=Date.now(),delta=Math.max(0,now-lastTick.current)/1000;lastTick.current=now;if(!document.hidden)setElapsed(previous=>previous+delta)},50);
    return () => {window.clearInterval(timer);document.removeEventListener('visibilitychange',resetTick)};
  },[ad.id]);
  function finish(skipped:boolean) {
    if (finished.current) return;
    finished.current = true;
    recordSponsoredTripEvent(ad.id,skipped?'sponsored_trip_skips':'sponsored_trip_completions');
    trackAd(ad.id,skipped?'skip':'complete',routeId);
    onContinue();
  }
  useEffect(() => { if (elapsed >= duration) finish(false); },[elapsed,duration]);
  const remaining = Math.max(0,Math.ceil(duration-elapsed));
  return <main className="sponsored-trip-screen" data-screen="patrocinio-de-viaje" aria-label="Patrocinio de viaje">
    <div className="sponsored-trip-content">
      <div className="sponsored-trip-header"><span>🚌 Ruta {routeName}</span><span>Publicidad</span></div>
      <div className="sponsored-trip-card" ref={impression}>
        <span className="sponsored-trip-badge">{config.brandBadgeText || 'Patrocinador de este viaje'}</span>
        <span className="sponsored-trip-icon" aria-hidden="true">{ad.icon || '✦'}</span>
        <AdImage ad={ad}/>
        <h1>{config.headline}</h1>
        <p className="sponsored-trip-offer">{config.promoOffer}</p>
        {config.promoDisclaimer && <small>{config.promoDisclaimer}</small>}
        <a className="sponsored-trip-cta" href={config.ctaUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={() => {recordSponsoredTripEvent(ad.id,'sponsored_trip_cta_clicks');trackAd(ad.id,'click',routeId)}}>
          {config.ctaType === 'whatsapp' && <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .5A11.4 11.4 0 0 0 2.2 17.8L.7 23.3l5.6-1.5A11.5 11.5 0 1 0 12 .5Zm0 20.9c-1.7 0-3.3-.4-4.8-1.3l-.3-.2-3.3.9.9-3.2-.2-.3A9.3 9.3 0 1 1 12 21.4Zm5.1-7c-.3-.2-1.6-.8-1.9-.9-.2-.1-.4-.2-.6.1-.2.3-.7.9-.9 1-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.5-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4H8c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.3s1 2.6 1.1 2.8c.2.2 1.9 2.9 4.6 4.1.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.1-1.3-.1-.2-.2-.2-.5-.4Z"/></svg>}
          {config.ctaText}
        </a>
      </div>
      <div className="sponsored-trip-footer">
        <div className="sponsored-trip-progress" role="progressbar" aria-valuenow={Math.min(100,Math.round(elapsed/duration*100))} aria-valuemin={0} aria-valuemax={100} aria-label="Tiempo antes de abrir el mapa"><span style={{width:`${Math.min(100,elapsed/duration*100)}%`}}/></div>
        <p>Abriendo el mapa en {remaining} s</p>
        {elapsed >= skipAfter && <button type="button" onClick={() => finish(true)}>Continuar al mapa →</button>}
      </div>
    </div>
  </main>;
}
