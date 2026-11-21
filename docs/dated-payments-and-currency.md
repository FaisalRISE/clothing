# Dated payments and order currency

Development branch: `codex/payment-ledger`. This work is not a production release.

## Staff flow

1. Create an order. Mumbai clients default to INR; London clients default to GBP. Choose a different currency under **Costs & received** if needed. The choice applies to all entered order amounts; there is no exchange conversion.
2. Open the order, choose **Costs & received**, then **Payments & history**.
3. For an older order, review its existing amounts and confirm the currency first.
4. On the first dated entry, the previously recorded received total becomes an **undated opening balance**. An unknown received total requires an explicit amount or zero. Do not enter earlier receipts again: they are already included in that opening balance.
5. Enter a receipt or refund amount, actual transaction date and reference/note. These entries record completed transactions; they do not move money.
6. Use **Reverse entry** to correct an erroneous dated entry, with a date and reason, then record the correct entry. The original stays visible. A reversal cannot be repeated or make the net received total negative.

The received total becomes read-only after dated tracking starts. Currency is also locked at that point. Orders with payment history cannot be deleted through the order form. Fabric/payment review remains separate: recording a receipt does not confirm a garment amendment, change a quote, release fabric, or alter workflow history.

## Existing records and recovery

- There is no bulk migration or automatic rewrite on load. Existing monetary amounts and unknown fields are preserved. Existing orders without a supported currency remain **currency unconfirmed** until staff review them. Explicit demo seed records use INR; these are separate from real records.
- Each order gains `paymentLedger` only when its first dated entry is saved. It contains an undated `openingMinor`, `startedAt` timestamp and append-only `entries`. Entry amounts are stored as integer paise/pence, with signed refunds and reversals. Transaction dates and recording timestamps are distinct.
- `advancePaid` is retained as the compatible cumulative received total and updated from the ledger. A payment save changes only this field and `paymentLedger`; unrelated orders, garment jobs, measurements, assignments, allocations and workflow history are untouched.
- Existing totals with more than two decimal places are not silently rounded into an opening balance. Review/correct them before enabling dated tracking.
- Export a full JSON backup in Settings before adopting the new release. The ledger and currency are included in that backup. Keep a second export after recording payments. The pre-existing local recovery snapshot remains available, but may be older than this milestone; a fresh export is the reliable pre-adoption reference.
- Recover into a separate browser profile/workspace and verify totals and history before using the restored copy. A pre-adoption backup will not contain later payments. Keep the post-adoption export to avoid losing those entries.
- Older releases do not enforce payment-ledger invariants. Do not continue entering financial changes in an old app version against a ledger-enabled backup. Preserve a current export if rolling back the interface.

## Reports and boundaries

Reports show INR and GBP separately. Unconfirmed orders have their own list and are excluded from currency totals. Their figures must not be added together until their currencies are confirmed. Missing cost inputs still contribute zero to existing contribution estimates; these are not audited profit figures.

Fabric-library costs remain INR. They auto-fill only into INR orders. GBP order costs require a verified GBP amount entered by staff. The milestone does not implement multiple cost currencies within one order or exchange-rate accounting. Changing the client after entering monetary values does not automatically relabel those values with a new default currency.

GitHub Pages still stores real records in that browser. Shared logins/data remain local staging only; no hosting changes or RISE project changes are included. Local shared staging validates immutable payment history and excludes payment data from workshop projections.

## Verification and release preparation

Run `npm test`, `npm run test:browser`, `npm run test:shared`, and `npm run test:shared:browser`.

The checks cover precise arithmetic, blank versus zero, legacy opening totals, invalid dates, duplicate reversals, immutable history/currency, failed writes, stale tabs, reloads, currency defaults, separated reports, workshop privacy, and retention of garment/workflow data. Browser projects cover desktop, portrait/landscape tablet and narrow phone layouts. Physical Android keyboard and A4 printer checks remain pending from the staff pilot.

Release `shared/payments.js` alongside `index.html`; the public page now loads this same-origin module. Both local preview servers serve it explicitly. Verify its response and the payment flow after an authorized release. No new backend or storage migration is needed.

Verification completed on 22 November 2026: 30 domain/payment checks, 100 browser checks, 10 local server checks and 20 shared-browser checks passed. Phone payment-history and measurement screenshots were visually reviewed.

The subsequent precision-helper correction removes its sticky positioning and collapses the controls by default. Four additional browser checks passed across the same viewport sizes, verifying keyboard expansion, fraction entry, scrolling, saving, unit conversion and A4 preview. The helper remains hidden when printing.
