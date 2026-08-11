# AGENTS.md

House Plan is one HACS package with two parts plus a demo harness:

- **Lovelace card** (`src/`, TypeScript + Lit) — the primary product, bundled to `dist/houseplan-card.js`.
- **Storage integration** (`custom_components/houseplan/`, Python) — the Home Assistant backend.
- **Demo harness** (`demo/`) — a self-contained Playwright page (`demo/srv/demo.html`) that renders the card against a fake `hass`, used for screenshots and the `smoke_*.mjs` end-to-end suite.

Standard commands live in `package.json` scripts, `CONTRIBUTING.md`, and `docs/DEVELOPMENT.md`. Read `docs/ARCHITECTURE.md` and `docs/STATUS.md` before non-trivial changes.

## Two-agent workflow

House Plan is developed by two agents: **Codex is the author** (analysis,
estimate, spec, implementation) and **Claude is the reviewer** (estimate, spec,
code). They exchange remarks through a local, git-ignored message bus —
**read `.agents/PROTOCOL.md` before acting on any task**. It defines the
message format, the estimate scales every agent must use, the three stages
(`estimate` → `spec` → `code`), the three-round convergence limit and what gets
published to GitHub.

Two rules that matter even if you read nothing else:

- write only into the *other* agent's inbox, never edit a file you did not
  create, and move a processed message to `.agents/archive/`;
- "verified" without a command and its output is not evidence — from either side.

## Canonical backlog

GitHub is the only active backlog for House Plan:

- [GitHub Issues](https://github.com/Matysh/houseplan-card/issues) are the
  canonical task records: problem, scope, acceptance criteria and discussion.
- [GitHub Projects (v2)](https://github.com/users/Matysh/projects/1) is
  the canonical prioritization and workflow-status view. Every open in-scope
  issue must be present there.

Before starting planned work, find or create its issue and keep its description,
labels and Project status current as decisions and implementation state change.
Close an issue only after the result is verified. Specs, audits and ADRs may
remain under `docs/`, but must link to their issue and must not become a parallel
task list. When repository documentation disagrees with Issues or Project v2,
the GitHub backlog wins.

## Cursor Cloud specific instructions

The startup update script already runs `npm ci`, provisions a Python 3.13 backend venv at `.venv-backend`, and installs Playwright Chromium. You do not need to reinstall dependencies.

- **Frontend** (from repo root): `npm run typecheck`, `npm test` (node:test, 424 tests at v1.60.0), `npm run build`. After building, keep both committed snapshots in sync — `cp dist/houseplan-card.js custom_components/houseplan/frontend/` and `cp dist/houseplan-card.js demo/srv/assets/`. CI enforces both comparisons byte-for-byte.
- **Backend HA-harness tests need Python 3.13, not the system 3.12.** Run them with the venv: `.venv-backend/bin/python -m pytest tests_backend/ -q` (150 tests at v1.60.0: 100 pure + 50 HA harness). Running `python3 -m pytest tests_backend` without Home Assistant silently **skips** the `test_ha_*.py` harness tests (`conftest.py` ignores them when `homeassistant` is not importable) and runs only the pure set.
- **Running the app / smoke suite**: build a fresh bundle and copy it into the demo assets first — `npm run build && cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` — then run `node demo/smoke_*.mjs`. The committed demo snapshot must remain byte-identical to `dist` (CI checks it); rebuilding first also guarantees the browser suite tests the current source in an uncommitted worktree. No real Home Assistant server is required: `demo/srv/demo.html` stubs `hass`, registries and `callService`.
- **Golden images**: `npm run golden:capture` and `npm run golden:verify` refuse a stale demo bundle. Build and copy the current bundle first, then review `artifacts/golden/actual/` and `diff/`. Update baselines only with `npm run golden:accept -- --reviewed`, using the complete Linux CI artifact; never accept a partial scenario or images merely to make CI green. See `demo/golden/README.md`.
- **Freshness contract**: the embedded fingerprint covers `src/` plus Rollup, TypeScript and package-lock build inputs. Benchmark and golden tooling must call `assertFreshDemoBundle` before recording any result; a missing or mismatched fingerprint is a hard failure, not a warning.
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

## Promotion rule

Every new feature or material behaviour change must be published as a beta/RC
before it can enter a stable release, even when its local audit is clean. The
stable release commit is promotion-only: version fields, generated bundle
snapshots and changelog/release metadata. Do not add feature source code in
that commit. An explicit owner-requested emergency hotfix is the only exception
and must be called out in the release handoff.
