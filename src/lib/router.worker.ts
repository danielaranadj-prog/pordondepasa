import {journeyService,serviceNotice} from './serviceHours';
import {findRoutes, type Shape} from './router';
import {WalkingRouter,type WalkNetwork} from './walking';
import {loadTransitShapes} from './transitShapes';
import {fetchDataset,DatasetChangedError} from './datasetFetch';
let loading:Promise<{shapes:Shape[];walking:WalkingRouter}>|undefined;
let walkingLoading:Promise<WalkingRouter>|undefined;
function loadWalking(){return walkingLoading??=fetchDataset<WalkNetwork>('tepic-walk-network.json').then(data=>new WalkingRouter(data)).catch(error=>{walkingLoading=undefined;throw error})}
function load(){return loading??=Promise.all([
 loadTransitShapes(),
 loadWalking(),
]).then(([shapes,walking])=>({shapes,walking})).catch(error=>{loading=undefined;throw error})}
self.onmessage=async(event)=>{
 const {id,origin,destination}=event.data;
 try{
  if(event.data.kind==='walk'){
   const walking=await loadWalking();
   const leg=walking.route(origin,destination,{heading:event.data.heading});
   self.postMessage({id,leg});return;
  }
  const {shapes,walking}=await load();
  if(!walking.snaps(origin).length){self.postMessage({id,code:'origin_off_street',error:'El origen quedó fuera de las calles disponibles. Ajusta el pin sobre una calle y confirma el origen.'});return;}
  if(!walking.snaps(destination).length){self.postMessage({id,code:'destination_off_street',error:'El destino quedó fuera de las calles disponibles. Ajusta el pin sobre una calle y confirma el destino.'});return;}
  const departAt=Number.isFinite(event.data.departAt)?event.data.departAt:Date.now();
  let closedMessage='';
  const options=findRoutes(origin,destination,shapes,5,candidate=>{
   const refined=walking.refineCandidate(candidate);if(!refined)return null;
   const service=journeyService(refined,departAt);if(!service.available){closedMessage=service.message;return null}return refined;
  });
  if(!options.length&&closedMessage){const notice=serviceNotice(departAt);self.postMessage({id,code:'outside_service_hours',error:`${notice.title}. ${closedMessage} Considera Uber, DiDi, inDrive o taxi.`});return}
  self.postMessage({id,options});
 }catch(error){self.postMessage({id,...(error instanceof DatasetChangedError?{code:'dataset_changed',error:error.message}:{error:'No se pudieron calcular las rutas. Comprueba la conexión o usa el viaje guardado.'})});}
};
