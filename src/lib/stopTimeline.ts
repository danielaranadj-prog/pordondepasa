import type {RouteStop} from './navigation.ts';
export function stopTimeline(stops:RouteStop[],legIndex:number,along:number,trusted:boolean){
 const current=stops.filter(stop=>stop.legIndex===legIndex);
 const passed=trusted?current.filter(stop=>stop.along<along-25):[];
 const upcoming=trusted?current.filter(stop=>stop.along>=along-25):current;
 return {passed,upcoming,next:trusted?upcoming[0]:undefined};
}
