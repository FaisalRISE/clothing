'use strict';
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt);
const D=require('../shared/data.cjs');
const {projectJobs,updateWorkshopJob}=require('./projection.cjs');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const publicUser=user=>({id:user.id,email:user.email,name:user.name,role:user.role,employeeId:user.employee_id});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

async function createStore(dataDir,bootstrapToken) {
 const db=await PGlite.create(dataDir);
 let settingUp=false;
 if(!(await db.query("select to_regclass('modisto.records') as present")).rows[0].present)await db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
 const role=async(tx,user,run)=>{
  await tx.query("select set_config('modisto.actor_id',$1,true)",[user.id]);
  await tx.exec('set local role modisto_staff');
  try{return await run(tx);}finally{await tx.exec('reset role');}
 };
 const rows=async tx=>(await tx.query('select * from modisto.records')).rows.map(row=>({...row,version:Number(row.version)}));
 const snapshotRows=records=>({database:D.assemble(records),versions:Object.fromEntries(records.map(row=>[D.rowKey(row),row.version]))});
 const audit=async(tx,user,action,collection=null,id=null,before=null,after=null)=>tx.query('insert into modisto.audit(actor,action,collection,record_id,before_value,after_value) values($1,$2,$3,$4,$5,$6)',[user.id,action,collection,id,before,after]);
 const refreshProjection=async tx=>{
  const records=await rows(tx),snapshot=snapshotRows(records);
  const old=(await tx.query('select * from modisto.workshop_jobs')).rows;
  const jobs=projectJobs(snapshot.database,snapshot.versions,old);
  await tx.exec('delete from modisto.workshop_jobs');
  for(const job of jobs)await tx.query('insert into modisto.workshop_jobs(id,employee_id,order_id,order_version,payload) values($1,$2,$3,$4,$5)',[job.id,job.employeeId,job.orderId,job.orderVersion,job.payload]);
 };
 async function addUser(input) {
  const email=String(input.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!String(input.name||'').trim())throw fail('Enter a name and valid email.');
  if(typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw fail('Use a password between 12 and 128 characters.');
  if(!['owner','office','workshop'].includes(input.role))throw fail('Invalid role.');
  if(input.role==='workshop' && !(await db.query("select 1 from modisto.records where collection='employees' and id=$1 and not deleted",[input.employeeId])).rows.length)throw fail('Choose an existing employee for workshop access.');
  const salt=crypto.randomBytes(16).toString('hex');
  const passwordHash=(await scrypt(input.password,salt,64)).toString('hex');
  const user={id:crypto.randomUUID(),email,name:input.name.trim(),role:input.role,employee_id:input.role==='workshop'?input.employeeId:null};
  await db.query('insert into modisto_private.users(id,email,name,salt,password_hash,role,employee_id) values($1,$2,$3,$4,$5,$6,$7)',[user.id,email,user.name,salt,passwordHash,user.role,user.employee_id]);
  return publicUser(user);
 }
 async function getSnapshot(user) {
  return db.transaction(tx=>role(tx,user,async tx=>{
   if(user.role==='workshop')return {jobs:(await tx.query('select id,order_version,payload from modisto.workshop_jobs order by id')).rows.map(row=>({...row.payload,orderVersion:Number(row.order_version)}))};
   return snapshotRows(await rows(tx));
  }));
 }
 async function apply(user,patch,{importing=false}={}) {
  if(!['owner','office'].includes(user.role))throw fail('Office access required.',403);
  if(!Array.isArray(patch)||patch.length>10000)throw fail('Invalid or oversized change set.');
  const keys=new Set();
  for(const change of patch) {
   if(![...D.COLLECTIONS,'settings','metadata'].includes(change.collection)||typeof change.id!=='string'||!change.id||keys.has(D.rowKey(change)))throw fail('Invalid or duplicate record.');
   if((change.collection==='settings'&&change.id!=='global')||(change.collection==='metadata'&&change.id!=='root'))throw fail('Invalid workspace record identity.');
   keys.add(D.rowKey(change));
   if(!Number.isSafeInteger(change.expectedVersion)||change.expectedVersion<0)throw fail('Invalid record version.');
   if(change.payload!==null&&!D.object(change.payload))throw fail('Invalid record value.');
   if(D.COLLECTIONS.includes(change.collection)&&change.payload!==null&&change.payload.id!==change.id)throw fail('Record identity mismatch.');
   if(user.role!=='owner'&&['settings','metadata'].includes(change.collection))throw fail('Owner access required for workspace settings.',403);
  }
  await db.transaction(async tx=>{
   const before=await rows(tx),byKey=new Map(before.map(row=>[D.rowKey(row),row]));
   for(const change of patch) {
    const prior=byKey.get(D.rowKey(change));
    if((prior?.version||0)!==change.expectedVersion)throw fail('This record changed on another device. Refresh the saved records before retrying.',409);
    if(importing&&prior&&!prior.deleted&&D.canonical(prior.payload)!==D.canonical(change.payload)&&!['settings','metadata'].includes(change.collection))throw fail('Import conflicts must be resolved before committing.',409);
    D.validateChange(prior?.deleted?null:prior?.payload,change.payload,change.collection);
    byKey.set(D.rowKey(change),{...change,deleted:change.payload===null});
   }
   D.validateReferences(D.assemble([...byKey.values()]));
   await role(tx,user,async tx=>{
    for(const change of patch)await tx.query(`insert into modisto.records(collection,id,payload,deleted) values($1,$2,$3,$4)
      on conflict(collection,id) do update set payload=excluded.payload,deleted=excluded.deleted,version=nextval('modisto.revisions')`,[change.collection,change.id,change.payload,change.payload===null]);
   });
   for(const change of patch)await audit(tx,user,importing?'Import':'Record saved',change.collection,change.id,byKeyBefore(before,change),change.payload);
   await refreshProjection(tx);
  });
  return getSnapshot(user);
 }
 function byKeyBefore(before,change){return before.find(row=>D.rowKey(row)===D.rowKey(change))?.payload??null;}
 return {
  db,close:()=>db.close(),
  setupRequired:async()=>!(await db.query('select 1 from modisto_private.users limit 1')).rows.length,
  async setup(input) {
   if(settingUp)throw fail('Owner setup is already in progress.',409);
   settingUp=true;
   try {
    if(!await this.setupRequired())throw fail('The owner is already configured.',409);
    if(input.token!==bootstrapToken)throw fail('Invalid setup token.',403);
    return await addUser({...input,role:'owner'});
   }finally{settingUp=false;}
  },
  async login(email,password) {
   const user=(await db.query('select * from modisto_private.users where email=$1 and enabled',[String(email||'').trim().toLowerCase()])).rows[0];
   const candidate=await scrypt(String(password||''),user?.salt||'no-account',64);
   if(!user||!crypto.timingSafeEqual(candidate,Buffer.from(user.password_hash,'hex')))throw fail('Invalid email or password.',401);
   const token=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(24).toString('hex');
   await db.query("insert into modisto_private.sessions values($1,$2,$3,now()+interval '1 hour')",[hash(token),user.id,csrf]);
   return {token,csrf,user:publicUser(user)};
  },
  async session(token) {
   if(!token)return null;
   const row=(await db.query('select u.*,s.csrf from modisto_private.sessions s join modisto_private.users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now() and u.enabled',[hash(token)])).rows[0];
   return row?{...publicUser(row),csrf:row.csrf}:null;
  },
  async logout(token){await db.query('delete from modisto_private.sessions where token_hash=$1',[hash(token||'')]);},
  snapshot:getSnapshot,apply,
  async staff(user) {
   if(user.role!=='owner')throw fail('Owner access required.',403);
   return (await db.query('select id,email,name,role,employee_id,enabled from modisto_private.users order by email')).rows.map(row=>({...publicUser(row),enabled:row.enabled}));
  },
  async createUser(user,input) {
   if(user.role!=='owner')throw fail('Owner access required.',403);
   const created=await addUser(input);await audit(db,user,'Staff account created',null,created.id,null,created);return created;
  },
  async disableUser(user,id) {
   if(user.role!=='owner'||id===user.id)throw fail('An owner cannot disable their own active account.',403);
   await db.query('update modisto_private.users set enabled=false where id=$1',[id]);
   await db.query('delete from modisto_private.sessions where user_id=$1',[id]);
   await audit(db,user,'Staff account disabled',null,id);
  },
  async importPlan(user,input) {
   if(user.role!=='owner')throw fail('Owner access required.',403);
   const current=await getSnapshot(user);return {...D.planImport(input,current.database),digest:hash(D.canonical(input))};
  },
  async importCommit(user,input,digest) {
   const plan=await this.importPlan(user,input);
   if(plan.digest!==digest||plan.conflicts.length)throw fail('Import changed or has conflicting record IDs.',409);
   const current=await getSnapshot(user);
   return apply(user,plan.insert.map(row=>({...row,expectedVersion:current.versions[D.rowKey(row)]||0})),{importing:true});
  },
  async audit(user){if(user.role!=='owner')throw fail('Owner access required.',403);return db.transaction(tx=>role(tx,user,async tx=>(await tx.query('select * from modisto.audit order by id desc limit 1000')).rows));},
  async updateJob(user,id,input,expectedVersion) {
   if(user.role!=='workshop')throw fail('Workshop access required.',403);
   const permitted=await db.transaction(tx=>role(tx,user,async tx=>(await tx.query('select * from modisto.workshop_jobs where id=$1',[id])).rows[0]));
   if(!permitted)throw fail('Job not assigned to this account.',403);
   await db.transaction(async tx=>{
    const row=(await tx.query("select * from modisto.records where collection='orders' and id=$1",[permitted.order_id])).rows[0];
    if(Number(row.version)!==expectedVersion)throw fail('This order changed. Reload this job before saving.',409);
    const currentAssignment=(await tx.query('select * from modisto.workshop_jobs where id=$1 and employee_id=$2',[id,user.employeeId])).rows[0];
    if(!currentAssignment)throw fail('Assignment changed.',403);
    const next=updateWorkshopJob(row.payload,id,input);
    await tx.query("update modisto.records set payload=$1,version=nextval('modisto.revisions') where collection='orders' and id=$2",[next,permitted.order_id]);
    await audit(tx,user,'Workshop progress saved','orders',permitted.order_id,row.payload,next);
    await refreshProjection(tx);
   });
   return getSnapshot(user);
  }
 };
}
module.exports={createStore,fail,hash};
