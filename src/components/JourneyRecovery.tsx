import type {JourneySession} from '../lib/journeySession';
export default function JourneyRecovery({session,onResume,onDiscard}:{session:JourneySession;onResume:()=>void;onDiscard:()=>void}){
 return <section className="journey-recovery" role="region" aria-label="Viaje pendiente"><strong>¿Retomar tu viaje?</strong><span>Hacia {session.destinationName}. Comprobaremos tu GPS de nuevo.</span><div><button onClick={onResume}>Retomar</button><button onClick={onDiscard}>Descartar</button></div></section>;
}
