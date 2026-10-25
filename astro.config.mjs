import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import {adsConfigGuard} from './scripts/ads-config.mjs';

export default defineConfig({
  base: process.env.PUBLIC_BASE_PATH || '/',
  integrations: [react()],
  output: 'static',
  vite: { plugins: [adsConfigGuard()], build: { target: 'es2022' } },
});
