# Garment jobs

Open an order from **Orders**, then choose **Review garment breakdown** or **Garment jobs**. Review its recorded description, add individual garments or suit bundles, and choose **Confirm garment breakdown**. A suit and two shirts create a jacket, trousers and two shirt jobs. Each physical garment receives a stable job ID.

The order page has separate **Overview**, **Garments**, **Fittings**, **Costs & received** and **Activity** sections. **Workshop** shows assignment counts for physical garments and orders awaiting breakdown. Select a maker to see their queue. Opening a garment from that queue takes you to its details.

Staff choose the saved measurements, fabric swatch and maker for each batch or individual job. The list remains a draft until **Confirm garment breakdown** or **Save garment jobs** succeeds. Draft jobs can be removed before saving. Saved jobs retain their task history.

**Edit garment & progress** opens assignments, stage and fittings. Expand **Workshop tasks** for the rest of the checklist. **Apply to garment list** keeps the edits in the workspace. **Save garment jobs** records them. Checking a task records that task's completion and date. The stage selector can record the current stage independently of earlier task completion.

The order displays how many garments are ready. Its overall stage follows the earliest unfinished garment stage. Payments, quoted value, committed order fabric metres and existing workflow entries remain at order level. Team shows active garment jobs under their assigned maker. Order search includes each garment’s fabric, maker and label. Delivered orders identify any tasks not marked complete without placing those jobs back in the workshop queue.

## Order amendments and cancellation

Add extra garments through **Add garment jobs**, enter the reason, then **Apply to garment list → Save garment jobs**. Each addition receives a new job ID; existing jobs and their measurement copies remain intact. The initial review of a legacy order still uses **Confirm garment breakdown**.

Choose **Cancel garment**, enter a reason and apply the cancellation, then **Save garment jobs**. Only that physical garment is cancelled; other suit components remain separate. Saved garments are retained rather than deleted. Cancelled cards keep their last production stage, measurements, fabric, maker, completed tasks and fitting notes. Editing, production printing and Team workload exclude cancelled garments. **Reinstate garment** requires a reason and returns it to the retained stage; both actions remain in its activity and the order amendment history. Delivered garments need a separate return/refund process and cannot be cancelled here.

Quantity reductions use cancellation of individual garments. Active quantities mean non-cancelled garments, including delivered garments still belonging to the order. Ready counts include delivered garments. When all garments are cancelled, the order appears under **Cancelled**, not Delivered. Managed orders cannot be deleted through Costing.

Each saved addition, cancellation or reinstatement marks **Fabric / payment review pending**. It does not change the quote, recorded advance, costs, costing metres, fabric-library stock or allocations. The order's existing fabric reservation is retained even if cancellation closes the order. Tell the workshop about cancellation: older printed sheets cannot be recalled. An open preview rechecks the saved garment before printing and marks a stale/cancelled sheet **DO NOT PRODUCE**.

Open **Review fabric & payments** after saving garment changes. Enter only verified order totals, with a reason. **Reserved fabric (m)** is separate from metres used for costing: enter 0 to release the remaining order reservation without erasing the recorded fabric cost. The fabric library's independently recorded allocation is retained; its existing availability calculation uses the larger of library allocation and order reservations. There is no per-garment stock ledger or inferred fabric consumption here.

Tick **I have reviewed…** and save to clear the pending review. A reason is required even when confirming no change. Before/after values and the review note appear in **Order amendment & commercial review history**. Editing a delivery date or other non-commercial field does not clear the flag. **Recorded received total** is the cumulative verified amount received, including advance and final payments; it uses the existing `advancePaid` field and can be corrected with a reason. The garment workspace shows the quote, received total and balance; a missing value is not treated as an explicit zero. The application does not process refunds or create individual payment transactions. Automatic single-garment cloth estimates are disabled in Costing for orders with a reviewed garment breakdown; the measurement workspace retains its advisory estimates.

These changes add optional cancellation/history fields on jobs and amendment, commercial-review and reservation fields on orders. Existing records load without being rewritten. Export JSON in Settings before rollout; importing that export restores the previous state. When rolling back application code, also restore that pre-milestone export: older versions do not understand cancellation or separate reservation fields. Draft changes survive write failures or stale-order conflicts. Cancel/reinstate actions are reversible; refunds and financial corrections remain explicit staff decisions.

## Additional trials

Open the order's **Fittings** section and choose **Add fitting** for the garment, or use **Edit garment & progress → Add trial / fitting** in the garment workspace. Enter the date and notes, then use **Apply to garment list → Save garment jobs**. Earlier notes and completion dates are under **Fitting history**. Adding a fitting through the garment editor at or beyond fitting stage returns the garment to fitting. Tick a fitting when it takes place. Cancel discards changes made in the editor.

For orders awaiting garment breakdown, choose **Manage order fittings → Add trial / fitting**. Choose **Save Sequence & Sync Stage** to keep dates and notes. Changing a sequence checkbox or stage also saves immediately. The tracker preserves existing trial numbering.

## Measurements

Selecting a docket creates an immutable measurement copy. Jobs sharing the same saved docket reuse one copy. Editing the original docket leaves those job copies intact. Open **Garment details → View measurement copy** to see the garment's fields in the cutter's sequence, with units, options and notes. To adopt later edits, explicitly select **Replace with the latest saved measurements**. Previous copies remain stored and job activity retains their references.

## Individual workshop sheets

Choose **Workshop sheet** on a saved garment card, then **Print workshop sheet** to open the browser print dialog or save as PDF. Choose A4 portrait. **Garment jobs** returns to the list. Save pending garment edits and select a saved measurement copy before opening a sheet. Printing never changes stored records, workflow completion, fabric commitments or payments.

Each sheet identifies the client, order, physical garment job, maker, garment fabric swatch and measurement-copy reference. Measurements use the saved copy's unit and cutter sequence without rounding or converting values. Blanks print as unrecorded; zero remains explicit. Posture corrections, garment-specific options, cutter instructions, job notes and all fitting dates/notes are included. Free-text unit annotations are reproduced verbatim. Order first-trial and delivery dates are labelled separately from garment trial dates. No order prices or advances appear on the sheet.

Waistcoat, bandi, sherwani and kurta sheets include a labelled upper-body reference section because their dedicated measurement sections contain only a few fields. These reference values retain their original field names. Previously unknown docket fields appear under **Other saved docket references - review applicability**. No missing measurement or garment fabric assignment is inferred from the live docket or order-level swatch.

Normal jacket sheets fit one A4 page with typical notes. Longer instructions and trial histories continue onto additional pages, with garment identification repeated in the page margin. Demo sheets are explicitly marked as samples. A4 PDF output is verified in Chrome; other browsers and physical printers have not been checked. The existing full-docket table and visual-guide print preview remain available from Measurements. There is no data migration for this feature.

## Existing records and recovery

There is no automatic parsing of historical garment descriptions. Staff review the quantity and components before confirming. New jobs start at New with pending tasks. The previous order stage and full order workflow remain available through **View previous order workflow**.

The local JSON format adds `orders[id].garmentJobs`, `productionBeforeGarmentJobs`, `garmentJobsReviewedAt` and a `measurementVersions` collection. Existing records load without requiring a rewrite. The current browser storage key stays at v7, with the existing pre-change recovery snapshot retained.

Export the database in Settings before converting existing orders. Import that export in Settings to restore it. Keep the export when rolling back to older application code. The browser still stores data separately for each device and profile.

Garment-list and costing saves check for intervening edits to the order and retain the draft on conflict or storage failure. Shared storage, transactional inventory, payment/refund transactions and repeat-fitting templates remain later milestones.

## Verification

Data checks cover bundle expansion, stable IDs, independent progress, preserved commercial fields and historical workflow, shared immutable measurement copies, refresh history, stale edits, cross-client references and failed writes.

Browser checks cover the full garment flow and measurement regressions on desktop, portrait tablet, landscape tablet and phone sizes. They include reload, different fabrics and makers, partial readiness, Team assignments, explicit refresh of measurements, failed-save retry and a stale costing form.

Workshop-sheet checks cover frozen measurement copies, inches/centimetres, blank versus zero, all garment types, instruction escaping, saved-state guards, keyboard print controls, returning to the garment list, and long multi-page fitting histories. A4 PDF output is inspected for page size, complete notes and repeated garment identification.

Amendment checks cover one suit piece cancelled independently, reinstatement, additions, all-cancelled orders, preserved fitting history and commercial values, reservations surviving terminal stage changes, explicit paid-total/reservation reviews, delivered-job guards, immutable saved history, failed-write retries, unrelated newer records and stale preview/save protection.
