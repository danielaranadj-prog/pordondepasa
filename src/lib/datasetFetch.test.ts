import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchDataset,DatasetChangedError} from './datasetFetch.ts';
const source=readFileSync(new URL('../../public/data/tepic-routes.json',import.meta.url));
const valid=(async()=>new Response(source)) as typeof fetch;
assert.ok((await fetchDataset<{routes:unknown[]}>('tepic-routes.json',valid)).routes.length>0);
await assert.rejects(()=>fetchDataset('tepic-routes.json',async()=>new Response('{"routes":[]}')),DatasetChangedError);
await assert.rejects(()=>fetchDataset('tepic-routes.json',async()=>new Response('',{status:503})));
console.log('OK: coherent dataset bytes accepted, stale/mixed data rejected.');
