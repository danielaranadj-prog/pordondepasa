import {isDeliverableAd, type AdCampaign} from './ads.ts';

const STORAGE_KEY = 'pordondepasa:sponsored-trip:v1';
export type SponsoredEventType = 'sponsored_trip_views' | 'sponsored_trip_completions' | 'sponsored_trip_cta_clicks' | 'sponsored_trip_skips';
export interface SponsoredEvent {adId:string;type:SponsoredEventType;at:number}

function readEvents(storage?: Pick<Storage,'getItem'>): SponsoredEvent[] {
  try {
    const source = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
    const parsed = JSON.parse(source?.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((event):event is SponsoredEvent =>
      !!event && typeof event.adId === 'string' && Number.isFinite(event.at) &&
      ['sponsored_trip_views','sponsored_trip_completions','sponsored_trip_cta_clicks','sponsored_trip_skips'].includes(event.type)) : [];
  } catch { return []; }
}

export function isPremiumUser(storage?: Pick<Storage,'getItem'>): boolean {
  try { return (storage ?? localStorage).getItem('isPremiumUser') === 'true'; } catch { return false; }
}

export function canShowSponsoredTrip(ad: AdCampaign, routeId: string, now = new Date(), storage?: Pick<Storage,'getItem'|'setItem'>): boolean {
  if (isPremiumUser(storage) || ad.type !== 'sponsored_trip' || !routeId ||
      !ad.routeIds?.includes(routeId) || !isDeliverableAd(ad,now,[routeId])) return false;
  // If impressions cannot be persisted (private/full storage), fail open for navigation,
  // not for advertising: never show an unmetered interstitial repeatedly.
  try { const target=storage??localStorage;target.setItem(STORAGE_KEY,target.getItem(STORAGE_KEY)??'[]'); }
  catch { return false; }
  const config = ad.sponsoredTrip;
  if (!config || !config.headline?.trim() || !config.promoOffer?.trim() || !config.ctaText?.trim() ||
      !isSafeSponsoredUrl(config.ctaUrl,config.ctaType)) return false;
  const views = readEvents(storage).filter(event => event.type === 'sponsored_trip_views');
  const cap = Math.min(2,Math.max(1,config.dailyCapPerUser ?? 2));
  const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const todaysViews = views.filter(event => {
    const date = new Date(event.at);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` === day;
  });
  if (todaysViews.length >= cap) return false;
  const lastView = views.at(-1);
  const cooldownMs = Math.max(0,config.cooldownHours ?? 3) * 3600000;
  return !lastView || now.getTime() - lastView.at >= cooldownMs;
}

export function isSafeSponsoredUrl(url:string,type:'whatsapp'|'web'):boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return type === 'whatsapp' ? parsed.hostname === 'wa.me' && /^\/\d{10,15}$/.test(parsed.pathname) : true;
  } catch { return false; }
}

export function recordSponsoredTripEvent(adId:string,type:SponsoredEventType,at=Date.now(),storage?:Pick<Storage,'getItem'|'setItem'>):void {
  try {
    const target = storage ?? localStorage;
    const recent = readEvents(target).filter(event => at-event.at < 90*86400000);
    recent.push({adId,type,at});
    target.setItem(STORAGE_KEY,JSON.stringify(recent.slice(-1000)));
  } catch { /* Private browsing or full storage: advertising must not block navigation. */ }
}

/** Anonymous per-campaign totals for a future export UI; remains on this device only. */
export function sponsoredTripReport(storage?:Pick<Storage,'getItem'>):Record<string,Record<SponsoredEventType,number>> {
  const report:Record<string,Record<SponsoredEventType,number>> = {};
  for (const event of readEvents(storage)) {
    report[event.adId] ??= {sponsored_trip_views:0,sponsored_trip_completions:0,sponsored_trip_cta_clicks:0,sponsored_trip_skips:0};
    report[event.adId][event.type]++;
  }
  return report;
}
