const { test, expect } = require('@playwright/test');

async function openJobs(page) {
  await page.locator('[data-v="orders"]').click();
  await page.locator('[data-act="openGarments"][data-id="o_3"]').click();
}
async function createJobs(page) {
  await page.goto('/?demo=1');
  await openJobs(page);
  await page.locator('#gjAdd').click();
  await page.locator('#gjDocket').selectOption('m_demo_3');
  await page.locator('#gjSwatch').fill('SW-2089');
  await page.locator('#gjMaker').fill('Demo Jacket Maker');
  await page.locator('#gjApply').click();
  await page.locator('#gjSave').click();
  return page.evaluate(()=>JSON.parse(JSON.stringify(DB.orders.o_3)));
}
async function changeCancellation(page,id,reason) {
  await page.locator('[data-job-cancel="'+id+'"]').click();
  await page.locator('#gjChangeReason').fill(reason);
  await page.locator('#gjChangeApply').click();
}

test('cancel one suit piece, review totals explicitly, reinstate it and add a shirt with retained history',async({page},testInfo)=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await createJobs(page);
  const before=await page.evaluate(()=>{
    const order=DB.orders.o_3;
    order.garmentJobs[0].status='Ready';
    order.garmentJobs[0].workflow[5]={...order.garmentJobs[0].workflow[5],done:true,doneDate:'2026-11-01',notes:'Retain first fitting balance'};
    order.garmentJobs[0].workflow=appendAdditionalTrial(order.garmentJobs[0].workflow);
    order.garmentJobs[0].workflow[6].notes='Keep extra fitting notes';
    writeDatabase(DB);
    return JSON.parse(JSON.stringify({order,versions:DB.measurementVersions,swatches:DB.swatches,reservation:getSwatchAllocationStatus('SW-2089').requiredMeters}));
  });
  await page.reload();await openJobs(page);
  const id=before.order.garmentJobs[0].id;
  await page.locator('[data-job-cancel="'+id+'"]').click();
  await expect(page.locator('#gjChangeReason')).toBeFocused();
  await page.locator('#gjChangeApply').click();
  await expect(page.locator('#gjChangeError')).toContainText('Enter a reason');
  await page.locator('#gjChangeReason').fill('Client cancelled jacket only <keep history>');
  await page.locator('#gjChangeApply').click();
  expect(await page.evaluate(()=>DB.orders.o_3.garmentJobs[0].cancellation)).toBeUndefined();
  await expect(page.locator('#gjReview')).toBeDisabled();
  await expect(page.locator('[data-job-print="'+id+'"]')).toBeDisabled();
  await page.locator('#gjSave').click();
  await expect(page.locator('#main')).toContainText('1 active · 1 cancelled');
  await expect(page.locator('#main')).toContainText('Fabric / payment review pending');
  expect(await page.evaluate(()=>getSwatchAllocationStatus('SW-2089').requiredMeters)).toBe(before.reservation);
  await page.reload();await openJobs(page);
  const cancelled=await page.evaluate(()=>JSON.parse(JSON.stringify(DB.orders.o_3)));
  for(const field of ['amount','advancePaid','fabricMeters','workflow','garments'])expect(cancelled[field]).toEqual(before.order[field]);
  for(const field of ['workflow','maker','swatchCode','measurementVersionId','status'])expect(cancelled.garmentJobs[0][field]).toEqual(before.order.garmentJobs[0][field]);
  expect(cancelled.garmentJobs[1]).toEqual(before.order.garmentJobs[1]);
  expect(await page.evaluate(()=>DB.measurementVersions)).toEqual(before.versions);
  expect(await page.evaluate(()=>DB.swatches)).toEqual(before.swatches);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({path:testInfo.outputPath('cancelled-garment.png'),fullPage:true});
  await page.locator('[data-v="team"]').click();
  await page.locator('.stage-pill-btn[data-select-emp="emp_4"]').click();
  await expect(page.locator('[data-team-garment]')).toHaveCount(1);
  await expect(page.locator('[data-team-garment="'+id+'"]')).toHaveCount(0);
  await openJobs(page);
  await page.locator('#gjReview').click();
  await expect(page.locator('#omDelete')).toHaveCount(0);
  await page.locator('#omAmount').fill('130000');
  await page.locator('#omAdvance').fill('69000');
  await page.locator('#omReserved').fill('35');
  await page.locator('#omReviewConfirmed').check();
  await page.locator('#omSave').click();
  await expect(page.locator('#omReviewError')).toContainText('Enter a reason');
  await page.locator('#omAdjustmentReason').fill('Agreed revised totals; retain five metres less in reservation');
  const modalWidth=await page.locator('#modal').evaluate(element=>({scroll:element.scrollWidth,client:element.clientWidth}));
  expect(modalWidth.scroll).toBeLessThanOrEqual(modalWidth.client);
  await page.screenshot({path:testInfo.outputPath('commercial-review.png')});
  await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('Simulated review failure');};});
  await page.locator('#omSave').click();
  await expect(page.locator('#omReviewError')).toContainText('Simulated review failure');
  expect(await page.evaluate(()=>DB.orders.o_3.amount)).toBe(before.order.amount);
  expect(await page.evaluate(()=>DB.orders.o_3.commercialAdjustments)).toBeUndefined();
  await page.evaluate(()=>{Storage.prototype.setItem=window.realSet;});
  await page.locator('#omSave').click();
  await expect(page.locator('#overlay')).toBeHidden();
  const reviewed=await page.evaluate(()=>JSON.parse(JSON.stringify(DB.orders.o_3)));
  expect(reviewed.commercialReviewRequired).toBe(false);
  expect(reviewed.reservedFabricMeters).toBe(35);
  expect(reviewed.fabricMeters).toBe(40);
  expect(reviewed.amount).toBe(130000);expect(reviewed.advancePaid).toBe(69000);
  expect(reviewed.garmentJobs).toEqual(cancelled.garmentJobs);
  expect(reviewed.commercialAdjustments).toHaveLength(1);
  expect(reviewed.commercialAdjustments[0].changes.reservedFabricMeters).toEqual({before:40,after:35});
  expect(await page.evaluate(()=>getSwatchAllocationStatus('SW-2089').requiredMeters)).toBe(before.reservation-5);
  await changeCancellation(page,id,'Client reinstated jacket');await page.locator('#gjSave').click();
  expect(await page.evaluate(()=>DB.orders.o_3.garmentJobs[0].status)).toBe('Ready');
  expect(await page.evaluate(()=>DB.orders.o_3.commercialReviewRequired)).toBe(true);
  await page.locator('#gjAdd').click();await page.locator('#gjType').selectOption('shirt');
  await page.locator('#gjApply').click();await expect(page.locator('#gjError')).toContainText('reason for adding');
  await page.locator('#gjAddReason').fill('Client added one shirt');
  await page.locator('#gjApply').click();await page.locator('#gjSave').click();
  await expect(page.locator('[data-job-card]')).toHaveCount(3);
  expect(await page.evaluate(()=>DB.orders.o_3.garmentRevisions.map(event=>event.kind))).toEqual(['Cancelled','Reinstated','Added']);
  expect(await page.evaluate(()=>DB.orders.o_3.advancePaid)).toBe(69000);
  expect(errors).toEqual([]);
});

test('all garments can be cancelled with safe retry and reviewed without silently releasing fabric',async({page})=>{
  const before=await createJobs(page);
  for(const job of before.garmentJobs)await changeCancellation(page,job.id,'Client cancelled this garment');
  await page.evaluate(()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('Simulated cancellation failure');};});
  await page.locator('#gjSave').click();await expect(page.locator('#gjStatus')).toContainText('Simulated cancellation failure');
  expect(await page.evaluate(()=>DB.orders.o_3.garmentJobs.some(job=>job.cancellation))).toBe(false);
  await page.evaluate(()=>{
    Storage.prototype.setItem=window.realSet;
    const other=JSON.parse(localStorage.getItem(DB_KEY));other.clients.c_demo_4.remarks='Preserve newer unrelated edit';localStorage.setItem(DB_KEY,JSON.stringify(other));
  });
  await page.locator('#gjSave').click();
  expect(await page.evaluate(()=>DB.clients.c_demo_4.remarks)).toBe('Preserve newer unrelated edit');
  expect(await page.evaluate(()=>DB.orders.o_3.status)).toBe('Cancelled');
  expect(await page.evaluate(()=>DB.orders.o_3.reservedFabricMeters)).toBe(40);
  await expect(page.locator('#main')).toContainText('0 active garments · 2 cancelled');
  await page.locator('[data-v="orders"]').click();
  await page.locator('#orderStageFilter').selectOption('Cancelled');
  await expect(page.locator('tr[data-act="openSequenceModal"]')).toHaveCount(1);
  await page.locator('[data-act="openGarments"][data-id="o_3"]').click();
  await page.locator('#gjReview').click();
  await expect(page.locator('#omStatus')).toHaveValue('Cancelled');
  await page.locator('#omAdjustmentReason').fill('Reviewed: keep reservation and recorded totals pending client agreement');
  await page.locator('#omReviewConfirmed').check();await page.locator('#omSave').click();
  const reviewed=await page.evaluate(()=>DB.orders.o_3);
  expect(reviewed.commercialReviewRequired).toBe(false);expect(reviewed.reservedFabricMeters).toBe(40);
  expect(reviewed.commercialAdjustments[0].changes).toEqual({});
  expect(reviewed.amount).toBe(before.amount);expect(reviewed.advancePaid).toBe(before.advancePaid);
});

test('delivered garments are protected and stale workshop sheets or cancellation drafts cannot overwrite newer records',async({page})=>{
  const before=await createJobs(page);
  await page.locator('[data-job-edit]').first().click();await page.locator('#gjStage').selectOption('Delivered');
  await page.locator('#gjApply').click();await page.locator('#gjSave').click();
  await expect(page.locator('[data-job-cancel="'+before.garmentJobs[0].id+'"]')).toBeDisabled();
  await page.locator('[data-job-print]').nth(1).click();
  await page.evaluate(()=>{
    window.printCalls=0;window.print=()=>window.printCalls++;
    const latest=latestStoredDatabase(),order=latest.orders.o_3;
    const workspace={orderId:order.id,original:JSON.stringify(order),jobs:copyGarmentData(order.garmentJobs),versions:copyGarmentData(latest.measurementVersions)};
    workspace.jobs[1]=reviseGarmentCancellation(workspace.jobs[1],'Cancelled in another tab');commitGarmentWorkspace(workspace);
  });
  await page.locator('#workshopPrintNow').click();
  await expect(page.locator('#workshopPrintWarning')).toContainText('DO NOT PRODUCE');
  expect(await page.evaluate(()=>window.printCalls)).toBe(0);
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#workshopPrintWarning')).toBeVisible();
  await page.locator('#workshopBack').click();
  expect(await page.evaluate(()=>DB.orders.o_3.status)).toBe('Delivered');
  expect(await page.evaluate(()=>DB.orders.o_3.reservedFabricMeters)).toBe(40);
  await changeCancellation(page,before.garmentJobs[1].id,'Reinstate trousers');await page.locator('#gjSave').click();
  await changeCancellation(page,before.garmentJobs[1].id,'Draft cancellation in first tab');
  await page.evaluate(()=>{const other=JSON.parse(localStorage.getItem(DB_KEY));other.orders.o_3.advancePaid=71000;localStorage.setItem(DB_KEY,JSON.stringify(other));});
  await page.locator('#gjSave').click();await expect(page.locator('#gjStatus')).toContainText('changed in another tab');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(DB_KEY)).orders.o_3.advancePaid)).toBe(71000);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(DB_KEY)).orders.o_3.garmentJobs[1].cancellation)).toBeNull();
});

test('an old legacy delete dialog cannot erase garment history adopted in another tab',async({page})=>{
  await page.goto('/?demo=1');
  await page.locator('[data-v="orders"]').click();
  await page.locator('[data-act="editOrder"][data-id="o_3"]').click();
  await expect(page.locator('#omDelete')).toBeVisible();
  await page.evaluate(()=>{
    const latest=latestStoredDatabase();
    const order=latest.orders.o_3;
    const workspace={orderId:order.id,original:JSON.stringify(order),jobs:makeGarmentJobs('shirt',1,{}),versions:{}};
    commitGarmentWorkspace(workspace);
  });
  await page.locator('#omDelete').click();
  await expect(page.locator('#toast')).toContainText('saved garment histories cannot be deleted');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(DB_KEY)).orders.o_3.garmentJobs.length)).toBe(1);
});
