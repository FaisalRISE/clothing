# Garment jobs

Open **Orders → Garment jobs** for an order. Review its recorded description, add individual garments or two/three-piece suit bundles, and choose **Confirm garment breakdown**. A suit and two shirts create a jacket, trousers and two shirt jobs. Each physical garment receives a stable job ID.

Staff choose the saved measurements, fabric swatch and maker for each batch or individual job. The list remains a draft until **Confirm garment breakdown** or **Save garment jobs** succeeds. Draft jobs can be removed before saving. Saved jobs retain their task history.

**Edit garment & progress** changes that garment's name, instructions, maker, fabric, current stage and task entries. **Apply to garment list** keeps the edits in the workspace. **Save garment jobs** records them. Checking a task records that task's completion and date. The stage selector can record the current stage independently of earlier task completion.

The order displays how many garments are ready. Its overall stage follows the earliest unfinished garment stage. Payments, quoted value, committed order fabric metres and existing workflow entries remain at order level. Team shows active garment jobs under their assigned maker.

## Measurements

Selecting a docket creates an immutable measurement copy. Jobs sharing the same saved docket reuse one copy. Editing the original docket leaves those job copies intact. **View measurement copy** shows the garment's fields in the cutter's sequence, with units, options and notes. To adopt later edits, explicitly select **Replace with the latest saved measurements**. Previous copies remain stored and job activity retains their references.

## Existing records and recovery

There is no automatic parsing of historical garment descriptions. Staff review the quantity and components before confirming. New jobs start at New with pending tasks. The previous order stage and full order workflow remain available through **View previous order workflow**.

The local JSON format adds `orders[id].garmentJobs`, `productionBeforeGarmentJobs`, `garmentJobsReviewedAt` and a `measurementVersions` collection. Existing records load without requiring a rewrite. The current browser storage key stays at v7, with the existing pre-change recovery snapshot retained.

Export the database in Settings before converting existing orders. Import that export in Settings to restore it. Keep the export when rolling back to older application code. The browser still stores data separately for each device and profile.

Garment-list and costing saves check for intervening edits to the order and retain the draft on conflict or storage failure. Shared storage and transactional inventory remain later milestones. Individual job print sheets, cancellation/reduction revisions and repeat-fitting templates are also pending. Existing docket print preview remains available.

## Verification

Data checks cover bundle expansion, stable IDs, independent progress, preserved commercial fields and historical workflow, shared immutable measurement copies, refresh history, stale edits, cross-client references and failed writes.

Browser checks cover the full garment flow and measurement regressions on desktop, portrait tablet, landscape tablet and phone sizes. They include reload, different fabrics and makers, partial readiness, Team assignments, explicit refresh of measurements, failed-save retry and a stale costing form.
