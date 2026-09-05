# Development and deployment

## Input support contract

Read `docs/TOUCH-SUPPORT.md` before changing interaction code.

- View and kiosk must work well on touch and remain release-blocking surfaces.
- Editors are implemented and accepted against a desktop browser with
  mouse/keyboard first.
- Full editor parity on phones/tablets is not required. If correct touch support
  is expensive, an intentionally reduced or absent touch path is allowed.
- Every editor feature/spec/code review must classify touch as supported,
  best-effort/degraded, or not exposed.
- A degradation is valid only when documented in the same change. It may not
  compromise data integrity, permissions, confirmations or ordinary View.
- Do not add complex gesture state solely to claim touch parity. Prefer a clear
  desktop recommendation or safe unavailable action over unreliable editing.

Existing touch editor behaviour is not silently disposable: when changing a
covered workflow, update its test and documentation explicitly and record why
the degradation is accepted.

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

## Local Windows workstation

The CI contract is **Node.js 22 + Python 3.13**. Do not use Codex's bundled
Node 24 or the machine's default Python 3.14 as proof that a release will pass.

Minimal native setup (PowerShell):

```powershell
winget install --id OpenJS.NodeJS.22 --source winget
winget install --id GitHub.cli --source winget
gh auth login
Set-Location 'C:\Users\Sergey\Downloads\dev\houseplan-dev\houseplan-card-src'
uv python install 3.13
uv venv --python 3.13 .venv
uv pip install --python '.venv\Scripts\python.exe' pytest voluptuous pytest-asyncio
npm ci
npx playwright install chromium
```

Open a new Windows Terminal after installing Node/GitHub CLI so their PATH
changes are visible. Keep the Playwright browser in its normal shared Windows
cache; downloading it inside every repository wastes time and disk space.

WSL2 is optional for the ordinary frontend and pure-backend loop. It is required
only when running the full HA harness locally: current Home Assistant imports
the Unix-only `fcntl` module and cannot start its pytest plugin on native
Windows. Keep a WSL clone inside the Linux ext4 filesystem rather than under
`/mnt/c`, otherwise dependency installs become slower. The release CI always
runs this harness on Ubuntu and gates the exact tagged commit. Docker Desktop is
not currently required. Do not install the full Home Assistant pytest stack
natively just for this repository: its pinned `lru-dict==1.3.0` first requires
Visual Studio Build Tools to compile, but the resulting plugin still cannot run
without `fcntl`.

Useful repo-local Git settings on NTFS (optional for this small repository):

```powershell
git config core.fsmonitor true
git config core.untrackedCache true
```

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
- Pure backend on native Windows (with no HA plugin autoload):
  `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'; .\.venv\Scripts\python.exe -m pytest
  -p pytest_asyncio.plugin tests_backend/test_validation.py
  tests_backend/test_trails.py tests_backend/test_trail_recorder.py -q`.
- Full backend (including `test_ha_*.py`): `python -m pytest tests_backend/ -q`
  in CI or WSL/Linux only.
- IMPORTANT (audit lesson): the rollup typescript plugin reports a syntax error as a WARNING and still
  builds the bundle — a truncated file can "pass". That is why the build starts with `tsc --noEmit`,
  which fails on such errors. Always build with `npm run build`, never bare `rollup -c`.
- Before committing a frontend source change, run `npm run bundle:sync`. Rollup writes
  `dist/houseplan-card.js`, `dist/houseplan-assets.json` and content-hashed chunks under
  `dist/houseplan-assets/`; the command synchronizes that complete tree to the committed
  integration snapshot and the untracked demo copy, then verifies every manifest hash.
  `node scripts/bundle-tree.mjs dist custom_components/houseplan/frontend` is the
  read-only parity check used by CI and release automation.
- The first-space/import dialog is a separate `houseplan-onboarding-runtime-*`
  chunk. Do not fold it into `houseplan-editor-runtime-*`: empty-install
  onboarding is a View prerequisite, while a configured View must request
  neither lazy runtime until the corresponding user intent.

## Maintenance diagnostics

### Labs presentation flags

Labs is an internal, presentation-only runtime in `src/labs.ts`; it must never
gate config/schema migrations, persistence writes, HA services or network
requests. `?hp_alpha=1` or `#hp_alpha=1&space=<id>` enables every experimental
capability in the current build and persists `1` in
`houseplan_card_alpha_v1`; `hp_alpha=0` disables them and persists `0`. Query is
applied before hash and the last exact `1`/`0` wins. The URL is not rewritten,
unknown values fail closed for the current resolution, and the legacy
`hp-labs`/`houseplan_card_labs_v1` inputs are not read or migrated. Diagnostics
expose the boolean `window.__hpAlpha` together with the frozen sorted
`window.__hpLabs` capability array.

To add a capability, add one unique lowercase id plus issue and a non-empty
summary to `LABS_FLAGS`, then cover registry validation and the alpha-on active
set. Capabilities have no individual public key or version lifetime: the one
persisted alpha switch is deliberately indefinite until the owner changes the
contract. See `docs/ISOMETRIC.md` for the current use.

These commands are read-only diagnostics, not release gates:

```bash
# Show registered legacy/internal fields or inspect an exported config locally.
npm run audit:config
npm run audit:config -- path/to/houseplan-config.json

# Reproducible synthetic large-house report (seven measured samples + warm-up).
npm run benchmark:large-house -- --samples=7 --warmups=1 --output=artifacts/performance/local.json

# Hidden isometric profile; diagnostic only outside exact-SHA Linux CI.
npm run benchmark:large-house-isometric -- --samples=7 --warmups=1 --output=artifacts/performance/isometric-local.json

# Golden candidates never overwrite reviewed references.
npm run golden:capture
npm run golden:verify
npm run golden:accept -- --reviewed
```

The config audit performs no network requests and does not rewrite the input.
Its registry and lifecycle rules are documented in `CONFIG-COMPATIBILITY.md`.
The blocking performance workflow runs its independent profile pairs in
parallel. Inside each pair it captures the base SHA and candidate sequentially
on one pinned Chromium/CI runner, applies the same relative and absolute budget,
and uploads both reports plus the comparison. This preserves same-machine
comparability without serialising the whole matrix beyond the job timeout. A
developer-laptop report remains a diagnostic and must not be used to loosen CI
limits. See
`demo/performance/README.md`.
When the comparison base predates `scripts/bundle-sync.mjs`, the workflow still
builds that exact tree and materializes its fresh bundle through the equivalent
legacy copy path. This keeps old stable releases usable as performance baselines
without borrowing build output from the candidate. Comparative benchmark
launches also pass that target tree as the freshness authority; the ordinary
smoke launcher continues to default to the current repository root.
Both browser diagnostics require a freshly built/copied demo bundle. Rollup
embeds a SHA-256 fingerprint of `src/` plus the locked package and
Rollup/TypeScript build inputs; benchmark/golden runners fail before
capturing anything when `demo/srv/assets/houseplan-card.js` is stale. Golden
commands and the explicit review workflow are documented in
`demo/golden/README.md`.

## Build

```bash
cd /tmp/hpc && npm ci        # once
npm run bundle:sync          # build + entry/manifest/chunks → integration + demo
npm run bundle:budget        # initial View graph must stay <= 256000 B gzip
node scripts/bundle-tree.mjs dist custom_components/houseplan/frontend
```

## Deployment to the dacha (ha.jbstudio.pro)

- SSH: port **22222**, root, key `ha_jb` (lives in the user folder `houseplan/.secrets/ha_jb`,
  outside git; copy into the sandbox with chmod 600 — only ask the user if it is gone).
- **The HA config root is `/mnt/data/supervisor/homeassistant`** — in this SSH
  environment `/config` does not exist; a deploy aimed at `/config/...` fails
  with "No such file or directory".
- Frontend: copy the complete `custom_components/houseplan/frontend/` tree.
  Copying only `houseplan-card.js` is unsupported: the entry imports hashed chunks and
  validates its editor runtime against the build fingerprint.
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
- **CSS `filter: blur()` on an SVG group is applied in name only** in Chromium:
  `getComputedStyle` returns `blur(1px)`, and the rendered result changes by a
  couple of hundred pixels on a whole plan — i.e. not at all. Use an SVG
  `<filter>` with `feGaussianBlur` and `filterUnits="userSpaceOnUse"`. One
  filter over the light layer costs about a fifth of one blurred mask per
  source (60 sources: 66 ms vs 206 ms).
- **A geometry cache must be keyed by the geometry, not by `_cfgEpoch`.** The
  epoch lags behind edits made in place (boundary/opening tools mutate the
  space object), and a stale barrier set is invisible: the plan keeps lighting
  through a wall that already exists. `_lightBarriers` hashes its own inputs
  instead, and the same fingerprint keys the per-source region cache.
- **Segments that cross must be split before a visibility sweep.** The sweep
  casts a ray at every barrier ENDPOINT; two faces crossing in their middles —
  normal where wall bodies meet at a junction — leave that corner unsampled and
  the fan closes it with a chord, so a sliver of floor next to a corner the
  lamp plainly sees goes dark. `splitAtIntersections` removes the whole class.

## Release

### Primary prerelease path

Prepare the candidate as usual: synchronize every version field, add dated RU
and EN changelog sections, update the production bundle snapshots and write the
short bilingual body in `docs/RELEASE-NOTES.md`. That file is the one current
instance of the canonical `## Основное` / `## Highlights` template; its two
changelog links must be pinned to the new tag.

After the candidate commit is pushed to `dev` and its exact-SHA Validate is
green, publication is one command:

```powershell
npm run release:prerelease -- v1.61.0-beta.4 --issues=63,64 --yes
```

Omit `--yes` for an interactive tag confirmation. Use the same fail-closed
preflight without creating a tag or release with:

```powershell
npm run release:check -- v1.61.0-beta.4 --issues=63,64
```

The orchestrator requires a clean, synchronized `dev`, byte-identical bundle
snapshots and a completed green Validate for `HEAD`. Snapshot hashes and the
uploaded standalone JS are read from the exact Git blobs rather than checkout
bytes, so Windows CRLF conversion cannot disagree with the LF-tagged archive.
The archive command additionally forces `core.autocrlf=false` for that one
operation; it does not modify the developer's Git configuration.
It creates or verifies an
annotated exact-SHA tag, builds `houseplan.zip` directly from that committed
tree, verifies its manifest and embedded frontend against the candidate hash,
stages a draft prerelease and uploads both assets. Only then does it make the
release public. It locates the Release, HACS-zip and Telegram runs by workflow
file plus exact tag/SHA, verifies the downloaded public asset contents and
paginated HACS prerelease order, and finally closes only the explicitly supplied
issues and strips their status label. Re-running the same command
after a partial failure is safe when local/remote tags still resolve to the same
SHA: stale public assets are replaced and verified rather than accepted or left
for manual deletion. ZIP inspection is implemented in Node and does not depend
on the host's `tar`/`unzip` variant. A per-tag local lock and GitHub workflow
concurrency reject parallel runs; the local lock is removed on normal exit and
on handled `SIGHUP`/`SIGINT`/`SIGTERM` interruption (`SIGKILL` cannot be handled
by any process).

`Publish prerelease` in GitHub Actions is the browser/button equivalent. Select
the `dev` branch and enter the exact tag. It performs the same contract and
draft-first publication entirely on GitHub, including both assets. Prereleases
are intentionally silent in Telegram; only stable releases are announced.
GitHub exposes a `workflow_dispatch` button only after
the workflow file exists on the default branch; until the next promotion to
`main`, use the local command. The button deliberately does not close Issues:
closing them is the release manager's call, and the `close-merged` job does it
from the beta itself (#120).

The older release-event workflows remain supported as a recovery/manual
fallback. They still gate assets on the exact tagged SHA, so adopting the new
path does not weaken releases created through the old path.

Tag `vX.Y.Z` + GitHub Release → `.github/workflows/release.yml` resolves that
tag to its exact commit, waits for every Validate run of the SHA to complete
successfully, then builds and attaches `houseplan-card.js`. A missing, failed,
cancelled or one-hour-timed-out Validate withholds the asset. Bump the version
everywhere in sync: `src/houseplan-card.ts` (CARD_VERSION), `package.json`,
`custom_components/houseplan/manifest.json`, `custom_components/houseplan/const.py`.

Validate intentionally runs on branch pushes, not tag pushes, so an annotated
release tag does not duplicate the expensive browser/performance matrix. Every
tagged SHA must therefore already be pushed to a branch and have a completed
green exact-SHA Validate run. For an owner-approved emergency hotfix, push a
temporary `hotfix/*` branch and wait for Validate before creating the tag;
never tag a detached or otherwise unpushed commit, because the release gate
will wait for a run that cannot exist and then fail closed after one hour.

The GitHub Release body is a concise **bilingual user summary**, not a copy of
the exhaustive changelog. Put Russian first and English second, with equivalent
meaning in both sections. Give separate bullets only to significant features
and user-visible behaviour changes. Collapse minor fixes, visual polish,
refactors, tests and purely internal improvements into one final bullet:
`Мелкие исправления и улучшения.` / `Small fixes and improvements.` Keep the
body short because HACS displays it inside Home Assistant and concatenates the
bodies of skipped releases. The full detail remains in both
`docs/CHANGELOG.ru.md` and `docs/CHANGELOG.md`; finish every release body with
two explicit links, one to each language version of the changelog.

Changelog entries may link directly to a **closed** GitHub Issue when that
issue is the canonical task for the shipped change. Append a normal Markdown
link such as `([#55](https://github.com/Matysh/houseplan-card/issues/55))` to
the relevant bullet in both language changelogs. Keep this optional: do not
invent issues for minor work, do not link open or partially delivered issues,
and do not expand the grouped small-fixes bullet into an issue inventory.

```md
<!-- release: vX.Y.Z -->

## Основное
- Значимое изменение.
- Исправлена конкретная проблема ([#123](https://github.com/Matysh/houseplan-card/issues/123)).
- Мелкие исправления и улучшения.

## Highlights
- Significant change.
- Fixed a specific problem ([#123](https://github.com/Matysh/houseplan-card/issues/123)).
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/vX.Y.Z/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/vX.Y.Z/docs/CHANGELOG.md)
```

The literal `## Основное` and `## Highlights` headings above are the canonical
release-body format. Do not maintain a second `## Русский` / `## English`
template in scripts or release notes; change this single template if the
product format changes again.

Replace `vX.Y.Z` with the release tag so the links remain pinned to the
published version instead of drifting with `dev` or `main`.

Local release gates are deliberately different. A pre-release runs
`npm run build` plus only the unit tests and browser smokes selected for the
changed surfaces; record the exact selection in the release handoff. A stable
release runs the complete local frontend, backend and smoke gates before its
tag is created. The exact-SHA Validate required by `release.yml` remains in
force for both and can run a broader matrix automatically; the local policy
does not weaken the publication guard.

Feature promotion has an additional hard gate: every new feature or material
behaviour change must spend at least one published beta/RC before stable. A
stable release commit may change only version fields, generated bundle
snapshots and changelog/release metadata; feature source changes belong in the
preceding pre-release commit. Skip this step only for an explicit owner-approved
emergency hotfix, and document the exception in the handoff.

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
`demo/srv/assets/houseplan-card.js` copy, which `npm run bundle:sync` writes and which is not committed (#255).

`updateComplete` proves only that Lit finished its own update. Pointer-owned
editor state can be painted later by `live-editor`, outside that cycle. Browser
checks which read live editor DOM must await the lazy runtime's
`_whenLiveEditorSettled()` contract; a timeout, sleep or fixed number of RAFs is
not evidence that the latest projection was applied. If a smoke changes editor
mode before dispatching synthetic gestures, it must also wait for the observable
mode-transition and viewport-refit state to settle, because the stage can finish
its physical resize after the Lit update (#460).

When adding a checklist line marked `[auto: ...]` in docs/TESTING.md, add the
failing check in the same commit — that is what the marker now promises.
