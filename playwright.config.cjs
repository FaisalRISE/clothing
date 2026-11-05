const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4187', launchOptions: { channel: 'chrome' } },
  projects: [
    { name: 'desktop', use: { viewport: {width:1440,height:1000} } },
    { name: 'tablet', use: { viewport: {width:820,height:1180}, hasTouch:true } },
    { name: 'tablet-landscape', use: { viewport: {width:1024,height:768}, hasTouch:true } }
  ],
  webServer: { command:'node scripts/serve.cjs', url:'http://127.0.0.1:4187', reuseExistingServer:true }
});
