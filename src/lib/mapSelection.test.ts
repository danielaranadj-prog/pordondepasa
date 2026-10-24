import assert from 'node:assert/strict';
import {TEPIC_MAP_CENTER,planningLocation,beginMapSelection,updateMapSelection} from './mapSelection.ts';
const now=1000000;
assert.deepEqual(planningLocation({point:TEPIC_MAP_CENTER,accuracy:20,timestamp:now},now),TEPIC_MAP_CENTER);
for(const fix of [
 {point:{lat:0,lng:0},accuracy:20,timestamp:now},
 {point:{lat:NaN,lng:-104.89},accuracy:20,timestamp:now},
 {point:TEPIC_MAP_CENTER,accuracy:101,timestamp:now},
 {point:TEPIC_MAP_CENTER,accuracy:NaN,timestamp:now},
 {point:TEPIC_MAP_CENTER,accuracy:20,timestamp:now-60001},
 {point:TEPIC_MAP_CENTER,accuracy:20,timestamp:now+10001},
])assert.equal(planningLocation(fix,now),null,'Invalid GPS must not confirm the reference point');
const chosen={lat:21.50,lng:-104.88},selection=beginMapSelection(2,'destination',chosen);
const moved=updateMapSelection(selection,2,{lat:21.51,lng:-104.90},false)!;
assert.deepEqual(chosen,{lat:21.50,lng:-104.88},'Draft must not mutate committed endpoint');
assert.deepEqual(moved.initial,chosen,'Cancel preserves the previous endpoint');
assert.notDeepEqual(moved.draft,chosen);
assert.equal(updateMapSelection(moved,1,chosen,false),moved,'Late event from previous picker must be ignored');
assert.equal(updateMapSelection(null,2,chosen,false),null,'Closing picker rejects late camera events');
console.log('OK: explicit map drafts, unchanged endpoints and validated planning GPS');
