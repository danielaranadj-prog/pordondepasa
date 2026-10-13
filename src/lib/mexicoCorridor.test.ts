import data from '../../public/data/tepic-routes.json' with {type:'json'};
import {findRoutes,meters,MAX_UNVERIFIED_BUS_EDGE_METERS,type Shape} from './router.ts';
import network from '../../public/data/tepic-walk-network.json' with {type:'json'};
import stopsData from '../../public/data/stops/mexico-stops.json' with {type:'json'};
import {WalkingRouter,type WalkNetwork} from './walking.ts';
import {stopsForOption,type TransitStop} from './navigation.ts';

const mexico=(data.routes as Shape[]).find(route=>route.id==='m-xico');
if(!mexico)throw new Error('Falta Ruta México');

// Este corredor de Av. Tepic-Xalisco / Av. México debe ser continuo en
// ambos sentidos; un salto en los puntos vuelve invisible la ruta al buscar.
for(const [from,to] of [[8,15],[20,29]] as const){
 const corridor=mexico.coordinates.slice(from,to+1);
 if(corridor.length<3)throw new Error('Faltan puntos intermedios de Ruta México');
 for(let i=1;i<corridor.length;i++){
  const gap=meters(corridor[i-1],corridor[i]);
  if(gap>MAX_UNVERIFIED_BUS_EDGE_METERS)
   throw new Error(`Salto sin verificar de ${Math.round(gap)} m en Ruta México`);
 }
 const options=findRoutes(corridor[0],corridor.at(-1)!,[mexico],25);
 const direct=options.find(option=>option.id==='direct-m-xico');
 if(!direct)throw new Error('Ruta México no aparece como viaje directo en el corredor');
 const ride=direct.legs.find(leg=>leg.kind==='bus');
 if(!ride?.geometry?.length)throw new Error('Falta el trazo del viaje en Ruta México');
 for(let i=1;i<ride.geometry.length;i++)
  if(meters(ride.geometry[i-1],ride.geometry[i])>MAX_UNVERIFIED_BUS_EDGE_METERS)
   throw new Error('El viaje de Ruta México cruza un salto sin verificar');
}
const walking=new WalkingRouter(network as unknown as WalkNetwork);
const stops=stopsData.stops.map(stop=>({...stop,source:'mexico'})) as TransitStop[];
const banderas={lat:21.472365,lng:-104.889448};
const victoria={lat:21.515208,lng:-104.8903836};
const madero={lat:21.5205434,lng:-104.8883219};
for(const [origin,destination] of [[victoria,banderas],[madero,banderas],[banderas,victoria]]){
 const options=walking.refine(findRoutes(origin,destination,data.routes as Shape[],25));
 const direct=options.find(option=>option.id==='direct-m-xico');
 if(!direct)throw new Error('Ruta México no es visible en la búsqueda real Victoria/Madero/Banderas');
 const relevant=stopsForOption(direct,stops);
 if(destination===banderas){
  if(!relevant.some(stop=>stop.name==='Hidalgo')||!relevant.some(stop=>stop.name==='Miñon'))
   throw new Error('Faltan las paradas de retorno sobre Avenida México en el viaje circular');
  if(relevant.some(stop=>stop.name==='Avenida México - Hidalgo'))
   throw new Error('La bajada de sentido norte no debe aparecer en el recorrido sur');
 }else if(!relevant.some(stop=>stop.name==='Avenida México - Hidalgo'))throw new Error('Se perdieron las paradas hacia el norte');
}
console.log('OK: Ruta México es continua y ofrece viaje directo en ambos sentidos del corredor.');
