import {useCallback,useEffect,useRef,useState} from 'react';
import type {SupabaseClient,User} from '@supabase/supabase-js';
import {accountClient,emptyAccount,finishOAuth,loadAccount,verifiedAccount,type AccountData} from '../lib/account';
import {clearAccountLocalData,setAccountStorageOwner} from '../lib/accountStorage';
import TransitApp from './TransitApp';
import AccountPanel from './AccountPanel';
import '../styles/account.css';

type State={phase:'checking'|'configuration'|'login'|'ready'|'error';user?:User;data:AccountData;message?:string};
export default function AccountApp(){
 const [state,setState]=useState<State>({phase:'checking',data:emptyAccount()}),[panel,setPanel]=useState(false),[signing,setSigning]=useState(false);
 const client=useRef<SupabaseClient|null>(null),serial=useRef(0),mounted=useRef(false),currentUser=useRef<string|undefined>(undefined);
 const verify=useCallback(async()=>{
  const sdk=client.current;if(!sdk)return;const check=++serial.current;
  try {
   const user=await verifiedAccount(sdk);if(!mounted.current||check!==serial.current)return;
   if(!user){setAccountStorageOwner(undefined);currentUser.current=undefined;setState({phase:'login',data:emptyAccount()});return;}
   if(currentUser.current===user.id)return;
   const data=await loadAccount(sdk,user);if(!mounted.current||check!==serial.current)return;
   setAccountStorageOwner(user.id);currentUser.current=user.id;setState({phase:'ready',user,data});
  }catch(error){if(mounted.current&&check===serial.current){setAccountStorageOwner(undefined);currentUser.current=undefined;setPanel(false);setState({phase:'error',data:emptyAccount(),message:error instanceof Error?error.message:'No se pudo verificar el ingreso.'});}}
 },[]);
 useEffect(()=>{
  mounted.current=true;const sdk=accountClient();client.current=sdk;
  if(!sdk){setState({phase:'configuration',data:emptyAccount()});return()=>{mounted.current=false};}
  const timers=new Set<ReturnType<typeof setTimeout>>();
  const {data:{subscription}}=sdk.auth.onAuthStateChange((event,session)=>{
   // No awaited SDK calls in an auth callback: avoids the auth lock deadlock.
   if(event==='SIGNED_OUT'||session?.user.id!==currentUser.current){
    clearAccountLocalData();serial.current++;setAccountStorageOwner(undefined);currentUser.current=undefined;
    setPanel(false);setState({phase:'checking',data:emptyAccount()});
   }
   const timer=setTimeout(()=>{timers.delete(timer);void verify()},0);timers.add(timer);
  });
  void finishOAuth(sdk).then(verify).catch(error=>{
   serial.current++;if(mounted.current)setState({phase:'error',data:emptyAccount(),message:error instanceof Error?error.message:'No se completó el ingreso.'});
  });
  const foreground=()=>{if(document.visibilityState==='visible')void verify()};
  document.addEventListener('visibilitychange',foreground);
  return()=>{mounted.current=false;serial.current++;subscription.unsubscribe();timers.forEach(clearTimeout);document.removeEventListener('visibilitychange',foreground);setAccountStorageOwner(undefined)};
 },[verify]);
 async function login(){
  if(signing||!client.current)return;setSigning(true);
  try {
   const result=await client.current.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL(import.meta.env.BASE_URL,window.location.origin).href,scopes:'openid email profile',queryParams:{prompt:'select_account'}}});
   if(result.error)throw new Error();
  }catch{setSigning(false);setState({phase:'error',data:emptyAccount(),message:'Google no pudo iniciar el ingreso. Revisa la configuración y vuelve a intentar.'});}
 }
 async function logout(){
  const sdk=client.current;if(!sdk)return;
  clearAccountLocalData();setAccountStorageOwner(undefined);currentUser.current=undefined;serial.current++;
  setPanel(false);setState({phase:'checking',data:emptyAccount()});
  let failed=false;
  try{failed=!!(await sdk.auth.signOut({scope:'local'})).error}catch{failed=true}
  if(failed){
   // Remove this app's persisted session even if the server cannot be reached.
   try{localStorage.removeItem('pordondepasa.auth.v1');localStorage.removeItem('pordondepasa.auth.v1-code-verifier')}catch{}
   window.location.replace(import.meta.env.BASE_URL);return;
  }
  setSigning(false);setState({phase:'login',data:emptyAccount()});
 }
 if(state.phase==='ready'&&state.user&&client.current)return <>
  <TransitApp key={state.user.id} savedPlaces={state.data.places} onOpenAccount={()=>setPanel(true)}/>
  {panel&&<AccountPanel client={client.current} user={state.user} data={state.data} onData={data=>setState(previous=>({...previous,data}))} onClose={()=>setPanel(false)} onLogout={()=>void logout()}/>}
 </>;
 const configured=state.phase!=='configuration';
 return <main className="account-login" data-screen="ingreso">
  <section className="login-card" aria-labelledby="login-heading">
   <div className="login-logo" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="12" y="7" width="24" height="30" rx="6"/><path d="M12 22h24M17 31h3m8 0h3M17 38v4m14-4v4"/></svg></div>
   <span className="account-eyebrow">TEPIC · XALISCO</span>
   <h1 id="login-heading">Tu ciudad.<br/>Tus rutas.</h1>
   <p className="login-intro">Bienvenido a PorDóndePasa. Guarda tu casa, tu trabajo y las rutas que más usas en tu cuenta privada.</p>
   {state.phase==='checking'?<p className="account-status" role="status">Verificando tu sesión…</p>:<>
    <button className="google-login" disabled={!configured||signing} onClick={()=>void login()}><span aria-hidden="true" className="google-letter">G</span>{signing?'Conectando con Google…':'Continuar con Google'}</button>
    {state.phase==='error'&&<div className="account-notice" role="alert"><p>{state.message}</p><button onClick={()=>void verify()}>Volver a verificar</button><button onClick={()=>void logout()}>Cerrar sesión / cambiar cuenta</button></div>}
    {!configured&&<div className="account-notice" role="status"><strong>Conexión pendiente</strong><p>El panel está preparado. Para ingresar de verdad falta conectar el proyecto de Supabase y activar Google. Tus otras aplicaciones siguen intactas.</p></div>}
   </>}
   <div className="login-privacy"><span aria-hidden="true">◈</span><div><strong>Solo para ti</strong><p>Tus lugares guardados no se publican ni se comparten con anunciantes. No pedimos acceso a tus contactos ni a tu correo de Gmail.</p></div></div>
   <small className="login-pilot">Piloto privado · Solo cuentas autorizadas<br/>La sesión se conserva en este dispositivo hasta que cierres sesión o expire.</small>
  </section>
 </main>;
}
