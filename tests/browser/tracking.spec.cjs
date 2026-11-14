const { test, expect } = require('@playwright/test');

test('Today drilldowns reconcile and open an order without writing data', async ({page}, testInfo) => {
  await page.clock.setFixedTime(new Date(2026, 10, 5, 12));
  await page.goto('/?demo=1');
  const snapshot = () => page.evaluate(() => ({
    records: JSON.stringify(DB), demo: localStorage.getItem(DB_KEY), real: localStorage.getItem('modisto_bespoke_v7')
  }));
  const before = await snapshot();
  await page.getByRole('heading', {name:'Today', exact:true}).waitFor();
  const noOverflow = () => page.evaluate(() => {
    const tracking = document.querySelector('.tracking');
    const results = document.querySelector('#orderRows');
    return tracking.scrollWidth <= tracking.clientWidth && (!results || results.scrollWidth <= results.clientWidth) &&
      document.documentElement.scrollWidth <= innerWidth;
  });
  expect(await noOverflow()).toBe(true);
  expect(await page.locator('#attentionHeading').evaluate(el => el.getBoundingClientRect().top < innerHeight)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('today.png'), fullPage:true});
  for (const view of ['active', 'overdue', 'fittings', 'ready']) {
    const card = page.locator('.tracking-metric[data-today-view="' + view + '"]');
    const count = await card.locator('strong').textContent();
    await card.click();
    await expect(page.locator('#orderResultCount')).toHaveText(count + (view === 'fittings' ? ' events' : ' orders'));
    expect(await noOverflow()).toBe(true);
    if (view === 'active') await page.screenshot({path:testInfo.outputPath('orders.png'), fullPage:true});
    await page.locator('[data-v="dashboard"]').click();
  }
  await page.locator('#todayBranch').selectOption('London');
  const bar = page.locator('[data-production-group]').first();
  const count = await bar.locator('strong').textContent();
  await bar.click();
  await expect(page.locator('#orderBranch')).toHaveValue('London');
  await expect(page.locator('#orderResultCount')).toHaveText(count + ' orders');
  const first = page.locator('#orderRows [data-open-tracked-order]').first();
  const name = await first.textContent();
  await page.locator('#orderSearch').fill(name);
  await first.focus();
  await first.press('Enter');
  await expect(page.locator('#orderOverviewHeading')).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('order-overview.png'), fullPage:true});
  await page.getByRole('button', {name:'← Orders', exact:true}).click();
  await expect(page.locator('#orderSearch')).toHaveValue(name);
  await expect(first).toBeFocused();
  expect(await snapshot()).toEqual(before);
});
