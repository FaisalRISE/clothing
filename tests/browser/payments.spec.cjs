const {test,expect}=require('@playwright/test');
const {navigate}=require('../navigate.cjs');

async function openPayments(page,id='o_3') {
  await page.locator('[data-v="orders"]').click();
  await page.locator(`[data-open-tracked-order="${id}"]`).click();
  await page.getByRole('button',{name:'Costs & received',exact:true}).click();
  await page.locator('[data-act="recordPayment"]').click();
}
test('dated receipts, refunds and reversals preserve old history and survive reload; failures retain the form',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?demo=1');
  const before=await page.evaluate(()=>{DB.orders.o_3.advancePaid=100;DB.orders.o_3.currency='GBP';localStorage.setItem(DB_KEY,JSON.stringify(DB));return structuredClone(DB.orders.o_3);});
  await openPayments(page);
  await expect(page.locator('#pmOpening')).toHaveValue('100');await expect(page.locator('#pmOpening')).toHaveAttribute('readonly','');
  await page.locator('#pmAmount').fill('25.75');await page.locator('#pmDate').fill('2026-11-21');await page.locator('#pmNote').fill('Bank transfer REF-1');
  await page.evaluate(()=>{window.goodPaymentWriter=writeDatabase;writeDatabase=()=>{throw new Error('Synthetic storage failure')};});
  await page.locator('#pmSave').click();await expect(page.locator('#pmError')).toContainText('Synthetic storage failure');
  expect(await page.evaluate(()=>DB.orders.o_3)).toEqual(before);await expect(page.locator('#pmAmount')).toHaveValue('25.75');
  await page.evaluate(()=>{writeDatabase=window.goodPaymentWriter});await page.locator('#pmSave').click();
  await expect(page.getByText('Payment recorded locally',{exact:true})).toBeVisible();
  await expect(page.locator('#overlay')).toContainText('£125.75');
  await page.locator('#pmKind').selectOption('refund');await page.locator('#pmAmount').fill('5.25');await page.locator('#pmDate').fill('2026-11-21');await page.locator('#pmNote').fill('Refund REF-2');await page.locator('#pmSave').click();
  await page.locator('[data-reverse-payment]').last().click();await page.locator('#pmDate').fill('2026-11-21');await page.locator('#pmNote').fill('Correct mistaken refund');await page.locator('#pmSave').click();
  const after=await page.evaluate(()=>structuredClone(DB.orders.o_3));expect(after.advancePaid).toBe(125.75);expect(after.paymentLedger.entries).toHaveLength(3);
  expect({...after,advancePaid:before.advancePaid,paymentLedger:undefined}).toEqual({...before,paymentLedger:undefined});
  await page.screenshot({path:info.outputPath('payment-history.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#pmClose').click();await page.reload();await openPayments(page);
  await expect(page.locator('#overlay')).toContainText('REF-1');await expect(page.locator('#overlay')).toContainText('Reversed');await page.locator('#pmClose').click();
  await page.locator('[data-act="reviewOrderCosts"]').click();await expect(page.locator('#omCurrency')).toBeDisabled();await expect(page.locator('#omAdvance')).toHaveAttribute('readonly','');
  expect(errors).toEqual([]);
});
test('legacy currency requires review, zero opening is explicit and stale payment saves cannot overwrite another tab',async({page})=>{
  await page.goto('/?demo=1');
  await page.evaluate(()=>{delete DB.orders.o_3.currency;DB.orders.o_3.advancePaid=null;localStorage.setItem(DB_KEY,JSON.stringify(DB));});
  await openPayments(page);await expect(page.locator('#pmSave')).toHaveCount(0);await page.locator('#pmCurrency').click();await expect(page.locator('#omCurrency')).toHaveValue('');
  await page.locator('#omCurrency').selectOption('INR');await page.locator('#omSave').click();await page.locator('[data-act="recordPayment"]').click();
  await page.locator('#pmAmount').fill('10');await page.locator('#pmDate').fill('2026-11-21');await page.locator('#pmNote').fill('Cash');await page.locator('#pmSave').click();await expect(page.locator('#pmError')).toContainText('amount');
  await page.locator('#pmOpening').fill('0');
  await page.evaluate(()=>{const latest=JSON.parse(localStorage.getItem(DB_KEY));latest.orders.o_3.notes='Changed in another tab';localStorage.setItem(DB_KEY,JSON.stringify(latest));});
  await page.locator('#pmSave').click();await expect(page.locator('#pmError')).toContainText('order changed');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(DB_KEY)).orders.o_3.paymentLedger)).toBeUndefined();
});
test('new order currencies follow clients until chosen; reports separate currencies and exclude unconfirmed totals',async({page},info)=>{
  await page.goto('/?demo=1');
  await page.evaluate(()=>{DB.clients.c_demo_3.branch='London · Northwood';orderModal(null,'c_demo_3');});
  await expect(page.locator('#omCurrency')).toHaveValue('GBP');
  await page.locator('#omClient').selectOption('c_demo_1');await expect(page.locator('#omCurrency')).toHaveValue('INR');
  await page.locator('#omCostsSummary').click();await page.locator('#omCurrency').selectOption('GBP');
  await page.locator('#omClient').selectOption('c_demo_2');await expect(page.locator('#omCurrency')).toHaveValue('GBP');
  await page.locator('#omAmount').fill('250.50');await expect(page.locator('#liveCostSummary')).toContainText('£250.5');await page.locator('#omSave').click();
  await page.evaluate(()=>{delete DB.orders.o_1.currency;DB.orders.o_1.amount=999999;localStorage.setItem(DB_KEY,JSON.stringify(DB));});
  await navigate(page,'costing');await page.locator('[data-act="reportCurrency"][data-id="GBP"]').click();
  await expect(page.locator('.stats')).toContainText('£250.5');await expect(page.locator('.stats')).not.toContainText('999,999');
  await page.locator('[data-act="reportCurrency"][data-id="unconfirmed"]').click();await expect(page.locator('.stats')).toHaveCount(0);await expect(page.locator('#main')).toContainText('999,999 (currency unconfirmed)');
  await page.screenshot({path:info.outputPath('currency-report.png'),fullPage:true});
});
