const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests/shared-browser',workers:1,timeout:60000,
 use:{launchOptions:{channel:'chrome'}},
 projects:[
  {name:'desktop',use:{viewport:{width:1440,height:1000}}},
  {name:'tablet',use:{viewport:{width:820,height:1180},hasTouch:true}},
  {name:'tablet-landscape',use:{viewport:{width:1024,height:768},hasTouch:true}},
  {name:'phone',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}
 ]
});
