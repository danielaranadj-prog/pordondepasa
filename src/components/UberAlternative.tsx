import type {Point} from '../lib/router';
import {uberTripLink} from '../lib/uber';
import '../styles/uber.css';

export default function UberAlternative({origin,destination,originName,destinationName}:{origin:Point;destination:Point;originName:string;destinationName:string}){
 return <div className="uber-alternative"><a className="uber-link" href={uberTripLink(origin,destination,originName,destinationName)} target="_blank" rel="noopener noreferrer" onClick={event=>{
  if(!window.confirm('¿Abrir Uber? Compartiremos con Uber el origen y el destino de este viaje. Ahí podrás revisar el precio antes de pedirlo. No se solicita ningún viaje automáticamente.'))event.preventDefault();
 }}>Ver este viaje en Uber ↗</a><small>Transporte privado · Precio aparte en Uber</small></div>;
}
