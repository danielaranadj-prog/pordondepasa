import type {TransitStop} from '../lib/navigation';
import '../styles/home.css';
type Props={query:string;ready:boolean;stops:TransitStop[];message:string;onQuery:(value:string)=>void;onChoose:(stop:TransitStop)=>void;onSearch:()=>void;onMap:()=>void};
function Icon({kind}:{kind:'route'|'search'|'pin'|'bus'|'arrow'}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='route'?<><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h9a4 4 0 0 1 0 8H7a4 4 0 0 0 0 8h9"/></>:kind==='search'?<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>:kind==='pin'?<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>:kind==='bus'?<><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M8 19v2m8-2v2M8 15h1m6 0h1"/></>:<path d="M4 12h16m-6-6 6 6-6 6"/>}</svg>;
}
const columns=[0,55,125,180,250,310,375,440,505],rows=[0,56,125,180,250,305,375,440,505];
export default function HomeScreen({query,ready,stops,message,onQuery,onChoose,onSearch,onMap}:Props){
 return <main className="pdp-home">
  <div className="home-city" aria-hidden="true">{rows.slice(0,-1).flatMap((y,r)=>columns.slice(0,-1).map((x,c)=><span key={`${r}-${c}`} style={{left:x+8,top:y+8,width:columns[c+1]-x-15,height:rows[r+1]-y-15}}/>))}</div>
  <div className="home-content">
   <header className="home-brand"><div><Icon kind="route"/><strong>PorDóndePasa</strong></div><small>TEPIC · XALISCO</small></header>
   <section className="home-hero"><h1>Tu ciudad.<br/><span>Tu camino.</span></h1></section>
   <form className="home-search" aria-label="Buscar destino" onSubmit={event=>{event.preventDefault();if(ready)onSearch()}}>
    <label className="home-field"><Icon kind="search"/><input aria-label="¿A dónde vas hoy?" placeholder="¿A dónde vas hoy?" value={query} autoComplete="off" onChange={event=>onQuery(event.target.value)} /></label>
    {!!stops.length&&<div className="home-suggestions" aria-label="Sugerencias de destino">{stops.map(stop=><button type="button" key={stop.id} onClick={()=>onChoose(stop)}><strong>{stop.name}</strong><small>Parada · Tepic y Xalisco</small></button>)}</div>}
    {!ready&&query.trim().length>=2&&!stops.length&&<p className="home-message">Sin coincidencias. Elige tu destino en el mapa.</p>}
    <button className="home-submit" disabled={!ready} type="submit">Encuentra tu ruta<Icon kind="arrow"/></button>
    <button className="home-map" type="button" onClick={onMap}><Icon kind="pin"/>Elegir en el mapa</button>
    {message&&<p className="home-message" role="status">{message}</p>}
   </form>
   <p className="home-caption"><Icon kind="bus"/>Transporte público, a tu alcance.</p>
  </div>
 </main>;
}
