import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import {accountConfigGuard} from './scripts/account-config.mjs';
import {adsConfigGuard} from './scripts/ads-config.mjs';

export default defineConfig({
  base: process.env.PUBLIC_BASE_PATH || '/',
  integrations: [react()],
  output: 'static',
  vite: { plugins: [accountConfigGuard(),adsConfigGuard()], build: { target: 'es2022' } },
});
