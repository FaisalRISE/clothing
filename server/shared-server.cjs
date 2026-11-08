'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createStore,fail}=require('./store.cjs');
const root=path.resolve(__dirname,'..');
async function start({port=4188,dataDir=path.join(root,'.local','shared-staging'),bootstrapToken}={}) {
 if(dataDir!=='memory://')fs.mkdirSync(dataDir,{recursive:true});
 const tokenFile=path.join(dataDir,'first-owner-token.txt');
 if(!bootstrapToken) {
  bootstrapToken=fs.existsSync(tokenFile)?fs.readFileSync(tokenFile,'utf8').trim():crypto.randomBytes(24).toString('hex');
  if(!fs.existsSync(tokenFile))fs.writeFileSync(tokenFile,bootstrapToken+'\n',{mode:0o600});
 }
 const store=await createStore(dataDir==='memory://'?'memory://':path.join(dataDir,'postgres'),bootstrapToken);
 const limits=new Map();
 const server=http.createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try {
   const allowed=['127.0.0.1:'+server.address().port,'localhost:'+server.address().port];
   if(!allowed.includes(req.headers.host))throw fail('Local staging accepts loopback hosts only.',403);
   const url=new URL(req.url,'http://'+req.headers.host);
   res.setHeader('X-Content-Type-Options','nosniff');
   res.setHeader('Referrer-Policy','no-referrer');
   res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'");
   if(!url.pathname.startsWith('/api/')) {
    if(req.method!=='GET')throw fail('Method not allowed.',405);
    const files={'/':'index.html','/index.html':'index.html','/shared-client.js':'shared/client.js','/shared-data.js':'shared/data.cjs'};
    if(!files[url.pathname])throw fail('Not found.',404);
    let body=fs.readFileSync(path.join(root,files[url.pathname]),'utf8');
    if(url.pathname==='/'||url.pathname==='/index.html')body=body.replace('<script>','<script src="/shared-data.js"></script><script src="/shared-client.js"></script>\n<script>');
    res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(body);
   }
   const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('modisto_local_sid='))?.slice(18);
   const user=await store.session(token);
   let body={};
   if(req.method!=='GET') {
    if(!allowed.some(host=>req.headers.origin==='http://'+host))throw fail('Invalid request origin.',403);
    if(!req.headers['content-type']?.startsWith('application/json'))throw fail('JSON requests are required.',415);
    let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8*1024*1024)throw fail('Request exceeds the 8 MB staging limit.',413);}
    try{body=JSON.parse(text||'{}');}catch{throw fail('Invalid JSON.');}
   }
   if(req.method==='GET'&&url.pathname==='/api/session')return send(200,{user,setupRequired:await store.setupRequired()});
   if(req.method==='POST'&&url.pathname==='/api/setup')return send(201,{user:await store.setup(body)});
   if(req.method==='POST'&&url.pathname==='/api/login') {
    const key=String(body.email||'').toLowerCase();
    const entry=limits.get(key)||{count:0,until:Date.now()+600000};
    if(entry.until<Date.now()){entry.count=0;entry.until=Date.now()+600000;}
    if(entry.count>=6)throw fail('Too many attempts. Try again in ten minutes.',429);
    try {
     const login=await store.login(body.email,body.password);limits.delete(key);
     res.setHeader('Set-Cookie','modisto_local_sid='+login.token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600');
     return send(200,{user:{...login.user,csrf:login.csrf}});
    }catch(error){entry.count++;limits.set(key,entry);throw error;}
   }
   if(!user)throw fail('Sign in to local staging.',401);
   if(req.method!=='GET'&&req.headers['x-csrf-token']!==user.csrf)throw fail('Invalid session request.',403);
   if(req.method==='POST'&&url.pathname==='/api/logout') {
    await store.logout(token);res.setHeader('Set-Cookie','modisto_local_sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');return send(200,{ok:true});
   }
   if(req.method==='GET'&&url.pathname==='/api/snapshot')return send(200,await store.snapshot(user));
   if(req.method==='POST'&&url.pathname==='/api/commit')return send(200,await store.apply(user,body.changes));
   if(req.method==='GET'&&url.pathname==='/api/staff')return send(200,{staff:await store.staff(user)});
   if(req.method==='POST'&&url.pathname==='/api/staff')return send(201,{user:await store.createUser(user,body)});
   if(req.method==='POST'&&url.pathname==='/api/staff/disable'){await store.disableUser(user,body.id);return send(200,{ok:true});}
   if(req.method==='POST'&&url.pathname==='/api/import/preview')return send(200,await store.importPlan(user,body.database));
   if(req.method==='POST'&&url.pathname==='/api/import/commit')return send(200,await store.importCommit(user,body.database,body.digest));
   if(req.method==='GET'&&url.pathname==='/api/audit')return send(200,{audit:await store.audit(user)});
   if(req.method==='POST'&&url.pathname==='/api/workshop/job')return send(200,await store.updateJob(user,body.id,body.job,body.expectedVersion));
   throw fail('Not found.',404);
  }catch(error){send(error.status||400,{error:error.message});}
 });
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return {server,store,port:server.address().port,close:()=>new Promise(resolve=>server.close(async()=>{await store.close();resolve();}))};
}
if(require.main===module)start().then(app=>{
 console.log('Local Modisto staging: http://127.0.0.1:'+app.port+'/');
 console.log('Synthetic/local testing only. First-owner token: .local/shared-staging/first-owner-token.txt');
}).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={start};
