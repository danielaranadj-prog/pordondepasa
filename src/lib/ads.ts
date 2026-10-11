import { meters, type Point } from './router';

export type AdType = 'banner' | 'pin' | 'landmark' | 'adsense';

export interface AdCampaign {
  id: string;
  clientId: string;
  type: AdType;
  title: string;
  description: string;
  icon: string;
  referenceText?: string;
  promoText?: string;
  routeIds?: string[];
  coordinates?: Point;
  radiusMeters?: number;
  callToAction?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

/**
 * Searches for an active landmark ad within radius of the target alighting point.
 */
export function findMatchingLandmarkAd(alightingPoint: Point, ads?: AdCampaign[]): AdCampaign | undefined {
  if (!ads || ads.length === 0) return undefined;
  let nearest: AdCampaign | undefined;
  let minDistance = Infinity;

  for (const ad of ads) {
    if (!ad.isActive || ad.type !== 'landmark' || !ad.coordinates || !ad.referenceText) continue;
    const radius = ad.radiusMeters ?? 350;
    const distance = meters(alightingPoint, ad.coordinates);
    if (distance <= radius && distance < minDistance) {
      minDistance = distance;
      nearest = ad;
    }
  }

  return nearest;
}

/**
 * Searches for all active pin ads that have coordinates.
 */
export function getActivePinAds(ads?: AdCampaign[]): AdCampaign[] {
  if (!ads || ads.length === 0) return [];
  return ads.filter(ad => ad.isActive && ad.type === 'pin' && ad.coordinates);
}

