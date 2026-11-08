/* Local-only shared staging controller. No hosted URL or browser database cache. */
(() => {
 'use strict';
 const D=globalThis.ModistoData;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const $=selector=>document.querySelector(selector);
 const root=document.createElement('section');root.id='sharedRoot';document.body.append(root);
 const style=document.createElement('style');style.textContent=`
 body.shared-locked .app,body.shared-locked #actionbar{display:none!important}
 .app [data-v][hidden]{display:none!important}
 #sharedRoot{max-width:960px;margin:20px auto;padding:0 16px}
 .shared-auth{max-width:440px;margin:40px auto}.shared-auth input{width:100%;margin:5px 0 12px;padding:10px}
 .shared-bar{padding:10px;background:#fff2cf;border:1px solid #ae8741;margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
 .shared-bar span{flex:1;min-width:160px}.shared-error{color:#9c2626;white-space:pre-wrap}
 .shared-data{overflow-wrap:anywhere}.shared-data textarea{width:100%;min-height:70px}
 @media print{.shared-bar,#sharedRoot .actions{display:none!important}}
 `;document.head.append(style);
 const app={enabled:true,user:null,base:null,versions:{},busy:false,uncertain:null,hooks:null,poll:null};
 async function request(url,body) {
  const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':app.user?.csrf||''},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const result=await response.json();
  if(!response.ok) {
   if(response.status===401&&app.user)setTimeout(endSession,0);
   throw Object.assign(new Error(result.error||'Shared request failed.'),{status:response.status});
  }
  return result;
 }
 function lock(value){document.body.classList.toggle('shared-locked',value);root.hidden=!value;}
 function endSession() {
  if(app.user)sessionStorage.removeItem('modisto-local-preferences-'+app.user.id);
  app.user=null;app.base=null;app.versions={};app.jobs=[];app.uncertain=null;
  clearInterval(app.poll);app.hooks.clear();renderAuth();
 }
 function busy(value,message='Saving to local server…'){app.busy=value;app.busyMessage=message;$('#main').inert=value;$('#modal').inert=value;root.inert=value;renderControls();}
 function failure(error){$('#sharedError')?.replaceChildren(document.createTextNode(error.message));}
 function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
 function remember(snapshot) {
  app.base=app.hooks.normalize(snapshot.database);app.versions=snapshot.versions;
  const preferences=JSON.parse(sessionStorage.getItem('modisto-local-preferences-'+app.user.id)||'{}');
  Object.assign(app.base.settings,preferences);app.base.settings.appsScriptUrl='';
 }
 async function load() {
  busy(true,'Loading shared records…');
  try {
   const snapshot=await request('/api/snapshot');app.uncertain=null;
   if(app.user.role==='workshop'){app.jobs=snapshot.jobs;showWorkshop();}
   else {remember(snapshot);lock(false);app.hooks.activate(D.clone(app.base));}
  }finally{busy(false);}
 }
 async function refresh() {
  if(app.busy)return;
  if((app.hooks.dirty()||app.uncertain)&&!confirm('Discard the current unsaved form and load the shared records? Download an unconfirmed draft first if needed.'))return;
  await load();
 }
 function renderAuth(setupRequired=false) {
  lock(true);$('#modal').replaceChildren();$('#overlay').classList.remove('on');
  root.innerHTML=`<div class="card shared-auth"><h1>Modisto local staging</h1><p>Local test environment. No hosted service or live records are connected.</p>
   <form id="sharedAuthForm">${setupRequired?'<h2>Create the first owner</h2><label>Setup token<input id="sharedSetupToken" autocomplete="off" required></label><label>Name<input id="sharedName" required></label>':''}
   <label>Email<input id="sharedEmail" type="email" autocomplete="username" required></label><label>Password<input id="sharedPassword" type="password" autocomplete="${setupRequired?'new-password':'current-password'}" minlength="12" maxlength="128" required></label>
   <p id="sharedError" class="shared-error" role="alert"></p><button class="btn primary" id="sharedLogin">${setupRequired?'Create owner and sign in':'Sign in'}</button></form>
   ${setupRequired?'<p>The setup token is in <code>.local/shared-staging/first-owner-token.txt</code>. Use synthetic test records.</p>':''}</div>`;
  $('#sharedAuthForm').onsubmit=async event=>{
   event.preventDefault();$('#sharedLogin').disabled=true;
   const email=$('#sharedEmail').value,password=$('#sharedPassword').value;
   try {
    if(setupRequired)await request('/api/setup',{token:$('#sharedSetupToken').value,name:$('#sharedName').value,email,password});
    const login=await request('/api/login',{email,password});app.user=login.user;await load();beginPoll();
   }catch(error){failure(error);if($('#sharedLogin'))$('#sharedLogin').disabled=false;}
  };
 }
 function controls() {
  return `<div class="shared-bar no-print"><b>LOCAL STAGING</b><span>${esc(app.user.name)} · ${esc(app.user.role)} · <b id="sharedSaveState">${app.busy?esc(app.busyMessage):app.uncertain?'Save not confirmed — download draft and refresh':'Shared records loaded'}</b></span>
   <button class="btn sm" id="sharedRefresh" ${app.busy?'disabled':''}>Refresh</button>
   ${app.user.role==='owner'?'<button class="btn sm" id="sharedStaff">Staff access</button><button class="btn sm" id="sharedImport">Import preview</button>':''}
   ${app.user.role!=='workshop'?'<button class="btn sm" id="sharedExport">Export records</button>':''}
   ${app.uncertain?'<button class="btn sm" id="sharedDraft">Download unconfirmed draft</button>':''}
   <button class="btn sm" id="sharedLogout" ${app.busy?'disabled':''}>Sign out</button></div>`;
 }
 function bindControls() {
  $('#sharedRefresh').onclick=()=>refresh().catch(error=>alert(error.message));
  $('#sharedLogout').onclick=async()=>{
   if((app.hooks.dirty()||app.uncertain)&&!confirm('Sign out and discard unsaved form changes? Download any unconfirmed draft first.'))return;
   try {await request('/api/logout',{});}catch(error){alert(error.message);return;}
   endSession();
  };
  if($('#sharedExport'))$('#sharedExport').onclick=()=>download(app.base,'modisto-shared-local-backup.json');
  if($('#sharedDraft'))$('#sharedDraft').onclick=()=>download(app.uncertain,'modisto-unconfirmed-draft.json');
  if($('#sharedStaff'))$('#sharedStaff').onclick=()=>staff().catch(error=>alert(error.message));
  if($('#sharedImport'))$('#sharedImport').onclick=()=>importDialog();
 }
 function renderControls() {
  if(!app.user)return;
  $('#sharedControls')?.remove();
  const holder=document.createElement('div');holder.id='sharedControls';holder.innerHTML=controls();(app.user.role==='workshop'?root:$('#main')).prepend(holder);bindControls();
  document.querySelectorAll('[data-v="settings"]').forEach(element=>element.hidden=app.user.role!=='owner');
 }
 function beginPoll() {
  clearInterval(app.poll);app.poll=setInterval(async()=>{
   if(app.busy||!app.user)return;
   try {
    const snapshot=await request('/api/snapshot');
    const changed=app.user.role==='workshop'?D.canonical(snapshot.jobs)!==D.canonical(app.jobs):D.canonical(snapshot.versions)!==D.canonical(app.versions);
    if(changed&&$('#sharedSaveState'))$('#sharedSaveState').textContent='Changes available on the server — Refresh';
   }catch(error){if($('#sharedSaveState'))$('#sharedSaveState').textContent=error.status===401?'Session expired — sign in again':'Server unavailable; current form retained';}
  },5000);
 }
 async function staff() {
  const result=await request('/api/staff');
  const employees=Object.values(app.base.employees);
  app.hooks.openModal(`<h2>Local staff access</h2><p>Accounts are local test accounts. No invitation email is sent.</p>
   ${result.staff.map(user=>`<p>${esc(user.name)} · ${esc(user.email)} · ${esc(user.role)} · ${user.enabled?'Enabled':'Disabled'} ${user.id!==app.user.id&&user.enabled?`<button class="btn sm" data-disable-staff="${esc(user.id)}">Disable</button>`:''}</p>`).join('')}
   <form id="sharedStaffForm"><div class="field"><label>Name<input id="staffName" required></label></div><div class="field"><label>Email<input id="staffEmail" type="email" required></label></div>
   <div class="field"><label>Temporary test password<input id="staffPassword" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label></div>
   <div class="field"><label>Role<select id="staffRole"><option value="office">Office</option><option value="workshop">Workshop</option><option value="owner">Owner</option></select></label></div>
   <div class="field"><label>Workshop employee<select id="staffEmployee"><option value="">Choose for workshop role</option>${employees.map(e=>`<option value="${esc(e.id)}">${esc(e.name)} · ${esc(e.id)}</option>`).join('')}</select></label></div>
   <p id="sharedError" class="shared-error" role="alert"></p><div class="actions"><button type="button" class="btn" id="staffClose">Close</button><button class="btn primary" id="staffCreate">Create test account</button></div></form>`);
  $('#staffClose').onclick=app.hooks.closeModal;
  document.querySelectorAll('[data-disable-staff]').forEach(button=>button.onclick=async()=>{try{await request('/api/staff/disable',{id:button.dataset.disableStaff});await staff();}catch(error){failure(error);}});
  $('#sharedStaffForm').onsubmit=async event=>{
   event.preventDefault();$('#staffCreate').disabled=true;
   try {await request('/api/staff',{name:$('#staffName').value,email:$('#staffEmail').value,password:$('#staffPassword').value,role:$('#staffRole').value,employeeId:$('#staffEmployee').value});await staff();}
   catch(error){failure(error);$('#staffCreate').disabled=false;}
  };
 }
 function importDialog() {
  let database,plan;
  app.hooks.openModal(`<h2>Preview a local staging import</h2><p>Use a synthetic test backup. Nothing is uploaded or replaced until you confirm. Conflicting IDs are blocked.</p>
   <input id="sharedImportFile" type="file" accept="application/json"><div id="sharedImportPlan"></div><p id="sharedError" class="shared-error" role="alert"></p>
   <div class="actions"><button class="btn" id="importClose">Close</button><button class="btn primary" id="importCommit" disabled>Import reviewed records</button></div>`);
  $('#importClose').onclick=app.hooks.closeModal;
  $('#sharedImportFile').onchange=async()=>{
   try {database=JSON.parse(await $('#sharedImportFile').files[0].text());plan=await request('/api/import/preview',{database});
    $('#sharedImportPlan').textContent=plan.insert.length+' new records; '+plan.identical.length+' identical; '+plan.conflicts.length+' conflicts. '+(plan.conflicts.join(', '));$('#importCommit').disabled=Boolean(plan.conflicts.length);
   }catch(error){plan=null;$('#importCommit').disabled=true;failure(error);}
  };
  $('#importCommit').onclick=async()=>{try{await request('/api/import/commit',{database,digest:plan.digest});app.hooks.closeModal();await load();}catch(error){failure(error);}};
 }
 function showWorkshop() {
  lock(true);root.innerHTML='<div id="sharedControls">'+controls()+'</div>'+`<h1>Assigned workshop jobs</h1><p>Only your assigned garments and saved measurement copies are available.</p><div class="garment-grid">${app.jobs.map(item=>`
   <article class="card shared-data" data-shared-job="${esc(item.id)}"><h2>${esc(item.job.label)}</h2><p>${esc(item.clientName)} · ${esc(item.orderNo)}</p><p>${esc(item.job.cancellation?'Cancelled':item.job.status)} · ${esc(item.job.maker)} · ${esc(item.job.swatchCode)}</p>
   <p>${esc(item.job.notes)}</p><details><summary>Saved measurement copy</summary>${item.measurement?`<p>${esc(item.measurement.date)} · ${esc(item.measurement.unit)}</p>${['measures','ticks','texts'].map(group=>Object.entries(item.measurement[group]).map(([key,value])=>`<p><b>${esc(key)}:</b> ${value===''?'—':esc(value)}${group==='measures'&&value!==''?' '+esc(item.measurement.unit):''}</p>`).join('')).join('')}<p>${esc(item.measurement.notes)}</p>`:'<p>No measurement copy assigned.</p>'}</details>
   <button class="btn" data-workshop-edit="${esc(item.id)}" ${item.job.cancellation||item.job.status==='Delivered'?'disabled':''}>Update progress</button></article>`).join('')||'<p>No assigned garments.</p>'}</div>`;bindControls();
  document.querySelectorAll('[data-workshop-edit]').forEach(button=>button.onclick=()=>editWorkshop(button.dataset.workshopEdit));
 }
 function editWorkshop(id) {
  const item=app.jobs.find(job=>job.id===id);
  app.hooks.openModal(`<h2>${esc(item.job.label)} · Workshop progress</h2><label>Stage<select id="workshopStage">${D.STAGES.slice(0,-1).map(stage=>`<option ${stage===item.job.status?'selected':''}>${esc(stage)}</option>`).join('')}</select></label>
   <div class="garment-tasks">${item.job.workflow.map((step,i)=>`<div class="garment-task"><label><input type="checkbox" data-workshop-done="${i}" ${step.done?'checked':''}>${esc(step.label)}</label><input type="date" data-workshop-date="${i}" aria-label="Completed date ${esc(step.label)}" value="${esc(step.doneDate||'')}"><input data-workshop-note="${i}" aria-label="Notes ${esc(step.label)}" value="${esc(step.notes||'')}"></div>`).join('')}</div>
   <p id="sharedError" class="shared-error" role="alert"></p><div class="actions"><button class="btn" id="workshopClose">Cancel</button><button class="btn primary" id="workshopSave">Save workshop progress</button></div>`);
  $('#workshopClose').onclick=app.hooks.closeModal;
  $('#workshopSave').onclick=async()=>{
   $('#workshopSave').disabled=true;
   try {
    const job={status:$('#workshopStage').value,workflow:item.job.workflow.map((step,i)=>({...step,done:$(`[data-workshop-done="${i}"]`).checked,doneDate:$(`[data-workshop-date="${i}"]`).value,notes:$(`[data-workshop-note="${i}"]`).value}))};
    const result=await request('/api/workshop/job',{id,job,expectedVersion:item.orderVersion});app.jobs=result.jobs;app.hooks.closeModal();showWorkshop();
   }catch(error){failure(error);$('#workshopSave').disabled=false;}
  };
 }
 app.commit=async next=>{
  if(app.busy)throw new Error('A shared save is already in progress.');
  if(app.uncertain)throw new Error('A previous save was not confirmed. Download its draft and refresh before saving again.');
  if(!app.user||app.user.role==='workshop')throw new Error('Office access is required.');
  const patch=D.changes(app.base,next,app.versions);const preferences=Object.fromEntries(D.UI_SETTINGS.map(key=>[key,next.settings[key]]));
  busy(true);
  try {
   const result=patch.length?await request('/api/commit',{changes:patch}):{database:app.base,versions:app.versions};
   sessionStorage.setItem('modisto-local-preferences-'+app.user.id,JSON.stringify(preferences));remember(result);
   for(const key of Object.keys(next))delete next[key];Object.assign(next,D.clone(app.base));app.hooks.saved();
  }catch(error){
   if(!error.status)app.uncertain=D.clone(next);
   throw new Error((error.status===409?'Conflict. ':error.status?'Save rejected. ':'Save not confirmed. ')+error.message+' Your form has been retained.');
  }finally{busy(false);}
 };
 app.snapshot=()=>D.clone(app.base||app.hooks.normalize({clients:{}}));
 app.renderControls=renderControls;
 app.openImport=()=>{if(app.user?.role!=='owner')throw new Error('Owner access required.');importDialog();};
 app.canNavigate=name=>app.user&&app.user.role!=='workshop'&&(name!=='settings'||app.user.role==='owner');
 app.boot=async hooks=>{app.hooks=hooks;const session=await request('/api/session');app.user=session.user;if(app.user){await load();beginPoll();}else renderAuth(session.setupRequired);};
 window.addEventListener('beforeunload',event=>{if(app.busy||app.uncertain||app.hooks?.dirty()){event.preventDefault();event.returnValue='';}});
 globalThis.ModistoShared=app;
})();
