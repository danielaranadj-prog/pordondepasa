import {useRef,useState,type ReactNode} from 'react';
export default function MapSheet({children,title,className,summary,initialOpen=true}:{children:ReactNode;title:string;className:string;summary?:ReactNode;initialOpen?:boolean}){
 const [open,setOpen]=useState(initialOpen),start=useRef<number|null>(null),swiped=useRef(false);
 return <section className={className+' map-sheet '+(open?'sheet-open':'sheet-closed')} aria-label={title}>
  <button className="sheet-handle" aria-expanded={open} aria-label={open?'Recoger panel':'Expandir panel'} onClick={()=>{if(swiped.current){swiped.current=false;return;}setOpen(!open)}}
   onPointerDown={e=>{start.current=e.clientY;swiped.current=false;e.currentTarget.setPointerCapture(e.pointerId)}}
   onPointerUp={e=>{if(start.current!==null&&Math.abs(e.clientY-start.current)>25){swiped.current=true;setOpen(e.clientY<start.current);}start.current=null;}}
   onPointerCancel={()=>{start.current=null;swiped.current=false;}}
  ><span className="sheet-grip"/><span>{title}</span><span className="sheet-chevron" aria-hidden="true">{open?'⌄':'⌃'}</span></button>
  {summary&&<div className="sheet-summary">{summary}</div>}
  <div className="sheet-content" hidden={!open}>{children}</div>
 </section>;
}
