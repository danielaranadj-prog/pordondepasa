import assert from 'node:assert/strict';
import {observeAdImpression,type ImpressionRuntime} from './adImpression.ts';
import {canShowSponsoredTrip,recordSponsoredTripEvent,sponsoredTripReport} from './sponsoredTrip.ts';
import type {AdCampaign} from './ads.ts';

function fixture(onView:()=>void){
 const visibility=new class extends EventTarget{hidden=false}();let visible=(_ratio:number)=>{},disconnected=false,clock=0,sequence=0;
 const timers=new Map<number,{at:number;callback:()=>void}>();
 const runtime:ImpressionRuntime={visibility,observe:(_target,update)=>{visible=update;return()=>{disconnected=true}},schedule:(callback,delay)=>{const id=sequence++;timers.set(id,{at:clock+delay,callback});return id},cancel:id=>{timers.delete(id as number)}};
 const dispose=observeAdImpression({} as Element,onView,runtime);
 return {visible:(ratio:number)=>visible(ratio),hidden:(hidden:boolean)=>{visibility.hidden=hidden;visibility.dispatchEvent(new Event('visibilitychange'))},dispose,disconnected:()=>disconnected,
  tick:(duration:number)=>{clock+=duration;for(const [id,timer] of [...timers])if(timer.at<=clock&&timers.delete(id))timer.callback()}};
}
let views=0;const view=fixture(()=>views++);
view.visible(.49);view.tick(5000);assert.equal(views,0,'Less than half is not an impression');
view.visible(.5);view.tick(999);assert.equal(views,0);view.hidden(true);view.tick(1000);assert.equal(views,0,'Background exposure is cancelled');
view.hidden(false);view.tick(999);assert.equal(views,0);view.tick(1);assert.equal(views,1);
view.visible(1);view.hidden(true);view.hidden(false);view.tick(5000);assert.equal(views,1,'An observer reports once');view.dispose();assert.ok(view.disconnected());
const interrupted=fixture(()=>views++);interrupted.visible(.6);interrupted.tick(700);interrupted.visible(.2);interrupted.tick(1000);assert.equal(views,1);interrupted.visible(1);interrupted.tick(999);assert.equal(views,1);interrupted.dispose();interrupted.tick(1);assert.equal(views,1,'Unmount does not leave a pending impression');
const failure=fixture(()=>{throw new Error('metric unavailable')});failure.visible(1);assert.doesNotThrow(()=>failure.tick(1000));failure.dispose();

const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}};
const now=new Date('2026-10-28T19:00:00-07:00');
const ad:AdCampaign={id:'sponsor-test',clientId:'fixture',type:'sponsored_trip',title:'Prueba',description:'Prueba',icon:'✦',routeIds:['test'],isActive:true,createdAt:'2026-10-01',sponsoredTrip:{durationSeconds:6,canSkipAfterSeconds:1.5,headline:'Patrocinio de prueba',promoOffer:'Oferta de prueba',ctaType:'web',ctaText:'Ver',ctaUrl:'https://example.test/',dailyCapPerUser:2,cooldownHours:3}};
assert.ok(canShowSponsoredTrip(ad,'test',now,storage));
const sponsor=fixture(()=>recordSponsoredTripEvent(ad.id,'sponsored_trip_views',now.getTime(),storage));sponsor.visible(.8);sponsor.tick(1000);
assert.equal(sponsoredTripReport(storage)[ad.id].sponsored_trip_views,1);
assert.equal(canShowSponsoredTrip(ad,'test',new Date(now.getTime()+3600000),storage),false,'A native card exposure consumes the frequency/cooldown gate');
sponsor.dispose();assert.doesNotThrow(()=>observeAdImpression({} as Element,()=>{})());
console.log('OK: continuous visible exposure, foreground, cancellation, non-blocking errors and native sponsor frequency cap.');
