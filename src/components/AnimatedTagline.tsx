import {useEffect,useState} from 'react';
import '../styles/animated-tagline.css';

const words=['ciudad','camino','tiempo','ruta','transporte'];

export default function AnimatedTagline(){
 const [typing,setTyping]=useState({word:0,count:words[0].length,deleting:false});
 const [reducedMotion,setReducedMotion]=useState(false);
 useEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReducedMotion(preference.matches);
  update();preference.addEventListener('change',update);
  return()=>preference.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  if(reducedMotion)return;
  const current=words[typing.word];
  const delay=typing.deleting?(typing.count===0?90:35):typing.count===current.length?480:55;
  const timer=window.setTimeout(()=>setTyping(previous=>{
   if(previous.deleting){
    if(previous.count>0)return {...previous,count:previous.count-1};
    return {word:(previous.word+1)%words.length,count:1,deleting:false};
   }
   if(previous.count<words[previous.word].length)return {...previous,count:previous.count+1};
   return {...previous,deleting:true};
  }),delay);
  return()=>window.clearTimeout(timer);
 },[typing,reducedMotion]);
 const word=reducedMotion?words[0]:words[typing.word].slice(0,typing.count);
 return <div className="welcome-tagline" aria-label="Tu ciudad, tu camino, tu tiempo, tu ruta, tu destino"><span aria-hidden="true">Tu</span><span className="welcome-tagline-word" aria-hidden="true">{word}<i/></span></div>;
}
