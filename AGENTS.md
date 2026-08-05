# AGENTS.md

House Plan is one HACS package with two parts plus a demo harness:

- **Lovelace card** (`src/`, TypeScript + Lit) — the primary product, bundled to `dist/houseplan-card.js`.
- **Storage integration** (`custom_components/houseplan/`, Python) — the Home Assistant backend.
- **Demo harness** (`demo/`) — a self-contained Playwright page (`demo/srv/demo.html`) that renders the card against a fake `hass`, used for screenshots and the `smoke_*.mjs` end-to-end suite.

Standard commands live in `package.json` scripts, `CONTRIBUTING.md`, and `docs/DEVELOPMENT.md`. Read `docs/ARCHITECTURE.md` and `docs/STATUS.md` before non-trivial changes.

## Cursor Cloud specific instructions

The startup update script already runs `npm ci`, provisions a Python 3.13 backend venv at `.venv-backend`, and installs Playwright Chromium. You do not need to reinstall dependencies.

- **Frontend** (from repo root): `npm run typecheck`, `npm test` (node:test, ~270 tests), `npm run build`. After building, keep the integration copy in sync — `cp dist/houseplan-card.js custom_components/houseplan/frontend/`. CI enforces `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` byte-for-byte.
- **Backend HA-harness tests need Python 3.13, not the system 3.12.** Run them with the venv: `.venv-backend/bin/python -m pytest tests_backend/ -q` (126 tests). Running `python3 -m pytest tests_backend` on the system 3.12 silently **skips** the `test_ha_*.py` harness tests (`conftest.py` ignores them when `homeassistant` is not importable) and runs only the ~83 pure tests.
- **Running the app / smoke suite**: build a fresh bundle and copy it into the demo assets first — `npm run build && cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` — then run `node demo/smoke_*.mjs`. The committed `demo/srv/assets/houseplan-card.js` is a stale snapshot; testing it reports green about code that no longer exists. No real Home Assistant server is required: `demo/srv/demo.html` stubs `hass`, registries and `callService`.
- **Demo harness render quirk**: the fake `hass` in `demo.html` is set once, so opening the page directly in a browser renders the floor plan but **device icons only appear after a re-render** (an F5 refresh, or nudging `card.hass = {...card.hass}`). The smoke launcher `demo/serve.mjs` already does this nudge; a plain browser session does not. This is a harness limitation, not a card bug.
- **Known environment-sensitive smoke**: `demo/smoke_opening_measure.mjs` fails two sub-checks (`place_dialog_x_magnetised`, `place_committed_x_center`) under the pinned Chromium — a `1e-6`-tolerance magnet-snap on the opening-*placement* path. It reproduces against the pristine committed bundle, so treat it as pre-existing/pixel-precision, not a regression you introduced.
- **Owner's local Windows checkout is invisible here.** Path
  `C:\Users\Sergey\Downloads\dev\houseplan-dev` (workflow notes + often
  unpushed edits) is **not mounted** into managed Cloud Agent VMs. Do not
  expect to `ls` or diff that folder. To bring local work into the cloud
  agent: push a branch to GitHub and say its name, or run a **local** Cursor
  Agent / My Machines worker inside that checkout. Day-to-day source of truth
  for cloud sessions remains **`origin/dev`** (minors) and **`origin/main`**
  (releases) — see `docs/STATUS.md`.
