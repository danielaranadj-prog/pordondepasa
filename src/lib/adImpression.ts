export type ImpressionRuntime={
 visibility:Pick<Document,'hidden'|'addEventListener'|'removeEventListener'>;
 observe:(target:Element,onVisibility:(ratio:number)=>void)=>()=>void;
 schedule:(callback:()=>void,delay:number)=>unknown;
 cancel:(timer:unknown)=>void;
};

/** One continuous second with at least half the card visible, in foreground. */
export function observeAdImpression(target:Element,onView:()=>void,runtime?:ImpressionRuntime):()=>void{
 if(!runtime){
  if(typeof document==='undefined'||typeof IntersectionObserver==='undefined')return()=>{};
  runtime={visibility:document,observe:(element,update)=>{
   const observer=new IntersectionObserver(entries=>{const entry=entries.find(entry=>entry.target===element);if(entry)update(entry.isIntersecting?entry.intersectionRatio:0)},{threshold:[0,.5]});
   observer.observe(element);return()=>observer.disconnect();
  },schedule:(callback,delay)=>setTimeout(callback,delay),cancel:timer=>clearTimeout(timer as ReturnType<typeof setTimeout>)};
 }
 const env=runtime;let shown=false,visible=false,disposed=false,timer:unknown;
 const cancel=()=>{if(timer!==undefined)env.cancel(timer);timer=undefined};
 const check=()=>{
  cancel();if(shown||disposed||!visible||env.visibility.hidden)return;
  timer=env.schedule(()=>{timer=undefined;if(shown||disposed||!visible||env.visibility.hidden)return;shown=true;try{onView()}catch{/* Measurement never blocks the map. */}},1000);
 };
 const disconnect=env.observe(target,ratio=>{visible=ratio>=.5;check()});
 env.visibility.addEventListener('visibilitychange',check);
 return()=>{disposed=true;cancel();disconnect();env.visibility.removeEventListener('visibilitychange',check)};
}
