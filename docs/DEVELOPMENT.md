# Development and deployment

## Environment (cowork sessions)

- The source of truth is **GitHub `main`** (https://github.com/Matysh/houseplan-card).
  In a sandbox session restore from it or from `houseplan-card.git.bundle`
  (`git clone houseplan-card.git.bundle hpcN` into a **fresh** /tmp directory).
- The user's folder `houseplan/houseplan-card/` is a file mirror (synced after every commit)
  + an up-to-date `houseplan-card.git.bundle`. The mount cannot delete files — stale
  artifacts linger there; git is authoritative.
- `/tmp` persists between sessions, **but files created in previous sessions belong to
  `nobody` and are unreadable** (this hit `/tmp/hpc`, `/tmp/ha_jb`, `/tmp/shots/srv`).
  Always clone into a new directory and re-run `npm ci`; ask the user to re-upload `ha_jb`.
- Headless Chromium for smoke tests: `PLAYWRIGHT_BROWSERS_PATH=/tmp/pw npx playwright
  install chromium-headless-shell`, then run with `LD_LIBRARY_PATH` pointing to the
  extracted lib dirs (`libs/lib/x86_64-linux-gnu:libs/usr/lib/x86_64-linux-gnu:.../nss`).
- Restart HA over SSH with `nohup ha core restart >/dev/null 2>&1 </dev/null &` —
  a plain `ha core restart` holds the SSH session until the sandbox call times out.
- GitHub pushes: classic PAT (repo+workflow scopes), created via the user's Chrome;
  stored in `~/.git-credentials` for the session.

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

- SSH: port **22222**, root, key `ha_jb` (lives in the user folder `houseplan/.secrets/ha_jb`,
  outside git; copy into the sandbox with chmod 600 — only ask the user if it is gone).
- **The HA config root is `/mnt/data/supervisor/homeassistant`** — in this SSH
  environment `/config` does not exist; a deploy aimed at `/config/...` fails
  with "No such file or directory".
- JS: `scp -P 22222 -i <key> dist/houseplan-card.js root@ha.jbstudio.pro:/mnt/data/supervisor/homeassistant/custom_components/houseplan/frontend/`
- Cache busting: `sed` the `?v=` version in `.storage/lovelace_resources`, then restart HA.
- **The `frontend/` subfolder is not optional.** `__init__.py` registers
  `Path(__file__).parent / "frontend" / "houseplan-card.js"` as the static path.
  A copy dropped next to `__init__.py` (…/houseplan/houseplan-card.js) is served
  by nobody: md5 on the server matches, the browser still gets the old bundle,
  and hours go into debugging a bug that was already fixed. Cost this mistake
  once: 2026-07-27, two releases deployed into the void.
- The whole integration: tar c custom_components/houseplan (--exclude __pycache__) → tar x on the server.
- **Verification is mandatory, and it must go over HTTP** — comparing md5 against
  the file you just copied proves nothing about what the browser receives. The
  one check that counts:
  `curl -s https://ha.jbstudio.pro/houseplan_files/houseplan-card.js | grep -o '1\.[0-9]*\.[0-9]*' | sort -u`
  must print the version just built. (Inside the SSH add-on `localhost` is NOT
  HA — use the host `homeassistant`.)
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

## Dependency and cache gotchas

- **polygon-clipping is a trap**: its `.d.ts` declares named exports but the ESM build has only
  a default export — tsc or the runtime breaks, whichever you appease. Use **polyclip-ts**
  (proper ESM + native types; same results, +~50 KB bundle via bignumber.js).
- **Redeploying the same version keeps the resource URL** (`/houseplan_files/houseplan-card.js?v=X`),
  so browsers may serve the previous bundle from cache. Bump the version for anything users must
  pick up, or hard-refresh (Ctrl+Shift+R) when testing a hotfix redeploy.

## Release

Tag `vX.Y.Z` + GitHub Release → `.github/workflows/release.yml` resolves that
tag to its exact commit, waits for every Validate run of the SHA to complete
successfully, then builds and attaches `houseplan-card.js`. A missing, failed,
cancelled or one-hour-timed-out Validate withholds the asset. Bump the version
everywhere in sync: `src/houseplan-card.ts` (CARD_VERSION), `package.json`,
`custom_components/houseplan/manifest.json`, `custom_components/houseplan/const.py`.

## Reproducible scripts (data)

- Extracting the geometry/backgrounds from the prototype and generating `src/data/*` — see the commit
  history and docs/ARCHITECTURE.md (SVG→base-space transforms: f1 0.647/(490,27), f2 0.896/(351,21)).
- Room fitting: render the plan with rectangles overlaid (cv2) → snap to walls → manual fine-tuning.

## Production objects in HA (the dacha)

- Dashboard `plan-doma`, panel view, card `custom:houseplan-card` (icon_size 2.5).
- The houseplan integration: entry loaded, `.storage/houseplan.layout` — the layout (server-side).
- The old prototype `/config/www/houseplan/` (iframe) is kept as a fallback, do not touch.
- configuration.yaml backups: `.bak-avgtemp` (before the average-temperature sensor edit).


## Smoke tests (since 2026-07-27)

Every `demo/smoke_*.mjs` ends with:

```js
checkAll(out);            // every key must be true...
checkAll(out, { n: 4 });  // ...unless an expected value is given
await finish(browser, out);
```

`finish` prints the JSON dump (useful on failure), reports named mismatches and
sets a non-zero exit code — including when the card threw during the run. The
suite runs in CI (`smoke` job) against a freshly built bundle; never test the
committed `demo/srv/assets/houseplan-card.js` snapshot.

When adding a checklist line marked `[auto: ...]` in docs/TESTING.md, add the
failing check in the same commit — that is what the marker now promises.
