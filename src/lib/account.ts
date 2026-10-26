import {createClient, type SupabaseClient, type User} from '@supabase/supabase-js';
import {isActiveRoute, type Point, type Shape} from './router.ts';

export type SavedPlace={kind:'home'|'work';label:string;point:Point};
export type AccountData={name:string;places:SavedPlace[];favorites:string[]};
export const emptyAccount=():AccountData=>({name:'',places:[],favorites:[]});
export function validSupabaseConfig(url:string,key:string):boolean {
 try {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')||parsed.pathname!=='/'||parsed.search||parsed.hash||parsed.username||parsed.password)return false;
  if(key.startsWith('sb_publishable_'))return key.length>25;
  // Reject accidentally configured service-role or secret keys before creating a client.
  const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  return key.split('.').length===3&&payload.role==='anon';
 }catch{return false}
}
export function validPrivatePoint(point:Point):boolean {
 return Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&point.lat>=21.40&&point.lat<=21.58&&point.lng>=-105.02&&point.lng<=-104.78;
}
export function personalName(value:unknown):string {return typeof value==='string'?value.trim().replace(/\s+/g,' ').slice(0,80):''}
let client:SupabaseClient|undefined;
export async function accountFetch(input:RequestInfo|URL,init:RequestInit={},timeoutMs=15000):Promise<Response> {
 const controller=new AbortController(),source=init.signal??(input instanceof Request?input.signal:undefined);
 const abort=()=>controller.abort();if(source?.aborted)abort();else source?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,timeoutMs);
 try {
  const response=await fetch(input,{...init,signal:controller.signal});
  // Keep the deadline through the JSON body too, not just response headers.
  await response.clone().arrayBuffer();return response;
 }finally{clearTimeout(timer);source?.removeEventListener('abort',abort)}
}
export function accountClient():SupabaseClient|null {
 const url=import.meta.env.PUBLIC_SUPABASE_URL?.trim()??'',key=import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()??'';
 if(!validSupabaseConfig(url,key))return null;
 return client??=createClient(url,key,{global:{fetch:accountFetch},auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'pordondepasa.auth.v1'}});
}
let callback:Promise<void>|undefined;
export function finishOAuth(client:SupabaseClient):Promise<void> {
 // Shared promise prevents duplicate exchanges when effects remount.
 return callback??=(async()=>{
  const url=new URL(window.location.href),code=url.searchParams.get('code'),error=url.searchParams.get('error');
  if(code||error||url.hash.includes('access_token')) {
   // Clear sensitive callback URL before rendering, links, or map requests.
   window.history.replaceState(null,'',`${url.origin}${import.meta.env.BASE_URL}`);
  }
  if(error)throw new Error('Google no completó el ingreso. Inténtalo otra vez.');
  if(url.hash.includes('access_token'))throw new Error('Este ingreso no usa el flujo seguro esperado. Inténtalo otra vez.');
  if(code){const result=await client.auth.exchangeCodeForSession(code);if(result.error)throw new Error('El enlace de ingreso expiró. Vuelve a iniciar con Google en este navegador.');}
 })();
}
export async function verifiedAccount(client:SupabaseClient):Promise<User|null> {
 const session=await client.auth.getSession();
 if(session.error)throw new Error('No se pudo recuperar la sesión.');
 if(!session.data.session)return null;
 const result=await client.auth.getUser();
 if(result.error||!result.data.user)throw new Error('No se pudo verificar tu sesión. Revisa la conexión y vuelve a intentar.');
 if(result.data.user.app_metadata.provider!=='google')throw new Error('Esta prueba admite únicamente ingreso con Google.');
 const access=await client.rpc('account_access');
 if(access.error)throw new Error('El servicio de cuentas aún no está listo o no está disponible.');
 if(access.data!==true)throw new Error('Esta cuenta de Google todavía no está autorizada para el piloto.');
 return result.data.user;
}
export async function loadAccount(client:SupabaseClient,user:User):Promise<AccountData> {
 const [profile,places,favorites]=await Promise.all([
  client.from('account_profiles').select('display_name').eq('user_id',user.id).maybeSingle(),
  client.from('account_saved_places').select('kind,label,latitude,longitude').eq('user_id',user.id),
  client.from('account_favorite_routes').select('route_id').eq('user_id',user.id)
 ]);
 if(profile.error||places.error||favorites.error)throw new Error('No se pudieron cargar tus datos privados. Puedes reintentar.');
 let name=personalName(profile.data?.display_name??user.user_metadata.full_name??'Usuario');
 if(!name)name='Usuario';
 if(!profile.data){const created=await client.from('account_profiles').insert({user_id:user.id,display_name:name});if(created.error&&created.error.code!=='23505')throw new Error('No se pudo crear tu perfil.');}
 return {name,places:(places.data??[]).flatMap(row=>{
  const point={lat:row.latitude,lng:row.longitude};
  return (row.kind==='home'||row.kind==='work')&&validPrivatePoint(point)?[{kind:row.kind,label:personalName(row.label),point}]:[];
 }),favorites:(favorites.data??[]).map(row=>row.route_id)};
}
export async function savePrivatePlace(client:SupabaseClient,userId:string,place:SavedPlace) {
 if(!validPrivatePoint(place.point)||!personalName(place.label))throw new Error('Elige una ubicación en Tepic o Xalisco y agrega un nombre.');
 const result=await client.from('account_saved_places').upsert({user_id:userId,kind:place.kind,label:personalName(place.label),latitude:place.point.lat,longitude:place.point.lng},{onConflict:'user_id,kind'}).select('kind').single();
 if(result.error||!result.data)throw new Error('No se pudo guardar. Tus datos anteriores se conservan.');
}
export async function saveFavorite(client:SupabaseClient,userId:string,routeId:string,enabled:boolean) {
 if(!/^[\w-]{1,120}$/.test(routeId))throw new Error('Ruta no válida.');
 const result=enabled?await client.from('account_favorite_routes').upsert({user_id:userId,route_id:routeId},{onConflict:'user_id,route_id'}).select('route_id').single():await client.from('account_favorite_routes').delete().eq('user_id',userId).eq('route_id',routeId).select('route_id');
 if(result.error||(!enabled&&(!Array.isArray(result.data)||!result.data.length)))throw new Error('No se pudo actualizar la favorita. Recarga tu cuenta e inténtalo otra vez.');
}
export async function loadRouteCatalog():Promise<Shape[]> {
 const response=await fetch(`${import.meta.env.BASE_URL}data/tepic-routes.json`);
 if(!response.ok)throw new Error('No se pudo cargar el catálogo de rutas.');
 const data=await response.json(),seen=new Set<string>();
 if(!Array.isArray(data.routes))throw new Error('Catálogo de rutas no disponible.');
 return data.routes.filter((r:Shape)=>{
  if(!r||typeof r.id!=='string'||typeof r.name!=='string'||!Array.isArray(r.coordinates)||r.coordinates.length<2||!isActiveRoute(r)||seen.has(r.id))return false;
  seen.add(r.id);return true;
 }).sort((a:Shape,b:Shape)=>a.name.localeCompare(b.name,'es',{numeric:true}));
}
