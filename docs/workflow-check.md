# Sample order workflow check

Checked locally on 8 November 2026, in separate demo browser contexts. No real client records, live-site storage or hosted projects were used in that rehearsal. Shared-database hosting remains deferred. The fixes were prepared on `codex/order-workflow-check`; publication is recorded in the repository's pull request history.

## Rehearsal

1. Open the demo workspace (`?demo=1`). Create **Demo Workflow Patron**, return to Clients and find the patron through search. Open Measurements and choose that client through the searchable picker.
2. Select suit and shirt measurement sections. Choose the sample suit fabric SW-2089. Enter Inseam 29.25 in, Chest (Suit) 40.25 in and Chest 39.75 in, plus cutter instructions; save the docket. The client’s order does not exist until Create order is confirmed.
3. Choose Create order. Review the description as **one two-piece suit and two shirts**. For this synthetic rehearsal only, enter quote ₹50,000, verified cumulative receipts ₹20,000, costing fabric 6.5 m and rate ₹1,000/m, first trial 15 November and delivery 25 November. Assign Demo Master Cutter. These values are entered explicitly; new records do not assume them.
4. Open Garment jobs. Add one suit bundle with SW-2089 / Demo Jacket Maker and two shirts with SW-3110 / Demo Shirt Maker. Choose the saved client docket for both batches, then Confirm garment breakdown. Verify four distinct physical jobs: jacket, trousers, shirt 1 and shirt 2. Review descriptions manually; old free-text garment descriptions are not parsed automatically.
5. Edit the jacket. Record only the first fitting as completed, with its findings, and schedule a second fitting with a separate date and notes. Apply and save. Other garments and the previous order workflow must remain unchanged. Open each garment’s workshop sheet and check its own fabric, maker, measurement fields and fitting notes. The sheets must contain no prices and must not write any records.
6. Record delivery separately for each garment. The order remains at the earliest unfinished garment stage until all four are delivered. Delivery must not fabricate missing workshop completion dates. Review the financial totals explicitly: the balance is ₹30,000 before the final update. Change the cumulative received total to ₹50,000 with a review note, then save and reload. Check a ₹0 balance, the financial before/after history and retained fitting records.
7. Search Orders by the shirt fabric SW-3110, Demo Shirt Maker and Shirt 2. Each must find the same order, even though its primary swatch and cutter belong to the suit. Historical cancelled garments remain searchable too.

## Verified gaps and fixes

- The rehearsal reached delivery but failed the search for a non-primary garment fabric. Order search now includes each garment’s label, type, maker and swatch, alongside the existing client/order fields.
- A delivered order previously showed **Next: Order Booked & Docket Created** when earlier task boxes had not been checked. The display now separates recorded delivery from recorded task completion, reports unmarked tasks honestly, and skips delivered/cancelled garments when finding the next active task. No workflow fields are changed. Orders with no workflow no longer claim all steps are complete.
- Missing estimated/actual days previously appeared as **0d / 0d (On time)**. They now display **Timing not recorded** in the order list and costing summary; explicit recorded zero remains distinct from blank.
- The financial form’s **Advance received** label hid the fact that the same stored field also holds final cumulative receipts. It is now **Recorded received total**, with an explanation. Garment jobs show quote, received total and balance together. Unknown totals remain unrecorded, explicit zero remains zero, and an excess received amount is shown separately. The legacy `advancePaid` storage field and all existing values remain unchanged.

## Limits and next milestone

Payments are still cumulative reviewed totals, not dated payment transactions, receipts or refunds. Fabric swatches are assigned per garment, but there is no transactional per-garment inventory ledger. Amounts are currently displayed in INR, including the London branch; GBP handling needs an agreed currency rule before entering GBP amounts. These are separate future milestones, not changes included in this check.

No migration is required: this increment adds search/display logic and labels only. Existing v7 browser records, saved measurement copies, garment IDs, financial histories and workshop task history keep their format. Export the database before any later live rollout as usual. The fixes are reversible by returning to the previous application version; no data conversion needs reversing.

The automated rehearsal is `tests/browser/order-workflow.spec.cjs` and runs at desktop, portrait tablet, landscape tablet and phone widths. It checks the workflow, client search, quarter-inch values, four job identities, immutable measurements, repeat fittings, print previews, partial/full delivery, final reviewed totals, reload, preserved unrelated records and demo/real-storage separation. Domain checks cover search across retained garments, active-task selection and blank/zero/excess payment summaries.

Validation passed: 24 domain checks (`npm test`), 9 shared-data checks (`npm run test:shared`), the complete 68-check browser suite (`npm run test:browser`), and the 4 shared-mode client/order/trial checks (`npm run test:shared:browser -- --grep="new client"`). The full sample-order rehearsal was repeated at all four widths after the final display changes. Desktop, portrait tablet and phone screenshots were inspected. Remaining shared-mode auth/permission browser tests were not repeated because this increment changes no authentication or storage code; backend isolation and preservation checks were rerun.
