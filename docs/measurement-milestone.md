# Measurement stabilization — 2 November 2026

## Baseline and verified findings

Source baseline: `7be6faddf4ec0806ded441de1a6782a61294fa11`, from the default `main` branch of `FaisalRISE/clothing`. The supplied local workspace initially contained an empty Git repository, with no working files, commits or remotes. Work was fetched and checked out on `codex/measurement-stability`. No existing local work was replaced. The repository contained only `index.html`; no applicable AGENTS.md was found in it or the inspected ancestor directories.

Read the supplied `modisto_improvement_roadmap.md` and companion `modisto_bespoke_project_summary_roadmap.md`. Their instructions were treated as reference material; the user's requested first milestone determined the implementation scope.

The source verified these roadmap hypotheses:

- `saveMeasure()` changed order garments, assigned cutter, fabric description/rate/metres and client posture; it also invoked workflow synchronization.
- A measurement without a matching order created an order with ₹95,000 quote, ₹50,000 advance, preset costs/hours, a Cutting stage and generated trial/delivery dates.
- `load_()` merged sample records into existing collections, populated trial dates and invoked reconciliation. Reconciliation created missing orders and reset workflows based on length or completed-step count. Boot recovery could replace records with samples.
- Unit switching changed `unit` and visible labels without converting values.
- Save, copy, new-client/new-docket and print actions were repeated. All sections and the print sheet appeared by default.
- Enquiry and order creation also carried invented financial/progress defaults. Enquiry dates were prefilled.

These are source findings plus local reproductions/regression checks. No business-changing save was made against the published application or a real backup.

## Implemented boundary

Saving measurements writes the selected docket and its save timestamp. It does not create orders, update clients, replace order quantities, commit an estimate, change fabric allocations or cutter assignments, record payments, or complete tasks. Existing order-number links remain readable and are checked against the client. Creating an order remains an explicit Orders/enquiry action.

The save reads the latest local database before merging the docket, preserving newer unrelated records from another tab. If the saved docket itself changed since loading, it refuses the overwrite and retains the current draft. This is a local stale-edit guard, not transactional multi-user storage.

Successful local writes show “Saved locally.” Failed writes retain the draft and show an error; unsaved edits are labeled. Optional Sheets export runs after the local save and is labeled unconfirmed, because `no-cors` cannot prove a remote write succeeded.

Fresh orders/enquiries have no preset quote, advance, costs, actual/estimated time, completion, trial date or delivery date. Unknown numeric business values are `null`, distinct from an explicitly entered zero. Enquiry cloth estimates are kept separately as `estimatedFabricMeters`; they are not committed allocations. New workflows contain pending tasks only. A stage change no longer creates or erases completion history. Checking a task changes only that task; extra legacy fitting steps survive. Merely closing the sequence dialog writes nothing.

Numeric measurements use the exact unit factor 2.54 with 15 significant digits of numeric precision. Inputs accept arbitrary decimal steps. Quarter-inch helpers remain available in inches; centimetres use direct decimal entry. Structured numeric bow-leg, knock-knee and shoulder corrections follow the selected unit, retaining their legacy field names for compatibility. Blank, null and zero remain distinct. Nonnumeric legacy values block conversion instead of being relabeled. Free-text notes, including values such as `1.75 in`, retain their written units and are explicitly excluded from conversion.

The cutter's field sequence, style options, diagrams, copy-previous behavior and branded sheets remain. Relevant garment sections and sections with stored measurements/correction notes appear by default. All sections remain available. The diagram opens from section navigation; print preview opens only on request. One fixed footer contains Save and Print preview, with occasional actions in More actions. The cloth estimate and garment picker are expandable. Print cells wrap long values instead of clipping them.

## Storage migration and recovery

1. Read the first present real-store key in this order: `modisto_bespoke_v7`, then `v6`, `v5`, `v4`, `v3`. Empty collections stay empty. Existing clients, orders, measurement values, unknown metadata and workflow arrays are retained. Missing collection containers/settings get defaults without adding sample clients, orders, swatches or employees.
2. Loading does not write or rewrite the source key. The first successful save writes `modisto_bespoke_v7`. Legacy keys remain untouched. Before writing, `modisto_bespoke_v7_recovery` captures a pre-change snapshot and is not replaced by later saves.
3. Settings → Download pre-change backup downloads that snapshot (or the original stored JSON if no snapshot exists). Settings → Export Database downloads the current in-memory data. Keep both exports outside browser storage.
4. To restore, download the current database first, then import the recovery JSON through Settings. Import retains empty collections and does not mix in sample records. An explicit valid import can repair an unreadable store, retaining the unreadable original bytes in the recovery key.
5. If loading fails, saving is blocked and a banner explains why. The original bytes remain downloadable. A rendering failure also leaves storage untouched.
6. Demo mode uses only `modisto_bespoke_demo_v7` and its own recovery key. It never automatically seeds or replaces the real workspace. Existing legacy samples cannot be reliably distinguished from business records by name or price; this milestone preserves them and requires human review before any later migration.

Rollback to the old application reads the old key and therefore does **not** include new v7 edits. Export v7 before rolling back. Do not use old code against a v7 export without a backup: the old loader can recreate the verified destructive behavior. Recovery inside this branch is the preferred path.

## Verification

- `npm test`: 8 data regressions covering measurement-only changes, unlinked drafts, write failure/retry, stale edits, newer order preservation, inch/cm round trips, zero/blank/null, posture and free-text handling, invalid conversion, custom workflow history, legacy loads, empty stores, isolated demos and corrupt storage.
- `npm run test:browser`: 12 checks across desktop and both tablet widths, covering direct keyboard and quarter-inch entry, unit switching, scrolling, unsaved/saved feedback, save/reload, no page-width overflow, relevant/all sections, on-demand preview, both print formats, legacy records, extended workflow history, single-task completion, recovery download/import and new order/enquiry defaults.
- Generated A4 PDFs inspected using pypdf/pdfplumber and rendered to images for visual review. The standard two-sheet docket produces two pages at all three viewports. Client/order/unit identity repeats; long style/fabric values wrap; numerical zero prints. No production records or external Sheets endpoint was used.
- `git diff --check` passes.

## Remaining limits and next milestone

Storage remains local to a browser. It is not shared between Mumbai and London; localStorage is not transactional across competing tabs. Other modules still use the legacy persistence architecture. Historical invented prices or completion dates are preserved because their authenticity cannot be inferred safely. Staff must review those records rather than having them silently “corrected.”

Measurements remain editable dockets linked through human order numbers. Version approval and production-issued snapshots are not implemented. Existing report and stock-estimation limitations, currency/branch behavior and duplicate measurement keys across garment groups remain outside this milestone. Long notes may require additional physical print pages; test representative workshop documents and printer settings before rollout. Browser emulation does not establish behavior on a physical iPad keyboard or printer.

Next: agree and implement stable order-line/garment-job IDs and versioned measurement references, with a mapping/review plan for legacy orders. Use that model to prepare shared authenticated storage and reservations in a separate milestone. Repeat fittings, integrations and a rebuild remain deferred.
