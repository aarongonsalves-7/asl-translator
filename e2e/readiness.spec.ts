import { expect, test } from '@playwright/test';
import config from '../vercel.json' with { type: 'json' };
const paths=['/','/alphabet/','/settings/','/privacy/','/terms/'];
test('unique metadata, local links, accessibility landmarks and crawl files',async({page,request})=> {
  const titles=new Set<string>(),descriptions=new Set<string>(),links=new Set<string>();
  for(const path of paths) {
    await page.goto(path);
    titles.add(await page.title());descriptions.add(await page.locator('meta[name="description"]').getAttribute('content') ?? '');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveAttribute('id','main-content');
    await expect(page.getByRole('link',{name:'Skip to content'})).toHaveAttribute('href','#main-content');
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content',/ASL Translator/);
    if(path!=='/') await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toBeVisible();
    for(const href of await page.locator('a[href]').evaluateAll(els=>els.map(el=>(el as HTMLAnchorElement).href))) {
      const target=new URL(href);if(target.origin==='http://127.0.0.1:4173') links.add(target.pathname+target.hash);
    }
  }
  expect(titles.size).toBe(paths.length);expect(descriptions.size).toBe(paths.length);expect(descriptions.has('')).toBe(false);
  for(const link of links) {
    const response=await page.goto(link);expect(response?.status(),link).toBe(200);
    const hash=new URL(page.url()).hash;
    if(hash) expect(await page.locator('[id]').evaluateAll((els,id)=>els.some(el=>el.id===id),decodeURIComponent(hash.slice(1))),link).toBe(true);
  }
  const robots=await request.get('/robots.txt');expect(robots.ok()).toBe(true);
  const sitemap=await request.get('/sitemap.xml');expect(sitemap.ok()).toBe(true);expect(await sitemap.text()).toContain('<urlset');
  expect((await request.get('/social-preview.png')).ok()).toBe(true);
  expect((await request.get('/favicon.svg')).ok()).toBe(true);
  const missing=await page.goto('/this-page-does-not-exist');expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading',{name:"That page isn't here."})).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, follow');
});

test('mobile CTA, pages and FAQ stay usable without overflow',async({page})=> {
  await page.setViewportSize({width:360,height:800});
  for(const path of paths) {
    await page.goto(path);
    if(['/', '/alphabet/', '/settings/'].includes(path)) await expect(page.locator('.mobile-cta')).toBeVisible();
    else await expect(page.locator('.mobile-cta')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true);
    if(path==='/privacy/') await page.screenshot({path:'test-results/privacy-mobile.png',fullPage:true});
  }
  await page.goto('/');
  await expect(page.getByRole('link',{name:'Try the translator',exact:true})).toBeInViewport();
  await page.getByText('Does my camera video leave my device?',{exact:true}).click();
  await expect(page.locator('#faq details').first()).toHaveAttribute('open','');
  await page.locator('.mobile-cta').click();await expect(page).toHaveURL(/#translator$/);
});

test('every settings control validates and persists changes',async({page})=> {
  await page.goto('/settings/');
  await page.waitForFunction(()=>!document.querySelector('astro-island')?.hasAttribute('ssr'));
  const sliders=page.locator('input[type="range"]');expect(await sliders.count()).toBe(5);
  for(const slider of await sliders.all()) {
    const minimum=await slider.getAttribute('min'),maximum=await slider.getAttribute('max');
    await slider.fill(minimum!);await expect(slider).toHaveValue(minimum!);
    await slider.fill(maximum!);await expect(slider).toHaveValue(maximum!);
    await expect(slider).toHaveAttribute('aria-describedby',/help/);
  }
  const toggle=page.getByRole('checkbox',{name:'Thumb gestures'});await toggle.uncheck();await page.reload();await expect(toggle).not.toBeChecked();
  await page.getByRole('button',{name:/reset/i}).click();await expect(toggle).toBeChecked();
});

test('proposed production CSP permits camera model and blocks external trackers',async({page})=> {
  const csp=config.headers[0]!.headers.find(h=>h.key==='Content-Security-Policy')!.value;
  await page.route('http://127.0.0.1:4173/**',async route=> {
    const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'content-security-policy':csp}});
  });
  const external:string[]=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4173/'))external.push(r.url());});
  await page.context().grantPermissions(['camera']);await page.goto('/');
  await page.getByRole('button',{name:'Turn on camera'}).click();
  await expect(page.getByTestId('stage-headline')).toHaveText(/no hand in view/i,{timeout:40000});
  expect(external).toEqual([]);
});
