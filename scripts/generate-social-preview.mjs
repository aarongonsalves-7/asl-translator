// A code-authored social card; no external images or fonts are fetched.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const font = (await readFile(new URL('../public/fonts/inter-latin.woff2', import.meta.url))).toString('base64');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html><html lang="en"><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#f0f6f2;color:#13332f;font-family:Inter,sans-serif}.nav{height:100px;background:#075e58;color:white;padding:28px 64px;display:flex;align-items:center;gap:16px;font-size:26px;font-weight:650}.mark{width:36px;height:42px;color:#f4db68}.body{padding:54px 64px}h1{font-size:58px;letter-spacing:-.035em;line-height:1.12;margin:0 0 20px;max-width:820px}p{font-size:25px;color:#365d54;margin:0}.bottom{display:flex;align-items:center;gap:28px;margin-top:42px}.action{background:#075e58;color:white;border-radius:8px;padding:18px 26px;font-weight:600;font-size:20px}.note{font-size:19px;color:#365d54}.line{display:flex;gap:10px;align-items:center;margin-top:40px;font-size:16px;color:#365d54}.line i{width:64px;height:1px;background:#8da99b}.line b{color:#075e58}
</style><div class="nav"><svg class="mark" viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 8v20M11 4v28M17 9v19M23 3v29M29 12v13"/></svg>ASL Translator</div><div class="body"><h1>Make room for<br>your next letter.</h1><p>Practice ASL fingerspelling, one handshape at a time.</p><div class="bottom"><span class="action">Camera or camera-free demo</span><span class="note">On your device. No account. No uploads.</span></div><div class="line"><b>Find your hand</b><i></i><span>Read the shape</span><i></i><span>Hold a letter</span><i></i><span>Add to text</span></div></div></html>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL('../public/social-preview.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
await browser.close();
