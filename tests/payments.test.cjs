const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../shared/payments.js');
const D=require('../shared/data.cjs');
const at='2026-11-21T12:00:00.000Z';
const input={kind:'receipt',date:'2026-11-21',amount:'0.20',note:'Cash receipt'};
const add=(order,extra={},id='p1')=>P.append(order,{...input,...extra},id,at);

test('payments preserve legacy totals, metadata, completed tasks and financial fields; arithmetic uses minor units',()=>{
  const before={currency:'GBP',advancePaid:0.1,amount:50,custom:'keep',workflow:[{done:true,doneDate:'2026-11-01'}],fabricMeters:3,commercialAdjustments:[{reason:'keep'}]};
  const snapshot=structuredClone(before),after=add(before);
  assert.deepEqual(before,snapshot);
  assert.equal(after.advancePaid,0.3);assert.equal(after.paymentLedger.openingMinor,10);
  assert.deepEqual({...after,advancePaid:before.advancePaid,paymentLedger:undefined},{...before,paymentLedger:undefined});
  assert.doesNotThrow(()=>D.validateChange(before,after,'orders'));
});
test('opening receipts remain unknown until explicitly supplied; zero is accepted and historical dates are not fabricated',()=>{
  assert.throws(()=>add({currency:'INR',advancePaid:null}),/amount/);
  assert.throws(()=>add({currency:'INR',advancePaid:''},{opening:''}),/amount/);
  const result=add({currency:'INR',advancePaid:null},{opening:'0'});
  assert.equal(result.paymentLedger.openingMinor,0);assert.equal(result.paymentLedger.entries.length,1);
  assert.equal(Object.hasOwn(result.paymentLedger,'date'),false);
  assert.throws(()=>add({advancePaid:0}),/currency/);
});
test('receipts, refunds and corrections are append-only, reject duplicate reversals and prevent negative balances',()=>{
  const a=add({currency:'INR',advancePaid:0},{amount:'100.25'});
  const b=add(a,{kind:'refund',amount:'25.10'},'p2');assert.equal(b.advancePaid,75.15);
  const c=add(b,{kind:'reversal',reverses:'p2',note:'Mistyped refund'},'p3');assert.equal(c.advancePaid,100.25);
  assert.deepEqual(c.paymentLedger.entries.slice(0,2),b.paymentLedger.entries);
  assert.throws(()=>add(c,{kind:'reversal',reverses:'p2'},'p4'),/reversed/);
  assert.throws(()=>add(c,{kind:'reversal',reverses:'p3'},'p4'),/reversed/);
  assert.throws(()=>add(b,{kind:'reversal',reverses:'p1'},'p4'),/negative/);
  assert.throws(()=>add(a,{},'p1'),/unique/);
  assert.throws(()=>add(a,{kind:'refund',amount:'101'},'p2'),/negative/);
});
test('invalid dates and amounts fail without partial changes',()=>{
  const order={currency:'GBP',advancePaid:0};
  for(const amount of ['','-1','0','1.001','1e3','Infinity','NaN','9007199254740992'])assert.throws(()=>add(order,{amount}));
  for(const date of ['','2026-02-30','21/11/2026','2026-13-01'])assert.throws(()=>add(order,{date}),/date/);
  assert.throws(()=>add(order,{note:'  '}),/note/);
  assert.deepEqual(order,{currency:'GBP',advancePaid:0});
});
test('shared validation rejects rewritten payments, changed currency, altered opening totals and deletion without garment jobs',()=>{
  const before=add({currency:'GBP',advancePaid:25},{amount:'10'});
  for(const mutate of [o=>{o.currency='INR'},o=>{o.advancePaid=0},o=>{o.paymentLedger.entries[0].note='rewritten'},o=>{o.paymentLedger.entries=[]},o=>{o.paymentLedger.openingMinor=0},o=>{delete o.paymentLedger}]){
    const after=structuredClone(before);mutate(after);assert.throws(()=>D.validateChange(before,after,'orders'));
  }
  assert.throws(()=>D.validateChange(before,null,'orders'),/history/);
  const tampered=add({currency:'GBP',advancePaid:20});
  assert.throws(()=>D.validateChange({advancePaid:25},tampered,'orders'),/opening balance/);
  assert.doesNotThrow(()=>D.validateChange(before,add(before,{},'p2'),'orders'));
  assert.deepEqual(D.assemble(D.flatten({clients:{},orders:{o:{...before,id:'o'}}})).orders.o,{...before,id:'o'});
});
