# Development and deployment

## Environment (cowork sessions)

- The source of truth for the code is the **git repository** (lives in `/tmp/hpc` during a session,
  restored from `houseplan-card.git.bundle`: `git clone houseplan-card.git.bundle hpc`).
- The user's folder `houseplan/houseplan-card/` is a mirror of the repo (rsync after every commit)
  + an up-to-date `houseplan-card.git.bundle`.

### ⚠️ File-sync pitfalls (critical)
1. The network mount sometimes serves files **truncated/scrambled** — edits via the Edit tool
   from the Windows side are unreliable. Rule: **apply python patches against a clean copy in /tmp,
   write via bash**, with an assert that count(old)==1.
2. **Run the rollup build ONLY in /tmp/hpc** (`npm ci` is already done). A build on the mount once
   produced a syntactically valid but broken bundle ("wi is not defined") that crashed the rendering
   of ALL HA dashboards (the card is loaded as an extra_module on every page!).
3. `.git` cannot be created on the mount ("Operation not permitted" on dot-directories) — hence the bundle.

## Tests

- Frontend: `npm test` — compiles src/logic.ts+rules.ts (tsconfig.test.json) and runs node:test
  (test/*.test.mjs). Strict typing: `npm run typecheck` (tsc --noEmit, part of `npm run build`).
- Backend: `python -m pytest tests_backend/` — pure validation of custom_components/houseplan/validation.py
  (loaded by path, without importing the HA package).
- IMPORTANT (audit lesson): the rollup typescript plugin reports a syntax error as a WARNING and still
  builds the bundle — a truncated file can "pass". That is why the build starts with `tsc --noEmit`,
  which fails on such errors. Always build with `npm run build`, never bare `rollup -c`.

## Build

```bash
cd /tmp/hpc && npm ci        # once
npx rollup -c                # → dist/houseplan-card.js
node --check dist/houseplan-card.js
cp dist/houseplan-card.js custom_components/houseplan/frontend/
```

## Deployment to the dacha (ha.jbstudio.pro)

- SSH: port **323**, root, key `ha_jb` (the user uploads it to the chat; in the sandbox /tmp/ha_jb, chmod 600).
- JS: `scp -P 323 -i /tmp/ha_jb dist/houseplan-card.js root@ha.jbstudio.pro:/config/custom_components/houseplan/frontend/`
- The whole integration: tar c custom_components/houseplan (--exclude __pycache__) → tar x on the server.
- **Verification is mandatory**: `md5sum` locally == on the server == `curl http://homeassistant:8123/houseplan_files/houseplan-card.js | md5sum`
  (inside the SSH add-on `localhost` is NOT HA, use the host `homeassistant`).
- Python changes require an HA restart (`ha core restart`, holds the connection until it finishes, HTTP
  comes back up in 1–3 min). JS changes — just a page refresh (the static path is served
  with no-cache).
- After deploying JS — check in the browser (Ctrl+F5) and the console (there must be no errors from
  houseplan-card.js; a broken bundle takes down all dashboards).

## Frontend cache and the "empty view"

- The card module URL contains `?v=<VERSION from const.py>`. Browsers keep the ES module in
  memory cache: after deploying new JS **bump VERSION in const.py and restart HA**,
  otherwise a plain F5 will keep the old version.
- After a page reload the HA frontend (with kiosk-mode) sometimes leaves the view empty
  ("InvalidStateError: Transition was aborted", hui-view is not created for 1–2 min).
  Cured by repeating the SPA navigation: pushState + a location-changed event, or just waiting.

## Release

Tag `vX.Y.Z` + GitHub Release → the workflow `.github/workflows/release.yml` builds and attaches
`houseplan-card.js`. Bump the version everywhere in sync: `src/houseplan-card.ts` (CARD_VERSION),
`package.json`, `custom_components/houseplan/manifest.json`, `custom_components/houseplan/const.py`.

## Reproducible scripts (data)

- Extracting the geometry/backgrounds from the prototype and generating `src/data/*` — see the commit
  history and docs/ARCHITECTURE.md (SVG→base-space transforms: f1 0.647/(490,27), f2 0.896/(351,21)).
- Room fitting: render the plan with rectangles overlaid (cv2) → snap to walls → manual fine-tuning.

## Production objects in HA (the dacha)

- Dashboard `plan-doma`, panel view, card `custom:houseplan-card` (icon_size 2.5).
- The houseplan integration: entry loaded, `.storage/houseplan.layout` — the layout (server-side).
- The old prototype `/config/www/houseplan/` (iframe) is kept as a fallback, do not touch.
- configuration.yaml backups: `.bak-avgtemp` (before the average-temperature sensor edit).
