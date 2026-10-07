import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  base: process.env.PUBLIC_BASE_PATH || '/',
  integrations: [react()],
  output: 'static',
  vite: { build: { target: 'es2022' } },
});
