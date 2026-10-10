import {findRoutes,meters,type Shape} from './router.ts';
import {splitKnownRouteBreaks} from './routeFragments.ts';
import data from '../../public/data/tepic-routes.json' with {type:'json'};

const original=(data.routes as Shape[]).find(route=>route.id==='agr-nomos-universidad');
if(!original)throw new Error('Missing Agrónomos Universidad');
const fragments=splitKnownRouteBreaks([original]);
if(fragments.length!==2||fragments[0].coordinates.length!==221||fragments[1].coordinates.length!==20)
 throw new Error('Unexpected break index');
if(JSON.stringify(fragments.flatMap(route=>route.coordinates))!==JSON.stringify(original.coordinates))
 throw new Error('The split must preserve every source point in its original order');
if(fragments.some(route=>route.id!==original.id||route.color!==original.color||route.name!==original.name))
 throw new Error('The split must preserve public route identity and display metadata');
if(meters(fragments[0].coordinates.at(-1)!,fragments[1].coordinates[0])<3000)
 throw new Error('The source gap was not detected');
const cross=findRoutes(fragments[0].coordinates[50],fragments[1].coordinates[5],fragments);
if(cross.some(option=>option.transfers>0))throw new Error('Separate loops must not create a same-route transfer');
for(const option of cross)for(const leg of option.legs.filter(leg=>leg.kind==='bus')){
 if(!fragments.includes(leg.route!))throw new Error('Bus leg must belong to a real fragment');
 for(let i=1;i<(leg.geometry?.length??0);i++)
  if(meters(leg.geometry![i-1],leg.geometry![i])>1000)throw new Error('Bus leg crosses an unverified gap');
}
for(const [fragment,from,to] of [[fragments[0],40,80],[fragments[1],2,10]] as const){
 if(!findRoutes(fragment.coordinates[from],fragment.coordinates[to],[fragment]).some(option=>option.legs.some(leg=>leg.kind==='bus')))
  throw new Error('A valid ride within a fragment was lost');
}
console.log('OK: Agrónomos Universidad has two intact loops; valid rides remain, no gap or same-route transfer');
