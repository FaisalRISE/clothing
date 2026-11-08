const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const source = html.match(/<script>([\s\S]*)<\/script>/)[1];
const prefix = source.slice(source.indexOf('const SCHEMA'), source.indexOf('/* ---------------- HELPERS'));
const conversion = source.slice(source.indexOf('function convertMeasurementUnit'), source.indexOf('const MEASUREMENT_VIEW_KEY'));
const save = source.slice(source.indexOf('async function saveMeasure'), source.indexOf('/* ============================================================================\n   4. ORDERS'));
function app(initial = {}, search = '') {
  const storage = new Map(Object.entries(initial));
  const status = { textContent: '' };
  const context = vm.createContext({
    URLSearchParams, location: { search }, console: { error() {} },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
    document: {}, toast() {}, $: () => status, pushToSheets: async () => false,
    makeOrderNo: () => '#TEST-NEW',
  });
  vm.runInContext(prefix + conversion + '\nlet MREC;\n' + save, context);
  return { run: code => vm.runInContext(code, context), storage, context, status };
}
const copy = value => JSON.parse(JSON.stringify(value));

test('order search finds individual makers, fabrics and retained cancelled garment labels',()=>{
 const a=app();
 a.context.sample={orderNo:'ORDER-CHECK',garments:'Historical free text',swatchCode:'PRIMARY',assignedTo:'Cutter',
  garmentJobs:[{type:'shirt',label:'Evening Shirt Two',swatchCode:'SECONDARY',maker:'Shirt Specialist',cancellation:{reason:'Retain reference'}}]};
 const before=JSON.stringify(a.context.sample),text=a.run('orderSearchText(sample,{name:"Test Patron"})');
 for(const term of ['order-check','historical free text','primary','cutter','secondary','shirt specialist','evening shirt two','test patron'])assert.ok(text.includes(term));
 assert.equal(JSON.stringify(a.context.sample),before);
});

test('order progress skips delivered and cancelled jobs without inventing task completion',()=>{
 const a=app();
 a.context.sample={status:'Cutting',garmentJobs:[
  {label:'Delivered shirt',status:'Delivered',workflow:[{label:'Earlier task',done:false}]},
  {label:'Cancelled trousers',status:'New',cancellation:{reason:'Cancelled'},workflow:[{label:'Excluded task',done:false}]},
  {label:'Jacket',maker:'Workshop maker',status:'Cutting',workflow:[{label:'Completed task',done:true},{label:'Cut pattern',done:false}]}
 ]};
 const before=JSON.stringify(a.context.sample),progress=copy(a.run('orderWorkflowSummary(sample)'));
 assert.equal(progress.total,3);assert.equal(progress.done,1);assert.deepEqual(progress.next,{label:'Cut pattern',garment:'Jacket',assignedTo:'Workshop maker'});
 assert.equal(JSON.stringify(a.context.sample),before);
 assert.equal(a.run('orderWorkflowSummary({status:"Delivered",workflow:[{label:"Retained",done:false}]}).delivered'),true);
 assert.equal(a.run('orderWorkflowSummary({status:"Cancelled",garmentJobs:sample.garmentJobs.map(job=>({...job,cancellation:{reason:"Cancelled"}}))}).cancelled'),true);
 assert.equal(a.run('orderWorkflowSummary({status:"New"}).total'),0);
});

test('received-total summaries distinguish missing values, explicit zero and excess receipts without modifying records',()=>{
 const a=app();
 assert.deepEqual(copy(a.run('recordedOrderPayments({amount:50000,advancePaid:""})')),{quoted:50000,received:null,balance:null,excess:null});
 assert.deepEqual(copy(a.run('recordedOrderPayments({amount:0,advancePaid:"0"})')),{quoted:0,received:0,balance:0,excess:0});
 assert.deepEqual(copy(a.run('recordedOrderPayments({amount:100,advancePaid:150})')),{quoted:100,received:150,balance:0,excess:50});
 a.context.sample={amount:null,advancePaid:0,workflow:[{done:false}],garmentJobs:[]};const before=JSON.stringify(a.context.sample);
 assert.equal(a.run('recordedOrderPayments(sample).balance'),null);assert.equal(JSON.stringify(a.context.sample),before);
 assert.equal(a.run('orderTimingRecorded({actualDays:0,estDays:0})'),true);
 assert.equal(a.run('orderTimingRecorded({actualDays:null,estDays:5})'),false);
 assert.equal(a.run('orderTimingRecorded({actualDays:0,estDays:""})'),false);
});
const legacy = {
  clients: { c: { id: 'c', name: 'Regression patron', posture: 'Approved prior posture' } },
  measurements: { m: { id: 'm', clientId: 'c', orderNo: 'SAME', unit: 'in', measures: { Chest: '40' }, ticks: {}, texts: {}, savedAt: 'old' } },
  orders: { o: { id: 'o', clientId: 'c', orderNo: 'SAME', garments: '1 suit + 16 shirts', fabricMeters: 40, fabricRate: 2400, amount: 148000, advancePaid: 112000, assignedTo: 'Committed cutter', status: 'Stitching', customAllocation: { shirts: 16, suit: 1 }, workflow: [ { key:'trial_3', done:true, doneDate:'2026-10-20', notes:'Keep fitting history', assignedTo:'Maker' } ] } },
  swatches: {}, employees: {}, settings: {}, customMetadata: { preserve: true }
};
test('legacy load preserves records, empty collections, custom workflow and source bytes', () => {
  const raw = JSON.stringify(legacy);
  const a = app({ modisto_bespoke_v6: raw });
  const db = copy(a.run('DB'));
  for (const key of ['clients','measurements','orders','swatches','employees','customMetadata']) assert.deepEqual(db[key], legacy[key]);
  assert.equal(a.storage.get('modisto_bespoke_v6'), raw);
  assert.equal(a.storage.has('modisto_bespoke_v7'), false);
});
test('measurement save preserves every other record and can save an unlinked draft without creating an order', async () => {
  const a = app({modisto_bespoke_v6: JSON.stringify(legacy)});
  const before = copy(a.run('DB'));
  a.run('MREC = JSON.parse(JSON.stringify(DB.measurements.m)); MREC.measures.Chest = "40.25"; MREC.measuredBy = "Different measurer"; MREC.selectedGarments = [{name:"Shirt",qty:1}]; MREC.swatchCode = "DIFFERENT";');
  await a.run('saveMeasure()');
  const after = copy(a.run('DB'));
  assert.equal(after.measurements.m.measures.Chest, '40.25');
  for (const key of Object.keys(before).filter(k=>k !== 'measurements')) assert.deepEqual(after[key], before[key]);
  a.run('MREC = blankMeasure("c"); MREC.measures.Inseam = "29.25";');
  await a.run('saveMeasure()');
  assert.equal(Object.keys(a.run('DB.orders')).length, 1);
  assert.deepEqual(JSON.parse(a.storage.get('modisto_bespoke_v7_recovery')), before);
  assert.equal(a.storage.get('modisto_bespoke_v6'), JSON.stringify(legacy));
  assert.match(a.status.textContent, /Saved locally/);
});
test('failed measurement persistence leaves saved state and timestamp untouched and permits retry', async () => {
  const a = app({modisto_bespoke_v6: JSON.stringify(legacy)});
  a.run('MREC = JSON.parse(JSON.stringify(DB.measurements.m)); MREC.measures.Chest = "42"; localStorage.setItem = () => { throw new Error("Quota exceeded"); };');
  const before = copy(a.run('DB'));
  await a.run('saveMeasure()');
  assert.deepEqual(copy(a.run('DB')), before);
  assert.equal(a.run('MREC.savedAt'), 'old');
  assert.equal(a.run('MREC.measures.Chest'), '42');
  assert.match(a.status.textContent, /Save failed/);
  a.context.localStorage.setItem = (k,v) => a.storage.set(k,v);
  await a.run('saveMeasure()');
  assert.equal(a.run('DB.measurements.m.measures.Chest'), '42');
});
test('measurement save keeps newer order changes from another tab and rejects a stale docket', async () => {
  const a=app({modisto_bespoke_v6:JSON.stringify(legacy)});
  a.run('MREC = JSON.parse(JSON.stringify(DB.measurements.m)); MREC.measures.Chest = "42";');
  const concurrent=copy(legacy);
  concurrent.orders.o.fabricMeters=52;
  concurrent.orders.o.workflow.push({key:'new_trial',done:true,doneDate:'2026-11-02'});
  a.storage.set('modisto_bespoke_v7',JSON.stringify(concurrent));
  await a.run('saveMeasure()');
  assert.deepEqual(copy(a.run('DB.orders')),concurrent.orders);
  concurrent.measurements.m.measures.Chest='44';
  a.storage.set('modisto_bespoke_v7',JSON.stringify(concurrent));
  a.run('MREC.measures.Chest="43"');
  await a.run('saveMeasure()');
  assert.equal(JSON.parse(a.storage.get('modisto_bespoke_v7')).measurements.m.measures.Chest,'44');
  assert.equal(a.run('MREC.measures.Chest'),'43');
  assert.match(a.status.textContent,/Save failed/);
});
test('unit conversion preserves blank versus zero, posture, notes, metric precision and repeated round trips', () => {
  const a = app();
  a.run('MREC = { unit:"in", measures:{ Chest:"40", Inseam:"29.25", zero:0, blank:"", missing:null }, texts:{ bowLegInches:"0.5", knockKneesInches:"", shoulderDownInches:"0", outfoldHeight:"1.75 in", bowLegComment:"Ease 0.25 in" } }; convertMeasurementUnit(MREC,"cm");');
  assert.equal(a.run('MREC.measures.Chest'), '101.6');
  assert.equal(a.run('MREC.measures.Inseam'), '74.295');
  assert.equal(a.run('MREC.measures.zero'), '0');
  assert.equal(a.run('MREC.measures.blank'), '');
  assert.equal(a.run('MREC.measures.missing'), null);
  assert.equal(a.run('MREC.texts.bowLegInches'), '1.27');
  assert.equal(a.run('MREC.texts.shoulderDownInches'), '0');
  assert.equal(a.run('MREC.texts.outfoldHeight'), '1.75 in');
  a.run('for(let i=0;i<100;i++){convertMeasurementUnit(MREC,"in");convertMeasurementUnit(MREC,"cm");} convertMeasurementUnit(MREC,"in");');
  assert.equal(a.run('MREC.measures.Inseam'), '29.25');
  a.run('MREC = {unit:"cm",measures:{Chest:"101.123456"},texts:{}}; convertMeasurementUnit(MREC,"in"); convertMeasurementUnit(MREC,"cm");');
  assert.ok(Math.abs(Number(a.run('MREC.measures.Chest'))-101.123456)<1e-11);
});
test('invalid conversion is atomic and never relabels nonnumeric legacy measurements', () => {
  const a = app();
  a.run('MREC = {unit:"in",measures:{Chest:"40",Other:"29 1/4"},texts:{}}');
  const before=copy(a.run('MREC'));
  assert.throws(()=>a.run('convertMeasurementUnit(MREC,"cm")'), /not numeric/);
  assert.deepEqual(copy(a.run('MREC')),before);
});
test('stage changes preserve custom history and new workflows contain no invented progress', () => {
  const a=app({modisto_bespoke_v6:JSON.stringify(legacy)});
  a.run('syncOrderStageToWorkflow(DB.orders.o,"New")');
  assert.deepEqual(copy(a.run('DB.orders.o.workflow')), legacy.orders.o.workflow);
  assert.ok(a.run('buildDefaultWorkflow("2026-10-01","Delivered","","").every(s=>!s.done && s.doneDate === "" && s.daysTaken === "" && s.assignedTo === "")'));
});
test('empty real workspace, isolated demo mode and corrupt data protection', () => {
  const a=app();
  assert.equal(Object.keys(a.run('DB.clients')).length,0);
  assert.equal(Object.keys(a.run('DB.orders')).length,0);
  const demo=app({},'?demo=1');
  assert.ok(Object.keys(demo.run('DB.clients')).length>0);
  demo.run('writeDatabase(DB)');
  assert.equal(demo.storage.has('modisto_bespoke_v7'),false);
  const corrupt=app({modisto_bespoke_v6:'broken JSON'});
  assert.throws(()=>corrupt.run('writeDatabase(DB)'), /could not be loaded/);
  assert.equal(corrupt.storage.get('modisto_bespoke_v6'),'broken JSON');
});

test('a suit and two shirts become four distinct jobs without fabric or progress assumptions', () => {
  const a = app();
  a.run('const suit = makeGarmentJobs("suit2", 1, {}); const shirts = makeGarmentJobs("shirt", 2, {}, suit); globalThis.jobs = [...suit, ...shirts];');
  const jobs = copy(a.run('jobs'));
  assert.deepEqual(jobs.map(job => job.type), ['jacket', 'trousers', 'shirt', 'shirt']);
  assert.equal(new Set(jobs.map(job => job.id)).size, 4);
  assert.equal(jobs[0].bundleId, jobs[1].bundleId);
  assert.ok(jobs.every(job => !job.maker && !job.swatchCode && job.status === 'New' && job.workflow.every(step => !step.done && !step.doneDate)));
  assert.throws(() => a.run('makeGarmentJobs("shirt", 1.5, {})'), /whole quantity/);
});

test('additional trials have stable numbering and preserve every existing task and completed fitting', () => {
  const a = app();
  a.run('globalThis.workflow = buildDefaultWorkflow("", "New", "", ""); workflow[5] = {...workflow[5],done:true,doneDate:"2026-11-01",notes:"Retain balance findings",scheduledDate:"2026-10-30"};');
  const before = copy(a.run('workflow'));
  a.run('globalThis.withSecond = appendAdditionalTrial(workflow); globalThis.withThird = appendAdditionalTrial(withSecond);');
  const extended = copy(a.run('withThird'));
  assert.deepEqual(copy(a.run('workflow')), before);
  assert.deepEqual(extended.filter(step => !['trial_2','trial_3'].includes(step.key)), before);
  assert.deepEqual(extended.slice(5,9).map(step => step.key), ['trial_1','trial_2','trial_3','finishing']);
  for (const step of extended.filter(step => ['trial_2','trial_3'].includes(step.key))) {
    assert.equal(step.done, false);
    for (const key of ['doneDate','scheduledDate','assignedTo','daysTaken','notes']) assert.equal(step[key], '');
  }
  a.run('globalThis.legacyExtra = appendAdditionalTrial([{key:"trial_11",stage:"1st Trial / Fitting",done:true,notes:"Keep"}]);');
  assert.equal(a.run('legacyExtra[1].label'), '12th Trial / Fitting');
  assert.equal(a.run('legacyExtra[0].notes'), 'Keep');
});

test('workshop sheets use immutable garment measurements and preserve precision, options and trial notes without writing data', () => {
  const a = app({modisto_bespoke_v6:JSON.stringify(legacy)});
  a.run(`DB.measurements.m.measures={"Suit Length Front":"29.25","Chest (Suit)":"0","Belly (Suit)":"","Legacy balance mark":0};
    DB.measurements.m.texts={shoulderDownInches:0,suitComments:"Keep shoulder balance",shirtComments:"Other garment only",legacyMark:"Retain legacy mark"};
    DB.measurements.m.ticks={"Shoulder Down":"Right Down",Pocket:"No"};
    globalThis.versions={}; const versionId=captureGarmentMeasurement("m",DB,versions);
    DB.measurementVersions=versions;
    DB.orders.o.garmentJobs=makeGarmentJobs("suit2",1,{measurementVersionId:versionId,maker:"Saved maker",swatchCode:"JOB-FABRIC"});
    DB.orders.o.garmentJobs[0].workflow=appendAdditionalTrial(DB.orders.o.garmentJobs[0].workflow);
    Object.assign(DB.orders.o.garmentJobs[0].workflow[6],{scheduledDate:"2026-11-20",notes:"Second fitting balance"});
    DB.measurements.m.measures["Suit Length Front"]="99";`);
  const before = copy(a.run('DB'));
  const sheet = copy(a.run('buildGarmentWorkshopSheet(DB,"o",DB.orders.o.garmentJobs[0].id)'));
  assert.equal(sheet.sections[0].rows[0].value, '29.25');
  assert.equal(sheet.sections[0].rows[1].value, '0');
  assert.equal(sheet.sections[0].rows[2].value, '');
  assert.deepEqual(sheet.sections[0].rows.map(row=>row.label),copy(a.run('SCHEMA.upper.measures')));
  assert.equal(sheet.swatchCode, 'JOB-FABRIC');
  assert.equal(sheet.maker, 'Saved maker');
  assert.ok(sheet.instructions.some(row=>row.label==='Shoulder correction' && row.value===0 && row.numeric));
  assert.ok(!sheet.instructions.some(row=>row.value==='Other garment only'));
  assert.equal(sheet.otherNotes[0].value, 'Retain legacy mark');
  assert.ok(sheet.otherNotes.some(row=>row.label==='Legacy balance mark' && row.value===0 && row.numeric));
  assert.equal(sheet.trials[1].scheduledDate, '2026-11-20');
  assert.equal(sheet.trials[1].done, false);
  assert.equal(sheet.trials[1].notes, 'Second fitting balance');
  assert.ok(!('amount' in sheet) && !('advancePaid' in sheet));
  assert.deepEqual(copy(a.run('DB')),before);
  assert.equal(a.storage.has('modisto_bespoke_v7'),false);
  const shirt = copy(a.run('DB.orders.o.garmentJobs=makeGarmentJobs("shirt",1,{measurementVersionId:DB.orders.o.garmentJobs[0].measurementVersionId}); buildGarmentWorkshopSheet(DB,"o",DB.orders.o.garmentJobs[0].id)'));
  assert.ok(shirt.instructions.some(row=>row.label==='Shoulder correction' && row.value===0));
  assert.ok(shirt.options.some(row=>row.label==='Shoulder Down' && row.value==='Right Down'));
});

test('every garment workshop sheet has its own section and supplementary upper-body references where needed', () => {
  const a = app({modisto_bespoke_v6:JSON.stringify(legacy)});
  a.run('globalThis.versions={}; globalThis.versionId=captureGarmentMeasurement("m",DB,versions); DB.measurementVersions=versions;');
  for (const type of ['jacket','trousers','shirt','waistcoat','bandi','sherwani','kurta','pyjama']) {
    a.context.garmentType = type;
    a.run('DB.orders.o.garmentJobs=makeGarmentJobs(garmentType,1,{measurementVersionId:versionId});');
    const sheet = copy(a.run('buildGarmentWorkshopSheet(DB,"o",DB.orders.o.garmentJobs[0].id)'));
    assert.equal(sheet.sections.length, ['waistcoat','bandi','sherwani','kurta'].includes(type) ? 2 : 1);
    if (type === 'kurta') assert.deepEqual(sheet.sections[1].rows.map(row=>row.label),['Kurta Length']);
    if (type === 'sherwani') assert.ok(!sheet.sections[1].rows.some(row=>row.label==='Kurta Length'));
  }
});

test('workshop sheets reject missing or cross-client saved copies without falling back to current docket or order fabric', () => {
  const a = app({modisto_bespoke_v6:JSON.stringify(legacy)});
  a.run('DB.orders.o.garmentJobs=makeGarmentJobs("shirt",1,{});');
  assert.throws(()=>a.run('buildGarmentWorkshopSheet(DB,"o",DB.orders.o.garmentJobs[0].id)'), /Choose saved measurements/);
  a.run('DB.measurementVersions={bad:{clientId:"other",snapshot:{clientId:"other"}}}; DB.orders.o.garmentJobs[0].measurementVersionId="bad";');
  assert.throws(()=>a.run('buildGarmentWorkshopSheet(DB,"o",DB.orders.o.garmentJobs[0].id)'), /does not belong/);
});

test('garment adoption and independent stages preserve legacy history and all financial fields', () => {
  const a = app({modisto_bespoke_v6: JSON.stringify(legacy)});
  a.run('globalThis.workspace = {orderId:"o", original:JSON.stringify(DB.orders.o), jobs:makeGarmentJobs("suit2",1,{}), versions:{}}; commitGarmentWorkspace(workspace);');
  const adopted = copy(a.run('DB.orders.o'));
  for (const key of Object.keys(legacy.orders.o).filter(key => key !== 'status')) assert.deepEqual(adopted[key], legacy.orders.o[key]);
  assert.equal(adopted.productionBeforeGarmentJobs.status, 'Stitching');
  a.run('workspace.original = JSON.stringify(DB.orders.o); workspace.jobs[0] = applyGarmentJobEdit(workspace.jobs[0], {status:"Ready",maker:"Maker"}); commitGarmentWorkspace(workspace);');
  assert.equal(a.run('DB.orders.o.garmentJobs[1].status'), 'New');
  assert.equal(a.run('DB.orders.o.status'), 'New');
  assert.equal(a.run('garmentProgressText(DB.orders.o.garmentJobs)'), '1 of 2 garments ready');
  assert.deepEqual(copy(a.run('DB.orders.o.workflow')), legacy.orders.o.workflow);
  assert.equal(a.run('DB.orders.o.advancePaid'), 112000);
  assert.equal(a.run('DB.orders.o.fabricMeters'), 40);
  a.run('workspace.original = JSON.stringify(DB.orders.o); workspace.jobs[1] = applyGarmentJobEdit(workspace.jobs[1], {status:"Ready"}); commitGarmentWorkspace(workspace);');
  assert.equal(a.run('DB.orders.o.status'), 'Ready');
});

test('immutable measurement versions are shared by jobs and remain after later docket edits', async () => {
  const a = app({modisto_bespoke_v6: JSON.stringify(legacy)});
  a.run('globalThis.versions = {}; globalThis.versionId = captureGarmentMeasurement("m",DB,versions); globalThis.workspace = {orderId:"o", original:JSON.stringify(DB.orders.o), jobs:makeGarmentJobs("shirt",2,{measurementVersionId:versionId}), versions}; commitGarmentWorkspace(workspace);');
  assert.equal(a.run('Object.keys(DB.measurementVersions).length'),1);
  assert.equal(a.run('captureGarmentMeasurement("m",DB,versions)'), a.run('versionId'));
  a.run('MREC = JSON.parse(JSON.stringify(DB.measurements.m)); MREC.measures.Chest="42";');
  await a.run('saveMeasure()');
  assert.equal(a.run('DB.measurementVersions[versionId].snapshot.measures.Chest'), '40');
  assert.equal(a.run('DB.measurements.m.measures.Chest'), '42');
  a.run('workspace.original = JSON.stringify(DB.orders.o); const nextId=captureGarmentMeasurement("m",DB,versions); workspace.jobs[0]=applyGarmentJobEdit(workspace.jobs[0],{measurementVersionId:nextId}); commitGarmentWorkspace(workspace);');
  assert.equal(a.run('Object.keys(DB.measurementVersions).length'),2);
  assert.equal(a.run('DB.orders.o.garmentJobs[1].measurementVersionId'),a.run('versionId'));
});

test('garment saves reject stale orders, foreign-client measurements and failed storage without partial writes', () => {
  const a = app({modisto_bespoke_v6: JSON.stringify(legacy)});
  a.run('globalThis.workspace = {orderId:"o",original:JSON.stringify(DB.orders.o),jobs:makeGarmentJobs("shirt",1,{}),versions:{}};');
  const changed = copy(legacy);
  changed.orders.o.advancePaid=120000;
  a.storage.set('modisto_bespoke_v7',JSON.stringify(changed));
  assert.throws(()=>a.run('commitGarmentWorkspace(workspace)'), /changed in another tab/);
  a.run('workspace.original=JSON.stringify(latestStoredDatabase().orders.o); workspace.versions.bad={id:"bad",clientId:"other",snapshot:{clientId:"other"}}; workspace.jobs[0].measurementVersionId="bad";');
  assert.throws(()=>a.run('commitGarmentWorkspace(workspace)'), /this order's client/);
  a.run('workspace.jobs[0].measurementVersionId=""; localStorage.setItem=()=>{throw new Error("Quota exceeded")};');
  const before=copy(a.run('DB'));
  assert.throws(()=>a.run('commitGarmentWorkspace(workspace)'), /Quota exceeded/);
  assert.deepEqual(copy(a.run('DB')),before);
  assert.equal(JSON.parse(a.storage.get('modisto_bespoke_v7')).orders.o.advancePaid,120000);
});

function amendmentApp() {
  const a=app({modisto_bespoke_v6:JSON.stringify(legacy)});
  a.run('globalThis.versions={}; const id=captureGarmentMeasurement("m",DB,versions); globalThis.workspace={orderId:"o",original:JSON.stringify(DB.orders.o),jobs:makeGarmentJobs("suit2",1,{measurementVersionId:id,maker:"Recorded maker",swatchCode:"JOB-FABRIC"}),versions}; commitGarmentWorkspace(workspace); workspace.original=JSON.stringify(DB.orders.o);');
  return a;
}

test('cancellation and reinstatement retain measurements, completed tasks, assignments and commercial values', () => {
  const a=amendmentApp();
  a.run('workspace.jobs[0]=applyGarmentJobEdit(workspace.jobs[0],{status:"Ready",workflow:workspace.jobs[0].workflow.map((step,i)=>i===5?{...step,done:true,doneDate:"2026-11-01",notes:"Keep fitting findings"}:step)}); commitGarmentWorkspace(workspace); workspace.original=JSON.stringify(DB.orders.o);');
  const before=copy(a.run('DB.orders.o'));
  assert.throws(()=>a.run('reviseGarmentCancellation(workspace.jobs[0]," ")'), /Enter a reason/);
  a.run('workspace.jobs[0]=reviseGarmentCancellation(workspace.jobs[0],"Client cancelled jacket only"); commitGarmentWorkspace(workspace);');
  const cancelled=copy(a.run('DB.orders.o'));
  for(const key of ['amount','advancePaid','fabricMeters','workflow','garments','assignedTo']) assert.deepEqual(cancelled[key],before[key]);
  for(const key of ['workflow','maker','swatchCode','measurementVersionId','status']) assert.deepEqual(cancelled.garmentJobs[0][key],before.garmentJobs[0][key]);
  assert.deepEqual(cancelled.garmentJobs[1],before.garmentJobs[1]);
  assert.equal(cancelled.commercialReviewRequired,true);
  assert.equal(cancelled.reservedFabricMeters,40);
  assert.equal(a.run('garmentProgressText(DB.orders.o.garmentJobs)'), '0 of 1 garments ready · 1 active · 1 cancelled');
  assert.equal(a.run('garmentOrderDescription(DB.orders.o)'), '1× Trousers');
  assert.throws(()=>a.run('applyGarmentJobEdit(workspace.jobs[0],{status:"Cutting"})'), /Reinstate/);
  assert.throws(()=>a.run('buildGarmentWorkshopSheet(DB,"o",DB.orders.o.garmentJobs[0].id)'), /cancelled/);
  a.run('workspace.original=JSON.stringify(DB.orders.o); workspace.jobs[0]=reviseGarmentCancellation(workspace.jobs[0],"Client reinstated jacket",true); commitGarmentWorkspace(workspace);');
  assert.equal(a.run('DB.orders.o.garmentJobs[0].status'),'Ready');
  assert.equal(a.run('DB.orders.o.garmentJobs[0].cancellation'),null);
  assert.deepEqual(copy(a.run('DB.orders.o.garmentRevisions.map(event=>event.kind)')),['Cancelled','Reinstated']);
});

test('cancelled garments leave production while reservations survive terminal stage changes and saved histories cannot be deleted', () => {
  const a=amendmentApp();
  a.run('workspace.jobs[0]=applyGarmentJobEdit(workspace.jobs[0],{status:"Delivered"}); commitGarmentWorkspace(workspace); workspace.original=JSON.stringify(DB.orders.o);');
  assert.throws(()=>a.run('reviseGarmentCancellation(workspace.jobs[0],"Cancellation")'), /return\/refund/);
  a.run('workspace.jobs[1]=reviseGarmentCancellation(workspace.jobs[1],"Cancel undelivered trouser"); commitGarmentWorkspace(workspace);');
  assert.equal(a.run('DB.orders.o.status'),'Delivered');
  assert.equal(a.run('orderFabricReservation(DB.orders.o)'),40);
  const b=amendmentApp();
  b.run('workspace.jobs=workspace.jobs.map(job=>reviseGarmentCancellation(job,"Client cancelled order")); commitGarmentWorkspace(workspace);');
  assert.equal(b.run('DB.orders.o.status'),'Cancelled');
  assert.equal(b.run('garmentProgressText(DB.orders.o.garmentJobs)'),'0 active garments · 2 cancelled');
  b.run('workspace.original=JSON.stringify(DB.orders.o); workspace.jobs.pop();');
  assert.throws(()=>b.run('commitGarmentWorkspace(workspace)'), /Saved garments cannot be removed/);
  b.run('workspace.jobs=JSON.parse(JSON.stringify(DB.orders.o.garmentJobs)); workspace.jobs[0].history=[];');
  assert.throws(()=>b.run('commitGarmentWorkspace(workspace)'), /activity cannot be removed/);
});

test('extra garments require an addition reason and preserve every previously saved garment', () => {
  const a=amendmentApp();
  const before=copy(a.run('DB.orders.o'));
  a.run('workspace.jobs.push(...makeGarmentJobs("shirt",1,{},workspace.jobs));');
  assert.throws(()=>a.run('commitGarmentWorkspace(workspace)'), /reason for adding/);
  a.run('workspace.jobs[2].additionReason="Client added a shirt"; commitGarmentWorkspace(workspace);');
  const after=copy(a.run('DB.orders.o'));
  assert.deepEqual(after.garmentJobs.slice(0,2),before.garmentJobs);
  assert.equal(after.garmentRevisions[0].kind,'Added');
  assert.equal(after.commercialReviewRequired,true);
  for(const key of ['amount','advancePaid','fabricMeters','workflow','garments']) assert.deepEqual(after[key],before[key]);
});

test('commercial reviews require reasons and explicitly record reservation and paid-total changes without rewriting job history', () => {
  const a=amendmentApp();
  a.run('globalThis.beforeReview={...DB.orders.o,commercialReviewRequired:true,reservedFabricMeters:40}; globalThis.afterReview={...beforeReview,amount:100000,advancePaid:94000,reservedFabricMeters:0};');
  assert.throws(()=>a.run('reviewOrderCommercials(beforeReview,afterReview,"",true)'), /Enter a reason/);
  a.run('globalThis.reviewed=reviewOrderCommercials(beforeReview,afterReview,"Agreed revised totals and released reservation",true);');
  const reviewed=copy(a.run('reviewed'));
  assert.equal(reviewed.commercialReviewRequired,false);
  assert.deepEqual(reviewed.commercialAdjustments[0].changes.advancePaid,{before:112000,after:94000});
  assert.deepEqual(reviewed.commercialAdjustments[0].changes.reservedFabricMeters,{before:40,after:0});
  assert.equal(reviewed.fabricMeters,40);
  assert.deepEqual(reviewed.garmentJobs,copy(a.run('beforeReview.garmentJobs')));
  assert.equal(a.run('beforeReview.advancePaid'),112000);
  assert.equal(a.run('reviewOrderCommercials(beforeReview,beforeReview,"Confirmed no change",true).commercialAdjustments[0].confirmed'),true);
  assert.equal(a.run('reviewOrderCommercials(beforeReview,beforeReview,"",false).commercialReviewRequired'),true);
  assert.throws(()=>a.run('reviewOrderCommercials(beforeReview,{...beforeReview,advancePaid:-1},"Correction",true)'), /positive number/);
});

test('failed cancellation writes retain drafts and retry safely; stale amendments retain newer payment values', () => {
  const a=amendmentApp();
  const before=copy(a.run('DB'));
  a.run('workspace.jobs[0]=reviseGarmentCancellation(workspace.jobs[0],"Client cancelled jacket"); localStorage.setItem=()=>{throw new Error("Quota exceeded")};');
  assert.throws(()=>a.run('commitGarmentWorkspace(workspace)'), /Quota exceeded/);
  assert.deepEqual(copy(a.run('DB')),before);
  assert.ok(a.run('workspace.jobs[0].cancellation'));
  a.context.localStorage.setItem=(k,v)=>a.storage.set(k,v);
  a.run('commitGarmentWorkspace(workspace); workspace.original=JSON.stringify(DB.orders.o); workspace.jobs[1]=reviseGarmentCancellation(workspace.jobs[1],"Cancel trousers");');
  const newer=copy(a.run('DB'));
  newer.orders.o.advancePaid=120000;
  a.storage.set('modisto_bespoke_v7',JSON.stringify(newer));
  assert.throws(()=>a.run('commitGarmentWorkspace(workspace)'), /changed in another tab/);
  assert.equal(JSON.parse(a.storage.get('modisto_bespoke_v7')).orders.o.advancePaid,120000);
  assert.equal(JSON.parse(a.storage.get('modisto_bespoke_v7')).orders.o.garmentJobs[1].cancellation,undefined);
});
