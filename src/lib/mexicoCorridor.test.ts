import data from '../../public/data/tepic-routes.json' with {type:'json'};
import {findRoutes,meters,MAX_UNVERIFIED_BUS_EDGE_METERS,type Shape} from './router.ts';

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
console.log('OK: Ruta México es continua y ofrece viaje directo en ambos sentidos del corredor.');
