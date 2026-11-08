'use strict';
(function(){

const COLLECTIONS = ['clients','measurements','measurementVersions','orders','swatches','employees'];
const UI_SETTINGS = ['activeBranch','measuredByDefault','viewMode','printPagesMode'];
const STAGES = ['New','Fabric Ordered','Fabric Received','Cutting','Stitching','1st Trial / Fitting','Finishing','Ready','Delivered'];
const clone = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (!object(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])]));
}
function inspect(value,depth=0) {
    if(depth>40)throw new Error('Backup nesting is too deep.');
    if(!value||typeof value!=='object')return;
    for(const [key,item] of Object.entries(value)) {
      if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsupported record key: '+key);
      inspect(item,depth+1);
    }
}
function flatten(database) {
  if (!object(database) || !object(database.clients)) throw new Error('Invalid Modisto backup: clients collection is required.');
  inspect(database);
  const rows=[];
  for(const collection of COLLECTIONS) {
    const records=database[collection] ?? {};
    if(!object(records)) throw new Error('Invalid collection: '+collection);
    for(const [id,payload] of Object.entries(records)) {
      if(!object(payload) || !id || payload.id !== id) throw new Error('Invalid record identity: '+collection+'/'+id);
      rows.push({collection,id,payload:clone(payload)});
    }
  }
  const settings={...(database.settings || {})};
  for(const key of UI_SETTINGS) delete settings[key];
  // Legacy exports remain recoverable, but staging never enables outgoing Sheets exports.
  settings.appsScriptUrl='';
  rows.push({collection:'settings',id:'global',payload:settings});
  const metadata=Object.fromEntries(Object.entries(database).filter(([key])=>!COLLECTIONS.includes(key)&&key!=='settings'));
  rows.push({collection:'metadata',id:'root',payload:metadata});
  return rows;
}
function assemble(rows) {
  const database=Object.fromEntries(COLLECTIONS.map(key=>[key,{}]));
  database.settings={};
  for(const row of rows.filter(row=>!row.deleted)) {
    if(row.collection==='settings') database.settings=clone(row.payload);
    else if(row.collection==='metadata') Object.assign(database,clone(row.payload));
    else if(COLLECTIONS.includes(row.collection)) Object.defineProperty(database[row.collection],row.id,{value:clone(row.payload),enumerable:true,writable:true,configurable:true});
  }
  return database;
}
const rowKey = row => row.collection+'/'+row.id;
function changes(base,next,versions) {
  const old=new Map(flatten(base).map(row=>[rowKey(row),row]));
  const fresh=new Map(flatten(next).map(row=>[rowKey(row),row]));
  const result=[];
  for(const key of new Set([...old.keys(),...fresh.keys()])) {
    const before=old.get(key),after=fresh.get(key);
    if(canonical(before?.payload ?? null)===canonical(after?.payload ?? null))continue;
    const row=after || before;
    result.push({collection:row.collection,id:row.id,payload:after?.payload ?? null,expectedVersion:versions[key] || 0});
  }
  return result;
}
function planImport(source,current) {
  const rows=flatten(source), existing=new Map(flatten(current).map(row=>[rowKey(row),row]));
  const plan={insert:[],identical:[],conflicts:[],counts:{}};
  for(const row of rows) {
    plan.counts[row.collection]=(plan.counts[row.collection]||0)+1;
    const old=existing.get(rowKey(row));
    // Empty settings/metadata are defaults, not an existing business record.
    if(!old || (['settings','metadata'].includes(row.collection)&&Object.keys(old.payload).filter(key=>key!=='appsScriptUrl').length===0))plan.insert.push(row);
    else if(canonical(old.payload)===canonical(row.payload))plan.identical.push(rowKey(row));
    else plan.conflicts.push(rowKey(row));
  }
  return plan;
}
function prefix(before,after,label) {
  if(!Array.isArray(after) || canonical(after.slice(0,before.length))!==canonical(before))throw new Error(label+' history cannot be removed or rewritten.');
}
function validateChange(before,after,collection) {
  inspect(after);
  if(collection==='metadata'&&after&&Object.keys(after).some(key=>[...COLLECTIONS,'settings'].includes(key)))throw new Error('Metadata cannot replace a record collection.');
  if(collection==='measurementVersions' && before && canonical(before)!==canonical(after))throw new Error('Saved measurement copies are immutable.');
  if(collection!=='orders' || !before?.garmentJobs?.length)return;
  if(!after)throw new Error('Orders with saved garments cannot be deleted.');
  prefix(before.garmentRevisions || [],after.garmentRevisions || [],'Order amendment');
  prefix(before.commercialAdjustments || [],after.commercialAdjustments || [],'Commercial review');
  for(const prior of before.garmentJobs) {
    const job=after.garmentJobs?.find(item=>item.id===prior.id);
    if(!job || job.type!==prior.type || job.bundleId!==prior.bundleId)throw new Error('Saved garment identities cannot be removed or replaced.');
    prefix(prior.history || [],job.history || [],'Garment');
    if((prior.workflow || []).some(step=>!job.workflow?.some(item=>item.key===step.key)))throw new Error('Existing workflow tasks cannot be removed.');
  }
}
function validateReferences(database) {
  for(const record of [...Object.values(database.measurements),...Object.values(database.orders)]) {
    if(!database.clients[record.clientId])throw new Error('Missing client reference: '+record.id);
  }
  for(const order of Object.values(database.orders))for(const job of order.garmentJobs || []) {
    if(!STAGES.includes(job.status))throw new Error('Invalid garment stage.');
    if(job.measurementVersionId) {
      const version=database.measurementVersions[job.measurementVersionId];
      if(!version || version.clientId!==order.clientId || version.snapshot?.clientId!==order.clientId)throw new Error('Cross-client or missing measurement copy.');
    }
  }
}
const api={COLLECTIONS,UI_SETTINGS,STAGES,clone,object,canonical,flatten,assemble,changes,planImport,validateChange,validateReferences,rowKey};
if(typeof module!=='undefined')module.exports=api;else globalThis.ModistoData=api;
})();
