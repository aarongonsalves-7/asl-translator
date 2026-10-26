import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static output: the whole app is client-side (camera + on-device inference), so Astro
// prerenders the two page shells and the React island takes over in the browser.
// This produces a plain static build that Vercel deploys with zero configuration.
export default defineConfig({
  integrations: [react()],
  output: 'static',
  build: {
    // Camera pages are JS-heavy; keeping CSS in one file avoids a flash on first paint.
    inlineStylesheets: 'never',
  },
});
