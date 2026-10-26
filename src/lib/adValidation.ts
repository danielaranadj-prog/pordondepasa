import type {AdCampaign,SponsoredTripConfig} from './ads.ts';
import {safeAdUrl,adImage} from './adMedia.ts';
import {validAdSchedule} from './adSchedule.ts';
const text=(value:unknown,max:number,required=false):value is string=>typeof value==='string'&&value.length<=max&&(!required||!!value.trim());
export function validSponsor(value:unknown):value is SponsoredTripConfig{
 if(!value||typeof value!=='object')return false;const c=value as SponsoredTripConfig;
 if(!text(c.headline,160,true)||!text(c.promoOffer,500,true)||!text(c.ctaText,80,true)||!safeAdUrl(c.ctaUrl)||!['web','whatsapp'].includes(c.ctaType))return false;
 if(c.ctaType==='whatsapp'){const url=new URL(c.ctaUrl);if(url.hostname!=='wa.me'||!/^\/\d{10,15}$/.test(url.pathname))return false;}
 return [c.durationSeconds,c.canSkipAfterSeconds,c.dailyCapPerUser,c.cooldownHours].every(n=>n===undefined||Number.isFinite(n)&&n>=0&&n<=168)&&
  (c.promoDisclaimer===undefined||text(c.promoDisclaimer,500))&&(c.brandBadgeText===undefined||text(c.brandBadgeText,100));
}
/** Untrusted CMS/local JSON is data, never a trusted TypeScript assertion. */
export function validCampaign(value:unknown):value is AdCampaign{
 if(!value||typeof value!=='object')return false;const ad=value as AdCampaign;
 if(!text(ad.id,120,true)||!['pin','landmark','sponsored_trip','banner'].includes(ad.type)||!text(ad.title,200,true)||typeof ad.isActive!=='boolean')return false;
 for(const key of ['description','referenceText','promoText','callToAction'] as const)if(ad[key]!==undefined&&!text(ad[key],1000))return false;
 if(ad.icon!==undefined&&!text(ad.icon,40))return false;
 if(ad.routeIds!==undefined&&(!Array.isArray(ad.routeIds)||ad.routeIds.length>100||!ad.routeIds.every(id=>text(id,120,true))))return false;
 if(ad.type==='sponsored_trip'&&(!ad.routeIds?.length||!validSponsor(ad.sponsoredTrip)))return false;
 if(ad.type!=='sponsored_trip'&&(!ad.coordinates||!Number.isFinite(ad.coordinates.lat)||!Number.isFinite(ad.coordinates.lng)||Math.abs(ad.coordinates.lat)>90||Math.abs(ad.coordinates.lng)>180))return false;
 if(ad.radiusMeters!==undefined&&(!Number.isFinite(ad.radiusMeters)||ad.radiusMeters<=0||ad.radiusMeters>10000))return false;
 if(ad.ctaUrl!==undefined&&!safeAdUrl(ad.ctaUrl))return false;
 if(ad.image!==undefined&&!adImage(ad.image))return false;
 if([ad.startDate,ad.endDate].some(d=>d!==undefined&&!text(d,40)))return false;
 return validAdSchedule(ad.schedule);
}
