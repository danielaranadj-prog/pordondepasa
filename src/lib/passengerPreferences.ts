const KEY='pordondepasa:preferences:v1';
export type PassengerPreferences={voice:boolean;lessEffects:boolean};
export function readPreferences():PassengerPreferences{try{const v=JSON.parse(localStorage.getItem(KEY)??'{}');return {voice:v.voice===true,lessEffects:v.lessEffects===true}}catch{return {voice:false,lessEffects:false}}}
export function savePreferences(value:PassengerPreferences){try{localStorage.setItem(KEY,JSON.stringify(value))}catch{}applyPreferences(value);}
export function applyPreferences(value=readPreferences()){if(typeof document!=='undefined')document.documentElement.dataset.effects=value.lessEffects?'reduced':'full';}
