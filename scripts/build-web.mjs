import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {assertAdsPublicConfig} from './ads-config.mjs';
const config=JSON.parse(await readFile(new URL('../deployment/android-ads-public.json',import.meta.url),'utf8'));
if(config.projectRef!=='suvpiadsjljkmvzrbgqv')throw Error('Web targets only the authorized PorDóndePasa ads service.');
const env={...process.env,PUBLIC_PASSENGER_MODE:'guest',PUBLIC_ADS_MODE:process.env.PUBLIC_ADS_MODE==='off'?'off':'remote',PUBLIC_ADS_FEED_URL:config.feedUrl,PUBLIC_ADS_EVENTS_URL:config.eventsUrl,PUBLIC_ADS_API_KEY:config.publicAnonKey};
assertAdsPublicConfig(env);
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','build:passenger'],{stdio:'inherit',env});
process.exit(result.status??1);
