import assert from 'node:assert/strict';
import {assertAdsPublicConfig} from './ads-config.mjs';
const anon=`x.${Buffer.from('{"role":"anon"}').toString('base64url')}.x`,service=`x.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x`;
const valid={PUBLIC_ADS_MODE:'remote',PUBLIC_ADS_FEED_URL:'https://pilot.supabase.co/functions/v1/feed',PUBLIC_ADS_EVENTS_URL:'https://pilot.supabase.co/functions/v1/events',PUBLIC_ADS_API_KEY:anon};
for(const e of [{},{PUBLIC_ADS_MODE:'local'},{PUBLIC_ADS_MODE:'off'},valid])assert.doesNotThrow(()=>assertAdsPublicConfig(e));
for(const e of [{PUBLIC_ADS_MODE:'wrong'},{...valid,PUBLIC_ADS_FEED_URL:''},{...valid,PUBLIC_ADS_API_KEY:service},{...valid,PUBLIC_ADS_API_KEY:'sb_secret_fake'},{...valid,PUBLIC_ADS_EVENTS_URL:'https://another.example.test/events'},{...valid,PUBLIC_ADS_FEED_URL:'https://user:password@example.test/feed'}])assert.throws(()=>assertAdsPublicConfig(e));
console.log('OK: feed, métricas y claves de anuncios se comprueban antes de compilar.');
