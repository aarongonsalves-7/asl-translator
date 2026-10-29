import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
const publicSite = process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined;
if (publicSite && (publicSite.protocol !== 'https:' || publicSite.pathname !== '/' || publicSite.search || publicSite.hash || publicSite.username || publicSite.password)) {
  throw new Error('SITE_URL must be an HTTPS origin without credentials, a path, query or fragment.');
}

// Static output: the whole app is client-side (camera + on-device inference), so Astro
// prerenders the two page shells and the React island takes over in the browser.
// This produces a plain static build that Vercel deploys with zero configuration.
export default defineConfig({
  // Explicit identity: do not publish preview/localhost URLs as canonicals.
  site: publicSite?.href,
  trailingSlash: 'always',
  integrations: [react()],
  output: 'static',
  build: {
    // Camera pages are JS-heavy; keeping CSS in one file avoids a flash on first paint.
    inlineStylesheets: 'never',
  },
});
