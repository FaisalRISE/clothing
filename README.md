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

Data stays in the browser's localStorage, separately for each origin, browser profile and device. Local preview cannot see the live site's storage. No shared database or authentication is introduced here. Optional Google Sheets export remains a one-way, unacknowledged request.

Read [the measurement milestone report](docs/measurement-milestone.md) before using this version with an existing backup. Export JSON from every browser or device holding business records before rollout.

Read [the garment jobs guide](docs/garment-jobs.md) for reviewing existing order quantities, assigning individual garments and retaining saved measurement copies.
