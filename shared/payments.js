'use strict';
(function () {
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const currency = order => ['INR','GBP'].includes(order.currency) ? order.currency : '';
  function minor(value) {
    if (value == null || String(value).trim() === '' || !/^\d+(\.\d{1,2})?$/.test(String(value)) || !Number.isSafeInteger(Math.round(Number(value)*100))) throw new Error('Enter a non-negative amount with at most two decimal places.');
    return Math.round(Number(value)*100);
  }
  function total(ledger) {
    let sum = ledger.openingMinor;
    const ids = new Map(), reversed = new Set();
    if (!Number.isSafeInteger(sum) || sum < 0 || !Array.isArray(ledger.entries) || !ledger.startedAt) throw new Error('Invalid payment opening balance.');
    for (const entry of ledger.entries) {
      if (!entry.id || ids.has(entry.id) || !entry.recordedAt || !entry.note?.trim()) throw new Error('Payment entries need a unique ID and a note.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(Date.parse(entry.date+'T00:00:00Z')) || new Date(entry.date+'T00:00:00Z').toISOString().slice(0,10) !== entry.date) throw new Error('Enter a valid payment date.');
      if (entry.kind === 'reversal') {
        const original = ids.get(entry.reverses);
        if (!original || original.kind === 'reversal' || reversed.has(original.id) || entry.amountMinor !== -original.amountMinor) throw new Error('That payment cannot be reversed.');
        reversed.add(original.id);
      } else if (!['receipt','refund'].includes(entry.kind) || (entry.kind === 'receipt' ? entry.amountMinor <= 0 : entry.amountMinor >= 0)) throw new Error('Enter a positive receipt or refund amount.');
      if (!Number.isSafeInteger(entry.amountMinor)) throw new Error('Invalid payment amount.');
      sum += entry.amountMinor;
      if (!Number.isSafeInteger(sum) || sum < 0) throw new Error('This entry would make the received total negative.');
      ids.set(entry.id,entry);
    }
    return sum;
  }
  function append(order, input, id, recordedAt) {
    if (!currency(order)) throw new Error('Confirm the order currency before recording payments.');
    const ledger = order.paymentLedger ? JSON.parse(JSON.stringify(order.paymentLedger)) : {
      openingMinor: minor(order.advancePaid == null || order.advancePaid === '' ? input.opening : order.advancePaid),
      startedAt: recordedAt, entries: []
    };
    const original = ledger.entries.find(entry => entry.id === input.reverses);
    const amountMinor = input.kind === 'reversal' ? -(original?.amountMinor || 0) : minor(input.amount) * (input.kind === 'refund' ? -1 : 1);
    ledger.entries.push({id,recordedAt,date:input.date,kind:input.kind,amountMinor,note:String(input.note || '').trim(),...(input.kind === 'reversal' ? {reverses:input.reverses} : {})});
    const received = total(ledger)/100;
    return {...order,paymentLedger:ledger,advancePaid:received};
  }
  function validate(before, after) {
    if (before?.paymentLedger) {
      if (!after?.paymentLedger || currency(after) !== currency(before)) throw new Error('Payment currency and history cannot be removed or replaced.');
      const prior = before.paymentLedger, next = after.paymentLedger;
      if (prior.openingMinor !== next.openingMinor || prior.startedAt !== next.startedAt || !equal(prior.entries,next.entries?.slice(0,prior.entries.length))) throw new Error('Payment history cannot be rewritten; record a reversal instead.');
    }
    if (!after?.paymentLedger) return;
    if (!currency(after) || total(after.paymentLedger)/100 !== after.advancePaid) throw new Error('Received total must match the payment ledger and have a confirmed currency.');
    if (!before?.paymentLedger && before?.advancePaid != null && before.advancePaid !== '' && minor(before.advancePaid) !== after.paymentLedger.openingMinor) throw new Error('Preserve the previously recorded received total as the opening balance.');
  }
  const api = {currency,minor,total,append,validate};
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.ModistoPayments = api;
})();
