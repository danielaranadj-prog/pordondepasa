import {ADS_API_KEY,ADS_EVENTS_URL,ADS_MODE} from './adConfig';
type Kind='view'|'click'|'complete'|'skip'|'route';
type Event={id:string;adId:string;kind:Kind;at:string;routeId?:string};
const KEY='pdp:ad-events:v1',uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
let sending=false,timer:ReturnType<typeof setTimeout>|undefined,attempts=0;
const enabled=()=>ADS_MODE==='remote'&&!!ADS_EVENTS_URL&&!!ADS_API_KEY;
function read():Event[]{try{const values=JSON.parse(localStorage.getItem(KEY)??'[]');return Array.isArray(values)?values.filter(e=>e&&uuid.test(e.id)&&uuid.test(e.adId)&&['view','click','complete','skip','route'].includes(e.kind)&&Date.now()-Date.parse(e.at)<86400000).slice(-100):[]}catch{return []}}
function write(events:Event[]){try{localStorage.setItem(KEY,JSON.stringify(events.slice(-100)))}catch{/* Metrics never block navigation. */}}
export function trackAd(adId:string,kind:Kind,routeId?:string){
 if(!enabled()||!uuid.test(adId)||typeof localStorage==='undefined')return;
 write([...read(),{id:crypto.randomUUID(),adId,kind,at:new Date().toISOString(),...(routeId?{routeId}:{})}]);attempts=0;schedule();
}
function schedule(){if(timer||sending||!enabled()||attempts>=5)return;timer=setTimeout(()=>{timer=undefined;void flush()},Math.min(30000,400*2**attempts))}
async function flush(){
 if(sending||!navigator.onLine)return;const events=read().slice(0,20);if(!events.length)return;
 try{const url=new URL(ADS_EVENTS_URL);if(url.protocol!=='https:')return;sending=true;const r=await fetch(url.href,{method:'POST',headers:{'content-type':'application/json',apikey:ADS_API_KEY,authorization:`Bearer ${ADS_API_KEY}`},body:JSON.stringify({events}),signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const ids=new Set(events.map(e=>e.id));write(read().filter(e=>!ids.has(e.id)));attempts=0}catch{attempts++}finally{sending=false;if(read().length)schedule()}
}
if(typeof window!=='undefined'){window.addEventListener('online',()=>{attempts=0;schedule()});document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});schedule()}
