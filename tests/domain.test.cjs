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
