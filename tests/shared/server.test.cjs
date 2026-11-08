const {test}=require('node:test');
const assert=require('node:assert/strict');
const {start}=require('../../server/shared-server.cjs');
const D=require('../../shared/data.cjs');
const {fixture}=require('./fixture.cjs');
const password='Synthetic-local-password-123';

test('local shared server: authentication, isolation, atomic saves and recovery',async t=>{
 const app=await start({port:0,dataDir:'memory://',bootstrapToken:'synthetic-bootstrap-token'});
 t.after(()=>app.close());
 const origin='http://127.0.0.1:'+app.port;
 async function call(route,body,session,extra={}) {
  const response=await fetch(origin+route,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(session?{Cookie:session.cookie,'X-CSRF-Token':session.user.csrf}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};
 }
 async function login(email){const result=await call('/api/login',{email,password});assert.equal(result.status,200);return {user:result.body.user,cookie:result.cookie.split(';')[0]};}
 let owner,office,workshop,original;
 await t.test('setup is gated, passwords are hashed and sessions use HttpOnly cookies',async()=>{
  assert.equal((await call('/api/snapshot')).status,401);
  assert.equal((await call('/api/setup',{token:'wrong',email:'owner@modisto.test',name:'Owner',password})).status,403);
  assert.equal((await call('/api/setup',{token:'synthetic-bootstrap-token',email:'owner@modisto.test',name:'Owner',password})).status,201);
  assert.equal((await call('/api/setup',{token:'synthetic-bootstrap-token',email:'second@modisto.test',name:'Second',password})).status,409);
  const result=await call('/api/login',{email:'owner@modisto.test',password});assert.equal(result.status,200);
  assert.match(result.cookie,/HttpOnly/);assert.match(result.cookie,/SameSite=Strict/);
  owner={user:result.body.user,cookie:result.cookie.split(';')[0]};
  const stored=(await app.store.db.query('select password_hash from modisto_private.users')).rows[0];assert.notEqual(stored.password_hash,password);assert.equal(stored.password_hash.length,128);
  assert.equal((await call('/api/commit',{changes:[]},owner,{'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await call('/api/commit',{changes:[]},owner,{Origin:'https://untrusted.example'})).status,403);
 });
 await t.test('backup import is previewed, preserves unknown metadata and blocks conflicting IDs',async()=>{
  original=fixture();
  const plan=await call('/api/import/preview',{database:original},owner);assert.equal(plan.status,200);assert.deepEqual(plan.body.conflicts,[]);
  const result=await call('/api/import/commit',{database:original,digest:plan.body.digest},owner);assert.equal(result.status,200);
  assert.deepEqual(result.body.database.orders,original.orders);
  assert.deepEqual(result.body.database.measurementVersions,original.measurementVersions);
  assert.deepEqual(result.body.database.legacyMetadata,original.legacyMetadata);
  const conflict=D.clone(original);conflict.orders.o_3.advancePaid=1;
  const preview=await call('/api/import/preview',{database:conflict},owner);assert.ok(preview.body.conflicts.includes('orders/o_3'));
  assert.equal((await call('/api/import/commit',{database:conflict,digest:preview.body.digest},owner)).status,409);
  assert.equal((await call('/api/staff',{email:'office@modisto.test',name:'Office',password,role:'office'},owner)).status,201);
  assert.equal((await call('/api/staff',{email:'workshop@modisto.test',name:'Workshop',password,role:'workshop',employeeId:'emp_4'},owner)).status,201);
  office=await login('office@modisto.test');workshop=await login('workshop@modisto.test');
 });
 await t.test('workshop receives assigned job projections only; RLS denies raw records and user rows',async()=>{
  const result=await call('/api/snapshot',undefined,workshop);assert.equal(result.status,200);assert.equal(result.body.jobs.length,2);
  const text=JSON.stringify(result.body);assert.ok(!text.includes('PRIVATE-CONTACT'));assert.ok(!text.includes('135791'));assert.ok(!text.includes('advancePaid'));assert.ok(!('database' in result.body));
  const raw=await app.store.db.transaction(async tx=>{
   await tx.query("select set_config('modisto.actor_id',$1,true)",[workshop.user.id]);await tx.exec('set local role modisto_staff');
   return (await tx.query('select * from modisto.records')).rows;
  });assert.deepEqual(raw,[]);
  await assert.rejects(app.store.db.transaction(async tx=>{await tx.exec('set local role modisto_staff');await tx.query('select * from modisto_private.users');}),/permission denied/);
  assert.equal((await call('/api/commit',{changes:[]},workshop)).status,403);
  assert.equal((await call('/api/staff',undefined,office)).status,403);
  assert.equal((await call('/api/staff',{email:'bad@modisto.test',name:'Bad',password,role:'owner'},office)).status,403);
 });
 await t.test('office patches preserve unrelated edits, reject stale versions and roll back the entire batch',async()=>{
  const first=(await call('/api/snapshot',undefined,office)).body;
  const ownerSnapshot=(await call('/api/snapshot',undefined,owner)).body;
  const altered=D.clone(first.database.clients.c_demo_1);altered.remarks='Office edit';
  assert.equal((await call('/api/commit',{changes:[{collection:'clients',id:altered.id,payload:altered,expectedVersion:first.versions['clients/'+altered.id]}]},office)).status,200);
  const other=D.clone(ownerSnapshot.database.clients.c_demo_4);other.remarks='Independent owner edit';
  assert.equal((await call('/api/commit',{changes:[{collection:'clients',id:other.id,payload:other,expectedVersion:ownerSnapshot.versions['clients/'+other.id]}]},owner)).status,200);
  const rejected=await call('/api/commit',{changes:[
   {collection:'clients',id:'c_demo_4',payload:{...other,remarks:'Must roll back'},expectedVersion:(await call('/api/snapshot',undefined,owner)).body.versions['clients/c_demo_4']},
   {collection:'clients',id:altered.id,payload:altered,expectedVersion:first.versions['clients/'+altered.id]}
  ]},office);assert.equal(rejected.status,409);
  const latest=(await call('/api/snapshot',undefined,owner)).body;assert.equal(latest.database.clients.c_demo_4.remarks,'Independent owner edit');assert.equal(latest.database.clients.c_demo_1.remarks,'Office edit');
  const version=Object.keys(latest.database.measurementVersions)[0];
  assert.equal((await call('/api/commit',{changes:[{collection:'measurementVersions',id:version,payload:{...latest.database.measurementVersions[version],snapshot:{}},expectedVersion:latest.versions['measurementVersions/'+version]}]},office)).status,400);
 });
 await t.test('workshop progress preserves money/history and rejects unassigned jobs and delivery',async()=>{
  const initial=(await call('/api/snapshot',undefined,workshop)).body.jobs[0];
  const input=D.clone(initial.job);input.status='Cutting';input.workflow[3].done=true;input.workflow[3].doneDate='2026-11-08';input.workflow[3].notes='Pattern reviewed';
  assert.equal((await call('/api/workshop/job',{id:'unassigned',job:input,expectedVersion:initial.orderVersion},workshop)).status,403);
  assert.equal((await call('/api/workshop/job',{id:initial.id,job:{...input,status:'Delivered'},expectedVersion:initial.orderVersion},workshop)).status,400);
  const result=await call('/api/workshop/job',{id:initial.id,job:input,expectedVersion:initial.orderVersion},workshop);assert.equal(result.status,200);
  assert.ok(!JSON.stringify(result.body).includes('advancePaid'));
  const order=(await call('/api/snapshot',undefined,owner)).body.database.orders.o_3;
  assert.equal(order.amount,original.orders.o_3.amount);assert.equal(order.advancePaid,original.orders.o_3.advancePaid);
  assert.deepEqual(order.workflow,original.orders.o_3.workflow);
  const job=order.garmentJobs.find(job=>job.id===initial.id);assert.equal(job.workflow[3].done,true);assert.equal(job.workflow[0].done,false);assert.equal(job.history.at(-1).kind,'Workshop update');
  assert.equal((await call('/api/workshop/job',{id:initial.id,job:input,expectedVersion:initial.orderVersion},workshop)).status,409);
 });
 await t.test('account revocation ends existing sessions immediately and audit excludes credentials',async()=>{
  const audit=(await call('/api/audit',undefined,owner)).body.audit;assert.ok(audit.length>0);assert.ok(!JSON.stringify(audit).includes('password_hash'));
  assert.equal((await call('/api/audit',undefined,workshop)).status,403);
  assert.equal((await call('/api/staff/disable',{id:workshop.user.id},owner)).status,200);
  assert.equal((await call('/api/snapshot',undefined,workshop)).status,401);
  assert.equal((await call('/api/staff/disable',{id:owner.user.id},owner)).status,403);
  await call('/api/logout',{},office);assert.equal((await call('/api/snapshot',undefined,office)).status,401);
 });
});

test('backup and diff utilities reject prototype keys and preserve blank versus zero',()=>{
 const source=fixture();source.measurements.m_demo_3.measures.Chest='';source.measurements.m_demo_3.measures.Inseam=0;
 assert.deepEqual(D.assemble(D.flatten(source)).measurements,source.measurements);
 assert.throws(()=>D.flatten(JSON.parse('{"clients":{},"__proto__":{"bad":true}}')),/Unsupported record key/);
 assert.throws(()=>D.validateChange(null,JSON.parse('{"__proto__":{}}'),'clients'),/Unsupported record key/);
 assert.throws(()=>D.validateChange(null,{clients:{}},'metadata'),/cannot replace/);
});

test('disk database survives restart and JSON export restores into a separate empty database',async()=>{
 const fs=require('node:fs/promises'),path=require('node:path');
 const {createStore}=require('../../server/store.cjs');
 const parent=path.resolve('.local');await fs.mkdir(parent,{recursive:true});
 const dir=await fs.mkdtemp(path.join(parent,'regression-'));
 let first,second,restored;
 try{
  first=await createStore(path.join(dir,'postgres'),'disk-test-token');
  await first.setup({token:'disk-test-token',email:'disk@modisto.test',name:'Disk test',password});
  let user=(await first.login('disk@modisto.test',password)).user;
  const source=fixture(),plan=await first.importPlan(user,source);
  await first.importCommit(user,source,plan.digest);
  const before=await first.snapshot(user),events=await first.audit(user);await first.close();first=null;
  second=await createStore(path.join(dir,'postgres'),'disk-test-token');
  assert.equal(await second.setupRequired(),false);user=(await second.login('disk@modisto.test',password)).user;
  const exported=await second.snapshot(user);assert.deepEqual(exported,before);assert.deepEqual(await second.audit(user),events);
  restored=await createStore('memory://','restore-token');await restored.setup({token:'restore-token',email:'restore@modisto.test',name:'Restore test',password});
  const owner=(await restored.login('restore@modisto.test',password)).user,preview=await restored.importPlan(owner,exported.database);
  await restored.importCommit(owner,exported.database,preview.digest);
  assert.deepEqual((await restored.snapshot(owner)).database,exported.database);
 }finally{
  if(first)await first.close();if(second)await second.close();if(restored)await restored.close();
  if(!path.resolve(dir).startsWith(parent+path.sep))throw new Error('Unexpected test cleanup path');
  await fs.rm(dir,{recursive:true,force:true});
 }
});
