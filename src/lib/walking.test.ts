import {WalkingRouter,type WalkNetwork} from './walking.ts';
import {meters} from './router.ts';
function expect(value:unknown,message:string){if(!value)throw new Error(message)}
const data:WalkNetwork={nodes:[[21.5,-104.9],[21.501,-104.9],[21.501,-104.899]],edges:[[0,1,'Primera'],[1,2,'Segunda']]};
const router=new WalkingRouter(data),from={lat:21.5,lng:-104.9},to={lat:21.501,lng:-104.899};
expect(router.snaps(from).length>0,'A point on a street must be accepted');
expect(router.snaps({lat:21.5,lng:-104.899}).length===0,'A point outside the street snap radius needs repositioning');
const path=router.route(from,to)!;
expect(path,'Route should exist');expect(path.geometry!.some(p=>p.lat===21.501&&p.lng===-104.9),'Must pass around the corner');
expect(path.meters>meters(from,to)*1.3,'Street distance must replace diagonal distance');
expect(path.instruction?.includes('Primera')&&path.instruction?.includes('Segunda'),'Keep street names');
expect(router.route(from,{lat:22,lng:-104})===null,'No straight fallback outside coverage');
const disconnected=new WalkingRouter({nodes:[[21.5,-104.9],[21.501,-104.9],[21.505,-104.9],[21.506,-104.9]],edges:[[0,1,'A'],[2,3,'B']]});
expect(disconnected.route(from,{lat:21.506,lng:-104.9})===null,'Do not jump between disconnected streets');
const same=router.route({lat:21.5002,lng:-104.9},{lat:21.5008,lng:-104.9})!;
expect(same.geometry?.length===2&&same.meters<70,'Use partial street segment');
console.log('OK: street corners, distance, names, disconnected roads and no diagonal fallback');
