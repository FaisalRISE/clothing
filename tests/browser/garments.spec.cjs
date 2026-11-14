const { test, expect } = require('@playwright/test');
const { navigate } = require('../navigate.cjs');

async function openJobs(page, orderId = 'o_3') {
  await page.locator('[data-v="orders"]').click();
  await page.locator('[data-open-tracked-order="' + orderId + '"]').click();
  await page.locator('[data-act="openGarments"][data-id="' + orderId + '"]').click();
}

async function addJobs(page, type, quantity, swatch, maker) {
  await page.locator('#gjAdd').click();
  await page.locator('#gjType').selectOption(type);
  await page.locator('#gjQty').fill(String(quantity));
  await page.locator('#gjDocket').selectOption('m_demo_3');
  await page.locator('#gjSwatch').fill(swatch);
  await page.locator('#gjMaker').fill(maker);
  await page.locator('#gjApply').click();
  await expect(page.locator('#overlay')).toBeHidden();
}

test('review one suit and two shirts, then progress one job while retaining the existing order history', async ({page}, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?demo=1');
  const before = await page.evaluate(() => {
    DB.orders.o_3.workflow = buildDefaultWorkflow(DB.orders.o_3.date, 'New', '', '');
    DB.orders.o_3.workflow.push({key:'trial_3',label:'Third fitting',stage:'1st Trial / Fitting',done:true,
      doneDate:'2026-10-30',daysTaken:0,assignedTo:'Historic maker',notes:'Retain fitting findings'});
    writeDatabase(DB);
    return JSON.parse(JSON.stringify({order:DB.orders.o_3,measurements:DB.measurements,swatches:DB.swatches}));
  });
  await openJobs(page);
  await expect(page.locator('[data-job-card]')).toHaveCount(0);
  await addJobs(page, 'suit2', 1, 'SW-2089', 'Demo Jacket Maker');
  await expect(page.locator('[data-job-card]')).toHaveCount(2);
  expect(await page.evaluate(() => DB.orders.o_3.garmentJobs)).toBeUndefined();
  await addJobs(page, 'shirt', 2, 'SW-3110', 'Demo Shirt Maker');
  await expect(page.locator('[data-job-card]')).toHaveCount(4);
  await page.locator('#gjSave').click();
  await expect(page.locator('#gjStatus')).toHaveText('Garment jobs saved locally');
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify(DB.orders.o_3)));
  expect(saved.garmentJobs.map(job => job.type)).toEqual(['jacket','trousers','shirt','shirt']);
  expect(new Set(saved.garmentJobs.map(job => job.id)).size).toBe(4);
  for (const key of Object.keys(before.order).filter(key => key !== 'status')) expect(saved[key]).toEqual(before.order[key]);
  expect(saved.productionBeforeGarmentJobs.status).toBe('Stitching');
  expect(await page.evaluate(() => Object.keys(DB.measurementVersions).length)).toBe(1);
  expect(await page.evaluate(() => DB.measurements)).toEqual(before.measurements);
  expect(await page.evaluate(() => DB.swatches)).toEqual(before.swatches);

  const jacketId = saved.garmentJobs[0].id;
  await page.locator('[data-job-edit="' + jacketId + '"]').click();
  await page.getByText('Workshop tasks', {exact:true}).click();
  await page.locator('#gjStage').selectOption('Cutting');
  await page.locator('[data-gj-done="3"]').check();
  await page.locator('[data-gj-date="3"]').fill('2026-11-08');
  await page.locator('[data-gj-note="3"]').fill('Pattern balance checked');
  await page.locator('#gjNotes').fill('Keep quarter-inch sleeve allowance');
  await page.locator('#gjApply').click();
  await page.locator('#gjSave').click();
  const progressed = await page.evaluate(() => JSON.parse(JSON.stringify(DB.orders.o_3)));
  expect(progressed.garmentJobs[0].workflow[0].done).toBe(false);
  expect(progressed.garmentJobs[0].workflow[3].doneDate).toBe('2026-11-08');
  expect(progressed.garmentJobs[1]).toEqual(saved.garmentJobs[1]);
  expect(progressed.workflow).toEqual(before.order.workflow);
  await page.locator('[data-job-edit="' + jacketId + '"]').click();
  await page.locator('#gjStage').selectOption('Ready');
  await page.locator('#gjApply').click();
  await page.locator('#gjSave').click();
  await expect(page.locator('#main')).toContainText('1 of 4 garments ready');
  await page.locator('#gjHistory > summary').click();
  await page.locator('#gjLegacy').click();
  await expect(page.locator('#modal')).toContainText('Retain fitting findings');
  await page.locator('#gjHistoryClose').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({path:testInfo.outputPath('garment-jobs.png'),fullPage:true});
  await page.reload();
  await openJobs(page);
  await expect(page.locator('[data-job-card]')).toHaveCount(4);
  await expect(page.locator('[data-job-card="' + jacketId + '"]')).toContainText('Ready');
  await page.locator('[data-job-card="' + jacketId + '"] .garment-details > summary').click();
  await page.locator('[data-job-copy="' + jacketId + '"]').click();
  await expect(page.locator('#modal')).toContainText('Chest (Suit)');
  await page.locator('#gjCopyClose').click();
  await navigate(page, 'team');
  await page.locator('[data-select-emp="emp_4"]').click();
  await expect(page.locator('#main')).toContainText('Garment jobs assigned to Demo Jacket Maker');
  await expect(page.locator('#main')).toContainText('No workflow recorded');
  expect(await page.locator('.tracking').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('workshop-queue.png'),fullPage:true});
  await page.locator('[data-workshop-job="' + jacketId + '"]').click();
  await expect(page.locator('[data-job-card="' + jacketId + '"] .garment-details')).toHaveAttribute('open', '');
  await page.getByRole('button', {name:'← Workshop', exact:true}).click();
  await expect(page.locator('[data-select-emp="emp_4"]')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('measurement copies remain stable, refresh explicitly, and garment saves survive failure or conflicts', async ({page}) => {
  await page.goto('/?demo=1');
  await openJobs(page);
  await addJobs(page, 'shirt', 1, 'SW-3110', 'Demo Shirt Maker');
  await page.locator('#gjSave').click();
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify(DB.orders.o_3.garmentJobs[0])));
  await page.locator('[data-v="measure"]').click();
  await page.locator('#docketDetailsLabel').click();
  await page.getByRole('button', {name:'Open linked order', exact:true}).click();
  await expect(page.locator('.tracking-overview')).toContainText('0 ready · 0 delivered · 1 garment');
  await page.getByRole('button', {name:'← Measurements', exact:true}).click();
  await page.locator('#mViewMode').selectOption('relevant');
  await page.locator('[data-m="Chest"]').fill('41.25');
  await page.locator('#abSave').click();
  expect(await page.evaluate(id => DB.measurementVersions[id].snapshot.measures.Chest, saved.measurementVersionId)).toBe('40.0');
  await openJobs(page);
  await page.locator('[data-job-edit="' + saved.id + '"]').click();
  await page.locator('#gjMaker').fill('Demo Pattern Cutter');
  await page.locator('#gjApply').click();
  await page.locator('#gjSave').click();
  expect(await page.evaluate(() => DB.orders.o_3.garmentJobs[0].measurementVersionId)).toBe(saved.measurementVersionId);
  await page.evaluate(() => {
    const otherTab = JSON.parse(localStorage.getItem(DB_KEY));
    otherTab.measurements.m_demo_3.measures.Chest = '42.5';
    localStorage.setItem(DB_KEY, JSON.stringify(otherTab));
  });
  await page.locator('[data-job-edit="' + saved.id + '"]').click();
  await page.locator('#gjRefresh').check();
  await page.locator('#gjApply').click();
  await page.evaluate(() => {
    window.realStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('Simulated storage failure'); };
  });
  await page.locator('#gjSave').click();
  await expect(page.locator('#gjStatus')).toContainText('Simulated storage failure');
  expect(await page.evaluate(() => Object.keys(DB.measurementVersions).length)).toBe(1);
  expect(await page.evaluate(() => DB.orders.o_3.garmentJobs[0].measurementVersionId)).toBe(saved.measurementVersionId);
  await page.evaluate(() => { Storage.prototype.setItem = window.realStorageSetItem; });
  await page.locator('#gjSave').click();
  const refreshedId = await page.evaluate(() => DB.orders.o_3.garmentJobs[0].measurementVersionId);
  expect(refreshedId).not.toBe(saved.measurementVersionId);
  expect(await page.evaluate(id => DB.measurementVersions[id].snapshot.measures.Chest, refreshedId)).toBe('42.5');
  expect(await page.evaluate(id => DB.measurementVersions[id].snapshot.measures.Chest, saved.measurementVersionId)).toBe('40.0');
  await page.locator('[data-job-edit="' + saved.id + '"]').click();
  await page.locator('#gjNotes').fill('Draft from the first tab');
  await page.locator('#gjApply').click();
  await page.evaluate(() => {
    const otherTab = JSON.parse(localStorage.getItem(DB_KEY));
    otherTab.orders.o_3.advancePaid = 71000;
    localStorage.setItem(DB_KEY, JSON.stringify(otherTab));
  });
  await page.locator('#gjSave').click();
  await expect(page.locator('#gjStatus')).toContainText('changed in another tab');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(DB_KEY)).orders.o_3.advancePaid)).toBe(71000);
  await expect(page.locator('#main')).toContainText('Draft from the first tab');
  await page.locator('[data-v="orders"]').click();
  await page.locator('#cdCancel').click();
  await expect(page.locator('#gjStatus')).toContainText('changed in another tab');
  await page.locator('[data-v="orders"]').click();
  await page.locator('#cdOk').click();
  await page.locator('[data-open-tracked-order="o_3"]').click();
  await page.locator('[data-act="editOrder"][data-id="o_3"]').click();
  await page.locator('#omAmount').fill('151000');
  await page.evaluate(() => {
    const otherTab = JSON.parse(localStorage.getItem(DB_KEY));
    otherTab.orders.o_3.garmentJobs[0].notes = 'Newer garment instructions';
    localStorage.setItem(DB_KEY, JSON.stringify(otherTab));
  });
  await page.locator('#omSave').click();
  await expect(page.locator('#toast')).toContainText('changed in another tab');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(DB_KEY)).orders.o_3.garmentJobs[0].notes)).toBe('Newer garment instructions');
});
