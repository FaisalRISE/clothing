# Focused order entry

Implemented on `codex/order-form-simplification`, following the UI roadmap's recommendation to simplify the order editor after the tracking screens. The starting release is PR #8 (`3d70ca9`). This increment is local and has not been published.

## Behavior

Client, order number, garments, order date, first fitting date and delivery remain visible. Fabric, Workshop, Costs & received, and Order notes open when needed. Detailed cost inputs and time estimates are secondary within their respective sections. All inputs stay in the same draft when a section closes.

Review fabric & payments opens the cost section directly from the order or garment workspace. A pending commercial review remains visible above the form. Existing reason and confirmation requirements still apply. Save and Cancel remain accessible while the form scrolls. Save failures appear outside the collapsible sections and leave the draft available for retry.

Input labels now explicitly target their controls. Keyboard focus returns to the relevant action after a successful save refreshes the underlying screen. Saved cutter and stitcher names remain selectable even if those people are no longer in the staff roster. Previously, opening the editor and saving could replace those names with an empty assignment.

## Verification

The new browser regression covers closed-section values, explicit zero and blank values, historical staff assignments, unknown legacy fields, completed workflow notes/dates, no writes while browsing, a failed write followed by a successful retry, reload, keyboard opening/closing, focus restoration and enlarged text. Existing complete-order tests now open the relevant sections through the UI before entering optional data.

Run `npm test`, `npm run test:browser`, `npm run test:shared` and `npm run test:shared:browser`. The browser projects cover desktop, portrait and landscape tablets, and phone. Screenshots are available in ignored `test-results/order-form-full/` and local staging output in `test-results/order-form-shared/`. These tests use isolated synthetic records.

Completed verification on 14 November 2026: 25 domain, 84 browser, 9 shared contract and 16 shared browser checks passed (134 total). `git diff --check` passed. Desktop, tablet and phone screenshots were visually inspected, including enlarged text.

## Recovery and boundaries

There is no storage schema change or migration. Export JSON from each browser/device holding business records before a future release, as described in the measurement milestone guide. The previous released source remains available at PR #8 for rollback, and backups remain readable in the existing format.

This is a form-layout and record-preservation increment. Currency handling, the existing cost calculations, stock-reservation rules, payment transactions and hosted collaboration remain separate work. No RISE project, production record or live hosting setting was changed. Physical phone keyboards and workshop printers still need a staff pilot.

Recommended next step: review this order form with an office user and cutter, then release it. After release, conduct one supervised sample order on the actual tablet/phone and workshop printer before choosing the next business-feature milestone.
