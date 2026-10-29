import type {Shape} from './router';
import {apply21Febrero,applyMetates} from './detours.ts';
import {splitKnownRouteBreaks} from './routeFragments.ts';
import {fetchDataset} from './datasetFetch.ts';

/** Shared by planning and exploration: same verified dataset, detours and breaks. */
export async function loadTransitShapes(fetcher:typeof fetch=fetch):Promise<Shape[]>{
 const [data,metates,febrero,victoria]=await Promise.all([
  fetchDataset<{routes:Shape[]}>('tepic-routes.json',fetcher),
  fetchDataset<any>('detours/colosio-metates.geojson',fetcher),
  fetchDataset<any>('detours/colosio-21-de-febrero.geojson',fetcher),
  fetchDataset<any>('detours/hospitales-1-hacia-victoria.geojson',fetcher),
 ]);
 return splitKnownRouteBreaks(apply21Febrero(applyMetates(data.routes,metates),febrero,victoria));
}
