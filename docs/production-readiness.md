# Deployment and privacy release checklist

## Implemented and scope

This is a static on-device tool, not a local business or lead-generation website. No inquiry forms, payments, account service, analytics ID, advertising tags or frontend secrets were found in the audited source. No duplicate contact form, spam widget, thank-you page, customer reviews, case studies, map, address, response promise or LocalBusiness schema was added. Add those only after a real service, truthful business information and an actual delivery endpoint exist. Existing favicon is retained. The only new raster image is an optimized 1200x630 social PNG (~29 KB); educational previews remain accessible SVG. No dependencies added.

## Required before public release

1. Supply the real public HTTPS origin as the build environment variable `SITE_URL` (origin only, no path/query). Configure `OPERATOR_NAME` and `PRIVACY_CONTACT_EMAIL` as build variables to render the real operator and privacy contact on the legal pages. None of these is a secret. Builds without SITE_URL omit canonical identity, emit noindex, an empty sitemap and disallow crawling, deliberately avoiding invented production URLs. Rebuild after changes. Preview deployments should omit SITE_URL.
2. Have counsel/operator review `/privacy/` and `/terms/` for the actual operator, jurisdiction, target audience (including children), legal basis, rights-request handling and hosting/subprocessor logs, retention, transfers and contact. The pages describe verified software behavior, not a claim of compliance or a substitute for operator-specific legal terms. Those details are currently unknown; do not label this release legally approved.
3. Select and configure the hosting account/domain. README targets Vercel: `vercel.json` adds HSTS, nosniff, referrer and permissions policies and a CSP that allows the local MediaPipe runtime. Vercel manages HTTP-to-HTTPS redirects/TLS; this repo cannot configure your DNS or verify your account. Other hosts must explicitly redirect HTTP to HTTPS and apply equivalent response headers. HSTS is scoped to this host (no includeSubDomains/preload). Do not replace redirects with frontend JavaScript.
4. Verify deployed `curl -I http://YOUR_REAL_DOMAIN/` redirects to HTTPS without loops; `curl -I https://YOUR_REAL_DOMAIN/` returns HSTS and the security headers. Check an unknown path returns the custom 404 with HTTP 404, not a 200 SPA rewrite. Confirm `robots.txt`, sitemap and canonical/social URLs contain the real domain, then submit sitemap to search tools. Verify compression (Brotli/gzip) is enabled by the CDN for JS/CSS/WASM; no manually compressed duplicate bundles are necessary. Hashed `/_astro/` assets have immutable caching; unhashed model/font/image files must not receive blanket immutable caching.
5. Smoke-test camera/model loading under real deployment headers on mobile Safari and Chromium. The browser regression injects the configured CSP, but only a real deployment confirms host behavior. CSP currently permits Astro's inline bootstrap scripts and WASM compilation; it blocks external connections/frames. Review before tightening further or introducing any vendor.

## Secrets

No private API credentials exist in the reviewed frontend/configuration files. `.env*` is ignored except `.env.example`. Never place secrets in `PUBLIC_*`, a React prop, browser JS, HTML, a static JSON endpoint or vercel headers. A future integration requiring private keys needs a server-side endpoint with authenticated/rate-limited input and host secret storage; a static build cannot conceal a key. Audit git history and rotate any historical credentials before release if such credentials ever existed; history was not exhaustively scanned here.

## Consent and analytics (not enabled)

Current app uses only user-requested theme/calibration preferences in localStorage; no advertising/analytics cookies or third-party tracking scripts are present. Camera permission is separately requested by the browser. No empty cookie banner was added. The operator must review regional storage rules and host-injected telemetry before release. Storage rules can cover localStorage as well as cookies: [ICO guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/cookies-and-similar-technologies/).

No GA measurement ID or analytics account was supplied. To add GA4:

- Provide the public measurement ID and confirm data retention, audience/jurisdiction and operator privacy disclosures. The ID is not a secret; service-account keys and Measurement Protocol API secrets are.
- Add a real consent manager with equally accessible Accept/Reject and later withdrawal. Start denied; do not fetch gtag.js or send cookieless pings before affirmative consent (basic consent mode). Do not treat camera permission as analytics consent. Persist only the consent choice needed to honor the user decision.
- Load GA only after grant. On revocation disable collection, remove configured analytics cookies as applicable, and verify in a clean browser that no Google requests occur before consent or after rejection. Account for multiple domains/cookie paths. Update CSP allowlists narrowly and review the privacy notice.
- Never put camera imagery, tracking coordinates, transcript text, sample files, sensitive URLs or user identifiers into analytics events. Test accept/reject/revoke, refresh, private browsing and storage failures. See [Google consent implementation](https://developers.google.com/tag-platform/security/guides/consent).

## Forms and links

Current controls are sliders, checkboxes and selects, not inquiry forms. Sliders have min/max/step, labels, value text and help associations; changes pass through `sanitizeConfig`. Stored non-finite/wrong-type values are rejected. Browser tests exercise every slider, thumb toggle, alphabet controls, navigation and local sample controls. If an inquiry form is later commissioned, implement server validation, length limits, same-origin/CSRF controls where relevant, server-side rate limiting and spam handling, accessible inline errors, delivery confirmation and a thank-you route reached only after successful delivery. Do not show a fabricated submission success for a mailto link or nonexistent backend.

## Reference documentation

- [Vercel response headers](https://vercel.com/docs/headers)
- [HSTS behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security)
- [FTC: honor privacy representations](https://www.ftc.gov/business-guidance/privacy-security)

Tests demonstrate engineering behavior, not legal approval, WCAG certification, real-signer recognition accuracy or an external performance score.

## Validation completed 29 October 2026

- 60 unit/integration tests passed.
- Astro type check: zero errors, warnings or hints; production build passed.
- All 18 Playwright checks passed, including every settings control, navigation and internal anchors, unique metadata, crawl files, custom 404 status, mobile overflow/CTA, camera and overlay behavior, and model loading with the configured CSP injected as a response header. No third-party requests were observed in that CSP camera test.
- Separate build to an ignored test directory with a reserved test domain verified all five canonical URLs, absolute social image URLs, sitemap entries, robots sitemap URL and 404 noindex. Normal dist remains a non-indexable preview until a real SITE_URL is set.
- Social artwork and mobile privacy layout were visually inspected. Static token contrast calculations: light muted text on canvas 5.52:1, dark muted text 7.83:1, green text on white 5.02:1, preview blue on white 5.05:1. These spot checks are not a WCAG conformance audit.
- Local privacy route returned HTTP 200. Actual deployment TLS, redirects, headers, cache/compression and operator legal obligations remain unverified without domain/hosting information and access.
