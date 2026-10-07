import {stopsForOption,projectProgress} from './navigation.ts';
import type {Option} from './router.ts';
const a={lat:21.5,lng:-104.9},b={lat:21.51,lng:-104.9};
const option:Option={id:'test',minutes:10,walk:0,transfers:0,fare:10,score:10,legs:[{kind:'bus',from:a,to:b,minutes:5,meters:1113,geometry:[a,b],route:{id:'mexico',name:'México',color:'#E11D48',groupName:'México',coordinates:[a,b]}}]};
function expect(v:unknown,message:string){if(!v)throw new Error(message)}
const stops=stopsForOption(option,[
 {id:'middle',name:'Centro',coordinates:{lat:21.505,lng:-104.8999},type:'oficial',routeIds:[]},
 {id:'opposite',name:'Enfrente',coordinates:{lat:21.505,lng:-104.9001},type:'oficial'},
 {id:'ambiguous',name:'Sobre la línea',coordinates:{lat:21.505,lng:-104.9}},
 {id:'outside',name:'Fuera del tramo',coordinates:{lat:21.52,lng:-104.9}},
 {id:'far',name:'Lejos del trazo',coordinates:{lat:21.505,lng:-104.89}},
 {id:'other',name:'Otra ruta',coordinates:{lat:21.505,lng:-104.9},routeIds:['other']},
 {id:'duplicate',name:'Duplicada',coordinates:{lat:21.505,lng:-104.8999}},
]);
expect(stops.length===1,'Only relevant stops should appear');
expect(stops[0].type==='oficial'&&stops[0].inferred,'Keep official type without inventing route assignments');
expect(stops[0].side==='right','Keep only stops on the right side');
const oppositeStops=[{id:'east',name:'Este',coordinates:{lat:21.505,lng:-104.8999}},{id:'west',name:'Oeste',coordinates:{lat:21.505,lng:-104.9001}}];
const reversed={...option,legs:[{...option.legs[0],from:b,to:a,geometry:[b,a]}]};
expect(stopsForOption(option,oppositeStops)[0]?.id==='east','Northbound accepts east sidewalk');
expect(stopsForOption(reversed,oppositeStops)[0]?.id==='west','Southbound accepts west sidewalk');
expect(projectProgress({lat:21.4999,lng:-104.895},[a,{lat:21.5,lng:-104.89}]).rightOffset>0,'Eastbound right is south');
expect(projectProgress({lat:21.5001,lng:-104.895},[{lat:21.5,lng:-104.89},a]).rightOffset>0,'Westbound right is north');
const p=projectProgress({lat:21.508,lng:-104.9},[a,b]);
// Imported stops placed on each of the two directional traces must not disappear
// or be mistaken for their opposite stop when displaying a sliced itinerary.
const returnA={lat:21.51,lng:-104.9001},returnB={lat:21.5,lng:-104.9001};
const knownRoute={...option.legs[0].route!,id:'m-xico',coordinates:[a,b,returnA,returnB]};
const outbound={...option,legs:[{...option.legs[0],route:knownRoute}]};
const imported=[{id:'out',name:'Ida sobre trazo',source:'mexico',coordinates:{lat:21.505,lng:-104.9}},{id:'back',name:'Vuelta sobre trazo',source:'mexico',coordinates:{lat:21.505,lng:-104.9001}}];
const restored=stopsForOption(outbound,imported);
expect(restored.length===1&&restored[0].id==='out'&&restored[0].side==='on-trace','Restore imported on-trace stops only on their own pass');
const inbound={...option,legs:[{...option.legs[0],route:knownRoute,from:returnA,to:returnB,geometry:[returnA,returnB]}]};
expect(stopsForOption(inbound,imported)[0]?.id==='back','Reverse itinerary uses only the return stop');
expect(p.remaining>210&&p.remaining<230,'Remaining distance should follow the travelled geometry');
expect(stopsForOption({...option,legs:[{kind:'walk',from:a,to:b,meters:1113,minutes:15}]},stops).length===0,'Walking does not show bus stops');
console.log('OK: stops limited to travelled geometry, deduplicated, explicit route membership respected and distance remaining correct.');
