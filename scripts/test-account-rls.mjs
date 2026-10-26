import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

// Real PostgreSQL roles and policies, not JavaScript simulations of RLS.
const db=new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role supabase_auth_admin;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as
 $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 grant execute on function auth.uid() to authenticated;
`);
await db.exec(await readFile(new URL('../supabase/migrations/202610130001_private_accounts.sql',import.meta.url),'utf8'));
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
await db.exec(`
 insert into auth.users values
 ('${A}','pilot-a@example.test',now(),'{"provider":"google"}'),
 ('${B}','pilot-b@example.test',now(),'{"provider":"google"}'),
 ('${C}','password@example.test',now(),'{"provider":"email"}');
 insert into app_private.account_allowlist(email) values
 ('pilot-a@example.test'),('pilot-b@example.test'),('password@example.test');
 insert into public.account_profiles(user_id,display_name) values ('${B}','Private B');
 insert into public.account_saved_places(user_id,kind,label,latitude,longitude) values ('${B}','home','Private home B',21.5,-104.89);
 insert into public.account_favorite_routes(user_id,route_id) values ('${B}','mexico');
`);
async function asRole(role,id,sql){
 await db.exec('begin');
 try {
  await db.exec(`set local role ${role}`);
  if(id)await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id]);
  const result=await db.query(sql);await db.exec('commit');return result.rows;
 }catch(error){await db.exec('rollback');throw error;}
}
let checks=0;
async function denied(role,id,sql){await assert.rejects(asRole(role,id,sql),error=>error.code==='42501');checks++}
for(const table of ['account_profiles','account_saved_places','account_favorite_routes']){
 await denied('anon',null,`select * from public.${table}`);
 assert.deepEqual(await asRole('authenticated',A,`select * from public.${table}`),[]);checks++;
}
await denied('anon',null,'select public.account_access()');
assert.equal((await asRole('authenticated',A,'select public.account_access() as allowed'))[0].allowed,true);checks++;
await asRole('authenticated',A,`insert into public.account_profiles(user_id,display_name) values ('${A}','Pilot A')`);checks++;
await asRole('authenticated',A,`insert into public.account_saved_places(user_id,kind,label,latitude,longitude) values ('${A}','work','My workplace',21.51,-104.90)`);checks++;
await asRole('authenticated',A,`insert into public.account_favorite_routes(user_id,route_id) values ('${A}','rio-suchiate')`);checks++;
await denied('authenticated',A,`insert into public.account_saved_places(user_id,kind,label,latitude,longitude) values ('${B}','work','Injection',21.51,-104.90)`);
await denied('authenticated',A,`update public.account_profiles set user_id='${B}' where user_id='${A}'`);
assert.deepEqual(await asRole('authenticated',A,`update public.account_saved_places set label='Hacked' where user_id='${B}' returning *`),[]);checks++;
assert.deepEqual(await asRole('authenticated',A,`delete from public.account_favorite_routes where user_id='${B}' returning *`),[]);checks++;
await denied('authenticated',A,'select * from app_private.account_allowlist');
await denied('authenticated',A,"insert into app_private.account_allowlist(email) values ('attacker@example.test')");
await denied('authenticated',A,"select app_private.before_account_created('{}')");
assert.equal((await asRole('authenticated',C,'select public.account_access() as allowed'))[0].allowed,false);checks++;
await denied('authenticated',C,`insert into public.account_profiles(user_id,display_name) values ('${C}','Wrong provider')`);
await db.exec("update app_private.account_allowlist set enabled=false where email='pilot-a@example.test'");
assert.equal((await asRole('authenticated',A,'select public.account_access() as allowed'))[0].allowed,false);checks++;
assert.deepEqual(await asRole('authenticated',A,'select * from public.account_saved_places'),[]);checks++;
await denied('authenticated',A,'select public.account_clear_data()');
await db.exec("update app_private.account_allowlist set enabled=true where email='pilot-a@example.test'");
await asRole('authenticated',A,'select public.account_clear_data()');checks++;
for(const table of ['account_profiles','account_saved_places','account_favorite_routes']){
 assert.deepEqual(await asRole('authenticated',A,`select * from public.${table}`),[]);checks++;
 assert.equal((await asRole('authenticated',B,`select count(*)::int as n from public.${table}`))[0].n,1);checks++;
}
const allowedEvent=JSON.stringify({user:{email:'pilot-a@example.test',app_metadata:{provider:'google'}}});
const allowedHook=await asRole('supabase_auth_admin',null,`select app_private.before_account_created('${allowedEvent}') as result`);
assert.deepEqual(allowedHook[0].result,{});checks++;
const deniedHook=await asRole('supabase_auth_admin',null,`select app_private.before_account_created('{"user":{"email":"stranger@example.test","app_metadata":{"provider":"google"}}}') as result`);
assert.equal(deniedHook[0].result.error.http_code,403);checks++;
await db.close();
console.log(`OK: ${checks} comprobaciones PostgreSQL de privacidad, permisos, Google, revocación y borrado propio.`);
