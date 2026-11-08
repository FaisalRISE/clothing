const {clone,STAGES}=require('../shared/data.cjs');
const fields=require('../shared/measurement-fields.json');
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value||{},key)).map(key=>[key,clone(value[key])]));
const STEP_FIELDS=['key','label','stage','done','doneDate','scheduledDate','daysTaken','assignedTo','notes','trialNumber'];
function safeMeasurement(version) {
 const source=version?.snapshot;
 if(!source)return null;
 return {...pick(source,['unit','date','measuredBy','notes']),measures:pick(source.measures,fields.measures),ticks:pick(source.ticks,fields.ticks),texts:pick(source.texts,fields.texts)};
}
function projectJobs(database,versions,previous=[]) {
 const result=[];
 for(const order of Object.values(database.orders))for(const job of order.garmentJobs||[]) {
  let employeeId=job.makerId;
  if(!employeeId) {
   const old=previous.find(row=>row.id===job.id);
   const candidates=Object.values(database.employees).filter(employee=>employee.name===job.maker);
   employeeId=old?.payload.job.maker===job.maker ? old.employee_id : candidates.length===1 ? candidates[0].id : null;
  }
  if(!database.employees[employeeId])continue;
  const measurementVersion=database.measurementVersions[job.measurementVersionId];
  if(measurementVersion && (measurementVersion.clientId!==order.clientId || measurementVersion.snapshot.clientId!==order.clientId))throw new Error('Invalid client measurement link.');
  const swatch=Object.values(database.swatches).find(s=>s.code===job.swatchCode);
  result.push({id:job.id,employeeId,orderId:order.id,orderVersion:versions['orders/'+order.id],payload:{
   id:job.id,orderId:order.id,orderNo:order.orderNo,clientName:database.clients[order.clientId]?.name||'Client',
   job:{...pick(job,['id','type','label','maker','swatchCode','status','notes','cancellation']),workflow:(job.workflow||[]).map(step=>pick(step,STEP_FIELDS))},
   measurement:safeMeasurement(measurementVersion),swatch:swatch?pick(swatch,['code','colorName','book','composition']):null
  }});
 }
 return result;
}
function updateWorkshopJob(order,jobId,input) {
 const job=order.garmentJobs.find(item=>item.id===jobId);
 if(!job || job.cancellation || job.status==='Delivered')throw new Error('This garment is not active workshop work.');
 if(!STAGES.slice(0,-1).includes(input.status))throw new Error('Only office staff can record delivery.');
 if(!Array.isArray(input.workflow) || input.workflow.length!==job.workflow.length)throw new Error('Workshop staff cannot add or remove tasks.');
 const workflow=job.workflow.map((step,index)=>{
  const edit=input.workflow[index];
  if(edit.key!==step.key || typeof edit.done!=='boolean' || typeof edit.notes!=='string')throw new Error('Invalid task update.');
  if(edit.doneDate && !/^\d{4}-\d{2}-\d{2}$/.test(edit.doneDate))throw new Error('Invalid completion date.');
  return {...step,done:edit.done,doneDate:edit.done?(edit.doneDate||new Date().toISOString().slice(0,10)):'',notes:edit.notes};
 });
 const changed={...clone(job),status:input.status,workflow};
 const prior=clone(job);delete prior.history;
 const after=clone(changed);delete after.history;
 changed.updatedAt=new Date().toISOString();
 changed.history=[...(job.history||[]),{at:changed.updatedAt,kind:'Workshop update',before:prior,after}];
 const next=clone(order);next.garmentJobs=next.garmentJobs.map(item=>item.id===jobId?changed:item);
 const active=next.garmentJobs.filter(item=>!item.cancellation);
 next.status=active.length?STAGES[Math.min(...active.map(item=>STAGES.indexOf(item.status))) ]:'Cancelled';
 return next;
}
module.exports={projectJobs,updateWorkshopJob,safeMeasurement};
