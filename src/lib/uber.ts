import type {Point} from './router';

/** Only built locally: coordinates are shared when the user opens Uber. */
export function uberTripLink(origin:Point,destination:Point,originName:string,destinationName:string){
 const url=new URL('https://m.uber.com/looking');
 url.searchParams.set('pickup',JSON.stringify({latitude:origin.lat,longitude:origin.lng,addressLine1:originName}));
 url.searchParams.set('drop[0]',JSON.stringify({latitude:destination.lat,longitude:destination.lng,addressLine1:destinationName}));
 return url.toString();
}
