import { meters, type Option, type Point } from './router.ts';
import { projectProgress, type RouteStop } from './navigation.ts';

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

const validPoint = (point?: Point): point is Point => !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
const localDay = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
function dateKey(value?: string): string | undefined {
  if (!value) return undefined;
  if (typeof value !== 'string') return undefined;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const parsed = new Date(`${day}T12:00:00`);
  return Number.isNaN(parsed.getTime()) || localDay(parsed) !== day ? undefined : day;
}

/** Shared delivery gate for every locally exported campaign. Invalid schedules fail closed. */
export function isDeliverableAd(ad: AdCampaign, now = new Date(), routeIds: string[] = []): boolean {
  if (!ad.isActive || typeof ad.id !== 'string' || !ad.id || !ad.type || typeof ad.title !== 'string' || !ad.title.trim() || !validPoint(ad.coordinates)) return false;
  if (ad.routeIds !== undefined && (!Array.isArray(ad.routeIds) || ad.routeIds.some(id => typeof id !== 'string'))) return false;
  if (ad.radiusMeters !== undefined && (!Number.isFinite(ad.radiusMeters) || ad.radiusMeters <= 0)) return false;
  const start = dateKey(ad.startDate), end = dateKey(ad.endDate), today = localDay(now);
  if ((ad.startDate && !start) || (ad.endDate && !end) || (start && end && start > end)) return false;
  if ((start && today < start) || (end && today > end)) return false;
  if (ad.routeIds?.length && !ad.routeIds.some(id => routeIds.includes(id))) return false;
  return true;
}

/** Match the verified alighting point, not passenger GPS or a guessed stop. */
export function findMatchingLandmarkAd(alightingPoint: Point, ads?: AdCampaign[], routeId?: string, now = new Date()): AdCampaign | undefined {
  if (!validPoint(alightingPoint) || !ads?.length) return undefined;
  return ads
    .filter(ad => ad.type === 'landmark' && typeof ad.referenceText === 'string' && !!ad.referenceText.trim() && isDeliverableAd(ad, now, routeId ? [routeId] : []))
    .map(ad => ({ad, distance: meters(alightingPoint, ad.coordinates!)}))
    .filter(item => item.distance <= Math.min(item.ad.radiusMeters ?? 350, 350))
    .sort((a, b) => a.distance - b.distance || a.ad.id.localeCompare(b.ad.id))[0]?.ad;
}

/** No commercial prompt from an untrusted fix or before the actual bus alighting leg. */
export function canShowAlightingAd(kind: 'walk'|'bus', trusted: boolean, acceptedAlong: number, length: number, remaining: number): boolean {
  return kind === 'bus' && trusted && Number.isFinite(length) && length > 0 && Number.isFinite(acceptedAlong) && Number.isFinite(remaining) && acceptedAlong >= length - 350 && remaining >= 0 && remaining <= 350;
}

/** Visible near this itinerary, without covering a known transit stop. */
export function getVisiblePinAds(ads?: AdCampaign[], option?: Option, stops: RouteStop[] = [], now = new Date()): AdCampaign[] {
  if (!ads?.length) return [];
  const routeIds = option?.legs.flatMap(leg => leg.kind === 'bus' && leg.route ? [leg.route.id] : []) ?? [];
  return ads.filter(ad => ad.type === 'pin' && isDeliverableAd(ad, now, routeIds)).filter(ad => {
    const point = ad.coordinates!;
    if (stops.some(stop => meters(point, stop.coordinates) < 20)) return false;
    if (!option) return !ad.routeIds?.length;
    const radius = Math.min(ad.radiusMeters ?? 350, 500);
    return option.legs.some(leg => projectProgress(point, leg.geometry ?? [leg.from, leg.to]).distance <= radius);
  }).sort((a, b) => a.id.localeCompare(b.id));
}

