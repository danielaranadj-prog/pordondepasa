import {findRoutes, type Shape} from './router';
import {WalkingRouter,type WalkNetwork} from './walking';
let loading:Promise<{shapes:Shape[];walking:WalkingRouter}>|undefined;
function load(){return loading??=Promise.all([
 fetch(`${import.meta.env.BASE_URL}data/tepic-routes.json`).then(async r=>{if(!r.ok)throw new Error();return (await r.json()).routes as Shape[]}),
 fetch(`${import.meta.env.BASE_URL}data/tepic-walk-network.json`).then(async r=>{if(!r.ok)throw new Error();return new WalkingRouter(await r.json() as WalkNetwork)})
]).then(([shapes,walking])=>({shapes,walking})).catch(error=>{loading=undefined;throw error})}
self.onmessage=async(event)=>{
 const {id,origin,destination}=event.data;
 try{
  const {shapes,walking}=await load();
  self.postMessage({id,options:walking.refine(findRoutes(origin,destination,shapes,25))});
 }catch{self.postMessage({id,error:'No se pudieron calcular las rutas.'});}
};
