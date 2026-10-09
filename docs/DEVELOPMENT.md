# Development and deployment

## Connected-floor Select node movement (#834)

`test/fixtures/834-node-connected.json` retains the anonymised 8-room, 30-wall,
14-opening geometry from the beta.9 report, not HA identifiers or device data.
`wall-node-connected.test.mjs` scans 100 adjacent positions and checks masonry,
floor holes and opening cuts; the two-room reduction proves this is independent
of HA state. The Python companion executes the unchanged server's independent
proof and exact inverse on the same 100 positions.

`wall-shell-topology.test.mjs` independently exercises the rare numerical retry.
A valid canonical operand loses a thin neck while its right lobe joins another
component after rounding: every hole survives and sorted ring counts remain
`[2, 3]`, but one hole changes owner. The retry must reject that result and keep
the exact original exception, without attempting the repaired merge. Boundary
identity binds each outer to its own holes and accepts only representation
changes, including exact zero-area retraces in the two-room regression. Equal
area/counts or a global bag of rings cannot prove identity; a one-ULP bend is
not collinear and cannot be silently removed.
The fresh-build bundle unit follows the existing #699 distinction: an ordinary
task may use the full 2,000-byte growth band; only a release candidate must
restore its additional noise reserve. It uses the canonical `bundle-policy
--must-match` selector, not a second ceiling 500 bytes below the actual gate.
The absolute View wall, graph ceilings and performance budgets are unchanged.

`smoke_wall_node_connected.mjs` is a normal CI-discovered smoke and the
`benchmark:wall-node-connected` command. Its native CDP stream does not wait for
two animation frames between moves. Every submitted input has an immutable
browser-clock timestamp; browser-coalesced/superseded inputs are reported
explicitly, never counted as separately painted positions. Independent
round-trip probes before each mouse-down bound the offset from the injector's
monotonic clock to the browser's monotonic clock. The lower offset bound is
conservative: it cannot make the source input appear later and under-report
latency. Source clocks are frozen before dispatch and never fitted to measured
inputs. Eight fixed probes include 0.1 ms clock-quantisation bounds, require at
most 1 ms uncertainty, and must remain consistent with independent post-gesture
probes; there is no retry-until-pass loop. Native CDP events use their own
monotonic timestamp, without an epoch
timestamp override. Unique exact positions identify the source inputs; order,
ownership, causal timestamps and the final input remain mandatory. A missing
final input or uncertain calibration fails the run. Unmatched native extras
stay in raw evidence without an invented source clock or paint latency, and
cannot block readiness of the complete matched stream. The report retains
cold/warm samples, complete candidate/proof/paint CPU, input-to-paint opportunity,
long tasks and proof counts. The test also exercises previously rejected
neighbours, actual new wall coverage, cancellation, one commit and Undo/Redo.
The paint observer uses the same producer-phase rule before and after: a
synchronous DOM update inside rAF has a paint opportunity before the next rAF;
a task/microtask update needs two rAFs because the first can precede its paint.
It observes/delegates native rAF calls without changing their IDs or pacing
input. Raw data also retains the unconditional two-rAF upper bound so the
scheduler change cannot hide the measurement difference. Neither number claims
a compositor presentation timestamp. The 50/100/150 ms budgets are unchanged.
CI also preserves the complete raw report, including partial failure evidence,
in `smoke-logs/smoke_wall_node_connected.raw.json` after measurement finishes.
The first full #834 CI found CPU p95 50.8 ms against the unchanged 50 ms limit.
Follow-up corner grouping and exact remote-hole exclusion reduce actual work,
not sampling or thresholds. Units compare all 100 positions with the original
floor subtraction and exercise each grouped-corner failure stage; touching,
enclosing and ambiguous holes retain the original operand and proof.
The next full run (37840038041) passed the other 312 browser smokes but found
CPU p95 75 ms and input-to-paint p95 143.907 ms. Its raw report shows roughly
1.93 times the local steady CPU for identical targets, not an input-clock or
queueing defect. The next optimization reuses canonical opening masks and
avoids only conservatively proved redundant fans; failed grouped operations
retain their historical fallback. The budgets
and native input protocol do not change.
The third CI run (37848952720) instead timed out in warmup: a successful
capture vanished before the first recorded move. A minimal native control
isolated the test-driver defect: CDP `mouseMoved` with `buttons: 1` but no
`button` lost capture; explicitly carrying `button: 'left'`, as Playwright
does, retained it. The identical throttled harness then completed all eight
gestures and the functional/history checks. Throttled timings are diagnostic,
not acceptance evidence. The driver now has a separate native capture probe
before the measured fixture; cadence, frozen clocks, workload and budgets are
unchanged. No camera-settling delay is used to hide the input defect.
Independently, accepted Select capture now freezes an in-flight camera at its
presented frame, matching the existing canvas pointerdown contract.
The lazy floor operation also uses the exact complement identity only after
proving containment in one outer contour and strict separation from every
other masonry component. Partial floors, islands, subject holes and failed
operations have explicit negative witnesses. The 100-position comparison uses
ordinary `wallBodiesGeometry` with no optimized ports, including material,
component/hole counts and strict proof verdicts.
The earlier epoch-based protocol exposed a 2.3 ms conversion step within one
gesture despite stable pre-gesture probes; the final native input was delivered
and painted. It is not accepted as performance evidence. Before/after figures
must use the same monotonic protocol, not mix it with those historical runs.
The old 200-room synthetic node benchmark selects only 0–2 disconnected rooms
per gesture; it is not evidence for a connected residential floor.

The full a249d62d run (37871638284) still failed the unchanged native limits:
CPU p95 54.3 ms, input-to-paint p95 123.663 ms. Its first candidate after each
Esc rebuilt the identical baseline; source painting also restored and immediately
reapplied all opacity/mask overrides, forcing a style barrier every frame.
One exact-context baseline now survives cancellation, while candidate geometry
and proof do not. Source style overrides are diffed, with a transition barrier
only when restoring a departing room opacity override. The adapter acquires
generic live-layer ownership once per gesture. The same native protocol remains
unchanged, including cold-first raw data; no preparation moves before real input.
`wall-node-card-adapter.test.mjs` covers value/reference/revision/context changes,
local-component replacement, failed baseline and write/disposal retirement.
`wall-node-paint.test.mjs` covers steady writes, valid/invalid mask changes,
full-render style adoption, replacement nodes and exact terminal restoration.

The r2 boundary-splice follow-up compares each added edge with both retained
edges and earlier added edges using the same exact predicates. Defensive
public-helper witnesses reject new/new crossings, overlaps and interior
contacts; a shared endpoint remains legal. The negative cases demonstrate
refusal directly, without claiming that malformed inputs pass the production
canonical-value certificate. Nightly anchors guard the complete crossing check
and the added-edge accumulation; local validation only checks the registry.

Full Validate 37881199359 on d4bd6e2c passed the other 312 browser smokes but
failed the unchanged native CPU/input limits at 50.2/109.858 ms. The next narrow
optimization reuses the exact predicate coordinate map for output area signs,
and constructs live handle templates before committing paper/room SVG. The
previous ordering read stage width after those writes and could force layout.
The executable paint witness fails on that old ordering, covers captured,
valid and invalid frames, and rechecks the scale on the next paint. Exact-area
witnesses retain a one-ULP positive triangle whose ordinary floating-point
shoelace sum is zero, and reject zero/opposite signs. Native input/clock and
performance budgets remain unchanged.

Never pass render-unit, opening-cut geometry directly to junction clearance.
Only a compatible pre-opening component explicitly normalized to config units
may be shared; open-span/incompatible cases retain the independent proof.
The numerical retry must not accept degraded geometry or discard a failed hole.
Registry anchors are checked locally; actual mutants remain nightly only.
The raw generated-tree accounting baseline increases from 2,771,465 to
2,780,814 bytes for these readable geometry helpers and conservative fallbacks
(the second CI follow-up adds 2,915 bytes over the initial 2,777,899 baseline);
delegation/port/harness coupling metrics do not grow. This is not a change to
the initial-View, lazy-editor, or runtime performance budgets.

## Kiosk hold → modal input (#831)

`smoke_kiosk_scale_no_editor --jitter-only` exercises real >4/<8 px mouse/touch
movement, the 3 s hold, release over Close, delayed unowned clicks and fresh
Close/Reset/Enter/Space. The delayed click is dispatched intentionally and is
not claimed as trusted input. The existing full smoke still covers pan, pinch,
cancel, lost capture, blur, remount, no lazy editor request and rejected chunk.
The outside-kiosk editor control subscribes to the chunk request before clicking
the public mode tab, then awaits both that event and the installed runtime.
Loader-ready in the page does not synchronise Playwright's host-side request
counter; do not replace this barrier with a fixed sleep.
`test/touch-gesture-click-guard.test.mjs` executes the matching/foreign terminal,
remaining contact, capture-loss and keyboard negatives cheaply. Modal takeover
can release implicit capture before the physical touch lifts: do not treat that
capture event as permission for another still-overlapping contact to act.
Browser-only handoff mutation is documented in the reviewed inventory; registry
anchors are checked locally, actual mutants only run nightly (PROCESS §2.7).

## Repeated Resize on materialized plans (#832)

The owner approved raising the lazy-editor gzip ceiling from 252,758 to
255,500 bytes on 2026-10-08, rather than micro-optimizing geometry checks.
The implementation keeps explicit correspondence/carrier checks and bounded
split materialization. The 2,000-byte band, initial-View and absolute budgets,
core caps and performance guards are unchanged; the issue records measured cost.

Do not index `wall_ids` by the shorter coalesced handle contour. Pure atom
projection tests cover ring starts/orientation, translated interiors, fixed
breakpoints, inconsistent catalogue incidence and inactive owner corners.
`smoke_resize_pointer_real_plan` now keeps a revisioned persisted server and
adds three native commits plus exact catalogue Undo/Redo on the same live layer;
`--repeat-no-history` separates history from the materialization defect.
`--record-repeat` writes the accepted anonymized config under artifacts/826 for
the invariant CLI. Old cancellation/capture/foreign-pointer assertions remain.
Strict physical preview success alone is insufficient: final materialization
and junction proof must see coherent compatibility polygons of shared ID owners.
The initial +5 finding includes legitimate numerical refusals; tests use a
coherent +2 target and never change geometry tolerances to force acceptance.
The full-proof unit includes an explicit stale-consumer negative. The tracked
real plan's old room-c/partition overlap remains an inherited invariant finding;
compare the before/after report, and run the clean three-owner regression too.
The helper's measured raw code cost is recorded in `monolith-baseline.json`;
metric bands, core ceilings, absolute bundle and Resize performance budgets stay
unchanged. `benchmark_safe_resize` times the solver/cached proof, not end-to-end
pointer-to-paint latency.

The full CI `smoke_floor_cache_reuse` caught a separate #832 regression after
server rejection materialized a four-room crossing: an inactive owner's real
corner is not a movable derived seam. `projectResizeStoredAtoms` recognises
only overlapping same-carrier side-wall changes and crosses the existing
structural barrier on the changed-ID owner closure to split ownership, keeping all neighbour
corners fixed. It retains the checked legacy rekey ledger; replacing it with
the materializer's atom-count projection falsely fails the existing exact
multiplicity guard. Neither that guard nor physical/junction limits is relaxed.
This smoke is now selected for changes to the projection helpers. Pure units
prove final ownership and reject displaced carriers/corrupt lineage.
The split barrier receives no remote room, partition, decor or unrelated
opening. Poisoned remote-room/opening `toJSON` units make whole-floor cloning RED; atoms
also consumed outside the closure must stay byte-identical or the step refuses.
Local catalogue thickness hints retain custom cm on split children and zero
atoms; the hosted-opening unit checks the child host, width and unknown fields.

## Wall-node editing (#803)

Use `node demo/smoke_wall_node_move.mjs` after `npm run bundle:sync` for trusted
mouse capture, visible ghost pixels, cancellation and server-protocol Undo/Redo.
The wire fixture supplies configs through fake HA, not private gesture writes.
Pure geometry/input/write-queue witnesses are `test/wall-node-*.test.mjs`;
the independent proof and real HA registration/CAS/ACL path are exercised by
`tests_backend/test_wall_node_move.py` and the #803 test in `test_ha_websocket.py`.

#828 adds `node demo/smoke_wall_node_reliability.mjs`: invalid A → unrelated
hass/full Lit ticks → invalid B → valid C, X prompts/guides, plus a pixel-alpha
oracle for the frozen .35 source (valid/invalid, light/dark, positive/zero/mixed,
opening cuts and a shared room corner). Hiding the source with CSS supplies an
independent raster background; reading its opacity alone is not evidence.
`803-wall-node-parity.json` includes finite fixed collinear contacts, proven X
children with far neighbours and true new crossing/contact/overlap negatives.
The real HA protocol matrix now also has fixed neighbours on both X far ends.
No private home export is committed; synthetic frames go to `artifacts/828-node/`.

`node demo/benchmark_wall_node_drag.mjs` measures the frozen-graph candidate
pass on 200 synthetic rooms. `node demo/benchmark_wall_node_browser.mjs`
measures real pointer-to-validated-DOM/paint latency and drag-window Long Tasks
(3 warm-ups, 20 series, 120 distinct raw positions per series, viewport/DPR and
fixture fingerprint in the report). This is not a 25 ms full-frame or 60 fps
claim. Keep the accepted 16 ms candidate-p95 and 150 ms / 3 / 300 ms Long Task
limits; existing performance/bundle ceilings and golden baselines are unchanged.
The large fixture includes two actually adjoining rooms, not only isolated
corners. Terminal reporting separates wire wait, non-network wall time and
Chromium main-thread `Performance.TaskDuration` CPU using `threadTicks`.
The same CPU clock measures the complete pointerdown dispatch. Baseline reuse
is gesture-local; every changed candidate still pays for its physical geometry
and junction guards. Disconnected-room clipping is checked against the original
boolean operations, including touching, holes, nesting and bridging components.
The X-axis hint is rendered locally: a generic card toast after capture would
schedule an unnecessary full-floor render inside the drag window.

After changing manual chunks, also run `node demo/smoke_entry_stale.mjs`:
the stable card and panel entries must settle with the localized reload message
when all old hashed chunks are missing. `test/bundle-assets.test.mjs` executes
the entry rewrite with and without extra eager edges; those edges must remain
inside the catch boundary and precede the implementation.

`smoke_wall_node_topology.mjs` compares shared/T/X/zero before/during/after/cancel
pixels, exact Undo/Redo/reload, capability/refusal and 100 accepted/cancelled
cycles, plus terminal/context events, unsupported X+branch and legacy cancellation.
Its committed synthetic exports live in ignored `artifacts/803-node/`
for `model-invariants --config`; no user home is copied into fixtures.
`python tests_backend/wall_node_parity.py` executes the common TS/Python
fixture matrix, including atomized unsupported junctions, opening intervals,
and independently proven inverse operations (not an optional skipped test).
The matrix includes realistic off-grid noisy T/X atoms and reversed endpoints,
an unrelated collinear node beyond the finite carrier, and a forbidden exchange
of two edges' connectivity at the same foreign point. Pure guards cover the
shared angular boundary and stable wall-ID / same-wall anchor snap ties.
The exact-axis/HV witness includes horizontal and vertical original axes at
off-grid `.503`, plus parallel-only goals that must retain grid quantisation.
The real HA negative host test injects a planner defect rehosting an unrelated
opening to a geometrically identical foreign partition: the independent ledger
must refuse with unchanged config, revision and events. The raw-legacy room
fixture exercises the ledger's read-compatible identity canonicalisation and
exact source immutability. Register these guards and use `mutation-gate --check`;
do not execute mutants during development.
The node browser witnesses also read compiled fixture helpers: their registry
guards explicitly prepare `test-build/` before the smoke (#830). Do not infer
readiness from a previous shared clean guard. The Python angular witness selects
both noisy operations and the unsmoothed classifier boundary; canonicalization
may erase the noise before the operation. See TESTING for preparation semantics.
Before pushing Python edits, also run the CI ruff subset: paired collections
use explicit `zip(..., strict=True)` so an incomplete proof cannot be truncated.
The mouse smoke also exits after a saved node, re-enters Plan with a real Enter
activation (no intervening pointerdown), and still performs exact Undo/Redo.
The pure tail witness distinguishes keyboard and outside-stage controls from
the cancelled gesture's late pointer-compatible stage click.
The Select-only module is a second-level lazy import, with an additional
18 KiB gzip guard (`node scripts/node-editor-bundle-budget.mjs`); it does not
change any existing graph ceiling or load in cold View/other tools. The
intentional raw-bundle/coupling increments are recorded in issue #803 and
`monolith-baseline.json`, not hidden by widening ratchet bands.
For #834 the owner-approved explicit increase from 14 to 18 KiB accommodates
exact boundary/ownership/winding proofs in this Select-only graph. Its bounded
cache and mandatory fallback trade a small one-time lazy download for less
per-frame clipping; no proof is dropped for byte savings. The raw bundle
baseline increase is recorded with the same issue and commit. Initial View,
ordinary editor ceilings, ratchet bands and runtime timing budgets do not grow.
After integrating #814, shared ghost mask/point templates and one affected-wall
selection remove duplicate emitted code; neither the accepted baseline nor its
bands change. Re-run both node raster smokes and the floor-cache-reuse smoke.
Shared tools/queue/live-editor/identity helpers have an explicit `editor-shared` chunk:
otherwise Rollup adds internal exports to the runtime and its opaque retry URL
can lose the named fingerprint/constructor API. Both cold retry smokes must pass.

## Device battery icons (#792)

Battery indicators reuse Home Assistant's `ha-icon` and four standard MDI
symbols: `battery`, `battery-30`, `battery-outline`, `battery-unknown`.
The owner approved the differences from the designer's export on 2026-10-06:
30% rather than an exact third, and an internal question mark. The designer's
colours, 19/33/56px frames and 2/4/7px gaps remain the visual contract.
No separate runtime SVG files, icon dependency or asset-serving route is added.
Scope size rules to `.device-battery-icon`; the main device glyph's `ha-icon`
size must not leak into this independent frame. Demo fixtures use the same MDI
paths so pixel tests do not substitute an emoji or an arbitrary test symbol.
The #806 shadow is interpolated from the approved 19px control
`(.7px 1.8px 1.3px)` to the 56px control `(1.6px 3.6px 3.2px)`, with a 75%
black alpha in between. Keep it on the existing icon and reserve the blurred
extent in preview fit bounds; do not add a wrapper, hit target or observer.

The owner also approved a size-budget recalibration. Fresh source builds move
initial View gzip from 301037 to 302532 bytes (+1495); the existing rolling
ceiling 301040 plus its unchanged 2000-byte band already admits this result.
The absolute wall moves to 320000 bytes, restoring 6.3% reserve over the measured
pre-feature reference. Raw dist moves from 2705833 to 2712880 bytes; only that
size baseline is recalibrated, not coupling or runtime-performance limits.
Optional eager-code/style extraction is tracked separately in #805, not done here.

## Space deletion completion (#819/#826)

`src/editors/space-delete.ts` owns the editor's post-confirmation path.
Keep confirmation text in the caller and the host port type-only. Onboarding
only creates/imports spaces: its form port has no Delete and no delete adapter.
The card delegates Delete to the editor runtime; `space-settings-dialog.ts`
passes that callback to `space-form.ts`, which renders the actual control.
Re-resolve the current
dialog/target before writing, retain the confirmed-marker-set guard, flush and
await pending writes before reading revisions, and adopt the authoritative
re-read bodies. Asset-wait is still owned by the scheduled reload.

`createSpaceDeletionCandidate` mirrors successful server deletion, including
nullable incoming stair targets, and leaves absent targets unchanged (the WS
endpoint rejects them before its pure candidate). The shared fixture covers
ordinary/bulk, blocked, last-space and missing-space cases; server atomicity,
rights, conflict and route-removal proofs remain independent.

Wall-model adoption copies only scalar leaf arrays, not the whole live model.
Point identity is not a gesture contract; root, rooms, partitions and catalog
records keep their id-based references and candidate property order. Run
`node --test test/wall-adoption-alias.test.mjs` after compilation and
`node demo/smoke_wall_adoption_alias.mjs` on a fresh demo bundle for two real
Resize commits with a foreign alias, opening-host preservation and exact
Undo/Redo. Its `--json-model` control has independent JSON points. The existing
real-plan pointer smoke also accepts `--alias-ownership` for the initial
materialization edge. These are commit-boundary copies, not a new full clone
on every pointermove; no ownership cache or schema migration is introduced.

After the test build, run `node --test test/space-delete-dialog.test.mjs
test/space-deletion.test.mjs` for the shared path and TS/Python mirror. Run
`node demo/smoke_space_delete_with_devices.mjs` against the fresh demo bundle
for warning visibility/focus, confirmation, cancellation, bulk deletion and
conflict recovery on both viewport sizes. Backend pair-write/file/trail proofs
remain in `tests_backend/test_ha_websocket.py`. A cumulative bundle ratchet
failure after rebase can be resolved by removing duplicate lazy code; do not
raise the baseline to conceal it. The #819 completion extraction leaves the
baseline, bands, translations and visible contract unchanged.

## Room-face lineage regression (#804)

`node demo/smoke_wall_face_lineage.mjs` exercises creation from a partial
independent wall using synthetic geometry, without a second exact-span carrier
over the room edge. Adding that duplicate carrier would hide the original bug.
Run against a fresh demo bundle; private runtime writes are not a test API.
Pure lineage cases and shared frontend/backend candidates cover retained IDs,
partial/full promotion and the unchanged partition-opening host restrictions.
Never add a user's complete exported home configuration to the test fixtures.

## Space deletion map-route regression (#822)

Run `pytest tests_backend/test_ha_space_delete_routes.py` in the pinned HA
environment. Its real WS client covers ordinary and `remove_markers` deletion
and both last-space variants, verifying the committed pair and revision
increments, unchanged dock/other routes, refusal snapshots and explicit `[]`
beside retained legacy calibration. The pure compatibility cases preserve
absent/null routes and older unrelated orphans. A TS preview alone cannot
witness this server bug. Register the two backend mutants, but execute only
`node scripts/mutation-gate.mjs --check` during development; mutation execution
belongs to the nightly gate. No rendering, input or model migration is involved.

## Input support contract

For View recovery (#824), run `node demo/smoke_view_recovery.mjs` after
`npm run bundle:sync`. It exercises missed config/layout events while detached,
short/long/cold return with late HA, the real bounded paint timeout in both
cards, and held stale responses under connection/placement/floor replacement.
No private state is written to simulate a successful load or controller timeout.
The historical beta.8 checkout is the negative control, not a development-time
mutation run. Node ownership/controller tests complement, not replace, those
mounted caller witnesses. Run existing continuity, warm/dialog/owner/navigation,
static identity, kiosk/touch smokes and golden verification without accepting
new baselines. Preserve fixed-floor selection, readonly static input and bundle
ratchets; six browser mutation declarations are inventoried and two pure
controller guards stay cheap. Execute only `mutation-gate --check` locally.
Static parity fixtures publish config/layout through `__hpTest` before mounting;
do not bypass authoritative attach with `_snap`/`_loadedOnce` writes. The
coordinate-canonicalization cold oracle mounts a distinct card and waits for
its real load, rather than clearing a live card while its intake is pending.
The recovery smoke also samples same-turn A→B→A and A→missing-HA→A: observing
only `willUpdate` misses the intermediate authority and is not a valid fence.

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

## Local contour in 5 minutes (локальный контур за 5 минут, #633)

For Zigbee route changes (#798), focused Node tests cover provider formats,
conflicts, exact mapping and async lifecycle. After `bundle:sync`, run
`node demo/smoke_zigbee_topology_hover.mjs` in WSL/Linux: it checks solid arrows,
unknown-quality outlines, target names, gates and camera anchoring. The
topology benchmark must use confirmed route evidence, not an empty graph.
Neighbour-only raw fixtures remain negative controls; do not add guessed
routes to make them draw. Ordinary LQI badges keep their separate palette.

The #816 tests in `zigbee-provider-routes.test.mjs` cover per-hover incomplete
data suppression (local/remote/unplaced uplinks and conflicting coordinator roles),
incoming-only negatives and unchanged global `partial`. The same hover smoke
checks the mounted caption, retained stale/error messages and real mouse hover.

For tooltip layout (#802), also run `node demo/smoke_zigbee_tooltip_layout.mjs`:
it uses real mouse movement and screen-space overlap oracles, including a
negative control at the previous cursor-relative position. DOM presence alone
does not prove either caption is readable. A small-card fallback must restore
without requiring a new pointerover; use the actual lazy-overlay update path.

For warm-remount changes, `node demo/smoke_warm_mode_adoption.mjs` records
intermediate camera frames and screen-space points, observes every memo size
publication, and exercises delayed permission/runtime races and a touch floor
tap (#762). Keep its five original-code regression witnesses independent;
the existing warm-dialog/owner/nav smokes cover neighbouring lifecycle paths.

Three commands take a fresh Linux sandbox (agent session, WSL, a clean VM) from
nothing to a green smoke, a full unit run in parts and a pre-push gate. Each
step fits the ≈3-minute limit of one sandbox command; everything is idempotent,
so after a timeout or a sandbox restart the same command is simply repeated.

```bash
# 1. Worktree + dependencies + Chromium + bundle + one Playwright page.
#    HP_BRANCH picks the branch (taken from origin if it exists there);
#    without it the worktree is a detached origin/dev.
HP_BRANCH=issue/NNN-slug HP_WORKTREE=/tmp/w-NNN bash scripts/sandbox-bootstrap.sh
#    or step by step: worktree | deps | chromium | bundle | check
cd /tmp/w-NNN && node demo/smoke_edge_cases.mjs     # AC2 of #633: green

# 2. The full unit suite in parts that each fit one command.
npm run test:chunk -- 1/6          # builds test-build/, then the first sixth
npm run test:chunk -- 2/6 --no-build
npm run test:chunk -- 3/6 --list   # only print the files of the part

# 3. Push: the pre-push hook runs npm run gate:small for issue/* branches.
git push origin issue/NNN-slug
HP_PREPUSH_GATE=0 git push origin issue/NNN-slug   # explicit opt-out
```

What each command guarantees:

- **`scripts/sandbox-bootstrap.sh`** — the worktree comes from the clone the
  script lives in (`HP_CLONE` overrides), `npm ci --ignore-scripts` runs only
  when `package-lock.json` changed (`HP_SHARED_NODE_MODULES` links a ready
  `node_modules` instead), Chromium comes from the npm package
  `@sparticuz/chromium@152.0.0` (the Playwright CDN is closed in the sandbox,
  the npm registry is not) and gets a shim at every path Playwright expects —
  a real browser already there is left alone. `bundle` is `npm run
  bundle:sync`; `check` opens one page in Playwright. The script carries no
  owner paths and no credentials: pushing is configured separately. Golden
  frames are still captured only in Linux CI (#455).
- **`npm run test:chunk -- N/M`** — `test/*.test.mjs` sorted by code point,
  file *i* goes to part *i* mod M + 1 (round-robin). Chosen over size-balanced
  parts so that a file stays in the same part while tests are edited; the M
  parts together cover every file exactly once (`test/test-chunk.test.mjs`).
  The test build runs in every part unless `--no-build`, so a part is
  self-contained after a sandbox restart.
- **pre-push** — see [TESTING.md «Локальный набор перед пушем»](TESTING.md#локальный-набор-перед-пушем-343):
  on by default for `issue/*` branches with an executable diff, skipped when the
  branch diff against `origin/dev` is class C/D only (review documents,
  changelogs, bundle), off with `HP_PREPUSH_GATE=0`, forced for any branch with
  `HP_PREPUSH_GATE=1`. `gate:small` takes minutes; when a push must fit a
  3-minute command, run `npm run gate:small` separately and push with
  `HP_PREPUSH_GATE=0`.

## Local Windows workstation

The CI contract is **Node.js 22 + Python 3.14**. Do not use Codex's bundled
Node 24 or an unpinned machine Python environment as proof that a release will
pass. The pins are not declared twice: `node scripts/toolchain-pins.mjs` reads
them from `validate.yml`, `tests_backend/requirements.txt` and the lockfile, and
`npm run toolchain:check` compares the machine with them (#496). `.nvmrc` and
`.python-version` carry the same values for nvm/uv/pyenv; a test keeps them equal.

Chromium is judged by the browser that actually runs (#827, F33), not by the
existence of `chromium.executablePath()`: that is the full Chromium, while the
standard headless `chromium.launch()` starts the separate headless shell
(`chromium-headless-shell` in `playwright-core/browsers.json`), and a directory
named after the pinned revision can be a symlink to another build.
`toolchain:check` launches the standard headless Chromium once and reports the
expected pin, the version of the running process, the Playwright version, the
mode and the path Playwright selected next to the binary that actually runs
(`/proc/<pid>/exe`, symlinks resolved). The same check
(`scripts/browser-attestation.mjs`, `node scripts/browser-attestation.mjs`
alone) guards the visual-proof entry points: `npm run docs:capture` and
`scripts/capture-determinism.mjs` before the first frame, golden capture and
verify on every browser the shared launcher starts, and the smokes that declare
`requirePinnedBrowser()` (`smoke_support_feedback`, `smoke_zigbee_tooltip_layout`,
`smoke_editor_styles_lazy`). A mismatch, a missing browser or a browser that
cannot be probed is an **environment failure** with a non-zero exit — no frame
or verdict is produced and committed PNGs and indexes stay untouched. There is
no bypass; `HP_ALLOW_FOREIGN_CAPTURE` covers the platform only. The check never
repairs a global install or a symlink: install the pinned browser with
`npx playwright install chromium`.

The supported native setup is repository-scoped and does not change the
machine's default Node, Python or persistent `PATH` (#557):

```powershell
# One-time/idempotent setup. Requires uv; installs a verified portable Node 22
# under %LOCALAPPDATA% and Python 3.14 in the dedicated .venv-ci.
.\scripts\windows-toolchain.ps1 setup

# Read-only proof: actual versions and executable/package/browser paths.
.\scripts\windows-toolchain.ps1 check

# Explicit pinned entrypoints for ordinary commands; no accidental PATH tools.
.\scripts\windows-toolchain.ps1 npm run gate:small
.\scripts\windows-toolchain.ps1 python -Arguments @(
  '-m', 'pytest', '-p', 'pytest_asyncio.plugin',
  'tests_backend/test_validation.py', 'tests_backend/test_trails.py',
  'tests_backend/test_trail_recorder.py', '-q'
)
.\scripts\windows-toolchain.ps1 playwright install chromium
```

The Node archive is selected from the official release index for the major in
`.nvmrc` and checked against Node's `SHASUMS256.txt`. The script prepends that
directory to `PATH` only for its child process. It never removes an existing
venv: if the requested `-VenvPath` contains another Python minor, setup stops
and asks for another path. Playwright remains in its normal shared Windows
cache. Install `uv` once with `winget install --id astral-sh.uv --source winget`
if it is absent; GitHub access still uses the separately installed `gh`.

WSL2 is optional for the ordinary frontend and pure-backend loop. Keep its clone
inside Linux ext4, not under `/mnt/c`; on a fresh checkout run:

```bash
cd ~/houseplan-card
bash scripts/wsl-setup.sh           # idempotent setup in dedicated .venv-ci
bash scripts/wsl-setup.sh --check   # no installation; paths + versions only
bash scripts/wsl-setup.sh --verify  # setup, real HA subset and one golden capture
```

The script provisions the CI pins (nvm → Node, uv → Python and the HA test stack
from `tests_backend/requirements.txt`, Playwright Chromium from the lockfile).
`--verify` imports Unix-only `fcntl` and the pinned Home Assistant, runs
`tests_backend/test_ha_setup.py`, builds the card and captures
`panel-wide-view-light-en` under `artifacts/golden/`; it records elapsed time and
the resulting PNG path. `HOUSEPLAN_VENV` selects another dedicated venv without
deleting or rewriting an existing one. WSL is normally early feedback. For an
intentional baseline change it may also produce the reviewed candidate with the
fail-closed command below; the canonical merge/release proof still lives in
GitHub Linux CI at the final exact SHA.
It is required only when running the full HA harness locally: current Home
Assistant imports the Unix-only `fcntl` module and cannot start its pytest plugin
on native Windows. Keep a WSL clone inside the Linux ext4 filesystem rather than
under `/mnt/c`, otherwise dependency installs become slower. The release CI
always runs this harness on Ubuntu and gates the exact tagged commit. Docker
Desktop is not currently required. Do not install the full Home Assistant pytest
stack natively just for this repository: its pinned `lru-dict==1.3.0` first
requires Visual Studio Build Tools to compile, but the resulting plugin still
cannot run without `fcntl`.

Useful repo-local Git settings on NTFS (optional for this small repository):

```powershell
git config core.fsmonitor true
git config core.untrackedCache true
```

## Local repository maintenance (#628)

Owner decision on 2026-09-25: use only a one-time local garbage collection for
the Windows clone. This issue does **not** introduce Git LFS, stop tracking
`dist/**`, remove the committed integration bundle, or rewrite published Git
history.

Run the maintenance command only when no Git process is active in the shared
clone (all worktrees use the same object database):

```powershell
git gc --prune=now
git count-objects -vH
git fsck --no-dangling --no-progress
```

The 2026-09-25 measurement before GC was 26,243 loose objects / 749.84 MiB,
41 packs / 334.55 MiB and 98 garbage entries / 959.60 KiB. After GC it is zero
loose objects, two packs / 467.63 MiB, zero `tmp_obj_*` files, and a clean
`git fsck`. `size-pack` grew because reachable loose objects moved into packs;
the meaningful total (`size` + `size-pack`) fell from 1,084.39 MiB to
467.63 MiB, a reduction of 616.76 MiB.

This post-GC value is the #628 monthly-growth baseline. To evaluate AC2 on or
after 2026-10-25, run the same GC and `count-objects` sequence and compare the
new `size-pack` with 467.63 MiB; the accepted upper bound is 487.63 MiB.

## Previous-installation lifecycle (#820)

The config flow uses `previous_data.py` for read-only discovery and reversible
rename archival; do not replace discovery with `Store.async_load` (it may save
migrations). No model/Store versions or runtime WS contracts change. Transfers
run in the executor, only after final confirmation, with single-entry and
concurrent-flow guards. No old archive is overwritten or automatically cleaned.

Targeted Linux/WSL proof (importable HA is required):

```sh
.venv-backend/bin/python -m pytest tests_backend/test_previous_data.py tests_backend/test_ha_config_flow.py -q
.venv-backend/bin/python -m pytest tests_backend/ -q
```

HA flow tests restore real disk I/O only for House Plan Store keys, keeping HA
registry mocks intact. They use isolated config directories and actual flow,
setup, WebSocket and authenticated content endpoints. Pure tests cover complete
byte sets, collisions, links, EXDEV and mid-transfer/rollback failures. Mutation
anchors live in `scripts/mutation-registry.mjs`; check them with
`node scripts/mutation-gate.mjs --check`, never execute mutants during development.

Manual recovery is documented in [USER-GUIDE](USER-GUIDE.md#removal-and-reinstallation):
stop HA, back up/preserve the new set, restore one archive's `storage/houseplan.*`
to `.storage/` and its `plans/files/assets` to `houseplan/`, without mixing sets
or overwriting the only copy, then restart. Multi-rename is not crash-atomic;
failed rollback leaves all bytes in original locations or the logged partial
archive. The wizard cannot recover an archive automatically.

## Tests

- Kiosk pan/hold (#825): `smoke_kiosk_scale_no_editor` uses trusted slow mouse
  and touch pans, including return to origin on the same press, and stationary
  jitter on the next hold. `--pan-red-witness` exits with the observed modal
  failure on the original implementation; editor and write/service spies stay
  empty. The LED clamp witness pauses page-local time, records the actual
  owner's 160 ms timer and trusted wheel timestamps, and samples inside and
  exactly at its original deadline despite 240 ms Node round trips. It restores
  hooks/resumes time in `finally`; closing the context disposes the clock.
  `clamped-wheel-lease.test.mjs` separately rejects cancellation, renewal,
  idle activation and scale/cache changes; existing guard IDs remain in place.
- Frontend: `npm test` — compiles src/logic.ts+rules.ts (tsconfig.test.json) and runs node:test
  (test/*.test.mjs). Strict typing: `npm run typecheck` (tsc --noEmit, part of `npm run build`).
- Shared Glow scheduling and render-local barrier reuse (#789) have separate
  scheduler/memo unit witnesses. `smoke_led_strip_glow` observes real opacity
  transition events on main/static LED and ordinary pools, without a forced
  style read between insertion and the entering frame. A declared 500 ms CSS
  duration alone is not evidence that a fade actually runs. Main-card ordinary
  Glow retains its previous no-replay behavior on return to a visited space;
  that navigation witness checks its steady state, not a newly invented fade.
  The complete
  `led-strips-v1` performance gate remains separate from these correctness checks.
- LED zoom quality (#789) keeps 48 mask paths and temporarily paints 24 while
  the camera scale changes. `zoom-scale-activity.test.mjs` uses a fake clock for
  the 160 ms deadline, no-op/pan and stale callbacks; `smoke_led_zoom_quality`
  covers real input and restoration. Full-quality pixels are compared with the
  pre-change 48-band construction, not with the coarse frame. The performance
  runner retains its old windows and adds a continuous observer through restore,
  immediate restart and a 500 ms tail; `led-camera-cycle.test.mjs` verifies that
  protocol and its fail-closed checks. Local timing is diagnostic, not a substitute
  for the exact-SHA Linux performance gate.
- Pure backend on native Windows (with no HA plugin autoload): use the explicit
  `python -Arguments @(...)` invocation above after setting
  `$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1'`.
- Full backend (including `test_ha_*.py`): `python -m pytest tests_backend/ -q`
  in CI or WSL/Linux only.
- Junction-limit TS/Python parity (clean, no Home Assistant):
  `npx tsc -p tsconfig.junction-parity.json && node scripts/fix-test-build.mjs &&
  python tests_backend/junction_parity.py --build-dir=test-build/junction-parity`.
  Its dedicated reusable Validate job owns this proof; missing compiled modules
  fail setup instead of turning into a pytest skip.
- IMPORTANT (audit lesson): the rollup typescript plugin reports a syntax error as a WARNING and still
  builds the bundle — a truncated file can "pass". That is why the build starts with `tsc --noEmit`,
  which fails on such errors. Always build with `npm run build`, never bare `rollup -c`.
- The committed bundle changes only in a beta/release candidate (#657). Rollup writes
  `dist/houseplan-card.js`, `dist/houseplan-assets.json` and content-hashed chunks under
  `dist/houseplan-assets/`; `npm run bundle:sync` builds and lays that tree out into the
  untracked demo copy, and `npm run bundle:clean` restores the tracked `dist/` before an
  ordinary commit (the `commit-msg` hook refuses bundle paths without a `Release:`
  trailer). The candidate runs `npm run bundle:release`, which also updates the
  integration snapshot `custom_components/houseplan/frontend`.
  `node scripts/bundle-policy.mjs --verify HEAD` is the check CI and `gate:small` run:
  build integrity always, byte parity with the committed copy only on a commit that
  changes the bundle or is a candidate; `node scripts/bundle-tree.mjs dist
  custom_components/houseplan/frontend` stays the read-only parity check of release automation.
- The first-space/import dialog is a separate `houseplan-onboarding-runtime-*`
  chunk. Do not fold it into `houseplan-editor-runtime-*`: empty-install
  onboarding is a View prerequisite, while a configured View must request
  neither lazy runtime until the corresponding user intent.
- 2.5D rendering is a separate `iso-scene-render-*` chunk. A View with
  `settings.volumetric_view` off (#649) must not request it. Its normal import and content-hashed retry
  must pass the same source-fingerprint handshake before Iso installs atomically;
  `houseplan-assets.json` records the graph as `lazyIsometricFiles`.

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
`window.__hpLabs` capability array. Since #649 the registry is empty: 2.5D left
alpha for the General settings switch `settings.volumetric_view`; smokes turn it
on with `window.__hpTest.setVolumetricView(true)`.

To add a capability, add one unique lowercase id plus issue and a non-empty
summary to `LABS_FLAGS`, then cover registry validation and the alpha-on active
set; invalid or duplicate entries fail closed. Capabilities have no individual public key or version lifetime: the one
persisted alpha switch is deliberately indefinite until the owner changes the
contract. See `docs/ISOMETRIC.md` for the current use.

These commands are read-only diagnostics, not release gates:

```bash
# Show registered legacy/internal fields or inspect an exported config locally.
npm run audit:config
npm run audit:config -- path/to/houseplan-config.json

# Reproducible synthetic large-house report (seven measured samples + warm-up).
npm run benchmark:large-house -- --samples=7 --warmups=1 --output=artifacts/performance/local.json

# #806: one-room browser stress with 200 painted battery shadows. It applies
# the existing 3400 ms static, 500 ms pan+zoom and 150 ms camera Long Task limits.
node demo/smoke_device_battery_performance.mjs

# Hidden isometric profile; diagnostic only outside exact-SHA Linux CI.
npm run benchmark:large-house-isometric -- --samples=7 --warmups=1 --output=artifacts/performance/isometric-local.json

# Dense Stage 3 overlay/opening profile; also diagnostic outside exact-SHA Linux CI.
npm run benchmark:isometric-stage3-dense -- --samples=7 --warmups=1 --output=artifacts/performance/isometric-stage3-local.json

# Golden candidates never overwrite reviewed references.
npm run golden:capture
npm run golden:verify
npm run golden:accept -- --reviewed

# Full attested candidate for baseline acceptance. Run only in the ext4 WSL
# clone, on a clean named branch whose HEAD already equals origin/<branch>.
npm run golden:wsl:capture -- --expect-change=<scene-id,scene-id>
npm run golden:accept -- --reviewed --from=artifacts/golden \
  --expect-change=<scene-id,scene-id>

# Docs screenshots whose pixels did not change (a version bump, a refactor):
# re-capture locally, compare decoded RGBA against the committed frames and,
# if every frame is identical, refresh only the manifest fingerprints (#512).
npm run docs:accept -- --identical
```

Golden frames never show the real card version: the harness sets the test-only
seam `window.__HP_VERSION_OVERRIDE__ = '0.0.0-golden'` before the card is
created, so a version bump alone changes no baseline (#512, see
`demo/golden/README.md`).

`golden:wsl:capture` refuses native Windows, `/mnt/c`, dirty or detached trees,
unpublished/mismatched branch SHAs, stale source fingerprints, toolchain drift,
partial matrices, undeclared differences and an insufficient witness floor. It
writes `artifacts/golden/wsl-attestation.json`, which self-hashes the source
identity, environment, pinned toolchain, report, every PNG and the acceptance
intent. Its Chromium is the headless shell that actually launches, judged like
`toolchain:check` (#827) — running version, selected and resolved path, sha256
of the resolved binary — not `chromium.executablePath()` (#833); a foreign or
missing browser is an environment failure before any passport. Acceptance
verifies the passport again, re-judges the current headless shell against it
and records it under `localAttestation` in the baseline index. Copy the printed
`Baseline-Reviewed-Local: sha256:…` line to the baseline commit together with
`Release:`; never add the GitHub `Baseline-Reviewed:` trailer to the same commit.
Push that commit and wait for the full GitHub Validate on its exact SHA before
S7/merge. The local path removes the earlier expected-red capture run, not this
independent final check. A downloaded `golden-images` artifact from GitHub stays
supported and keeps the existing `Baseline-Reviewed: <run URL>` provenance.

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
capturing anything when `demo/srv/assets/houseplan-card.js` is stale;
`demo/bundle-freshness.mjs` also verifies every manifest-listed asset hash, so a
partially copied tree fails too. Golden commands and the explicit review
workflow are documented in `demo/golden/README.md`.

## Build

```bash
npm ci                       # once
npm run bundle:sync          # build + entry/manifest/chunks → demo
npm run bundle:budget        # initial View graph within INITIAL_VIEW_GZIP_BUDGET (scripts/bundle-budget.mjs)
npm run bundle:clean         # before an ordinary commit (#657)
npm run bundle:release       # candidate only: also → custom_components/houseplan/frontend
node scripts/bundle-tree.mjs dist custom_components/houseplan/frontend   # candidate parity
```

## Deployment

Installations update themselves through HACS by release tag (`PROCESS.md` §12: no
manual copying into a running Home Assistant); the closed dev stand auto-deploys
the `dev` branch, and an installation of the owner's choosing may track the
head of `dev` automatically (below). Access to the owner's instances is not
documented here.

### Tracking the head of dev on your own installation (#835)

HACS installs releases only (`zip_release`), never branches. After every green
push to `dev`, Validate publishes the whole integration of that commit into the
orphan branch `dev-build` (`scripts/dev-build.mjs`): the Python side from the
source tree and `frontend/` from the bundle it has just built — the committed
bundle in `dev` is the last beta's (#657). `DEV-BUILD.json` names the source SHA
and `integrationTree`, the git hash of `custom_components/houseplan` in the
branch. The hash follows content: a push that does not change what Home
Assistant receives (documentation, process, review documents) keeps it, so
nothing is reinstalled and nothing restarts.

`scripts/ha-track-dev.sh` installs that branch on a Home Assistant host. It is
POSIX `sh` for the Home Assistant container (it needs `curl` and `tar`),
swaps `/config/custom_components/houseplan` by rename, keeps the previous copy
in `/config/houseplan-dev-prev`, and prints `updated <source> <tree>` or
`unchanged <source> <tree>`. On any failure the installed copy is untouched and
the exit code is non-zero. Without arguments it downloads the archive (~4 MB);
with `--poll` it first compares the ~300-byte marker and downloads only on a
change — the marker on `raw.githubusercontent.com` may lag a few minutes behind
the branch, which is why the push path does not use `--poll`.

Copy the script to `/config/scripts/ha-track-dev.sh`, then:

```yaml
# configuration.yaml
shell_command:
  houseplan_dev: sh /config/scripts/ha-track-dev.sh {{ mode | default('') }}

# automations.yaml
- alias: House Plan — head of dev
  mode: single
  triggers:
    # Push: Validate calls this webhook when the integration changed.
    - trigger: webhook
      webhook_id: houseplan-dev-<random>
      allowed_methods: [POST]
      local_only: false
      id: push
    # Pull: for a host that the internet cannot reach. Drop either trigger.
    - trigger: time_pattern
      minutes: "/10"
      id: poll
  actions:
    - action: shell_command.houseplan_dev
      data:
        mode: "{{ '--poll' if trigger.id == 'poll' else '' }}"
      response_variable: result
    - condition: template
      value_template: "{{ result.returncode == 0 and result.stdout.startswith('updated') }}"
    - action: homeassistant.restart
```

For the push path, store the full webhook URL — `https://<host>/api/webhook/<id>`,
or the `hooks.nabu.casa` address Home Assistant Cloud gives the webhook trigger —
as the repository secret `HP_HA_DEV_WEBHOOK`. The `dev_build` job calls it only
when `integrationTree` changed; without the secret the step does nothing, and a
failed call never turns Validate red (the job is `continue-on-error`). The URL,
the response and curl's error text stay out of the log.

What the head of `dev` is not:

- **Not a beta.** It is reviewed code behind the light Validate; golden, smokes
  and performance run only on a beta candidate.
- **Data may move first.** A storage migration reaches this installation before
  any beta; a later downgrade to a release may not read it. Keep Home
  Assistant's automatic backups on.
- **HACS still owns the slot.** It keeps showing the installed release and
  offers release updates; installing one replaces the dev copy until the next
  trigger installs the head again. Removing House Plan in HACS deletes the
  files. To stop tracking, disable the automation.
- **The version string is the last beta's.** The identity of what is installed
  is the `updated` line and `custom_components/houseplan/.dev-build-tree`.
- **Rollback:** `rm -rf /config/custom_components/houseplan && mv
  /config/houseplan-dev-prev /config/custom_components/houseplan`, then restart
  — or redownload a release in HACS. The installed hash travels with the copy,
  so the next trigger installs the head again unless the automation is off.

## Frontend cache and the "empty view"

- The card module URL contains `?v=<VERSION from const.py>`. Browsers keep the ES module in
  memory cache: after deploying new JS **bump VERSION in const.py and restart HA**,
  otherwise a plain F5 will keep the old version. This is a deployment step — a
  release candidate or your own local stand. An ordinary task commit bumps neither
  `VERSION` nor the committed bundle: both change only in a commit with a
  `Release:` trailer (#657, `PROCESS.md` §1).
- After a page reload the HA frontend (with kiosk-mode) sometimes leaves the view empty
  ("InvalidStateError: Transition was aborted", hui-view is not created for 1–2 min).
  Cured by repeating the SPA navigation: pushState + a location-changed event, or just waiting.

## Resource registration and version recovery (#462)

- A writable Lovelace resource registry is the loader authority. Registration
  returns a typed outcome; a pending or transient first attempt installs the
  `extra_module_url` fallback immediately and schedules exactly one retry after
  Home Assistant reaches running state plus a fixed one-second delay. Listener,
  timer and retry task must all be cancelled through config-entry unload.
- Runtime registration facts belong in `hass.data[DOMAIN]` and System Health,
  not in plan/layout storage. The persistent hard-reload notification is
  localized from the backend `issues` translation category and its config-entry
  flag is written only after `persistent_notification.async_create` returns
  without an exception.
- Every successful `houseplan/config/get` is authoritative for
  `integration_version`. A missing, non-string or whitespace-only value clears
  a previously known version. The full-card version controller stays in the
  initial View graph; do not move it behind the lazy editor runtime or add it to
  `houseplan-space-card`.
- Targeted checks while changing this contract are:

  ```text
  python -m pytest tests_backend/test_ha_frontend_registration.py tests_backend/test_ha_setup.py -q
  npx tsc -p tsconfig.test.json
  node scripts/fix-test-build.mjs
  node --test test/version-recovery.test.mjs
  node demo/smoke_version_recovery.mjs
  node scripts/check-docs.mjs
  ```

  The full HA pytest harness requires Linux/WSL; native Windows lacks `fcntl`.

## The stylesheet minifier sees TypeScript output, not the source (#526)

`scripts/css-template-minifier.mjs` runs as a Rollup transform, and by then the
module has already been through TypeScript. The TS printer puts a space between
a tag and its template, so the source `css`…`` arrives as `css `…``.

The plugin used to look for the exact string `css` + backtick and therefore
returned `null` for every stylesheet in the project: minification never ran
once, and roughly 23 KB of explanatory comments were shipped to every user —
12.8 KB gzipped in the initial chunk.

Two consequences for anyone touching this area:

- match the tag as a word followed by optional whitespace, never as a literal
  two-character string;
- the guard that keeps this honest is not inside the plugin but in
  `test/bundle-assets.test.mjs`: it takes real comment text out of
  `src/styles/*.ts` and asserts none of it appears in `dist/**`. A plugin that
  silently stops working cannot pass it.

## Do not animate container-relative properties on the plan (#524)

A CSS property whose value is expressed in container query units — `cqw`,
`cqh`, or any custom property derived from them, such as `--dev-size` — must
not appear in a `transition` on elements the plan draws in quantity.

Container query styles are re-evaluated whenever the container's inline size
changes: a tooltip, a scrollbar, a rotation, a panel resize. Every such
re-evaluation produces a new computed value and therefore **restarts the
transition on every one of those elements at once**.

That is how `box-shadow` on device markers cost a real user 9.4 frames per
second in Firefox 155: sixty-one markers started a 150 ms non-composited
shadow transition four times in two seconds, and the refresh driver spent the
window waiting for paint. Chromium starts exactly the same transitions — it
merely pays less for them, which is why the defect hid there.

The witness is browser-independent and lives in
`demo/smoke_marker_shadow_transitions.mjs`: change the stage container width by
one pixel and assert that no `transitionrun` for `box-shadow` arrives.

## Updating a pinned Action (#556)

Every `uses:` in `.github/workflows/**` is a full commit SHA with the human
version in a trailing comment; `node scripts/action-pins.mjs` enforces it and the
Validate preflight runs it. The comment is not decoration — it is the only thing
that tells a reader which release they audited.

To move a pin: read what the tag points at today,

```bash
gh api repos/<owner>/<repo>/commits/<tag> -q .sha
```

read the delta from the currently pinned SHA, then change **both** the SHA and
the comment in one commit. `node scripts/action-pins.mjs --list` prints every
third-party action with its pin, which is the fastest way to see what is behind.

Two of these are branches upstream, not releases — `home-assistant/actions`
(`master`) and `hacs/action` (`main`) — so their comment carries the date the
branch head was read. They have no tags to follow; the only honest record is
"this commit, read on this day".

## Moving the runner image (#658)

Every job that runs on a GitHub runner names an explicit image version in
`runs-on:`, and all workflows name the same one; `test/workflow-hygiene.test.mjs`
rejects a floating label such as `ubuntu-latest` and any drift between files.
The reason is the evidence tied to the image: golden baselines, documentation
screenshots and performance budgets were captured on it with the pinned
Playwright/Chromium (#455, #557), and Chromium's system libraries come from the
image itself (the install steps deliberately skip `--with-deps`). A floating
label moves under that evidence — `ubuntu-latest` becomes Ubuntu 26 from
2026-10-19 (actions/runner-images#14748) — and would turn a day with no change
into mass golden `different` and a red performance smoke.

Move the image on purpose, as its own infra issue:

1. change `runs-on:` in every workflow in one commit;
2. capture golden in CI on the new image and accept the differences with
   review (`npm run golden:accept -- --reviewed …`), re-capture the documentation
   screenshots (`demo/docs/capture.mjs`);
3. run the full Validate and `performance.yml`, and recalibrate a budget only
   with measured evidence next to the number (the #483 and #675 pattern);
4. mirror the thin callers into `main` (see `workflow_sync` in `validate.yml`)
   and remember that `release.yml`, `performance.yml` and the other files `main`
   executes pick the new image up only with the next stable promotion.

The same test requires `timeout-minutes` on every runner job (at most 180; the
default is 360) and keeps `cron` off minutes 0/15/30/45, which GitHub's
scheduler delays by hours. A job that waits for other runs, such as the release
gate, gets a timeout above the sum of its own waits and says so in a comment.

## What the review model is allowed to do (#556)

The `model_review` job is the only untrusted stage of the review pipeline: it
runs a model with `Read/Write/Bash` over the material. Its `permissions:` block
is the real ceiling **only because** the `Review` step is handed
`github_token: ${{ secrets.GITHUB_TOKEN }}`.

Without that input `claude-code-action` exchanges the job's OIDC token for its
own GitHub App installation token (`src/github/token.ts`), and that exchange
defaults to `contents: write`, `pull_requests: write`, `issues: write` no matter
what the calling job declared — the `ghs_…` token then sits in the environment of
the model's own Bash tool. Removing the one line therefore widens the model's
rights silently, with every test still green, which is why there is a witness
(`test/review-doc-guard.test.mjs`) and a mutant
(`review-job-trusts-the-app-token`) standing on it.

`issues: write` is the single write scope the model keeps, because the process
asks the reviewer for the verdict comment (§7.2) and a separate issue for
out-of-scope Medium findings (§12). It buys comments, labels and issue-body
edits — not a commit, not a merge (that is decided in `integrate` from the sealed
`verdict.json`), not a release. Dropping it means moving both duties into
`integrate`, which is a pipeline change and not part of this one.

## Dependency and cache gotchas

- **polygon-clipping is a trap**: its `.d.ts` declares named exports but the ESM build has only
  a default export — tsc or the runtime breaks, whichever you appease. Use **polyclip-ts**
  (proper ESM + native types; same results). It brings `bignumber.js` and `splaytree-ts`;
  their measured weight in the built graph is below (#814).
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
  instead, and the same fingerprint keys the per-source region cache. A cache
  whose inputs are one floor's record keys by that record's content,
  remembered per epoch (`floorRecordKeyMemo` in `src/floor-geometry-key.ts`):
  the card's four floor-geometry caches (#744) and the summary panel's area
  (#769). The furniture and stairs magnet (`furniture-wall-surface.ts`) keeps
  the epoch by measurement: its own edits change the floor record anyway (#769).
  The opening wall index and the sun wedges list every input they read in the
  same module (`openingWallIndexKey`, `sunGeometryKey`, #814) and read the
  in-place mutable ones afresh on every call; the record key is never a
  substitute for them. Physical bodies and opening tunnels keep a pool of the
  eight most recently shown floors next to the active entry (`floorPoolEntry`).
- **Segments that cross must be split before a visibility sweep.** The sweep
  casts a ray at every barrier ENDPOINT; two faces crossing in their middles —
  normal where wall bodies meet at a junction — leave that corner unsampled and
  the fan closes it with a chord, so a sliver of floor next to a corner the
  lamp plainly sees goes dark. `splitAtIntersections` removes the whole class.
- **Layout reads in the render path are judged by `scripts/render-layout-read.mjs`**
  (`gate:small`, #654, #725): `getComputedStyle`, `getBoundingClientRect` and reads such as
  `clientWidth`/`offsetTop`. The guarded methods (and the one summary-panel measurement method
  that may read) are listed in the script; measure in `updated()` or an observer instead.

### Geometry dependency weight and the bundle ratchet (#814: F19, F27)

Measured on the build of `7c6931c1` (the last product commit of #814 on base
`a5e7d79c`; its test and documentation commits do not change `dist`) with
Node 22.22.2, Rollup 4.62.2, terser 5.48.0 (`@rollup/plugin-terser` 0.4.4) and
TypeScript 5.9.3.
Method: after `npm run build`, the project's Rollup config generates the bundle
in memory; for every module of `bignumber.js`, `polyclip-ts` and `splaytree-ts`
and for the two style modules, Rollup's `chunk.modules[id].code` (the rendered
code after tree-shaking, before terser) is minified alone with the build's
terser options and gzipped at level 9, as the bundle manifest does. The
standalone gzip is an upper bound of a module's share of its chunk, which
compresses with shared context. Graph membership is read from
`dist/houseplan-assets.json`.

| Module | Source, B | Rendered, B | Minified, B | Gzip (alone), B | Graph |
| --- | ---: | ---: | ---: | ---: | --- |
| `bignumber.js` 9.3.1 (`bignumber.mjs`) | 84 714 | 84 648 | 18 460 | 8 328 | initial View (card entry chunk) |
| `polyclip-ts` 0.16.8 | 39 981 | 39 442 | 17 780 | 5 082 | initial View (card entry chunk) |
| `splaytree-ts` 1.0.2 | 17 966 | 11 538 | 3 296 | 1 106 | initial View (card entry chunk) |
| `src/styles/plan.styles.ts` | 61 356 | 31 652 | 31 528 | 6 472 | initial View (card entry chunk) |
| `src/styles/chrome.styles.ts` | 16 093 | 10 460 | 10 233 | 2 480 | initial View (card entry chunk) |

The three geometry dependencies are at most 14 516 B gzip of the 298 916 B
initial View graph (about 4.9 %), not the 85 KB of `bignumber.js` source. They
stay: View itself needs exact booleans (wall union, clean floors, Glow and sun
occlusion), so the code cannot leave the first-frame graph by laziness, and a
replacement is a separate decision. The plan/chrome CSS that remains in the
entry after #805 is a separate tail of at most 8 952 B gzip; its ownership is
unchanged here.

F27, the `bundleBytes` ratchet on the same build: the committed release `dist`
at `a5e7d79c` is 2 718 201 B, equal to `scripts/monolith-baseline.json`; a
sandbox build of `a5e7d79c` is 2 717 957 B; `7c6931c1` builds 2 718 948 B
(+991 B over the base build, +747 B over the baseline, inside the +2 000 B
band). The initial View graph moves 298 665 → 298 916 B gzip (ceiling 303 046
+ 2 000), the lazy editor graph 250 248 → 250 293 B (ceiling 251 460 + 2 000).
No band, ceiling or the `UPSTREAM_WINS` policy changed. A CI build of the exact
SHA is the authority; these are sandbox numbers.

## Release

This section is the only home of the release mechanics; `docs/STATUS.md`,
`docs/ARCHITECTURE.md`, `AGENTS.md` and `CONTRIBUTING.md` link here instead of
retelling it. The process side — when an issue closes, what a stable commit may
contain, the independent line review — is `PROCESS.md` §2.8, §3 and §11.5.

The shape in one paragraph: a pre-release is one tested `dev` commit and tag
with `prerelease=true`, published from `dev`; `main` stays untouched. A stable
release fast-forwards `main` to the exact tested `dev` SHA and is produced only
by `release.yml`. Installations then update through HACS by tag («Deployment»
above); the dev stand takes the head of `dev` from the `dev-build` branch
(`demo/stand/README.md`).

### Primary prerelease path

Prepare the candidate as usual: synchronize every version field, add dated RU
and EN changelog sections, update the production bundle snapshots with
`npm run bundle:release` (since #657 the only commit that may change them; it
carries the `Release:` trailer), then lower the ratchets to the candidate's
facts with `node scripts/ratchets.mjs tighten` (#699: it rewrites the core line
caps, the gzip graph ceilings and `scripts/monolith-baseline.json` from the
fresh `dist/`; commit them with the candidate) and write the
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
snapshots and a completed green Validate for `HEAD`; like `release.yml`, it
refuses a candidate without the `Release:` trailer and a committed bundle whose
embedded source fingerprint differs from the tree. Snapshot hashes and the
uploaded standalone JS are read from the exact Git blobs rather than checkout
bytes, so Windows CRLF conversion cannot disagree with the LF-tagged archive.
The archive command additionally forces `core.autocrlf=false` for that one
operation; it does not modify the developer's Git configuration.
It creates or verifies an
annotated exact-SHA tag, builds `houseplan.zip` directly from that committed
tree, verifies its manifest and embedded frontend against the candidate hash,
and creates `RELEASE-MEMBERSHIP.json`. Every explicitly supplied issue must have
an `Issue: #NN` trailer in the candidate history since the previous release;
issue authorship is irrelevant. The prerelease is staged as a draft and receives
both installable assets, the membership manifest and their `SHA256SUMS` passport.
Only then does it become public. The downloaded public bytes and membership are
verified against the candidate, followed by the paginated HACS order and
manifest-driven issue bookkeeping. Nothing else re-uploads assets after
publication (#540): the bytes it verified are the bytes that stay. Re-running
the same command after a partial failure is safe when the checkout still points
to the tagged candidate: stale assets are repaired, while a hidden per-release
comment marker, manifest membership and postcondition check make comment,
status-label removal and close individually repeatable (#547). ZIP inspection
is implemented in Node and does not depend on the host's `tar`/`unzip` variant.
A per-tag local lock and GitHub workflow
concurrency reject parallel runs; the local lock is removed on normal exit and
on handled `SIGHUP`/`SIGINT`/`SIGTERM` interruption (`SIGKILL` cannot be handled
by any process).

`Publish prerelease` in GitHub Actions is the browser/button equivalent. Select
the `dev` branch and enter the exact tag. It performs the same contract and
draft-first publication entirely on GitHub, including both assets. Prereleases
are intentionally silent in Telegram; only stable releases are announced.
GitHub exposes a `workflow_dispatch` button only after
the workflow file exists on the default branch; until the next promotion to
`main`, use the local command. The workflow snapshots the current S8 candidates
before publication, then retains only issues proven by Git history in the pinned
SHA. Its `close-merged` job consumes that immutable manifest after public asset
verification, so work merged later remains open and an accepted external issue
is treated like an owner-authored one. A retry reuses the published manifest and
resumes bookkeeping even when the release is already public (#120, #547).

**Independent line review (#638, `PROCESS.md` §11.5).** Right after the
candidate SHA is pinned, the `independent-review` job of `release.yml` queues
`.github/workflows/release-review.yml` on `dev` for the same tag and SHA. It
reviews every product surface changed since the previous stable tag against
`docs/SCOPE.md` and `docs/USER-GUIDE.ru.md` — without specs or review rounds —
and publishes `docs/reviews/RELEASE-REVIEW-vX.Y.Z.md` to `dev`. It runs in
parallel and **never blocks the release**: no release job needs it, a failure
is a warning, and the findings are the owner's call. Manual run:
`gh workflow run release-review.yml --ref dev -f tag=vX.Y.Z`; a repeat for a
tag whose document already exists is skipped unless `-f force=true`.

**Stable releases** go through `.github/workflows/release.yml`, the only
publisher of installable assets (#540). Run it with `workflow_dispatch` on
`main` with the exact tag: when the tag does not exist yet it is created on the
`main` tip; when it exists, its commit is the candidate. The workflow resolves
the tag to its exact commit, requires the `Release: <tag>` trailer on it,
checks the release contract (`release-contract.mjs --stable`) and
requires a complete Validate proof for its SHA and
Git tree (#541). The proof is tied to the workflow run ID and attempt and lists
both the requested checks and the jobs that actually executed. A skipped heavy job counts only
when its content-addressed reuse marker names an independently verified
successful source job. Since #573 the proof also carries composite evidence:
the identity of the product tree (every tracked path except the accepted
golden overlay `demo/golden/baselines/**`), the overlay itself (its Git tree,
the SHA-256 of `baselines-index.json` and either the run named by the commit's
`Baseline-Reviewed:` trailer or the attestation hash stored by a
`Baseline-Reviewed-Local:` commit) and the content key of every reusable job,
executed or reused. Release consumers standing on the candidate checkout
(`release-gate.mjs`, `release-prerelease.mjs`) recompute all of it locally and
fail closed on any mismatch, on a reused marker whose key is not the
candidate's, and on a declared review run that does not exist, was cancelled
or is not a Validate run; a proof without the block is stale for them. Review
and merge consumers pass no expectations, do not query the declared review run
and keep the #541 semantics unchanged. The
practical consequence is the beta.3 path: a candidate red only in golden,
then a baseline-only commit that reuses smoke, performance smoke, parity and
backend from the candidate's green jobs, skips every caught witness in the
mutation ledger and re-runs golden, preflight and frontend only. Review, merge and release use the
same `missing` / `pending` / `cancelled` / `stale` / `failed` state machine. A
cancelled or light run is not a release verdict. The newest compatible full run is the verdict:
a later failed full run blocks an older green proof, while a later cancelled,
light or otherwise stale run is skipped because it does not answer the same
release policy. A later complete green full run can refresh an older failure
(#511, #619, #656). The release also requires Full
Performance and a green E2E run on a
real Home Assistant — `e2e-gate.mjs --ref=<sha>` dispatches `e2e.yml` in
`Matysh/houseplan-e2e` on the **candidate commit**, whose
`custom_components/houseplan` tree the suite installs from the codeload tarball
(#514, #540) — then builds once, archives `houseplan.zip` from that same tree
(`git archive <sha>:custom_components/houseplan`, deterministic), writes
`SHA256SUMS`, uploads everything into a draft, publishes, downloads the public
assets back and checks them against the passport, and only then announces.
Before staging, a stable release also runs `npm run continuity:screencast`: the
CDP compositor screencast fails the run on an empty or black presented frame and
uploads the failed frames as `continuity-screencast`. The
tree hash printed in the run summary is the identity between what E2E installed
and what HACS downloads.

**After a stable release**, once its line review
(`RELEASE-REVIEW-vX.Y.Z.md`) is in `dev` and the `S7-code-review` queue is
empty, archive the line's review documents (`PROCESS.md` §2.10):
`node scripts/reviews-archive.mjs --through=vX.Y.Z` prints the plan,
`--apply` moves the files into `legacy/reviews/vX.Y.Z/` with `git mv`, rewrites
the relative Markdown links in and to the moved documents and rebuilds
`docs/reviews/INDEX.md` (`--check-links` lists what is still broken); commit the result as one class C commit
whose `Issue:` trailer names the issue doing the move or the repository-hygiene
umbrella (`PROCESS.md` §11.3).

Publishing a stable release by hand in the GitHub form still works, but
fail-closed: `release: published` starts the same workflow, which immediately
turns the release back into a draft and walks the same path; nothing installable
is public while the gates run. A red gate leaves the draft in place — open the
linked run, the Playwright traces and screenshots are in its artifacts; fix,
then cut a new tag. Re-dispatching the workflow on an already public tag is a
**repair**: the gates run again on the SHA, missing assets are added, and an
existing asset whose hash differs from the rebuilt one fails the run instead of
being replaced. Hand-published betas are ignored by this workflow — prereleases
have their own staged path above. Bump the version in every source
`scripts/release-contract.mjs` reads (`parseVersionSources`: `package.json`,
`package-lock.json`, the integration `manifest.json` and `const.py`,
`CARD_VERSION` in the card and in the editor runtime); the snapshot table in
`docs/STATUS.md` reports whether they agree.

Validate intentionally runs on branch pushes, not tag pushes, so an annotated
release tag does not duplicate the expensive browser/performance matrix; a new
push cancels an unfinished Validate for the same branch, and the gates accept
only a completed run for the exact SHA, never "the last green one". Every
tagged SHA must therefore already be pushed to a branch and have a completed
green full exact-SHA Validate proof. For an owner-approved emergency hotfix, push a
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

A **stable** body aggregates the changelog since the previous **stable**
release, never since the last beta (#328, owner rules 2026-08-27): everything
the line's beta changelogs describe reaches it, while a bug introduced and fixed
strictly inside the beta line — never shipped in any stable — stays out. Every
bullet links its GitHub issue so the rules stay machine-checkable. Draft with
`npm run release:notes -- <tag>` (it lists each candidate item with its source
section so the curator can strike in-line-only fixes), curate by hand, then
`npm run release:notes -- <tag> --verify` must pass. The small-fixes bullet is
allowed only when the range really contains user-visible work the body does not
itemise; a single-issue hotfix ships without it (the verifier enforces this).
Open or partially delivered issues are never presented as shipped.

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
emergency hotfix, and document the exception in the handoff. A
`Release vX.Y.Z-beta.N candidate` commit is **not** promotion-only: it carries
the work itself and follows the ordinary rules, trailers included.

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

The fake `hass` in `demo/srv/demo.html` is set once: opened directly in a
browser, the page renders the plan but **device icons appear only after a
re-render** (F5, or `card.hass = {...card.hass}`). `demo/serve.mjs` does that
nudge for smokes; a plain browser session does not. It is a harness limitation,
not a card bug.

Known environment-sensitive smoke: `demo/smoke_opening_measure.mjs` fails two
sub-checks (`place_dialog_x_magnetised`, `place_committed_x_center`) under the
pinned Chromium — a `1e-6`-tolerance magnet snap on the opening *placement*
path. It reproduces against the pristine committed bundle: pre-existing pixel
precision, not a regression of the change under test.
