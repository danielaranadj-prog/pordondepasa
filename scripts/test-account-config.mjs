import assert from 'node:assert/strict';
import {assertAccountPublicConfig} from './account-config.mjs';
assert.doesNotThrow(()=>assertAccountPublicConfig({}));
assert.doesNotThrow(()=>assertAccountPublicConfig({PUBLIC_SUPABASE_URL:'https://pilot.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_1234567890'}));
for(const env of [
 {PUBLIC_SUPABASE_SERVICE_ROLE_KEY:'fake-secret'},
 {PUBLIC_SUPABASE_URL:'https://pilot.supabase.co'},
 {PUBLIC_SUPABASE_URL:'https://pilot.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_fake'},
 {PUBLIC_SUPABASE_URL:'https://pilot.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:`x.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x`},
 {PUBLIC_SUPABASE_URL:'https://pilot.supabase.co.evil.test',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_1234567890'}
])assert.throws(()=>assertAccountPublicConfig(env));
console.log('OK: la compilación rechaza claves secretas y configuración incompleta antes de incluirlas en el frontend.');
