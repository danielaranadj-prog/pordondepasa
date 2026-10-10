import type {TransitStop} from '../lib/navigation';
import type {Place} from '../lib/places';
import '../styles/home.css';
type Props={query:string;ready:boolean;stops:TransitStop[];places:Place[];message:string;onQuery:(value:string)=>void;onChoose:(stop:TransitStop)=>void;onChoosePlace:(place:Place)=>void;onSearch:()=>void;onMap:()=>void};
function Icon({kind}:{kind:'search'|'pin'|'bus'|'arrow'}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='search'?<><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>:kind==='pin'?<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>:kind==='bus'?<><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M8 19v2m8-2v2M8 15h1m6 0h1"/></>:<path d="M4 12h16m-6-6 6 6-6 6"/>}</svg>;
}
const columns=[0,55,125,180,250,310,375,440,505],rows=[0,56,125,180,250,305,375,440,505];
export default function HomeScreen({query,ready,stops,places,message,onQuery,onChoose,onChoosePlace,onSearch,onMap}:Props){
 return <main className="pdp-home">
  <div className="home-city" aria-hidden="true">{rows.slice(0,-1).flatMap((y,r)=>columns.slice(0,-1).map((x,c)=><span key={`${r}-${c}`} style={{left:x+8,top:y+8,width:columns[c+1]-x-15,height:rows[r+1]-y-15}}/>))}</div>
  <div className="home-content">
   <div className="home-main">
   <header className="home-brand"><div><Icon kind="bus"/><h1>PorDóndePasa</h1></div><small> Tu transporte público</small></header>
   <form className="home-search" aria-label="Buscar destino" onSubmit={event=>{event.preventDefault();if(ready)onSearch()}}>
    <label className="home-field"><Icon kind="search"/><input aria-label="¿A dónde vas hoy?" placeholder="¿A dónde vas hoy?" value={query} autoComplete="off" onChange={event=>onQuery(event.target.value)} /></label>
    {!!(places.length||stops.length)&&<div className="home-suggestions" aria-label="Sugerencias de destino">{places.map(place=><button type="button" key={`place:${place.id}`} onClick={()=>onChoosePlace(place)}><strong>{place.name}</strong><small>{place.neighborhood||place.municipality||'Lugar'}{place.status!=='verificado'?' · Por verificar':''}</small></button>)}{stops.map(stop=><button type="button" key={`stop:${stop.id}`} onClick={()=>onChoose(stop)}><strong>{stop.name}</strong><small>Parada · Tepic y Xalisco</small></button>)}</div>}
    {!ready&&query.trim().length>=2&&!stops.length&&!places.length&&<p className="home-message">Sin coincidencias. Elige tu destino en el mapa.</p>}
    <button className="home-submit" disabled={!ready} type="submit">Ver rutas<Icon kind="arrow"/></button>
    <button className="home-map" type="button" onClick={onMap}><Icon kind="pin"/>Elegir en el mapa</button>
   {message&&<p className="home-message" role="status">{message}</p>}
   </form>
   </div>
   <p className="home-caption">TEPIC · XALISCO</p>
  </div>
 </main>;
}
