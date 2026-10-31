import { expect, test } from '@playwright/test';

test('reduced motion preserves a usable interface at narrow widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  await expect(page.locator('.btn-primary').first()).toHaveCSS('transition-duration', '1e-06s');
  for (const path of ['/', '/alphabet/', '/settings/', '/privacy/', '/terms/', '/404/']) {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
  }
});

test('Space activates the focused demo control instead of editing the transcript', async ({ page }) => {
  await page.goto('/');
  const demo = page.getByRole('button', { name: 'Try the demo' });
  await demo.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Stop demo' })).toBeVisible();
  await expect(page.locator('.viewport-idle')).toHaveCount(0);
  await expect(page.getByTestId('output-text')).toContainText('HELLO', { timeout: 30000 });
  await page.getByRole('button', { name: 'Stop demo' }).click();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { (window as any).__copied = text; } } }));
  await page.getByRole('button', { name: 'Copy text' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Copied to clipboard.' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__copied)).toContain('HELLO');
});
