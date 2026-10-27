import { expect, test } from '@playwright/test';

test('the alphabet page lists all 26 handshapes from the rule table', async ({ page }) => {
  await page.goto('/alphabet/');
  await expect(page.locator('.letter-card')).toHaveCount(26);
  await expect(page.locator('#letter-J')).toContainText(/motion/i);
});

test('settings changes survive a reload and reach the recogniser', async ({ page }) => {
  await page.goto('/settings/');
  const holdTime = page.locator('#setting-holdMs');
  await holdTime.fill('900');
  await expect(page.getByTestId('value-holdMs')).toHaveText('0.90 s');

  await page.reload();
  await expect(page.getByTestId('value-holdMs')).toHaveText('0.90 s');

  await page.goto('/');
  await expect(page.getByText('0.9s hold')).toBeVisible();
});

test('the translate page stacks on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const main = await page.locator('.translate-main').boundingBox();
  const side = await page.locator('.translate-side').boundingBox();
  expect(main).not.toBeNull();
  expect(side).not.toBeNull();
  // Stacked: the side column starts below the main column rather than beside it.
  expect(side!.y).toBeGreaterThan(main!.y + main!.height - 1);
  await expect(page.locator('.nav-badge')).toBeHidden();
});

test('dark mode is honoured and can be overridden', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  // The page canvas is parchment, so dark mode lands on #1c1c1e rather than pure black.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(28, 28, 30)');

  await page.getByRole('button', { name: /switch to light theme/i }).click();
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).toBe('rgb(245, 245, 247)');
});
