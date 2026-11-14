const {test,expect}=require('@playwright/test');
const {navigate}=require('../navigate.cjs');

test('a new client completes a suit and two shirts from measurement to fitting, workshop sheets and final totals',async({page},testInfo)=>{
 test.setTimeout(60000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?demo=1');
 const original=await page.evaluate(()=>({orders:JSON.parse(JSON.stringify(DB.orders)),real:localStorage.getItem('modisto_bespoke_v7')}));
 await navigate(page,'clients');await page.locator('[data-act="newClient"]').click();
 await page.locator('#cmName').fill('Demo Workflow Patron');await page.locator('#cmSave').click();
 await navigate(page,'clients');await page.locator('#clientSearch').fill('workflow patron');
 await expect(page.locator('#clientRows .directory-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Demo Workflow Patron',exact:true}).click();
 await page.locator('[data-v="measure"]').click();await page.locator('#mClientSelect').click();
 await page.locator('#pickSearch').fill('workflow patron');await page.locator('#pickSearch').press('Enter');
 if(await page.locator('#cdOk').isVisible())await page.locator('#cdOk').click();
 await page.locator('#mViewMode').selectOption('relevant');
 await page.getByText('Choose garment sections',{exact:true}).click();await page.locator('[data-gp-id="shirt"]').click();
 await page.locator('#docketDetailsLabel').click();
 await page.locator('#mSwatchCode').click();await page.locator('#pickSearch').fill('SW-2089');await page.locator('#pickList button').click();
 await page.locator('[data-m="Inseam"]').fill('29.25');await page.locator('[data-m="Chest (Suit)"]').fill('40.25');await page.locator('[data-m="Chest"]').fill('39.75');
 await page.locator('#mNotes').fill('DEMO WORKFLOW: retain quarter-inch balance and cutter sequence.');
 await page.locator('#abSave').click();await expect(page.locator('#status')).toContainText('Saved locally');
 const docket=await page.evaluate(()=>JSON.parse(JSON.stringify(DB.measurements[MREC.id])));
 await page.locator('#abCreateOrder').click();
 for(const id of ['omAmount','omAdvance','omMeters','omRate','omTrialDate','omDeliver'])await expect(page.locator('#'+id)).toHaveValue('');
 await expect(page.locator('#liveCostSummary')).toContainText('Balance Due: Unrecorded');
 await expect(page.locator('#liveCostSummary')).toContainText('Timing not recorded');
 await expect(page.getByLabel('Recorded received total (₹)',{exact:true})).toHaveValue('');
 await page.locator('#omGarments').fill('1× 2-Piece Bespoke Suit + 2× Bespoke Shirt');
 await page.locator('#omAmount').fill('50000');await page.locator('#omAdvance').fill('20000');await page.locator('#omMeters').fill('6.5');await page.locator('#omRate').fill('1000');
 await page.locator('#omTrialDate').fill('2026-11-15');await page.locator('#omDeliver').fill('2026-11-25');await page.locator('#omAssigned').selectOption('Demo Master Cutter');
 await page.locator('#omSave').click();await expect(page.locator('#overlay')).toBeHidden();
 const order=await page.evaluate(id=>JSON.parse(JSON.stringify(Object.values(DB.orders).find(o=>o.measurementId===id))),docket.id);
 await page.locator('#orderSearch').fill('workflow patron');
 await page.locator('[data-open-tracked-order="'+order.id+'"]').click();
 await page.locator('[data-act="openGarments"][data-id="'+order.id+'"]').click();
 for(const [type,qty,swatch,maker] of [['suit2',1,'SW-2089','Demo Jacket Maker'],['shirt',2,'SW-3110','Demo Shirt Maker']]){
  await page.locator('#gjAdd').click();await page.locator('#gjType').selectOption(type);await page.locator('#gjQty').fill(String(qty));
  await page.locator('#gjDocket').selectOption(docket.id);await page.locator('#gjSwatch').fill(swatch);await page.locator('#gjMaker').fill(maker);await page.locator('#gjApply').click();
 }
 await page.locator('#gjSave').click();await expect(page.locator('#gjStatus')).toHaveText('Garment jobs saved locally');await expect(page.locator('[data-job-card]')).toHaveCount(4);
 await page.locator('#gjCosts > summary').click();
 await expect(page.locator('#gjPaymentSummary')).toContainText('Received total ₹20,000');await expect(page.locator('#gjPaymentSummary')).toContainText('Balance due ₹30,000');
 const reviewed=await page.evaluate(id=>JSON.parse(JSON.stringify(DB.orders[id])),order.id),jacket=reviewed.garmentJobs[0];
 expect(reviewed.garmentJobs.map(j=>j.type)).toEqual(['jacket','trousers','shirt','shirt']);expect(new Set(reviewed.garmentJobs.map(j=>j.id)).size).toBe(4);
 await page.locator('[data-job-edit="'+jacket.id+'"]').click();await page.locator('#gjStage').selectOption('1st Trial / Fitting');
 await page.locator('[data-gj-done="5"]').check();await page.locator('[data-gj-date="5"]').fill('2026-11-15');await page.locator('[data-gj-note="5"]').fill('First fitting: adjust right shoulder.');
 await page.locator('#gjApply').click();await page.locator('#gjSave').click();
 await page.getByRole('button',{name:'← Order overview',exact:true}).click();
 await page.locator('[data-order-section="fittings"]').click();
 await expect(page.getByText('Fitting history (1)',{exact:true})).toBeVisible();
 expect(await page.locator('.tracking-overview').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('order-fittings.png'),fullPage:true});
 await page.locator('[data-act="addTrackedFitting"][data-id="'+jacket.id+'"]').click();
 await page.getByLabel('Scheduled date for 2nd Trial / Fitting',{exact:true}).fill('2026-11-20');
 await page.locator('[data-gj-note="6"]').fill('Second fitting: recheck shoulder correction.');await page.locator('#gjApply').click();await page.locator('#gjSave').click();
 await expect(page.locator('#gjStatus')).toHaveText('Garment jobs saved locally');
 const fitted=await page.evaluate(id=>JSON.parse(JSON.stringify(DB.orders[id])),order.id);
 expect(fitted.garmentJobs[0].workflow[0].done).toBe(false);expect(fitted.garmentJobs[0].workflow[5].doneDate).toBe('2026-11-15');expect(fitted.garmentJobs[0].workflow[6].done).toBe(false);
 expect(fitted.garmentJobs.slice(1)).toEqual(reviewed.garmentJobs.slice(1));expect(fitted.workflow).toEqual(order.workflow);
 for(const job of fitted.garmentJobs){
  const raw=await page.evaluate(()=>localStorage.getItem(DB_KEY));await page.locator('[data-job-print="'+job.id+'"]').click();
  const sheet=page.locator('#garmentPrintSheet');await expect(sheet).toContainText('DEMO - SAMPLE');await expect(sheet).toContainText('Demo Workflow Patron');await expect(sheet).toContainText(job.swatchCode);await expect(sheet).toContainText(job.maker);
  if(job.type==='jacket'){
   await expect(sheet).toContainText('40.25 in');
   await expect(sheet).toContainText('First fitting: adjust right shoulder.');
   await expect(sheet).toContainText('Second fitting: recheck shoulder correction.');
  }
  if(job.type==='trousers')await expect(sheet).toContainText('29.25 in');if(job.type==='shirt')await expect(sheet).toContainText('39.75 in');
  await expect(sheet).not.toContainText('50,000');expect(await page.evaluate(()=>localStorage.getItem(DB_KEY))).toBe(raw);
  if(job.type==='jacket')await page.screenshot({path:testInfo.outputPath('workflow-workshop-sheet.png'),fullPage:true});
  await page.locator('#workshopBack').click();
 }
 for(const job of fitted.garmentJobs){
  await page.locator('[data-job-edit="'+job.id+'"]').click();await page.locator('#gjStage').selectOption('Delivered');await page.locator('#gjApply').click();await page.locator('#gjSave').click();await expect(page.locator('#gjStatus')).toHaveText('Garment jobs saved locally');
  const saved=await page.evaluate(id=>JSON.parse(JSON.stringify(DB.orders[id])),order.id);
  expect(saved.status).toBe(job.id===fitted.garmentJobs.at(-1).id?'Delivered':'New');
  expect(saved.garmentJobs.find(j=>j.id===job.id).workflow).toEqual(fitted.garmentJobs.find(j=>j.id===job.id).workflow);
 }
 await page.locator('#gjCosts > summary').click();
 await page.locator('#gjReview').click();await expect(page.locator('#omAmount')).toHaveValue('50000');await expect(page.locator('#omAdvance')).toHaveValue('20000');await expect(page.locator('#liveCostSummary')).toContainText('30,000');
 await page.locator('#omAdvance').fill('50000');await page.locator('#omAdjustmentReason').fill('DEMO: verified final cumulative receipts total, not an individual payment transaction.');await page.locator('#omReviewConfirmed').check();await page.locator('#omSave').click();await expect(page.locator('#overlay')).toBeHidden();
 await page.reload();await page.locator('[data-v="orders"]').click();await page.locator('[data-order-view="all"]').click();await page.locator('#orderSearch').fill('workflow patron');
 const final=await page.evaluate(id=>JSON.parse(JSON.stringify(DB.orders[id])),order.id);
 expect(final).toMatchObject({status:'Delivered',amount:50000,advancePaid:50000,fabricMeters:6.5,assignedTo:'Demo Master Cutter'});expect(final.commercialAdjustments.at(-1).changes.advancePaid).toEqual({before:20000,after:50000});
 expect(final.workflow).toEqual(order.workflow);expect(final.garmentJobs[0].workflow).toEqual(fitted.garmentJobs[0].workflow);
 const orderLink=page.locator('[data-open-tracked-order="'+order.id+'"]');
 await orderLink.click();
 await page.getByText('Recorded workflow & timing',{exact:true}).click();
 const overview=page.locator('.tracking-overview');
 await expect(overview).toContainText('Delivery recorded');
 await expect(overview).toContainText('36 tasks not marked complete');
 await expect(overview).not.toContainText('Next:');
 await expect(overview).toContainText('Timing not recorded');
 await expect(overview).not.toContainText('(On time)');
 await page.getByRole('button',{name:'← Orders',exact:true}).click();
 expect(await page.evaluate(()=>localStorage.getItem('modisto_bespoke_v7'))).toBe(original.real);expect(await page.evaluate(()=>JSON.parse(JSON.stringify(DB.orders)))).toMatchObject(original.orders);
 await page.screenshot({path:testInfo.outputPath('workflow-delivered-order.png'),fullPage:true});
 await page.locator('#orderSearch').fill('SW-3110');await expect(orderLink).toBeVisible();
 for(const query of ['Demo Shirt Maker','Shirt 2']){await page.locator('#orderSearch').fill(query);await expect(orderLink).toBeVisible();}
 await orderLink.click();
 await page.locator('[data-order-section="costs"]').click();await expect(page.locator('.tracking-overview')).toContainText('Balance due ₹0');
 await page.screenshot({path:testInfo.outputPath('workflow-final-totals.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
