export default function MapIcon({kind}:{kind:'location'|'compass'|'north'}){
 return <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  {kind==='location'?<path d="m20 4-6 16-3-7-7-3Z"/>:kind==='compass'?<><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/></>:<><path d="M8 17V7l8 10V7"/><path d="m10 3 2-2 2 2"/></>}
 </svg>;
}
