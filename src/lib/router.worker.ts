import {findRoutes, type Shape} from './router';
import {WalkingRouter,type WalkNetwork} from './walking';
import {apply21Febrero,applyMetates} from './detours';
import {splitKnownRouteBreaks} from './routeFragments';
let loading:Promise<{shapes:Shape[];walking:WalkingRouter}>|undefined;
function load(){return loading??=Promise.all([
 fetch(`${import.meta.env.BASE_URL}data/tepic-routes.json`).then(async r=>{if(!r.ok)throw new Error();return (await r.json()).routes as Shape[]}),
 fetch(`${import.meta.env.BASE_URL}data/tepic-walk-network.json`).then(async r=>{if(!r.ok)throw new Error();return new WalkingRouter(await r.json() as WalkNetwork)}),
 fetch(`${import.meta.env.BASE_URL}data/detours/colosio-metates.geojson`).then(async r=>{if(!r.ok)throw new Error();return r.json()}),
 fetch(`${import.meta.env.BASE_URL}data/detours/colosio-21-de-febrero.geojson`).then(async r=>{if(!r.ok)throw new Error();return r.json()}),
 fetch(`${import.meta.env.BASE_URL}data/detours/hospitales-1-hacia-victoria.geojson`).then(async r=>{if(!r.ok)throw new Error();return r.json()})
]).then(([shapes,walking,metates,febrero,victoria])=>({shapes:splitKnownRouteBreaks(apply21Febrero(applyMetates(shapes,metates),febrero,victoria)),walking})).catch(error=>{loading=undefined;throw error})}
self.onmessage=async(event)=>{
 const {id,origin,destination}=event.data;
 try{
  const {shapes,walking}=await load();
  if(!walking.snaps(origin).length){self.postMessage({id,code:'origin_off_street',error:'El origen quedó fuera de las calles disponibles. Toca una calle en el mapa para ubicarlo.'});return;}
  if(!walking.snaps(destination).length){self.postMessage({id,code:'destination_off_street',error:'El destino quedó fuera de las calles disponibles. Toca una calle en el mapa para ubicarlo.'});return;}
  self.postMessage({id,options:walking.refine(findRoutes(origin,destination,shapes,25))});
 }catch{self.postMessage({id,error:'No se pudieron calcular las rutas.'});}
};
