import {meters,type Point} from './router.ts';
import {headingDelta,movementHeading} from './heading.ts';
/** Infer only a change of direction on the supplied street geometry, never street names. */
export function nextManeuver(line:Point[],along:number){
 let distance=0;
 for(let i=1;i<line.length-1;i++){
  distance+=meters(line[i-1],line[i]);
  if(distance<along+12)continue;
  if(distance>along+250)break;
  let before=i-1,after=i+1;
  while(before>0&&meters(line[before],line[i])<15)before--;
  while(after<line.length-1&&meters(line[after],line[i])<15)after++;
  const angle=headingDelta(movementHeading(line[before],line[i]),movementHeading(line[i],line[after]));
  if(Math.abs(angle)>=45&&Math.abs(angle)<=135)return {distance:distance-along,label:angle>0?'Gira a la derecha':'Gira a la izquierda',icon:angle>0?'↱':'↰'};
 }
 return undefined;
}
