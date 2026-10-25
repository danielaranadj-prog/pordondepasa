function safeEndpoint(value) {
  try { const u=new URL(value); return !u.username&&!u.password&&!u.hash&&(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))); } catch { return false; }
}
function publicAnonKey(value) {
  try { return value.split('.').length===3&&JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString()).role==='anon'; } catch { return false; }
}
export function assertAdsPublicConfig(env) {
  for(const [name,value] of Object.entries(env))if(name.startsWith('PUBLIC_ADS_')&&value&&(/SECRET|SERVICE_ROLE|PASSWORD/.test(name)||String(value).startsWith('sb_secret_')))throw Error('No se permiten secretos en la configuración pública de anuncios.');
  if(env.PUBLIC_ADS_MODE&&!['off','local','remote'].includes(env.PUBLIC_ADS_MODE))throw Error('PUBLIC_ADS_MODE debe ser off, local o remote.');
  if(env.PUBLIC_ADS_MODE!=='remote')return;
  const feed=env.PUBLIC_ADS_FEED_URL??'',events=env.PUBLIC_ADS_EVENTS_URL??'',key=env.PUBLIC_ADS_API_KEY??'';
  if(!safeEndpoint(feed))throw Error('El modo remoto necesita un feed HTTPS válido.');
  if(key&&!publicAnonKey(key))throw Error('El gateway admite la clave JWT pública anon, nunca una clave secret/service_role.');
  if(new URL(feed).hostname.endsWith('.supabase.co')&&!publicAnonKey(key))throw Error('Falta la clave pública anon para el gateway de Supabase.');
  if(events&&(!safeEndpoint(events)||new URL(events).protocol!=='https:'||new URL(events).origin!==new URL(feed).origin||!publicAnonKey(key)))throw Error('Las métricas requieren un endpoint HTTPS del mismo servicio y su clave pública anon.');
}
export function adsConfigGuard(){return {name:'pordondepasa-ads-public-config',async config(_config,{mode}){
 const {loadEnv}=await import('vite');assertAdsPublicConfig({...loadEnv(mode,process.cwd(),'PUBLIC_'),...process.env});
}};}
