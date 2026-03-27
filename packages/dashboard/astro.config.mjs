// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import clerk from '@clerk/astro';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    clerk({
      afterSignInUrl: '/dashboard',
      afterSignUpUrl: '/dashboard',
    }),
  ],
});
