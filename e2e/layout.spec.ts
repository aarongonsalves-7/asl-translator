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
  // The menu collapses on phone widths; the wordmark and the theme control stay.
  await expect(page.locator('.global-nav-links')).toBeHidden();
  await expect(page.locator('.global-nav-brand')).toBeVisible();
  await expect(page.locator('#theme-toggle')).toBeVisible();
});

test('dark mode is honoured and can be overridden', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  // Theme preference switches the whole neutral surface system.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(16, 31, 27)');

  await page.getByRole('button', { name: /switch to light theme/i }).click();
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).toBe('rgb(240, 246, 242)');
});

test('the practice workspace is immediately reachable and the shell stays consistent', async ({
  page,
}) => {
  await page.goto('/');

  const nav = page.locator('.global-nav');
  const navBox = await nav.boundingBox();
  expect(navBox!.height).toBe(76);
  await expect(page.getByRole('button', { name: 'Turn on camera', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Try the demo', exact: true })).toBeInViewport();
  await expect(page.getByRole('list', { name: 'Current recognition steps' })).toBeVisible();

  // Bands are full-bleed (no radius, edge to edge) with editorial air inside.
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
  expect(tiles[0]!.pad).toBeGreaterThanOrEqual(24);

  // The bundled UI face keeps the interface independent of third-party font requests.
  const hero = await page.locator('.hero-display').evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      size: parseFloat(style.fontSize),
      weight: style.fontWeight,
      family: style.fontFamily,
    };
  });
  expect(hero.size).toBeGreaterThanOrEqual(40);
  expect(hero.weight).toBe('600');
  expect(hero.family).toContain('InterVar');

  // Teal consistently identifies the primary action.
  await page.goto('/settings/');
  await waitForHydration(page);
  await expect
    .poll(() =>
      page
        .locator('.settings-actions .btn-primary')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe('rgb(7, 94, 88)');
});

test('the mobile menu opens from the hamburger and closes again', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const toggle = page.locator('#nav-toggle');
  const menu = page.locator('#nav-menu');
  await expect(toggle).toBeVisible();
  await expect(menu).toBeHidden();

  await toggle.click();
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  // The panel is a working menu, not just decoration.
  await toggle.click();
  await menu.getByRole('link', { name: 'Alphabet' }).click();
  await expect(page).toHaveURL(/\/alphabet\/$/);
});

test('the theme control shows a sun in light mode and a moon in dark mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.theme-icon-sun')).toBeVisible();
  await expect(page.locator('.theme-icon-moon')).toBeHidden();

  await page.getByRole('button', { name: /switch to dark theme/i }).click();
  await expect(page.locator('.theme-icon-moon')).toBeVisible();
  await expect(page.locator('.theme-icon-sun')).toBeHidden();
});
