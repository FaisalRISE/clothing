const {test,expect}=require('@playwright/test');
const {start}=require('../../server/shared-server.cjs');
const {fixture}=require('../shared/fixture.cjs');
const D=require('../../shared/data.cjs');
const password='Synthetic-local-password-123',token='browser-test-setup-token';
let app,origin;
test.beforeEach(async()=>{app=await start({port:0,dataDir:'memory://',bootstrapToken:token});origin='http://127.0.0.1:'+app.port;});
test.afterEach(async({context})=>{await context.close();await app.close();});
async function post(context,path,body,csrf){return context.request.post(origin+path,{headers:{Origin:origin,...(csrf?{'X-CSRF-Token':csrf}:{})},data:body});}
async function login(page,email){await page.goto(origin);await page.locator('#sharedEmail').fill(email);await page.locator('#sharedPassword').fill(password);await page.locator('#sharedLogin').click();await expect(page.locator('#sharedLogout')).toBeVisible();}
async function seed(context){
 await post(context,'/api/setup',{token,name:'Test owner',email:'owner@modisto.test',password});
 const user=(await (await post(context,'/api/login',{email:'owner@modisto.test',password})).json()).user;
 const data=fixture(),plan=await (await post(context,'/api/import/preview',{database:data},user.csrf)).json();
 expect((await post(context,'/api/import/commit',{database:data,digest:plan.digest},user.csrf)).status()).toBe(200);
 return {user,data};
}
async function makeContext(browser,testInfo){const {viewport,isMobile,hasTouch}=testInfo.project.use;return browser.newContext({viewport,isMobile,hasTouch});}
async function snapshot(context){return (await context.request.get(origin+'/api/snapshot')).json();}

test('owner setup/import, two office sessions and an assigned workshop job share acknowledged saves',async({page,context,browser},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('modisto_bespoke_v7','untouched-browser-records'));
 await page.goto(origin);
 await page.locator('#sharedSetupToken').fill(token);await page.locator('#sharedName').fill('Test owner');
 await page.locator('#sharedEmail').fill('owner@modisto.test');await page.locator('#sharedPassword').fill(password);await page.locator('#sharedLogin').click();
 await expect(page.locator('#sharedStaff')).toBeVisible();
 expect(await page.evaluate(()=>Object.keys(DB.clients).length)).toBe(0);
 const data=fixture();
 await page.locator('#sharedImport').click();
 await page.locator('#sharedImportFile').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await expect(page.locator('#importCommit')).toBeEnabled();
 expect(Object.keys((await snapshot(context)).database.clients)).toHaveLength(0);
 await page.locator('#importCommit').click();await expect(page.locator('#overlay')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>Object.keys(DB.clients).length)).toBe(Object.keys(data.clients).length);
 await page.locator('#sharedStaff').click();
 for(const [role,name,email] of [['office','Test office','office@modisto.test'],['workshop','Test workshop','workshop@modisto.test']]){
  await page.locator('#staffName').fill(name);await page.locator('#staffEmail').fill(email);await page.locator('#staffPassword').fill(password);await page.locator('#staffRole').selectOption(role);
  if(role==='workshop')await page.locator('#staffEmployee').selectOption('emp_4');
  await page.locator('#staffCreate').click();await expect(page.locator('#modal')).toContainText(email);await expect(page.locator('#staffEmail')).toHaveValue('');
 }
 await page.locator('#staffClose').click();
 const office=await makeContext(browser,testInfo),workshop=await makeContext(browser,testInfo);
 try {
  const op=await office.newPage(),wp=await workshop.newPage();op.on('pageerror',e=>errors.push(e.message));wp.on('pageerror',e=>errors.push(e.message));
  await login(op,'office@modisto.test');await expect(op.locator('[data-v="settings"]')).toBeHidden();
  await op.evaluate(()=>ACTIONS.openMeasureByOrder('o_3'));await op.locator('#mViewMode').selectOption('relevant');
  const before=(await snapshot(context)).database;
  const input=op.locator('[data-m="Inseam"]');await input.fill('29.25');await input.press('Tab');await input.focus();await op.locator('[data-step="0.25"]').click();
  await expect(input).toHaveValue('29.5');await op.locator('#mUnit').selectOption('cm');await expect(input).toHaveValue('74.93');await op.locator('#mUnit').selectOption('in');
  await op.locator('#mNotes').fill('Shared measurement draft');await op.locator('#abSave').click();await expect(op.locator('#status')).toContainText('Saved to local staging server');
  const after=(await snapshot(context)).database;
  expect(after.orders).toEqual(before.orders);expect(after.measurementVersions).toEqual(before.measurementVersions);expect(after.measurements.m_demo_3.measures.Inseam).toBe('29.5');
  await page.locator('#sharedRefresh').click();await expect(page.locator('#sharedSaveState')).toHaveText('Shared records loaded');await page.evaluate(()=>ACTIONS.openMeasureByOrder('o_3'));await expect(page.locator('#mNotes')).toHaveValue('Shared measurement draft');
  await op.locator('#abPrint').click();await expect(op.locator('#panel-summary')).toBeVisible();await expect(op.locator('#printNow')).toBeFocused();
  expect(await op.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await op.screenshot({path:testInfo.outputPath('shared-measurement-preview.png'),fullPage:true});await op.locator('#closePrintPreview').click();
  await login(wp,'workshop@modisto.test');await expect(wp.locator('[data-shared-job]')).toHaveCount(2);
  const projected=await snapshot(workshop);expect(JSON.stringify(projected)).not.toMatch(/PRIVATE-CONTACT|advancePaid|135791/);
  await expect(wp.locator('.app')).toBeHidden();await wp.locator('[data-workshop-edit]').first().click();await wp.locator('#workshopStage').selectOption('Cutting');
  await wp.locator('[data-workshop-done="3"]').check();await wp.locator('[data-workshop-date="3"]').fill('2026-11-08');await wp.locator('[data-workshop-note="3"]').fill('Workshop pattern check');
  await wp.locator('#workshopSave').click();await expect(wp.locator('#overlay')).toBeHidden();
  await expect(wp.locator('[data-shared-job]').first()).toContainText('Cutting');
  const progressed=(await snapshot(context)).database.orders.o_3;
  expect(progressed.amount).toBe(before.orders.o_3.amount);expect(progressed.advancePaid).toBe(before.orders.o_3.advancePaid);expect(progressed.workflow).toEqual(before.orders.o_3.workflow);
  expect(progressed.garmentJobs.some(job=>job.workflow[3].notes==='Workshop pattern check')).toBe(true);
  expect(await wp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await wp.screenshot({path:testInfo.outputPath('assigned-workshop.png'),fullPage:true});
  await wp.locator('#sharedLogout').click();await expect(wp.locator('#sharedLogin')).toBeVisible();
  expect(await wp.evaluate(()=>({clients:Object.keys(DB.clients).length,jobs:ModistoShared.jobs.length,cookie:document.cookie}))).toEqual({clients:0,jobs:0,cookie:''});
  await op.locator('#sharedLogout').click();await expect(op.locator('#sharedLogin')).toBeVisible();
  expect(await op.evaluate(()=>Object.keys(DB.clients).length)).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('modisto_bespoke_v7'))).toBe('untouched-browser-records');expect(errors).toEqual([]);
 }finally{await office.close();await workshop.close();}
});

test('stale and interrupted saves retain a recoverable draft without false success',async({page,context},testInfo)=>{
 const {user}=await seed(context);await page.goto(origin);await expect(page.locator('#sharedLogout')).toBeVisible();
 await page.evaluate(()=>ACTIONS.openMeasureByOrder('o_3'));await page.locator('#mNotes').fill('Retain my stale draft');
 const current=await snapshot(context),changed=D.clone(current.database.measurements.m_demo_3);changed.notes='Another device saved this';
 expect((await post(context,'/api/commit',{changes:[{collection:'measurements',id:changed.id,payload:changed,expectedVersion:current.versions['measurements/'+changed.id]}]},user.csrf)).status()).toBe(200);
 await page.locator('#abSave').click();await expect(page.locator('#status')).toContainText('Save failed');await expect(page.locator('#status')).toContainText('Conflict');await expect(page.locator('#mNotes')).toHaveValue('Retain my stale draft');
 expect((await snapshot(context)).database.measurements.m_demo_3.notes).toBe('Another device saved this');
 page.once('dialog',d=>d.accept());await page.locator('#sharedRefresh').click();await expect(page.locator('#sharedSaveState')).toHaveText('Shared records loaded');await page.evaluate(()=>ACTIONS.openMeasureByOrder('o_3'));
 await page.locator('#mNotes').fill('Download this unconfirmed draft');await page.route('**/api/commit',route=>route.abort());await page.locator('#abSave').click();
 await expect(page.locator('#status')).toContainText('Save not confirmed');await expect(page.locator('#sharedDraft')).toBeVisible();
 const downloading=page.waitForEvent('download');await page.locator('#sharedDraft').click();const stream=await (await downloading).createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
 const recovered=JSON.parse(Buffer.concat(chunks).toString());expect(recovered.measurements.m_demo_3.notes).toBe('Download this unconfirmed draft');
 await page.unroute('**/api/commit');await page.locator('#abSave').click();await expect(page.locator('#status')).toContainText('previous save was not confirmed');
 expect((await snapshot(context)).database.measurements.m_demo_3.notes).toBe('Another device saved this');
 await page.screenshot({path:testInfo.outputPath('unconfirmed-draft.png'),fullPage:true});
 page.once('dialog',d=>d.accept());await page.locator('#sharedRefresh').click();await expect(page.locator('#sharedDraft')).toHaveCount(0);
});

test('conflicting imports are blocked and disabling a session clears its browser data',async({page,context,browser},testInfo)=>{
 const {user,data}=await seed(context);await page.goto(origin);await expect(page.locator('#sharedStaff')).toBeVisible();
 const conflict=D.clone(data);conflict.clients.c_demo_3.phone='Changed contact';
 await page.locator('#sharedImport').click();await page.locator('#sharedImportFile').setInputFiles({name:'conflict.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(conflict))});
 await expect(page.locator('#sharedImportPlan')).toContainText('clients/c_demo_3');await expect(page.locator('#importCommit')).toBeDisabled();await page.locator('#importClose').click();
 const result=await (await post(context,'/api/staff',{name:'Revoked office',email:'revoked@modisto.test',password,role:'office'},user.csrf)).json();
 const other=await makeContext(browser,testInfo);
 try{
  const op=await other.newPage();await login(op,'revoked@modisto.test');expect(await op.evaluate(()=>Object.keys(DB.clients).length)).toBeGreaterThan(0);
  await post(context,'/api/staff/disable',{id:result.user.id},user.csrf);
  await expect(op.locator('#sharedLogin')).toBeVisible({timeout:10000});expect(await op.evaluate(()=>Object.keys(DB.clients).length)).toBe(0);await expect(op.locator('#main')).toBeEmpty();
  await op.locator('#sharedEmail').fill('owner@modisto.test');await op.locator('#sharedPassword').fill(password);await op.locator('#sharedLogin').click();
  await expect(op.locator('[data-v="dashboard"]')).toBeVisible();
  if(await op.locator('#navMore').isVisible()) await op.locator('#navMore').click();
  await expect(op.locator('[data-v="settings"]')).toBeVisible();
 }finally{await other.close();}
});

test('new client, reviewed order, garment jobs and an additional trial persist through shared storage',async({page,context})=>{
 await seed(context);await page.goto(origin);await expect(page.locator('#sharedStaff')).toBeVisible();
 await page.evaluate(()=>ACTIONS.newClient());await page.locator('#cmName').fill('Synthetic staging patron');await page.locator('#cmSaveAndMeasure').click();
 await expect(page.locator('#mClientSelect')).toContainText('Synthetic staging patron');
 await page.locator('[data-m="Inseam"]').fill('30.25');await page.locator('#abSave').click();await expect(page.locator('#status')).toContainText('Saved to local staging server');
 const docketId=await page.evaluate(()=>MREC.id);await page.locator('#abCreateOrder').click();
 for(const id of ['omAmount','omAdvance','omMeters','omRate','omTrialDate','omDeliver'])await expect(page.locator('#'+id)).toHaveValue('');
 await page.locator('#omSave').click();await expect(page.locator('#overlay')).toBeHidden();
 const order=Object.values((await snapshot(context)).database.orders).find(item=>item.measurementId===docketId);
 expect(order).toMatchObject({amount:null,advancePaid:null,fabricMeters:null,trialDate:'',delivery:'',status:'New'});expect(order.workflow.every(step=>!step.done&&!step.doneDate)).toBe(true);
 await page.locator('[data-v="orders"]').click();
 await page.locator('[data-open-tracked-order="'+order.id+'"]').click();
 await page.locator('[data-act="openGarments"][data-id="'+order.id+'"]').click();
 await page.locator('#gjAdd').click();await page.locator('#gjDocket').selectOption(docketId);await page.locator('#gjMaker').fill('Demo Jacket Maker');await page.locator('#gjApply').click();
 await page.locator('#gjSave').click();await expect(page.locator('#gjStatus')).toHaveText('Garment jobs saved to staging server');
 const jobs=(await snapshot(context)).database.orders[order.id].garmentJobs;expect(jobs).toHaveLength(2);
 await page.locator('[data-job-edit="'+jobs[0].id+'"]').click();await page.locator('#gjAddTrial').click();await page.getByLabel('Scheduled date for 2nd Trial / Fitting',{exact:true}).fill('2026-11-20');
 await page.locator('#gjApply').click();await page.locator('#gjSave').click();await expect(page.locator('#gjStatus')).toHaveText('Garment jobs saved to staging server');
 await page.reload();await expect(page.locator('#sharedStaff')).toBeVisible();
 const saved=(await snapshot(context)).database.orders[order.id];expect(saved.garmentJobs[0].workflow.find(step=>step.key==='trial_2').scheduledDate).toBe('2026-11-20');expect(saved.garmentJobs[1]).toEqual(jobs[1]);expect(saved.amount).toBeNull();expect(saved.workflow).toEqual(order.workflow);
});
