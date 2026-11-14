const { test, expect } = require('@playwright/test');
const { navigate } = require('../navigate.cjs');

test('browse large client and fabric directories and retain an unfinished docket', async ({page}, testInfo) => {
  await page.goto('/?demo=1');
  await page.evaluate(() => {
    for (let i = 0; i < 30; i++) {
      const id = 'additional-client-' + i;
      DB.clients[id] = {id, name: 'Synthetic catalogue client ' + i + ' ' + 'Long'.repeat(48), branch: 'Mumbai', phone: '5551234'};
      const swatchId = 'additional-swatch-' + i;
      DB.swatches[swatchId] = {id:swatchId, code:'QA-' + i, colorName:'Synthetic shade', vendorName:'Catalogue supplier',
        vendorContact:'demo@example.test', stockMeters:i === 0 ? null : 18};
    }
  });
  const snapshot = () => page.evaluate(() => ({
    data:JSON.stringify(DB), demo:localStorage.getItem(DB_KEY), actual:localStorage.getItem('modisto_bespoke_v7')
  }));
  const before = await snapshot();
  const more = page.locator('#navMore');
  if (await more.isVisible()) {
    await expect(page.locator('[data-v="orders"]')).toBeVisible();
    await expect(page.locator('[data-v="measure"]')).toBeVisible();
    await more.press('Enter');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await more.press('Escape');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  }
  const checkWidth = async () => expect(await page.evaluate(() => {
    const main = document.querySelector('#main');
    return main.scrollWidth <= main.clientWidth && document.documentElement.scrollWidth <= innerWidth;
  })).toBe(true);
  await navigate(page, 'clients');
  await expect(page.locator('#clientRows .directory-card')).toHaveCount(25);
  await page.getByRole('button', {name:'Load more', exact:true}).click();
  await expect(page.locator('#clientRows .directory-card')).toHaveCount(34);
  await page.locator('#clientSearch').fill('5551234');
  await expect(page.locator('#clientRows [role="status"]')).toHaveText('30 clients');
  await checkWidth();
  await page.locator('#clientSearch').fill('demo client');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path:testInfo.outputPath('clients.png'), fullPage:false});
  await navigate(page, 'measure');
  await page.locator('#mViewMode').selectOption('tabs');
  await page.locator('[data-m="Inseam"]').fill('31.25');
  await navigate(page, 'clients');
  await page.locator('#clientSearch').fill('demo client four');
  await page.getByRole('button', {name:'Demo Client Four', exact:true}).press('Enter');
  await page.getByRole('button', {name:'New measurement', exact:true}).click();
  await expect(page.locator('#overlay')).toContainText('Unsaved measurements');
  await page.locator('#cdCancel').press('Shift+Tab');
  await expect(page.locator('#cdOk')).toBeFocused();
  await page.locator('#cdOk').press('Escape');
  await expect(page.getByRole('button', {name:'New measurement', exact:true})).toBeFocused();
  await navigate(page, 'measure');
  await expect(page.locator('[data-m="Inseam"]')).toHaveValue('31.25');
  await expect(page.locator('#mSwatchCode')).toBeHidden();
  await page.screenshot({path:testInfo.outputPath('measurements.png'), fullPage:false});

  await navigate(page, 'dashboard');
  const stockReview = page.getByRole('button', {name:/fabrics need review/});
  const count = (await stockReview.textContent()).match(/\d+/)[0];
  await stockReview.click();
  await expect(page.locator('#swatchReview')).toBeChecked();
  await expect(page.locator('#swatchRows [role="status"]')).toHaveText(count + ' swatches');
  await page.locator('#swatchReview').uncheck();
  await page.locator('#swatchSearch').fill('catalogue supplier');
  await expect(page.locator('#swatchRows [role="status"]')).toHaveText('30 swatches');
  await page.locator('#swatchSearch').fill('qa-0');
  const card = page.locator('#swatchRows .directory-card');
  await expect(card).toContainText('Stock unrecorded');
  await expect(card.getByText('demo@example.test', {exact:true})).toBeHidden();
  await card.getByText('Swatch details', {exact:true}).click();
  await expect(card.getByText('demo@example.test', {exact:true})).toBeVisible();
  await checkWidth();
  await page.screenshot({path:testInfo.outputPath('fabrics.png'), fullPage:false});
  expect(await snapshot()).toEqual(before);
});
