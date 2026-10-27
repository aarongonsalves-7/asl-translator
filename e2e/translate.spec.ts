import { expect, test } from '@playwright/test';

test.describe('translate', () => {
  test('starts in the explicit "camera off" stage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('stage-headline')).toHaveText(/Camera off/i);
    await expect(page.getByRole('button', { name: 'Turn on camera' })).toBeVisible();
  });

  test('replays the demo and adds letters through the real pipeline', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Try the demo' }).click();

    await expect(page.getByTestId('stage-headline')).toHaveText(/no hand in view/i);
    // The demo spells HELLO letter by letter; each letter needs a hold to commit.
    await expect(page.getByTestId('output-text')).toContainText('H', { timeout: 15_000 });
    await expect(page.getByTestId('output-text')).toContainText('HELLO', { timeout: 25_000 });
    await expect(page.getByTestId('receipt')).toBeVisible();
    await expect(page.getByTestId('candidate').first()).toBeVisible();
  });

  test('explains a denied camera instead of showing a generic error', async ({ page }) => {
    // No permission granted, and the prompt is never accepted, so getUserMedia rejects.
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException('denied by test', 'NotAllowedError'));
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Turn on camera' }).click();

    await expect(page.getByTestId('stage-headline')).toHaveText(/Camera blocked/i);
    await expect(page.getByTestId('stage-action')).toContainText(/permission/i);
    await expect(page.getByRole('button', { name: 'Try camera again' })).toBeVisible();
  });

  test('loads the vendored tracker and reaches the no-hand stage with a real camera stream', async ({
    browser,
  }) => {
    // A fake capture device proves the whole live path works: camera -> MediaPipe wasm+model
    // (served from public/, no CDN) -> frame loop -> stage machine.
    const context = await browser.newContext({
      permissions: ['camera'],
      baseURL: 'http://127.0.0.1:4173',
    });
    const page = await context.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'Turn on camera' }).click();

    await expect(page.getByTestId('stage-headline')).toHaveText(/Loading the hand tracker/i, {
      timeout: 15_000,
    });
    await expect(page.getByTestId('stage-headline')).toHaveText(/no hand in view/i, {
      timeout: 45_000,
    });
    await expect(page.locator('.viewport-tag.live')).toBeVisible();
    await context.close();
  });
});
