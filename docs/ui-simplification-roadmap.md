# Modisto Bespoke — UI review and implementation roadmap

**Implementation update, 14 November 2026.** The local redesign includes Today, compact Orders, contextual order sections, Workshop queues and the supporting screen consistency pass. Clients and Fabrics show searchable cards with details on demand. On phones and small tablets, More opens Clients, Workshop, Fabrics, reports and Settings. Measurements keeps unit and layout controls visible and groups order reference, date, swatch and cutter under Docket details. Existing records use the same storage format.

Reviewed 11 November 2026. Prepared for handoff to the next implementer, expected to be GPT-6.1 sol.

**Recommendation:** make the application answer “What needs attention, what is due next, and where do I act?” before showing supporting details. Start with Today, Orders and an order overview. Preserve the existing tailoring workflow and data protections. This document is a plan, not authorization to implement or deploy it.

## 1. Scope and evidence

Reviewed the supplied original roadmap and project summary, the current local repository, its milestone documents, source, tests and rendered demo screens. The original documents describe intent and historical findings; they are not proof of current behavior.

- Baseline: local `main`, commit `ef65d14392b296f28e55675152e75d1f9da32eeb` (PR #7). Working tree was clean before this documentation change. No applicable `AGENTS.md` was found in the repository or inspected ancestor directories.
- Browser inspection: isolated Chrome demo contexts at 1440×1000, 820×1180 and 390×844. Captured Dashboard, Orders, Team, Clients and Measurements at each size; visually inspected Dashboard, Orders and Team screenshots. No page JavaScript errors occurred during those navigation checks. The real-workspace localStorage key stayed absent.
- Re-ran the existing synthetic complete-order rehearsal across desktop, portrait tablet, landscape tablet and phone; results are recorded below. This is a local review, not a fresh certification of the live deployment or a production-record audit.
- Read `docs/measurement-milestone.md`, `docs/garment-jobs.md`, `docs/shared-staging.md` and `docs/workflow-check.md`. Their previous test results remain historical evidence. The full shared-auth suite, every browser regression and physical devices/printers were not rechecked in this review.
- Review screenshots and diagnostic logs are in ignored `.local/ui-review/`. They are supporting local artifacts, not runtime dependencies or committed deliverables.

The public app remains browser-local. Shared data and staff authentication exist only in separate local staging. Hosting is deferred. Leave RISE Events and RISE Sports untouched.

## 2. What has been achieved

| Area | Current implementation and value | Preserve in the redesign |
|---|---|---|
| Measurement saving | Docket-only saves, stale-edit checks, retained drafts on failure; explicit order creation | A measurement edit must not alter commercial values, assignments, allocations or completed workflow |
| Measurement entry | Numeric inch/cm conversion, blank versus zero, posture corrections, quarter-inch entry, searchable client/swatch selection, tabbed/relevant/all modes | Cutter field sequence, units, free-text notes, phone tab mode and explicit save feedback |
| Physical garment jobs | Stable job IDs, bundle expansion, separate makers/fabrics/stages, saved measurement copies | One client order with independently tracked garments; no guessing historical quantities |
| Fittings and sheets | Additional trials, retained fitting history, individual workshop sheets and full docket printing | Additional trials must remain discoverable; preserve both print routes and financial exclusions |
| Amendments | Reasoned cancellation/reinstatement/addition; separate explicit commercial review | No silent fabric release, payment correction, refund or deletion of history |
| Workflow rehearsal | Client → measurements → suit and two shirts → fittings → print → partial/full delivery → reviewed received total | A complete path through the app rather than isolated attractive screens |
| Shared staging | Local acknowledged writes, conflicts, roles, restricted workshop projection, import/recovery checks | Adapter and server restrictions; UI visibility is not authorization |

These are a useful foundation. The current priority is presentation and navigation, rather than rebuilding the application or adding more simultaneous features.

Still incomplete: hosted collaboration, a dated payment ledger, explicit INR/GBP rules, transactional garment-level inventory, formal appointment scheduling/conflicts, and governed measurement approval. Saved measurement copies exist; they should not be renamed “approved” without an approval workflow.

## 3. Verified review findings

| Priority | Finding and evidence | Required response |
|---|---|---|
| High | Dashboard leads with a full vendor/contact alert, ten stage buttons, five statistics and two detailed tables. The sample phone page is 3,022 px tall. Source: `vDashboard()` | Replace with a few actionable numbers, a short attention queue and one compact production graphic |
| High | Orders has nine columns, duplicate stage controls and four row actions. Table content is 1,577 px wide within 1,128 px on desktop and 320 px on phone | Compact desktop rows and phone/tablet cards; open details from one clear link |
| High | Team combines a selected person's job table, employee directory and all-order time diagnostics. Sample desktop page is 2,353 px tall; its first table needs 1,711 px within 1,126 px | Show a team summary first, then one person's queue. Move timeline/history into order/job details |
| High | Team shows “All steps done” when a legacy order has an empty workflow. Source and demo reproduce it | Share truthful summary helpers; use “No workflow recorded” |
| High | Team substitutes 28 hours / 14 days when estimates are absent and labels three jobs or delays as overload. Some views call incomplete work “Early” or “On schedule” from insufficient evidence | Remove invented display estimates and unsupported capacity conclusions; distinguish calendar due dates from recorded effort |
| High | “Net Atelier Profit” sums quote minus selected costs across orders, treating missing costs as zero; currency is displayed as INR even for London | Remove from the operational landing page. Do not introduce new profit graphics before completeness/currency rules exist |
| Medium | Sidebar branch selection saves a setting but does not filter Dashboard/Orders/Team | Separate entry defaults from explicitly labelled view filters; never imply an access boundary |
| Medium | Garment cards expose IDs, measurement references, notes and several buttons before a user chooses a garment | Keep label, maker, stage, next dated event and a relevant exception; open the rest on demand |
| Medium | Recent measurements show posture details on Dashboard; Clients exposes company, contact, posture, counts and spend together | Move these details to the appropriate client/docket view |
| Prerequisite | Standard `npm test` fails all 24 tests at setup on this CRLF checkout. The extraction marker in `tests/domain.test.cjs:9` contains a literal LF, so it misses the Orders boundary and evaluates unrelated DOM code | Normalize line endings and assert extraction boundaries before evaluating source; do not weaken behavioral assertions |

The layout problem is mainly overflow **inside tables**, not current full-page horizontal overflow. In the inspected viewports, document width equalled viewport width. A “no page overflow” assertion alone therefore misses the usability problem.

Diagnostic result: a temporary copy of the domain test with only its input HTML normalized to LF passes 24/24. Tracked tests and application code were not changed. This distinguishes a test-harness portability defect from evidence that 24 business behaviors are broken.

## 4. Design direction

Keep the Modisto navy, ivory and muted gold identity. Use short serif headings, readable sans-serif content, restrained borders and generous spacing. Reduce emojis, uppercase instructions and repeated badges. Gold should identify the main action; red/amber should have a specific reason.

Use three levels of information:

1. **Overview:** a count, status or next event that helps staff decide where to go.
2. **Record:** client/order/garment context and the actions relevant to that record.
3. **Detail:** measurements, full tasks, fitting notes, costs, vendor contacts and history.

Do not simply put every existing section inside an accordion. Decide what belongs on each screen. Keep save failures, unsaved changes, unresolved commercial review and essential measurement warnings visible in context.

### Navigation

Desktop: **Today · Orders · Clients · Measurements · Workshop · Fabrics**, with Reports and Settings secondary. Rename Team & Timeline to Workshop. Keep Measurements directly accessible for cutters. No new Calendar destination in this milestone; use a compact dated agenda within Today/Workshop.

Phone: **Today · Orders · Measure · More** in a compact accessible navigation pattern; More contains the remaining destinations. Avoid the current horizontally scrolling primary navigation. Account for safe areas and the on-screen keyboard so navigation and save controls do not overlap.

Use “Client branch: All / Mumbai / London / Unspecified” only if implemented consistently against the linked client's recorded branch. This is a browsing filter, not a verified order service location. Preserve unknown values. Keep any “Default branch for new clients” setting separate. Defer order service/workshop locations until their business meaning is agreed. Never label the selected cutter as a signed-in user in browser-local mode.

### A. Today dashboard — first priority

Show four operational cards: **Active orders · Delivery overdue · Fittings in next 7 days · Ready for collection**. Each card opens the corresponding filtered records with the same count and definition.

Below them, show:

- **Needs attention:** at most five rows, ordered by delivery overdue, past uncompleted fitting dates, missing job setup and pending fabric/payment review. Show one concise reason per row and a count of additional issues. “View all” exposes the full queue.
- **Coming next:** at most five dated fitting/delivery events with client, order, garment where relevant, event type and date. A click opens that exact context.
- **Production overview:** a small labelled horizontal stage-count graphic. Each segment filters Orders. No decorative pie charts, gauges or percentage-complete claims.
- A single compact fabric warning such as “3 fabrics need review”. Supplier contacts and the full stock calculation belong in Fabrics. Do not claim a number of blocked jobs unless the data establishes that relationship.

One primary creation action, **New order**; New client and New measurements remain in a clearly labelled secondary menu/direct navigation. Search should at least offer a direct route to Orders/Clients search; a new global search engine is not a dependency.

Illustrative structure, not real business values:

```text
TODAY                                      [New order]
Client branch: All                         As of: [date / zone]

[Active orders] [Overdue delivery] [Upcoming fittings] [Ready]

Needs attention                            Coming next
Client · order · delivery overdue →         Client · Trial 2 · date →
Client · order · maker unassigned →         Client · delivery · date →
View all                                   View all

Production: Preparation | Making | Fitting | Finishing | Ready
Fabric review: [count] →
```

On phone, cards form a 2×2 grid and attention rows precede secondary charts. With the standard synthetic fixture, show the start of the attention list in the first 844 px viewport at normal text size. Do not achieve this through tiny text or clipped warnings.

### B. Orders — compact tracking

Heading **Orders**, persistent search and one primary **New order** action. Default to Active. Quick views: **Active · Needs attention · Ready · All**; exact stage, branch and archived status live in Filters. Delivered/cancelled orders stay searchable through All and explicit filters.

Desktop default columns, at most five:

| Column | Visible content |
|---|---|
| Client / order | Client name and order number as a real accessible link |
| Garments | Short summary and separate ready/delivered counts; “Breakdown needed” for legacy orders |
| Current stage | Recorded/derived stage plus one material attention badge |
| Next event | Earliest relevant dated fitting or delivery, with event type; “No date recorded” when absent |
| Delivery | Recorded promised date and overdue/due-today wording where justified |

Use stacked cards on phone and portrait tablet. Keep details to approximately three content lines plus status/date, allowing long names to wrap. Do not hide the only route to details behind horizontal scrolling or hover. No prices, profit, full cloth descriptions, task lists or editable stage dropdown in the default list.

Selecting an order opens its overview. A contextual More menu may offer Edit or Print routes, but cancellation belongs inside the record with its reason/history safeguards. Preserve search by client, order, garment label, maker and any garment swatch, including retained cancelled garments. Preserve filter, search, scroll and focus when returning from details. Paginate or use an explicit “Load more” (for example, 25 records) for large lists; counts reflect all matching records, not just the displayed page.

### C. Order overview — one place to inspect an order

Use a dedicated detail view, not another large editing modal. Header: client, order number, delivery and status. First section: short garment readiness summary and highest-priority issue/next dated event. Show pending commercial review near this summary without exposing all financial fields.

Use **Overview · Garments · Fittings · Costs & received · Activity** as contextual sections. On small screens use a clearly labelled section selector or accessible compact tab control. Costs & received accurately describes the current cumulative-total model; do not imply payment transactions or a ledger exist.

- Overview contains commitments and concise next actions, not copies of every other section.
- Garments shows compact rows: garment, stage, maker, next task/date, exception. Selecting one opens its detail/editor. Show technical job IDs and measurement-copy references inside that detail.
- Fittings lists each recorded trial, date, garment and completion state. **Add fitting** must be visible here and in the garment editor. Multiple garment fitting entries are not automatically one client appointment.
- Costs & received exposes the existing explicit financial/fabric review form and unrecorded/zero distinction. Editing totals remains deliberate and reasoned.
- Activity contains completed tasks, previous order workflow, amendment history and measurement replacement history. It is retained, reachable and read-only unless an existing authorized edit route applies.

Keep **Workshop sheet** readily accessible from a saved garment's detail. Keep the full docket print preview in Measurements. Do not merge their different purposes or disclose financial fields on workshop sheets.

Initially reuse existing tested editors behind the new overview. A later small increment can simplify the large order editor into grouped sections. Do not simultaneously redesign all forms and change persistence.

### D. Workshop and timelines

Workshop defaults to a concise team workload summary and a **Needs assignment** entry. Show active garment job counts by maker, plus legacy unbroken-down orders separately. A legacy order containing several garments is not one comparable physical garment job.

Use labelled horizontal bars for assignment counts, not a claim of capacity/utilization. No “overloaded” threshold until available hours and remaining effort are reliable. Selecting a person opens only their queue; administration and all-history diagnostics become secondary actions.

Order/job timeline defaults to **current recorded stage, next pending task and next dated event**. Expand to a vertical sequence showing scheduled versus completed dates, trial numbers and notes. Past events and full history are collapsed initially. Do not present arbitrary bar widths as time or task completion as a percentage of garment readiness.

Do not fabricate start dates, durations, dependencies or completion timestamps to draw a Gantt chart. Defer a true scheduling calendar/Gantt, capacity planning, rescheduling/no-show records and appointment conflicts.

### E. Supporting screens

| Screen | Default | On demand |
|---|---|---|
| Clients | Search, name, recorded branch, active-order count, Open | Contact/address, company, posture, preferences, previous orders and measurements |
| Measurements | Known client/docket identity, unit, current relevant section, save state and Save; Tabbed default on phone | Other sections, estimator, diagrams, copy previous, new docket, print preview |
| Fabrics | Search, swatch code, small colour sample, recorded availability/review status | Composition, supplier contact, costing, stock calculations, affected order references |
| Reports | Existing explicitly labelled reporting, with missing-data limitations | Financial breakdowns; new ledger/currency reporting deferred |
| Settings | Backup/recovery and workspace settings grouped clearly | Branding, optional export setup, local staging administration where authorized |

Measurements needs only a light polish after the main tracking views. Preserve Tabbed / Relevant / All choices and stored preferences. Selecting a global measurement shortcut should make the current client/docket obvious; moving to a new picker must not silently discard an existing draft.

## 5. Summary and infographic rules

Create pure read-only summary helpers shared by Today, Orders and Workshop. They take records plus an explicit reference date/time context. They do not mutate stored status, dates or history.

| Item | Definition / guardrail |
|---|---|
| Active orders | Count unique orders whose existing status is neither Delivered nor Cancelled; preserve established garment-derived status rules. Flag inconsistent legacy data rather than rewriting it |
| Delivery overdue | Active order with a valid recorded delivery date earlier than the displayed reference date. No date means “Delivery not scheduled”, not on time |
| Upcoming fittings | Count incomplete fitting entries with a scheduled date from today through the following six calendar dates. Count events, label them as events, and show garment identity |
| Past fitting date | Incomplete fitting entry before today: “Past fitting date — confirm outcome”. Do not claim the client missed an appointment |
| Fitting source | For broken-down orders use garment workflow fitting entries; otherwise use legacy order fitting entries. Use `trialDate` only as a labelled legacy fallback when no structured fitting entries exist. Do not duplicate both representations or invent a trial outcome |
| Ready for collection | Count unique orders with at least one non-cancelled garment at Ready, excluding Delivered garments. Separate partially ready from all remaining garments ready; legacy fallback is recorded order Ready |
| Garment counts | Denominator is non-cancelled garments. Ready and Delivered counts are separate, disjoint states. “Ready or delivered” must be labelled explicitly if using the existing helper. All-cancelled is not 100% complete |
| Production graphic | Count orders by their current stored/derived stage. Suggested display groups: Preparation = New/Fabric Ordered/Fabric Received; Making = Cutting/Stitching; Fitting; Finishing; Ready. This grouping never writes new workflow stages. Delivered/Cancelled remain outside active totals |
| Needs attention | Unique order count with one or more known reasons; expanding shows all reasons. Keep overlapping categories transparent; the four dashboard cards are not additive |
| Missing setup | Explicit missing maker, swatch or saved measurement copy on active garment jobs; legacy breakdown absent. These are review needs, not an invented blocked state |
| Team assignment | Separate physical garment jobs from legacy order assignments; exclude cancelled/delivered work; name counts rather than estimated capacity |
| Finance / stock | No invented zero costs, cross-currency aggregate, inferred payment transaction or inferred garment stock reservation. Existing stock calculations are review signals, not transactional inventory guarantees |

Date-only fields remain date-only. Display the date/zone used for “Today”; use an explicit tested reference date, not implicit UTC parsing that shifts dates. A branch filter is not an appointment timezone. Until appointment location/time rules exist, do not claim cross-city appointment scheduling or conversion.

Every graphic needs a visible label and count, keyboard-operable drilldown, a text equivalent, and a defined empty/unknown state. Zero, missing and invalid values must remain distinguishable. Avoid donut charts for overlapping categories and decorative trend lines without historical data.

## 6. Implementation sequence

One development branch and reviewable PR per increment. Inspect current HEAD and instructions again at execution time; source anchors below refer to this review baseline. No deployment without a fresh release request.

| Increment | Work | Completion gate |
|---|---|---|
| **UI-0 — Baseline and summary contract** | Repair CRLF-sensitive test extraction; assert markers exist. Add synthetic edge-case fixtures and the pure summary helpers needed for Today/Orders. Record existing behavior before UI changes | Standard domain suite passes on LF and CRLF; summaries agree on unknown dates, legacy orders, repeat trials and partial delivery; no business-data writes |
| **UI-1 — First visible release** | Shared spacing/type/status styles; compact Today; concise Orders rows/cards; minimal read-only order overview linking existing editors. Preserve routes/actions and search/return state | Desktop/tablet/phone previews; card counts equal drilldown results; first meaningful work visible promptly; no sideways scroll to operate core tracking; workflow rehearsal passes |
| **UI-2 — Order detail and garment/fitting drilldown** | Complete contextual sections; compact garment summaries; keep Add fitting, measurement copies, workshop sheets and commercial review discoverable | Two interactions from an order row to its garment details; additional trial retains previous findings; explicit save/failure/conflict behavior and both print paths pass |
| **UI-3 — Workshop and timeline simplification** | Team count graphic, separate legacy queues, one employee queue at a time, concise event/task timeline with expandable history | No fake overload/hours/early labels; assignments match existing rules; completed/cancelled history remains accessible; no loss of workshop role restrictions |
| **UI-4 — Consistency pass** | Clients, fabrics, measurement chrome and secondary navigation; keyboard/focus/empty states; large-record browsing | Same interaction patterns; preserve cutter sequence and view modes; no usability regression with large synthetic datasets or long names/notes |

**Recommended first implementation scope: UI-0 and UI-1 only.** Review the visual result before extending the same pattern to the other screens. Use a few static wireframes or a local sample-data preview early; avoid a multi-page framework rewrite. Prefer existing HTML/CSS and small SVG/CSS graphics with accessible text over a new charting dependency.

Separate later milestones: payment transactions and explicit INR/GBP handling; hosted storage/authentication; transactional fabric reservations; richer appointments/alterations. Financial currency and cross-currency workshop costing require business decisions before that separate work. They are not prerequisites for this UI cleanup.

## 7. Implementation map and invariants

Baseline source anchors in `index.html`:

- Summaries: `orderWorkflowSummary()` around 1805, `recordedOrderPayments()` around 1825; preserve blank/zero behavior.
- Inventory/economics: `getSwatchAllocationStatus()` around 2836, `calcOrderEconomics()` around 2869; inspect limitations before reusing totals.
- Navigation/render: `go()` around 2972, `render()` around 3027; retain unsaved-draft guards and shared-mode navigation checks.
- Today: `vDashboard()` around 3176.
- Clients: `vClients()` around 3413 and `vClient()` around 3459.
- Measurements: `vMeasure()` around 3878; preferences near `MEASUREMENT_VIEW_KEY`.
- Orders: `orderRows()` around 5061, `vGarmentJobs()` around 5141, `vOrders()` around 5531.
- Workshop: `vTeam()` around 5598. Fabrics/Reports: `vSwatches()` around 5984, `vCosting()` around 6050.
- Shared mode: `shared/client.js`, `shared/data.cjs`, `server/projection.cjs`, server validation. Workshop users must never receive confidential structured fields merely because a new view needs them.

Keep these boundaries intact:

1. No changes to storage keys or business schema are required for the initial UI work. View preferences belong in a separate namespaced preference key, never business backup records.
2. Browsing, filtering, expanding, printing and summary calculations must not save records. UI labels do not migrate workflow state.
3. Retain unknown legacy fields, stable IDs, measurement copies, completed task history, trials, commercial review reasons and recovery exports.
4. Retain the existing draft → apply → save distinction where present. Do not introduce autosave while simplifying controls. Distinguish “Applied to draft”, “Saved locally”, acknowledged staging save and failure.
5. Preserve `latestStoredDatabase()`/`writeDatabase()` behavior and stale-edit protection. Closing or switching a view must not bypass unsaved-edit safeguards.
6. Existing global event delegation, `data-*` actions and browser tests are coupled to the markup. Update deliberately; prefer semantic controls and stable test IDs. Do not weaken tests merely to accept broken routes.
7. If extracting modules, do so separately and update the loopback server's explicit file allowlist, shared-staging asset handling and Pages-relative paths. A framework/build-system migration is not part of UI-1.
8. Keep demo/real storage separation conspicuous but compact. Keep shared staging isolated; no hosted URL, provider setup or real-record import is needed.

Recovery: export current business data before any eventual live rollout; retain the exact released source commit. A presentation-only release should leave the existing data readable by the preceding release. Verify that with synthetic legacy backups. If implementation discovers a schema change is necessary, separate it into a migration proposal with a reversible recovery path rather than slipping it into the UI work.

## 8. Acceptance and verification

Product checks:

- Staff can identify an overdue delivery, the next fitting and a ready garment without reading full task history.
- Today cards, graphics and filtered lists reconcile under the same scope/date. A zero-state does not invent work or show a fake graph.
- Orders search remains directly visible. Open an order and return without losing search, filters, page or scroll.
- Default Orders/Workshop tracking content fits its container at 1440, 1024, 820 and 390 px; test internal overflow as well as document width. A long technical print preview may have separate print-specific rules.
- No full workflow checklist or cost breakdown on Today or in default Orders rows. One obvious primary page action; detail/history remain reachable.
- Add fitting is discoverable in the fitting section; workshop printing is discoverable per garment; measurement Tabbed/All modes remain accessible.
- Keyboard Tab/Enter/Escape work; focus is visible and returns to the opener after closing details. Dialogs trap focus appropriately; tabs expose selected state; touch controls target about 44 px. Test 200% text zoom and long names without clipped controls.
- Destructive/reasoned actions remain explicit, and failure/conflict messages retain the draft rather than disappear in a collapsed section.

Regression fixtures must include: empty database; old orders without jobs/workflow; one suit plus two shirts with different makers/fabrics; repeat fittings; partially delivered orders; all-cancelled jobs; completed tasks with later rework; unknown/zero/invalid values; no delivery date; due today/yesterday; ambiguous branch; long notes; many orders/clients; failed and stale saves. Use a fixed test clock for date-based counts.

Run the relevant existing commands, adjusting selectors only for intentional UX changes:

```sh
npm test
npm run test:browser
npm run test:shared
npm run test:shared:browser
git diff --check
```

Use targeted tests during each increment, then the full applicable suite for the candidate release. Run shared suites whenever shared navigation, rendering, save plumbing or role-visible data could be affected. Do not claim the local owner interface is a new hosted staff login.

Before/after comparison must include screenshots at all four established sizes and a complete rehearsal: find client → measure with keyboard/quarter-inch helper → save → explicitly create order → review garment breakdown → record repeat fitting → print garment sheet → partial delivery → review received total → reload. Also verify A4 docket/garment print output after any shared style changes. Physical iPad keyboard/printer checks remain a pilot task, not a claim based on emulation.

Review baseline on 11 November:

- Standard `npm test`: 0/24 pass because the CRLF-dependent extraction fails before business assertions.
- Isolated diagnostic normalization: 24/24 domain tests pass; no tracked test changes.
- Existing complete synthetic order rehearsal: 4/4 pass across desktop, both tablet orientations and phone.
- Fifteen local demo view/viewport navigation checks: no page JavaScript errors; real-workspace storage untouched.
- No production code changes, deployment, hosted changes or production-record edits were made for this roadmap.

## 9. Handoff prompt

> Implement UI-0 and UI-1 from `docs/ui-simplification-roadmap.md`. Inspect current repository state and any applicable AGENTS.md first; preserve existing work and use a `codex/` development branch. Keep the current browser-local and separate local-staging architecture. Restore the standard regression baseline, implement tested read-only summary helpers, then simplify Today and Orders with a minimal order overview that reuses existing editors. Preserve measurement semantics, additional trials, immutable copies, history, financial/fabric safeguards, search, printing and recovery. Test desktop, both tablet orientations and phone with isolated synthetic data. Show before/after evidence and report remaining limitations. Do not add payment/currency features, redesign storage, touch RISE projects or deploy. Stop after this first reviewable increment; subsequent increments and release need their own instruction.

No additional business approval is needed to *write this plan*. When execution is requested, routine reversible visual decisions can follow these defaults. Ask only if a new business rule materially affects data correctness; do not use that as a reason to stop independent UI work.
