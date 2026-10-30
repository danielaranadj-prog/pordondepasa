import {useEffect,useState} from 'react';
import type {Shape} from '../lib/router';
import {serviceNotice} from '../lib/serviceHours';
export function useServiceClock(){const [now,setNow]=useState(Date.now);useEffect(()=>{const update=()=>setNow(Date.now()),foreground=()=>{if(!document.hidden)update()};const timer=setInterval(update,60000);document.addEventListener('visibilitychange',foreground);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',foreground)}},[]);return now}
export default function ServiceHoursNotice({now,route}:{now:number;route?:Pick<Shape,'id'>}){const notice=serviceNotice(now,route);return <aside className={`service-hours-notice service-${notice.kind}`} role="status"><strong>{notice.title}</strong><p>{notice.text}</p></aside>}
