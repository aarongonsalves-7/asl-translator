import { expect, test, type Page } from '@playwright/test';

/**
 * Astro marks an island with `ssr` until its JavaScript has hydrated. Interacting before that
 * point races the hydration render, which re-applies the stored config over the input.
 */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const island = document.querySelector('astro-island');
    return !island || !island.hasAttribute('ssr');
  });
}

test('the alphabet page lists all 26 handshapes from the rule table', async ({ page }) => {
  await page.goto('/alphabet/');
  await expect(page.locator('.letter-card')).toHaveCount(26);
  await expect(page.locator('#letter-J')).toContainText(/motion/i);
});

test('settings changes survive a reload and reach the recogniser', async ({ page }) => {
  await page.goto('/settings/');
  await waitForHydration(page);
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
  // The sub-nav sheds its note on phone widths; the page name and theme toggle stay.
  await expect(page.locator('.sub-nav-note')).toBeHidden();
  await expect(page.locator('.sub-nav-title')).toBeVisible();
});

test('dark mode is honoured and can be overridden', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  // The page canvas is pure white in light mode, so dark mode lands on pure black.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(0, 0, 0)');

  await page.getByRole('button', { name: /switch to light theme/i }).click();
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).toBe('rgb(255, 255, 255)');
});

test('the shell keeps the Apple chassis: black nav, frosted sub-nav, full-bleed tiles', async ({
  page,
}) => {
  await page.goto('/');

  const nav = page.locator('.global-nav');
  const navBox = await nav.boundingBox();
  expect(navBox!.height).toBe(44);
  expect(await nav.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(0, 0, 0)');

  const subNav = page.locator('.sub-nav');
  expect((await subNav.boundingBox())!.height).toBe(52);
  // 80px of air inside the hero tile, and no rounding on the tile itself.
  // The React island is a custom element, so its tiles are descendants of main, not children.
  const tiles = await page.locator('main .tile').evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        radius: style.borderTopLeftRadius,
        pad: parseFloat(style.paddingTop),
        width: Math.round(node.getBoundingClientRect().width),
      };
    }),
  );
  expect(tiles.length).toBeGreaterThanOrEqual(2);
  for (const tile of tiles) {
    expect(tile.radius).toBe('0px');
    expect(tile.width).toBe(page.viewportSize()!.width);
  }
  expect(tiles[0]!.pad).toBeGreaterThanOrEqual(64);

  // The hero headline is set at display scale, not at body scale.
  const heroSize = await page.locator('.hero-display').evaluate((el) => {
    const style = getComputedStyle(el);
    return { size: parseFloat(style.fontSize), weight: style.fontWeight, align: style.textAlign };
  });
  expect(heroSize.size).toBeGreaterThanOrEqual(40);
  expect(heroSize.weight).toBe('600');
});
