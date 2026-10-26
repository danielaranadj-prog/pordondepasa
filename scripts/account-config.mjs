import {loadEnv} from 'vite';

export function assertAccountPublicConfig(env){
 const url=(env.PUBLIC_SUPABASE_URL??'').trim(),key=(env.PUBLIC_SUPABASE_PUBLISHABLE_KEY??'').trim();
 const dangerous=Object.keys(env).some(name=>/^PUBLIC_SUPABASE_.*(SECRET|SERVICE_ROLE|PASSWORD)/i.test(name)&&env[name]);
 if(dangerous)throw new Error('No se permiten secretos de Supabase en variables PUBLIC_.');
 if(!url&&!key)return; // Unconfigured local preview is deliberately fail-closed.
 let safe=false;
 try {
  const parsed=new URL(url);
  const publicKey=key.startsWith('sb_publishable_')&&key.length>25||key.split('.').length===3&&JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';
  safe=parsed.protocol==='https:'&&parsed.hostname.endsWith('.supabase.co')&&parsed.pathname==='/'&&!parsed.search&&!parsed.hash&&!parsed.username&&!parsed.password&&publicKey;
 }catch{}
 if(!safe)throw new Error('Configura la URL HTTPS y una clave publishable de Supabase. No compilar con claves secret o service_role.');
}
export function accountConfigGuard(){return {name:'pordondepasa-account-public-config',config(_config,{mode}){
 assertAccountPublicConfig({...loadEnv(mode,process.cwd(),'PUBLIC_'),...process.env});
}}}
