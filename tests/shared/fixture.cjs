const fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const html=fs.readFileSync('index.html','utf8');
 const source=html.slice(html.indexOf('const SCHEMA ='),html.indexOf('/* ---------------- HELPERS'));
 const context=vm.createContext({URLSearchParams,location:{search:'?demo=1'},localStorage:{getItem:()=>null},console});
 vm.runInContext(source,context);
 return JSON.parse(vm.runInContext(`JSON.stringify((()=>{
  const data=getSeedData(),versions={};
  const id=captureGarmentMeasurement('m_demo_3',data,versions);
  data.measurementVersions=versions;
  data.orders.o_3.garmentJobs=makeGarmentJobs('suit2',1,{measurementVersionId:id,maker:'Demo Jacket Maker',swatchCode:'SW-2089'});
  data.clients.c_demo_3.phone='PRIVATE-CONTACT-DO-NOT-SHARE';
  data.clients.c_demo_3.email='private-contact@modisto.test';
  data.orders.o_3.amount=135791;
  data.legacyMetadata={retain:'unchanged'};
  return data;
 })())`,context));
}
module.exports={fixture};
