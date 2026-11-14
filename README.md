# Modisto Bespoke

A static tailoring management application. The application lives in `index.html` and runs in a browser. GitHub Pages hosts the published version.

## Local preview and checks

Requires Node.js 22+ and installed Chrome (the test configuration can use `channel: 'msedge'` instead).

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4187/`. A new browser workspace starts empty. Use Settings → Open separate demo workspace, or visit `http://127.0.0.1:4187/?demo=1`, to explore sample records. Demo data has its own storage key. Never import a real backup into demo mode.

```sh
npm test
npm run test:browser
```

The browser suite uses isolated browser contexts and synthetic/sample records. It covers 1440×1000 desktop, 820×1180 portrait tablet, 1024×768 landscape tablet and 390×844 phone. Screenshots and A4 PDFs are written to ignored `test-results/`. The server listens on loopback only and serves just the application.

## Data and recovery

The published application and normal local preview keep data in the browser's localStorage, separately for each origin, browser profile and device. Local preview cannot see the live site's storage. Optional Google Sheets export remains a one-way, unacknowledged request in that browser-local mode.

An opt-in **local shared-data staging environment** is available with `npm run shared:start` on port 4188. It has a separate embedded PostgreSQL database, owner/office/workshop test accounts, acknowledged saves, conflict detection and reviewed backup imports. It never automatically imports browser records. Read [the staging setup and recovery guide](docs/shared-staging.md) before starting it. Hosting and managed authentication are deferred; it does not connect to either RISE Supabase project. Use synthetic records only.

Run `npm run test:shared` and `npm run test:shared:browser` to verify that separate environment. These do not require a hosted account or paid service.

Read [the measurement milestone report](docs/measurement-milestone.md) before using this version with an existing backup. Export JSON from every browser or device holding business records before rollout.

Read [the garment jobs guide](docs/garment-jobs.md) for reviewing existing order quantities, assigning individual garments and retaining saved measurement copies.

Read [the sample-order workflow check](docs/workflow-check.md) for the client → measurements → four garment jobs → fitting → workshop sheets → delivery → reviewed financial totals rehearsal and its remaining limitations.

Read [the UI simplification roadmap](docs/ui-simplification-roadmap.md) for the review and implementation history. Today and Orders lead to contextual order sections, and Workshop shows garment and legacy order assignments separately. Clients and Fabrics use searchable directories, and mobile navigation keeps Today, Orders and Measure in view.
