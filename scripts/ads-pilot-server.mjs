/** Local-only ad bridge. This is deliberately not a production public API. */
import {createServer} from 'node:http';
import {readFile, writeFile, rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';

const host = '127.0.0.1';
const port = Number(process.env['ADS_PILOT_PORT'] || 4370);
const token = process.env.ADS_PILOT_TOKEN;
const store = resolve(process.env.ADS_PILOT_STORE || '.ads-pilot.json');
const allowedOrigins = new Set((process.env.ADS_PILOT_ORIGINS || 'http://127.0.0.1:4359,http://localhost:4359').split(','));
const loopbackOrigin = value => { try { const url=new URL(value); return url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname); } catch { return false; } };
if (!token || token.length < 16) throw Error('Define ADS_PILOT_TOKEN con al menos 16 caracteres antes de iniciar el puente.');

const emptyFeed = {schemaVersion:1,enabled:false,version:'empty',campaigns:[]};
async function currentFeed() {
  try { return JSON.parse(await readFile(store,'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return emptyFeed; throw error; }
}
function validCampaign(ad) {
  return ad && typeof ad === 'object' && typeof ad.id === 'string' && ad.id.length > 0 &&
    ['pin','landmark','sponsored_trip'].includes(ad.type) && typeof ad.title === 'string' &&
    typeof ad.isActive === 'boolean' && Array.isArray(ad.routeIds) &&
    ad.routeIds.length > 0 && ad.routeIds.every(id => typeof id === 'string') &&
    (ad.type === 'sponsored_trip' || ad.coordinates && Number.isFinite(ad.coordinates.lat) && Number.isFinite(ad.coordinates.lng));
}
const publicFields = ['id','type','title','description','icon','referenceText','promoText','routeIds','coordinates','radiusMeters','callToAction','isActive','sponsoredTrip','startDate','endDate','schedule'];
const publicCampaign = ad => Object.fromEntries(publicFields.filter(key => ad[key] !== undefined).map(key => [key,ad[key]]));
export function validPublish(body) {
  return body && body.schemaVersion === 1 && typeof body.enabled === 'boolean' &&
    Array.isArray(body.campaigns) && body.campaigns.length <= 100 &&
    body.campaigns.every(validCampaign) && new Set(body.campaigns.map(ad => ad.id)).size === body.campaigns.length;
}
function send(response,status,data) {
  response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
  response.end(JSON.stringify(data));
}
async function receiveJson(request) {
  let raw='';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 500_000) throw Error('payload_too_large');
  }
  return JSON.parse(raw);
}
export function createAdsPilotServer() {
  return createServer(async (request,response) => {
    const origin = request.headers.origin;
    if (origin && loopbackOrigin(origin)) {
      response.setHeader('access-control-allow-origin',origin);
      response.setHeader('vary','Origin');
      response.setHeader('access-control-allow-methods','GET,PUT,OPTIONS');
      response.setHeader('access-control-allow-headers','Authorization,Content-Type');
    }
    if (request.method === 'OPTIONS') { response.writeHead(origin && loopbackOrigin(origin) ? 204 : 403); response.end(); return; }
    if (request.url !== '/api/ads') { send(response,404,{error:'not_found'}); return; }
    if (request.method === 'GET') { send(response,200,await currentFeed()); return; }
    if (request.method !== 'PUT') { send(response,405,{error:'method_not_allowed'}); return; }
    if (origin && !allowedOrigins.has(origin)) { send(response,403,{error:'origin_not_allowed'}); return; }
    if (request.headers.authorization !== `Bearer ${token}`) { send(response,401,{error:'unauthorized'}); return; }
    try {
      const body = await receiveJson(request);
      if (!validPublish(body)) { send(response,400,{error:'invalid_feed'}); return; }
      const feed = {schemaVersion:1,enabled:body.enabled,version:randomUUID(),campaigns:body.campaigns.map(publicCampaign)};
      const temp = `${store}.${process.pid}.tmp`;
      await writeFile(temp,JSON.stringify(feed,null,2),{mode:0o600});
      await rename(temp,store);
      send(response,200,{ok:true,version:feed.version,count:feed.campaigns.length,enabled:feed.enabled});
    } catch (error) { send(response,error?.message === 'payload_too_large' ? 413 : 400,{error:'invalid_json'}); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  createAdsPilotServer().listen(port,host,() => console.log(`Puente local de anuncios en http://${host}:${port}/api/ads`));
}
