import {useEffect,useId,useState,type ReactNode} from 'react';
import SheetHandle from './SheetHandle';
import type {SheetMode} from '../lib/sheetMode';
export default function MapSheet({children,title,className,summary,initialOpen=true,resetKey}:{children:ReactNode;title:string;className:string;summary?:ReactNode;initialOpen?:boolean;resetKey?:number}){
 const [mode,setMode]=useState<SheetMode>(initialOpen?'open':'closed');
 const contentId=useId();
 useEffect(()=>{if(resetKey!==undefined)setMode('open')},[resetKey]);
 const open=mode!=='closed';
 return <section className={className+' map-sheet sheet-'+mode} aria-label={title}>
  <SheetHandle mode={mode} onChange={setMode} label={title||'Rutas disponibles'} controls={contentId}/>
  {summary&&<div className="sheet-summary">{summary}</div>}
  <div id={contentId} className="sheet-content" hidden={!open}>{children}</div>
 </section>;
}
