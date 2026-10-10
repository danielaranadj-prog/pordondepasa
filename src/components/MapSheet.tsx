import {useRef,useState,type ReactNode} from 'react';
export default function MapSheet({children,title,className,summary,initialOpen=true}:{children:ReactNode;title:string;className:string;summary?:ReactNode;initialOpen?:boolean}){
 const [mode,setMode]=useState<'closed'|'open'|'expanded'>(initialOpen?'open':'closed');
 const start=useRef<{x:number;y:number}|null>(null),swipedUntil=useRef(0);
 const open=mode!=='closed';
 function swipe(dx:number,dy:number){
  if(Math.abs(dy)<55||Math.abs(dy)<Math.abs(dx)*1.25)return;
  swipedUntil.current=Date.now()+450;
  setMode(previous=>dy<0?'expanded':previous==='expanded'?'open':'closed');
 }
 return <section className={className+' map-sheet sheet-'+mode} aria-label={title}
  onClickCapture={e=>{if(Date.now()<swipedUntil.current){e.preventDefault();e.stopPropagation();swipedUntil.current=0}}}
  onTouchStart={e=>{if(e.touches.length!==1)return;const content=(e.target as HTMLElement).closest('.sheet-content');if(content&&content.scrollTop>2){start.current=null;return;}start.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}}
  onTouchEnd={e=>{if(start.current&&e.changedTouches.length)swipe(e.changedTouches[0].clientX-start.current.x,e.changedTouches[0].clientY-start.current.y);start.current=null}}
  onTouchCancel={()=>{start.current=null}}
 >
  <button className="sheet-handle" aria-expanded={open} aria-label={open?'Recoger panel':'Expandir panel'} onClick={()=>setMode(open?'closed':'open')}
   onPointerDown={e=>{if(e.pointerType==='touch')return;start.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId)}}
   onPointerUp={e=>{if(e.pointerType==='touch')return;if(start.current)swipe(e.clientX-start.current.x,e.clientY-start.current.y);start.current=null;}}
   onPointerCancel={()=>{start.current=null}}
  ><span className="sheet-grip"/><span>{title}</span><span className="sheet-chevron" aria-hidden="true">{open?'⌄':'⌃'}</span></button>
  {summary&&<div className="sheet-summary">{summary}</div>}
  <div className="sheet-content" hidden={!open}>{children}</div>
 </section>;
}
