const { test, expect } = require('@playwright/test');

async function openJobs(page) {
  await page.locator('[data-v="orders"]').click();
  await page.locator('[data-open-tracked-order="o_3"]').click();
  await page.locator('[data-act="openGarments"][data-id="o_3"]').click();
}

test('a garment sheet prints saved measurements, job assignments and fittings without modifying records', async ({page}, testInfo) => {
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?demo=1');
  await page.evaluate(() => {
    Object.assign(DB.measurements.m_demo_3.measures, {'Suit Length Front':'29.25','Chest (Suit)':'0','Suit Length Back':''});
    Object.assign(DB.measurements.m_demo_3.texts, {shoulderDownInches:0,suitComments:'Cutter <script>literal text</script>',shirtComments:'Shirt-only instructions'});
    writeDatabase(DB);
  });
  await openJobs(page);
  await page.locator('#gjAdd').click();
  await page.locator('#gjDocket').selectOption('m_demo_3');
  await page.locator('#gjSwatch').fill('SW-2089');
  await page.locator('#gjMaker').fill('Demo Jacket Maker');
  await page.locator('#gjApply').click();
  await expect(page.locator('[data-job-print]').first()).toBeDisabled();
  await page.locator('#gjSave').click();
  await page.locator('[data-job-edit]').first().click();
  await page.locator('#gjNotes').fill('JACKET JOB INSTRUCTIONS - preserve quarter-inch sleeve allowance');
  await page.locator('#gjAddTrial').click();
  await page.getByLabel('Scheduled date for 2nd Trial / Fitting',{exact:true}).fill('2026-11-20');
  await page.locator('[data-gj-note="6"]').fill('SECOND FITTING - check right shoulder balance');
  await page.locator('#gjApply').click();
  await page.locator('#gjSave').click();
  const before = await page.evaluate(() => {
    DB.measurements.m_demo_3.measures['Suit Length Front']='99';
    writeDatabase(DB);
    return localStorage.getItem(DB_KEY);
  });
  await page.locator('[data-job-print]').first().click();
  await expect(page.locator('#workshopPrintNow')).toBeFocused();
  const sheet=page.locator('#garmentPrintSheet');
  await expect(sheet).toContainText('29.25 in');
  await expect(sheet).toContainText('0 in');
  await expect(sheet).toContainText('Demo Jacket Maker');
  await expect(sheet).toContainText('SW-2089');
  await expect(sheet).toContainText('JACKET JOB INSTRUCTIONS');
  await expect(sheet).toContainText('SECOND FITTING');
  await expect(sheet).toContainText('Cutter <script>literal text</script>');
  await expect(sheet.locator('script')).toHaveCount(0);
  await expect(sheet).not.toContainText('99 in');
  await expect(sheet).not.toContainText('Shirt-only instructions');
  await expect(sheet).not.toContainText('Inseam');
  await expect(sheet).not.toContainText('Advance');
  const labels=await sheet.locator('.workshop-columns > div').first().locator('tr > td:first-child').allTextContents();
  expect(labels).toEqual(await page.evaluate(()=>SCHEMA.upper.measures));
  await expect(sheet.locator('.workshop-table tr').filter({has:page.locator('td', {hasText:/^Suit Length Back$/})})).toContainText('—');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({path:testInfo.outputPath('garment-preview.png'),fullPage:true});
  await page.evaluate(()=>{window.printCalls=0;window.print=()=>window.printCalls++;});
  await page.locator('#workshopPrintNow').press('Enter');
  expect(await page.evaluate(()=>window.printCalls)).toBe(1);
  await page.emulateMedia({media:'print'});
  await expect(page.locator('#nav')).toBeHidden();
  await expect(page.locator('.workshop-actions')).toBeHidden();
  await expect(sheet).toBeVisible();
  await page.pdf({path:testInfo.outputPath('garment-workshop.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
  await page.emulateMedia({media:'screen'});
  expect(await page.evaluate(()=>localStorage.getItem(DB_KEY))).toBe(before);
  await page.locator('#workshopBack').click();
  await expect(page.locator('[data-job-print]').first()).toBeFocused();
  await page.locator('[data-job-print]').nth(1).click();
  await expect(sheet).toContainText('Trouser');
  await expect(sheet).toContainText('Inseam');
  await expect(sheet).not.toContainText('Chest (Suit)');
  await page.locator('#workshopBack').click();
  await page.locator('[data-v="measure"]').click();
  await page.locator('#abPrint').click();
  await expect(page.locator('.docket-page')).toHaveCount(2);
  await expect(page.locator('#garmentPageStyle')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/garment-print-mode/);
  await page.locator('#closePrintPreview').click();
  await openJobs(page);
  await page.locator('[data-job-edit]').first().click();
  await page.locator('#gjNotes').fill('Unsaved workshop change');
  await page.locator('#gjApply').click();
  await expect(page.locator('[data-job-print]').first()).toBeDisabled();
  expect(errors).toEqual([]);
});

test('metric sheets retain long notes and many trial dates and reject a stale order preview', async ({page}, testInfo) => {
  await page.goto('/?demo=1');
  await page.evaluate(() => {
    const docket=DB.measurements.m_demo_3;
    convertMeasurementUnit(docket,'cm');
    docket.measures.Chest='101.6';
    docket.notes=Array.from({length:30},(_,i)=>'Docket instruction '+(i+1)+': preserve the recorded posture and cutter sequence without rounding the saved measurements.').join('\n')+'\nFINAL DOCKET INSTRUCTION';
    const versions={};
    const versionId=captureGarmentMeasurement(docket.id,DB,versions);
    DB.measurementVersions=versions;
    const jobs=makeGarmentJobs('shirt',1,{measurementVersionId:versionId,maker:'Demo Shirt Maker',swatchCode:'SW-3110'});
    for(let i=0;i<12;i++) jobs[0].workflow=appendAdditionalTrial(jobs[0].workflow);
    for(const step of jobs[0].workflow.filter(isTrialWorkflowStep)) {
      step.scheduledDate='2026-11-20';
      step.notes=step.label+' - retain sleeve balance and cuff allowance. '+('Check the fitting notes before altering the pattern. '.repeat(5));
    }
    jobs[0].workflow.find(step=>step.key==='trial_13').notes+=' FINAL TRIAL INSTRUCTION';
    DB.orders.o_3.garmentJobs=jobs;
    writeDatabase(DB);
  });
  await openJobs(page);
  const before=await page.evaluate(()=>localStorage.getItem(DB_KEY));
  await page.locator('[data-job-print]').click();
  await expect(page.locator('#garmentPrintSheet')).toContainText('101.6 cm');
  await expect(page.locator('#garmentPrintSheet')).toContainText('FINAL DOCKET INSTRUCTION');
  await expect(page.locator('#garmentPrintSheet')).toContainText('FINAL TRIAL INSTRUCTION');
  await expect(page.locator('#garmentPrintSheet')).toContainText('13th Trial / Fitting');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.pdf({path:testInfo.outputPath('long-garment-workshop.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
  expect(await page.evaluate(()=>localStorage.getItem(DB_KEY))).toBe(before);
  await page.locator('#workshopBack').click();
  await page.evaluate(()=>{
    const latest=JSON.parse(localStorage.getItem(DB_KEY));
    latest.orders.o_3.garmentJobs[0].notes='Newer instructions in another tab';
    localStorage.setItem(DB_KEY,JSON.stringify(latest));
  });
  await page.locator('[data-job-print]').click();
  await expect(page.locator('#toast')).toContainText('changed in another tab');
  await expect(page.locator('#garmentPrintSheet')).toHaveCount(0);
});
