import { expect, test } from '@playwright/test';
test('alphabet preview exposes all poses and controllable motion', async ({ page }) => {
  await page.goto('/alphabet/');
  await page.waitForFunction(() => !document.querySelector('astro-island')?.hasAttribute('ssr'));
  await expect(page.getByRole('img', { name: /hand landmark preview/ })).toHaveCount(26);
  await page.getByLabel('Signing hand').selectOption('left');
  await expect(page.getByRole('img', { name: 'A, left hand landmark preview' })).toBeVisible();
  const before = await page.locator('#letter-J svg').innerHTML();
  await page.getByLabel('Motion frame').fill('35');
  await expect.poll(() => page.locator('#letter-J svg').innerHTML()).not.toBe(before);
  await page.screenshot({ path: 'test-results/alphabet-preview.png', fullPage: true });
});
