import assert from 'node:assert/strict';
import {validJourney,saveJourney,readJourney,clearJourney,DATASET_VERSION,type JourneySession} from './journeySession.ts';
const p={lat:21.5,lng:-104.9};
const session:JourneySession={version:1,dataset:DATASET_VERSION,at:Date.now(),step:0,origin:p,destination:p,originName:'Origen',destinationName:'Destino',option:{id:'walk',minutes:0,walk:0,transfers:0,fare:0,score:0,legs:[{kind:'walk',from:p,to:p,geometry:[p,p],meters:0,minutes:0}]}};
const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:(k:string)=>{map.delete(k)}};
assert.ok(saveJourney(session,storage));assert.equal(readJourney(storage)?.destinationName,'Destino');
assert.ok(!validJourney({...session,at:Date.now()-13*3600000}));assert.ok(!validJourney({...session,dataset:'old'}));assert.ok(!validJourney({...session,step:2}));
assert.ok(!validJourney({...session,option:{...session.option,legs:[{...session.option.legs[0],geometry:null}]}}));
clearJourney(storage);assert.equal(readJourney(storage),undefined);
const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('storage blocked')}});
try{assert.doesNotThrow(()=>readJourney());assert.equal(saveJourney(session),false);assert.doesNotThrow(()=>clearJourney())}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete (globalThis as any).localStorage;}
console.log('OK: bounded local session, TTL, dataset isolation and invalid state rejection.');
