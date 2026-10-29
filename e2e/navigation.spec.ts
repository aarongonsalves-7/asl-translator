import { expect, test } from '@playwright/test';
test('icon navigation retains names, active states and keyboard focus on every page',async({page})=> {
  for(const [url,label] of [['/','Translate'],['/alphabet/','Alphabet'],['/settings/','Settings']]) {
    await page.goto(url!);
    for(const name of ['Main','Bottom']) {
      const nav=page.getByRole('navigation',{name,exact:true});
      for(const item of ['Translate','Alphabet','Settings']) {
        const link=nav.getByRole('link',{name:item,exact:true});
        await expect(link.locator('svg')).toHaveCount(1);
        await expect(link).toHaveText('');
        if(item===label) {
          await expect(link).toHaveAttribute('aria-current','page');
          await expect(link).not.toHaveCSS('box-shadow','none');
        }
        else await expect(link).not.toHaveAttribute('aria-current');
      }
    }
  }
  await page.getByRole('navigation',{name:'Bottom',exact:true}).getByRole('link',{name:'Alphabet',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/alphabet\/$/);
});

test('live preview mirrors both video and overlay without mirroring inference input',async({page})=> {
  await page.context().grantPermissions(['camera']);
  await page.goto('/');
  await page.getByRole('button',{name:'Turn on camera'}).click();
  await expect(page.locator('.viewport-mirrored')).toBeVisible({timeout:30000});
  const transforms=await page.locator('.viewport-mirrored').evaluate(el=>({video:getComputedStyle(el.querySelector('video')!).transform,canvas:getComputedStyle(el.querySelector('canvas')!).transform}));
  expect(transforms.video).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  expect(transforms.canvas).toBe(transforms.video);
  await page.getByText('Save a recognition mistake for review').click();
  await page.getByLabel('Intended letter').selectOption('M');
  await page.getByRole('button',{name:'Save recognition sample'}).click();
  await expect(page.getByRole('status').filter({hasText:'No tracked hand yet'})).toBeVisible();
});
