import {remainingTripMinutes} from './tripEstimate.ts';
import type {Option} from './router.ts';
const p={lat:21.5,lng:-104.9};
const option:Option={id:'test',minutes:31,walk:4,transfers:0,fare:10,score:31,legs:[
 {kind:'walk',from:p,to:p,minutes:4,meters:300},
 {kind:'bus',from:p,to:p,minutes:20,meters:5000},
]};
if(remainingTripMinutes(option,0,300)!==option.minutes)throw new Error('Initial estimate must include waiting');
if(remainingTripMinutes(option,1,5000)!==20)throw new Error('Boarded bus must not include waiting again');
console.log('OK: remaining trip ETA includes only upcoming waits');
