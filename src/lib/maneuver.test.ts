import {nextManeuver} from './maneuver.ts';
const route=[{lat:21,lng:-104},{lat:21.001,lng:-104},{lat:21.001,lng:-103.999}];
if(nextManeuver(route,0)?.label!=='Gira a la derecha')throw Error('North to east must turn right');
if(nextManeuver(route,120)!==undefined)throw Error('Completed turn must disappear');
if(nextManeuver([route[0],route[1],{lat:21.002,lng:-104}],0)!==undefined)throw Error('Straight street must not create a turn');
console.log('OK: walking maneuvers preserve street geometry');
