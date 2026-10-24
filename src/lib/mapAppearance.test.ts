import assert from 'node:assert/strict';
import {mapAppearance} from './mapAppearance.ts';
const luminance=(hex:string)=>{const c=hex.match(/[0-9a-f]{2}/gi)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
for(const dark of [true,false]){const p=mapAppearance(dark),a=luminance(p.text),b=luminance(p.halo);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Street labels keep readable contrast');assert.notEqual(p.background,p.minor);assert.notEqual(p.walking,p.background);assert.ok(Object.values(p).every(color=>/^#[0-9a-f]{6}$/.test(color)))}
assert.deepEqual(Object.keys(mapAppearance(true)),Object.keys(mapAppearance(false)));
console.log('OK: day/night map palette, readable labels and separate walking identity');
