import assert from 'node:assert/strict';
import {acknowledgedEventIds} from './adAcknowledgement.ts';
const sent=[{id:'one'},{id:'two'}];
assert.equal(acknowledgedEventIds({accepted:0},sent).size,0);
assert.equal(acknowledgedEventIds({accepted:1},sent).size,0);
assert.deepEqual([...acknowledgedEventIds({acknowledged:['two','invented']},sent)],['two']);
assert.equal(acknowledgedEventIds({accepted:2},sent).size,2);
assert.equal(acknowledgedEventIds(null,sent).size,0);
console.log('OK: partial/empty metric acceptance never silently drops a batch.');
