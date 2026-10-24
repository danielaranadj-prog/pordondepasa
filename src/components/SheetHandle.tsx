import {useId,useRef} from 'react';
import {moveSheet,sheetSwipe,type SheetMode} from '../lib/sheetMode';
export default function SheetHandle({mode,onChange,label,controls}:{mode:SheetMode;onChange:(mode:SheetMode)=>void;label:string;controls?:string}){
 const gesture=useRef<{x:number;y:number}|null>(null),ignoreClick=useRef(false);
 const id=useId();
 return <button type="button" id={id} className="sheet-handle" aria-label={`${label}. ${mode==='closed'?'Expandir panel':mode==='open'?'Ampliar panel':'Recoger panel'}`} aria-expanded={mode!=='closed'} aria-controls={controls}
  onClick={()=>{if(ignoreClick.current){ignoreClick.current=false;return}onChange(mode==='expanded'?'closed':moveSheet(mode,'up'))}}
  onKeyDown={event=>{if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();onChange(event.key==='Home'?'closed':event.key==='End'?'expanded':moveSheet(mode,event.key==='ArrowUp'?'up':'down'))}}}
  onPointerDown={event=>{gesture.current={x:event.clientX,y:event.clientY};ignoreClick.current=false;event.currentTarget.setPointerCapture(event.pointerId)}}
  onPointerUp={event=>{const start=gesture.current;gesture.current=null;if(!start)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;const next=sheetSwipe(mode,dx,dy);if(Math.abs(dx)>8||Math.abs(dy)>8){ignoreClick.current=true;if(next!==mode)onChange(next)}if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}}
  onPointerCancel={()=>{gesture.current=null;ignoreClick.current=false}}
 ><span className="sheet-grip" aria-hidden="true"/><span>{label}</span><span className="sheet-chevron" aria-hidden="true">{mode==='expanded'?'⌄':'⌃'}</span></button>;
}
