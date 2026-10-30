import {ESTIMATED_WAIT_MINUTES,type Option,type Shape} from './router.ts';
/** Local operating estimates supplied by the product owner, 2026-10-29.
 * Not a published operator timetable, live vehicle feed or last-pass prediction. */
export const SERVICE_TIME_ZONE='America/Mazatlan';
export const SERVICE_HOURS={opens:5*60,weekdayCloses:20*60+30,weekdayExtendedCloses:21*60+30,weekendCloses:20*60,nightStarts:22*60,closingNoticeMinutes:30,updated:'2026-10-29'} as const;
const extended=new Set(['m-xico','insurgentes','canoas','pueblo-nuevo','lomas-verdes']);
export function tepicClock(at:Date|number=new Date()){
 const date=new Date(at),parts=new Intl.DateTimeFormat('en-CA',{timeZone:SERVICE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const value=(type:string)=>parts.find(p=>p.type===type)?.value??'';
 const day=`${value('year')}-${value('month')}-${value('day')}`;
 return {day,weekday:new Date(day+'T12:00:00Z').getUTCDay(),minute:Number(value('hour'))*60+Number(value('minute'))};
}
export const hourLabel=(minute:number)=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
export function routeService(route:Pick<Shape,'id'>,at:Date|number=new Date()){
 const clock=tepicClock(at),weekend=clock.weekday===0||clock.weekday===6;
 const closes=weekend?SERVICE_HOURS.weekendCloses:extended.has(route.id)?SERVICE_HOURS.weekdayExtendedCloses:SERVICE_HOURS.weekdayCloses;
 const available=clock.minute>=SERVICE_HOURS.opens&&clock.minute<closes;
 return {...clock,weekend,opens:SERVICE_HOURS.opens,closes,available,closing:available&&clock.minute>=closes-SERVICE_HOURS.closingNoticeMinutes};
}
export function serviceNotice(at:Date|number=new Date(),route?:Pick<Shape,'id'>){
 const clock=tepicClock(at),weekend=clock.weekday===0||clock.weekday===6;
 if(clock.minute>=SERVICE_HOURS.nightStarts)return {kind:'night' as const,title:'Sin servicio nocturno registrado',text:'No contamos con rutas de transporte público para este horario en Tepic. Considera Uber, DiDi, inDrive o taxi. Disponibilidad y precio se consultan con cada servicio.'};
 if(clock.minute<SERVICE_HOURS.opens)return {kind:'before-opening' as const,title:'El servicio aún no comienza',text:'El inicio estimado es a las 05:00, hora de Tepic. Las opciones consideran la hora estimada de abordaje. También puedes consultar Uber, DiDi, inDrive o taxi.'};
 if(route){const state=routeService(route,at);return {kind:state.available?(state.closing?'closing' as const:'open' as const):'closed' as const,title:state.available?(state.closing?'Últimas vueltas estimadas':'Horario orientativo'):'Fuera del horario estimado',text:`${hourLabel(state.opens)}–${hourLabel(state.closes)}${weekend?' · fin de semana':''}. No es información en tiempo real; confirma con el operador. El trazo del mapa es informativo.`}}
 const end=weekend?SERVICE_HOURS.weekendCloses:SERVICE_HOURS.weekdayExtendedCloses;
 if(clock.minute>=end)return {kind:'closed' as const,title:'Fuera del horario estimado de las rutas',text:'No encontramos servicio de transporte público dentro del horario estimado para este momento. Considera Uber, DiDi, inDrive o taxi. No hay rutas nocturnas registradas.'};
 if(weekend&&clock.minute>=end-30)return {kind:'closing' as const,title:'El servicio termina antes en fin de semana',text:'Cierre estimado a las 20:00. Confirma la última vuelta con el operador; no se garantiza el paso de una unidad.'};
 if(!weekend&&clock.minute>=SERVICE_HOURS.weekdayCloses-30)return {kind:'closing' as const,title:'Servicio en últimas vueltas',text:'Cierre general estimado: 20:30. México, Insurgentes, Canoas, Pueblo Nuevo y Lomas Verdes: última vuelta aproximada a las 21:30, de lunes a viernes. Confirma con el operador.'};
 return {kind:'open' as const,title:'Horario orientativo de servicio',text:weekend?'05:00–20:00 · sábados y domingos. Horario estimado; confirma con el operador.':'Desde las 05:00 · cierre general aproximado a las 20:30. Sin servicio nocturno registrado.'};
}
/** Check every future boarding, including walking and the existing estimated wait.
 * A bus already boarded is never cancelled when its estimated schedule ends. */
export function journeyService(option:Pick<Option,'legs'>,at:Date|number=new Date(),alreadyOnFirstBus=false){
 let elapsed=0;const warnings:string[]=[];
 for(let i=0;i<option.legs.length;i++){
  const leg=option.legs[i];
  if(leg.kind==='bus'){
   if(!(i===0&&alreadyOnFirstBus)){
    elapsed+=ESTIMATED_WAIT_MINUTES;const boardingAt=new Date(+new Date(at)+elapsed*60000);
    if(leg.route){const state=routeService(leg.route,boardingAt);if(!state.available)return {available:false,boardingAt:boardingAt.toISOString(),routeName:leg.route.name,message:`${leg.route.name}: el abordaje estimado queda fuera de su horario orientativo (${hourLabel(state.opens)}–${hourLabel(state.closes)}, hora de Tepic). No se garantiza servicio para esa conexión.`};
     if(state.closing)warnings.push(`${leg.route.name} está en sus últimas vueltas estimadas. Confirma el abordaje con el operador.`);
    }
   }
  }
  elapsed+=Math.max(0,leg.minutes);
 }
 return {available:true,warnings,message:warnings.join(' ')};
}
