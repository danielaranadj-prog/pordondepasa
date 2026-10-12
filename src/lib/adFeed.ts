import type {AdCampaign} from './ads.ts';

export interface PublicAdFeed { schemaVersion: 1; enabled: boolean; version: string; campaigns: AdCampaign[] }
export type AdMode = 'off'|'local'|'remote';

// GPS still exports the original Río Suchiate identifier, while the transit
// dataset uses the corrected ID. Translate only this known legacy ID at the
// feed boundary; never broaden a campaign to unrelated routes.
const legacyRouteIds: Record<string, string> = {'r-o-suchiate':'r-rio-suchiate'};
export function normalizeAdRouteIds(campaigns: AdCampaign[]): AdCampaign[] {
  return campaigns.map(ad => {
    if (!Array.isArray(ad.routeIds)) return ad;
    const routeIds = [...new Set(ad.routeIds.map(id => legacyRouteIds[id] ?? id))];
    return routeIds.every((id, index) => id === ad.routeIds![index]) && routeIds.length === ad.routeIds.length
      ? ad : {...ad, routeIds};
  });
}

export function parsePublicAdFeed(value: unknown): PublicAdFeed | undefined {
  if (!value || typeof value !== 'object') return;
  const feed = value as Record<string, unknown>;
  if (feed.schemaVersion !== 1 || typeof feed.enabled !== 'boolean' || typeof feed.version !== 'string' ||
      !Array.isArray(feed.campaigns) || feed.campaigns.length > 100) return;
  if (!feed.campaigns.every(item => item && typeof item === 'object' &&
    typeof item.id === 'string' && item.id.length > 0 &&
    ['pin','landmark','sponsored_trip'].includes(item.type) &&
    typeof item.title === 'string' && typeof item.isActive === 'boolean' &&
    Array.isArray(item.routeIds) && item.routeIds.every((id:unknown) => typeof id === 'string'))) return;
  return feed as unknown as PublicAdFeed;
}

/** An unavailable or malformed online feed never falls back to old paid placements. */
export async function loadPublicAds(mode: AdMode, localUrl: string, remoteUrl: string,
  fetcher: typeof fetch = fetch): Promise<AdCampaign[]> {
  if (mode === 'off') return [];
  const url = mode === 'local' ? localUrl : remoteUrl;
  if (!url) return [];
  if (mode === 'remote') {
    try {
      const parsed = new URL(url, typeof location === 'undefined' ? 'http://localhost' : location.href);
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname))) return [];
    } catch { return []; }
  }
  try {
    const response = await fetcher(url, {cache:'no-store', signal:AbortSignal.timeout(5000)});
    if (!response.ok) return [];
    const data:unknown = await response.json();
    if (mode === 'local') return Array.isArray(data) ? normalizeAdRouteIds(data as AdCampaign[]) : [];
    const feed = parsePublicAdFeed(data);
    return feed?.enabled ? normalizeAdRouteIds(feed.campaigns) : [];
  } catch { return []; }
}
