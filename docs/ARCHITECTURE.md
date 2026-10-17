# House Plan architecture

The Flat device-contact wall cache (#935 performance correction) uses the
existing floor-record reader with one narrow fingerprint projection: omit only
the top-level `decor` field from each model/current record. Decor cannot alter
masonry. All other fields, including unknown compatible ones, epoch/identity
refresh, mismatched preview records and border visibility remain authoritative.
The general floor caches keep their original keys. A decor transform/cancel
therefore does not cold-build the contact wall union or its spatial graph.

Device copying (#935) is an editor-only `DeviceCopyEditor` command backed by
pure template/name/reverse-link/placement helpers in `device-copy.ts`. It creates
a new virtual Marker, never rebinds the source or moves LED geometry. Effective
HA icon and own light appearance are materialised; own light/toggle selectors
are removed, operational state is not cloned. Existing explicit external sources
and unknown compatible settings remain deep-independent.

`houseplan/marker/copy` accepts source identity/binding, one new marker/position
and both expected revisions. The server reconstructs the narrow delta from the
locked stored pair, derives incoming additions from marker refs and the source's
own HA entities, validates the new graph/settings and commits via `_commit_pair`.
Source availability and writer permission are checked again after executor work.
No Optimize/migration or full-layout client overwrite is involved. The response
contains both accepted bodies/revisions. A lost reply triggers reads for the
same new ID, not another write. Foreign HA replies cannot adopt or retire a
newer command. Uploaded attachments are COPY-prepared with exact name mappings;
original folders are never cleaned by this command. Failed preparations may
leave unreferenced staged files under the new ID, not partial visible markers.
File COPY and uploads share `upload_lock` and the same existing store quotas,
so concurrent duplication cannot spend the same remaining slot twice.

External plan migration (#937) is isolated in `scripts/sh3d-convert/`, not a
Lovelace runtime dependency. Both readers emit the current space envelope through
a generated tool-only bundle of the canonical wall writer. SH3D retains physical
units and plan-only privacy; Easy Floorplan carries explicit compatible content
and manifests, with an automatic estimated common scale. The bounded YAML parser
and wall runtime are bundled into the offline page. No source actions are executed,
images are references only, and the existing authenticated HA import remains the
only writer. See [converter boundaries and deployment](../scripts/sh3d-convert/README.md).

Converter target limits are generated from the real Python numeric declarations;
they are independent of the more generous source-reader budget. Consumer tests
exercise the actual space-display/sun/backdrop helpers, not just an extra-key
tolerant schema, so stored `space.settings` remains effective in the runtime.

Backdrop references (#941) accept only bounded image-selector query parameters;
unknown names, duplicates and fragments are omitted with the existing loss report.
This avoids an unbounded credential-name denylist or stripping a required signature.

Nightly witness maintenance (#917) changes no product owner or runtime. The
gesture-entry witness calls the live-update router; the tool-boundary witness
calls the actual lazy renderer with a retained dialog/cache, independently of
toolbar cleanup. The stale-door mutation spans both redundant protections.
Two preparation definitions retain TypeScript's original broad JSON typing
and reachable callback narrowing instead of failing before their oracle.
An explicit read-only published-stable metadata check may use the reachable
previous stable tag's catalogue after the next cycle opens. It requires the
unchanged tagged notes and current authored RU/EN sections. Publication stays
HEAD-bound and rejects this historical-verification option.

Stable field decisions (#916) are release metadata, not product state or native
receipts. A reviewed tag/SHA binding plus the latest authenticated owner comment
can authorize promotion of an owner-tested public beta with unchanged product,
dependencies and capture/build inputs except exact version fields. The reader
now treats manual owner dev/GPU observations as optional on every channel
(#929), never fabricates GPU proof, and cannot override explicit vetoes,
supplied invalid scene plans or automatic gates. The historical #916 scene-plan
waiver remains scoped to its exact promotion; future field receipts need no waiver.
Release accounting reads all reachable parents, retaining each task's original
implementation provenance instead of borrowing a merge's unrelated issue.

Presentation seams (#907) have no new data or write authority. The marker form
passes its effective locale to the reactive read-only preview, which retains
HA fallback when standalone. The existing write-error mapper recognises the
known context code, supplied by the unchanged early placement refusal. Optimize
reads own string roster names only; owner classification and cleanup stay intact.

Thickness selection (#911) is lazy editor presentation, not a new hit target.
`wall-thickness-selection.ts` resolves the current room span or partition from
the dialog target and opening floor, and reuses the physical hover shape policy.
The runtime caches one result by opening array identity, model and config epoch;
field edits and camera movement do not rebuild it. Its editor-only class hands
paint ownership to the existing live layer. The original hover getter remains
cursor-only and still owns wallhot; no host port, schema or writer is added.

Release delivery phases (#903) share `scripts/task-delivery.mjs` between the
SPEC publisher, release catalogue and membership create/verify. Versioned
spec-review trailers require the exact publisher/delta and the document's own
machine material anchors; old publisher commits receive equivalent checks.
Spec trace remains separate from implemented entries. The schema-1 authored
classification must be renewed when an earlier doc-only blob meets its first
A/B delivery; the same immutable history check guards merge and catalogue.
No runtime state, owner acceptance or release authority is introduced.

Review instruction consistency (#905) places negative-evidence policy in the
common reviewer entry and actual workflow prompt, before track-specific text.
Ordinary inputs exercise unchanged code; temporary source, compiled-artifact,
guard or budget substitutions are mutation execution and remain nightly-only.
Existing static readiness and outcome classifiers keep their formats/owners;
no command sandbox, permission change or retrospective verdict rewrite is added.

Evidence accuracy (#910) adds no runtime or evidence-executor owner. A pure
uniform-dirty receipt test isolates the existing signature refusal; a bounded
DEVELOPMENT checklist linked from TESTING separates execution, reused proof,
content equivalence and unknown. Historical corrections are additive dated prose with primary links,
not edits to original review anchors, raw or verdicts. Text/link checks do not
claim semantic fact-checking.

Backdrop cancellation (#908) reconciles only its stage `bdgrabbing` class at
cancel and explicit begin, since a retained terminal can leave Lit's cached
class value unchanged. The stage routes capture loss only for the active
backdrop pointer; normal release has already retired that owner. No per-move
publication, frame policy, transform builder or history/persistence owner changes.

Stage surface ownership (#900) is one pure composed-path predicate in
`canvas-surface-gestures.ts`, shared by scene pointer, click, wheel and touch
contact admission. Physical contacts still reach the activation-tail guard;
surface contacts never enter the scene pinch. `wall-thickness-dialog-gesture.ts`
is an editor-only DOM owner: keyed dialog lifetime, pointer capture, threshold,
bounded screen coordinates and a resize observer. It performs no host render,
camera update, config write or history operation. The dialog is a stage sibling
of the camera wrapper; editor-only styles remain lazy. LED's modal shell also
consumes pointer/click events while retaining native list scrolling.

System LQI visibility (#876) has one bounded policy in `signal-visibility.ts`.
`spaceDisplayOf` projects explicit new modes and historical false; every full,
static, hover and preview consumer feeds that local override, the exact card
option and accepted installation setting into `effectiveShowLqi`. A card's
default true cannot hide the global setting. The policy performs no HA reads,
registry indexing, geometry work or persistence; snapshot boolean variants stay
reusable. The independent room-card `label_lqi`, explicit LQI value sources,
battery diagnostics and topology ownership do not consume this policy.

The synthetic QA boundary (#896) is outside both product bundles and persisted
HA schemas. Its cloned in-memory config/layout pairs implement the real write
message shapes and independent revisions, while a session-stable service
recorder survives synthetic state events. Static capture alone owns recursive
shadow stability and restores it in `finally`; dynamic transition evidence uses
ordinary CSS. Capture/source identity includes browser argument modules, with
launched-browser attestation remaining a separate proof of the executable.

View marker holds (#847) have one pointer-owned `ViewHoldGesture`, one 600 ms
timer and a generation fence. Marker/stage/window terminals cancel only that
owner. Blur interrupts activation without discarding physical contacts; shared
hidden/pagehide and disconnect abandon contacts but keep old click/contextmenu
tails inert until deliberate pointer/keyboard intent. Capture loss is not a
physical release, and implicit loss after accepted up cannot cancel room fit.
`subscribePageVisibility` owns one pagehide listener per Document, normalizes it
to the existing hidden signal and deduplicates hidden+pagehide. Sun fade teardown
resets its two-second keep-alive before detach; reconnect reads current HA sun.

View entry recovery (#894) resolves opening-info against the canonical exact
space/stable opening ID, never a retained display object. Binding changes retire
the old unlock decision. Exact lock/contact friendly names are presentation-only.
`WarmMarkerRestore` owns an unpublished View draft until the lazy renderer is
ready; its visible loading/error surface can be closed or retried, and stale
permissions/identity/intent cannot publish or acknowledge it. The Area action is
a native sibling of the room-fit keyboard target, not a nested button.
The named fit sibling carries the same stable room ID through the shared plan
pointer owner, so its keyboard role does not swallow the existing room tap.
Its 44px native Area hit box extends away from the text while retaining the
passive icon's inline footprint and View/Plan name-anchor parity.
`isLightGroupDevice` certifies model Group using the existing indexed HA children;
the shared Auto/roster/preview/static resolver leaves custom icons first.
`kiosk-viewport-recovery.ts` keeps only a ten-minute, consume-once camera address
in sessionStorage, scoped by DOM/shadow placement, route, options and HA account.
Only non-carousel kiosks bypass the old base-zoom version gate; all other guards
remain. A failed memo write refuses automatic navigation rather than discarding
the camera; deleted exact floors never transfer coordinates to the fallback.
Delayed restoration rechecks the captured write-context generation and the
unchanged placement key before it can publish a draft or camera.

Optional View boundaries (#848) share immutable factory/pending code only.
`ViewRuntimeBoundary` owns each card's loading/error, single explicit retry and
HA-context generation. A retired pending result cannot construct or install a
runtime or update its old host. Every module checks its own compiled fingerprint;
Zigbee custom-element registration is an installation side effect after that
check. Summary keeps synchronous page-warm adoption and rejected-promise cleanup;
its named entry facade survives Rollup's internal shared-namespace export aliases.
Nonce retry points to the same immutable hashed root, not a guessed new bundle.
The permanent notice remains during retry and disappears only on success or a
disabled function. Summary preference identity has one shared reader. Terminal
failures feed the existing `VersionRecoveryController` safety timer/session claim,
without inventing a version mismatch or another reload budget.

Composite form focus (#870) belongs either to the native form-kit wrapper or
the authentic HA picker, never both. The picker is styled through its public
host contract; its private shadow DOM and event handlers remain untouched.

Stable release prose (#840) has separate authored RU/EN histories in
`docs/changelog_user_stable_{ru,en}.md`. `user-stable-changelog.mjs` extracts a
tag/base-bound section without summarizing it. Release preparation copies both
languages into RELEASE-NOTES for GitHub/HACS; the contract proves exact equality.
Telegram reads only the same RU section and renders the heading/bold/links,
retaining emoji and blank lines. Technical/beta changelogs and product runtime
are unchanged. The shared `stableHeading` fixes the locale-specific short title
(#841); extraction and validation use that same contract. Canon: `PROCESS.md`
§11.9; mechanics: `DEVELOPMENT.md` › Release.

Kiosk hold-to-modal input (#831) transfers stage suppression to an instance-local
`TouchGestureClickGuard` modal-tail barrier before interrupting the stage. Its
owning pointer survives implicit capture loss until actual release/cancel; an
unrelated terminal cannot re-arm it. A fresh pointerdown after that boundary or
Enter/Space permits native dialog activation without a timeout. The existing
multi-touch post-gesture barrier remains independent and cannot be re-armed by
modal keyboard intent. No pointermove work or editor runtime is added.

Resize atom projection (#832) prepares frozen oriented run/vertex correspondence
in `resize-atom-projection.ts`. Solver handles remain coalesced; preview restores
the original ordered structural vertices before updating catalogue IDs. The
gesture owns one catalogue/consumer closure: only owners of changed IDs resync
their compatibility polygon. An inactive owner's same-thickness collinear
identity vertex may move on its unchanged run, never a corner or physical
thickness boundary. Both incident atoms must agree. Metadata, full physical and
junction barriers still run before paint/commit; terminal/reset drops the map.
If an enabled side-wall length change separates shared ownership at a fixed
third-room corner, a proven same-carrier split uses the existing structural
barrier on the frozen changed-ID owner closure before proof/paint. It never
drags that corner or rebuilds remote rooms. An indirectly shared atom with an
external consumer must remain byte-identical or the local candidate refuses.
The already-checked compatibility rekey ledger stays intact; final writes
derive the canonical wall projection through the ordinary barrier.

One HACS repository (category **Integration**) ships the backend
(`custom_components/houseplan`), both Lovelace cards and the `/houseplan` panel
(`src/` → `dist/`). This document is the map: each subsystem gets a short
description and a link to its canonical document, which owns the details.

## Wall-node editing (#803)

#834 separates cheap input arbitration from expensive frame work. Native
events retain the first unambiguous X axis while only the newest pending target
builds/proves/paints in an animation frame. Release flushes synchronously before
the existing paint/write barrier; cancellation retires the callback. Identical
snapped target/axis reuses its exact accepted or refused candidate, while a
guide-only change still paints.

`wall-shell-union.ts` keeps the ordinary exact union first. Only its exception
gets a retry with computed operands at the existing canonical coordinate
precision; collapsed rings, disappearing holes and changed operand topology
remain failures. This does not rewrite stored coordinates or relax junction
limits. Junction reuse explicitly scales the pre-opening room masonry to
config units; structural open-spans and incompatible/failed artifacts retain
the canonical independent proof. Visible opening-cut geometry is never used
as that proof.

The frozen Select baseline owns `WallBooleanBaseline`: exact operation/operand keys,
defensive result copies, and a bounded baseline-only recording phase (512
entries / 2 million serialized characters). Moving candidates never add result
records; they may refresh the separately bounded canonical-value certificate
FIFO described in WALL-THICKNESS.md. The synchronous scope is
restored even on exceptions and does not alter ordinary View/Resize calls.
Local boundary replacement proves every added/retained and added/added edge
pair free of crossings, overlaps and interior contacts before reconstructing
the output rings; only ordinary shared endpoints are allowed.
The reconstructed rings reuse that same exact coordinate scale for their area
sign; this avoids reparsing decimals without approximating the shoelace sum.
Corner unions and opening cuts batch exact associative boolean operations,
with the historical sequential path on failure. A wall strip is omitted only
when a conservative convex-containment proof shows it already lies entirely
in masonry; ambiguous predicates, holes and concave bays take normal clipping.
This coverage predicate is supplied only by lazy Select through `WallGeometryOperations`; ordinary View retains the canonical edge boolean path without loading that helper.
Ordered local junction replacements are composed before the final whole-body
difference/union; later cuts still remove earlier additions. Failed composition
replays the historical sequential path, including its per-node isolation and
protected strips. The junction guard computes and judges room contours itself;
an optional observer then copies them into the candidate's render-only cache
in render units. The proof never consumes that cache. Incompatible previews
retain the original independent contour calculation.

Select also groups corner fans before clipping their shared facade bound. Any
failed grouped stage, including the final body union, replays the complete
historical per-fan path; ordinary View keeps that path directly. The guard's
lazy subtraction operation omits only canonical masonry holes whose bounding
boxes are strictly disjoint from every subject ring. Outer boundaries and
touching/enclosing holes stay intact; ambiguous rings use the complete old
operand. This exact locality reduction never skips the room-floor subtraction
or its clearance checks, and both helper implementations stay outside View.

Node movement (#803) is a lazy subsystem whose capture is Select-only (#843:
its history is not): `wall-node-move.ts`
freezes the structural graph, `wall-node-editor.ts` owns capture/cancel and
the isolated live roots, `wall-node-preview.ts` renders the local complete-body
closure through production masonry/inner-contour/opening functions, and
`wall-node-write.ts` serializes the dedicated server operation with existing
writers. Remote paper, fills and masonry stay in the settled DOM. #828 gives
every transient warning, guide, X prompt and active handle one live owner;
the full Lit scene owns only stationary handles. At pointerdown the already
presented production masonry/axes/zero lines are frozen once (without room
fills, opening symbols or snap handles). One .35 source layer above candidate
paper/fills and below candidate masonry clips that snapshot to changed old
arms, retaining opening cuts and ordinary unchanged neighbours. Its coverage
is gesture-local and reused while the target moves; even an unbuildable
candidate can show the source. Cancel/commit/context retirement releases it.
Old settled local geometry remains masked out so it cannot duplicate either
source or candidate. These masks do not rebuild full-floor geometry per pointer.
Preview never replaces
the authoritative config, model cache or recovery snapshot. The backend mirror
`wall_node_move.py` derives the delta and independently proves an inverse before
Undo; a separate original-interval/midpoint ledger proves the only allowed
host-ID changes before strict partition-jamb validation, without copying
authority from the candidate. `config/set` keeps its existing host protection.
The ledger read-normalises a copy of the durable legacy input before deriving
structural identities, just as the first proof does; it never migrates on hover.
Details: CANVAS.md, UX-MODES.md, WALL-THICKNESS.md and CONFIG-COMPATIBILITY.md.
`wall-node-history.ts` (#843) applies a node command of the shared geometry
stack from any Plan/Background tool; a node step in the stack makes the runtime
load the adapter on demand, View never does. `writeWallNode` first settles this
tab's own write queue (a failed own write is re-sent before, never overtaken)
and may then advance the expected revision only through own accepted writes:
`ConfigAdoption.adoptionEpoch` moves on every other identity change, and the
target floor must equal the command's expectation (Undo: the accepted move,
Redo: the accepted Undo — the server proves only Undo; a gesture: its start).
`CommandStack.confirmUndo/confirmRedo` move the cursor only after acceptance.
`wall-node-edges.ts` (#864) groups only uncovered edge strips, clips their
union to the common centre and merges it into the unchanged room body. Any
grouped failure replays the complete old per-edge phase; ordinary View retains
its original sequential consumer, and no geometry certificate/cache is added.
Every live paint rechecks its frozen context before constructing SVG groups;
mode/floor/revision adoption retires capture and masks before the settled render.
`editor-shared` isolates shared lazy helpers so the editor entry retains its
named API on both its normal import and its opaque immutable-URL retry.
Both stable entry facades hoist any extra eager chunk imports into the same
awaited fallback boundary, before the implementation. A deleted extra chunk
therefore cannot abort the entry before its stale-update message is installed;
the manifest retains every eager dependency.
The write terminal refreshes history controls even when its own revision
adoption already retired the live preview before the command was recorded.
One successful local baseline can survive cancellation while the authoritative
config object, revision, space and exact selected-config value remain unchanged.
The retained config is private; every new candidate still builds and receives
its physical proof. Context exits, writes/history, pagehide and disposal retire
it. Candidate geometry, structural snapshots and live layers remain gesture-only.
Persistent source-style overrides are diffed and restored only on departure;
full host renders rebind their elements and changed authoritative inline styles.
Live handle templates read the current viewport scale before committing the
paper/room SVG layers, avoiding a read-after-write layout flush within paint.
`wall-local-boolean` keeps disconnected canonical components out of
repeated clipping sweeps; touching bounds still invoke the original boolean
library. These are exact broad-phase exclusions, not relaxed wall limits.
Snap arbitration keeps its winning axis guide but preserves an exact compatible
non-parallel H/V point instead of moving it with longitudinal quantisation.
Retired click-tail suppression checks stage ancestry and permits keyboard
clicks (`detail=0`); it cannot immobilise header/toolbar controls after a drag.

## Styles (#266)

`src/styles.ts` composes `cardStyles = [base, plan, devices, chrome, dialogs,
isoTiles]` from `src/styles/*.styles.ts`; the order is a cascade contract (the
golden set is accepted against it; `isoTiles` last so 2.5D tiles beat
equal-weight Flat marker rules, #649). `base` holds host, variables and rules
shared by two surfaces; `plan` stage ink, `devices` markers, `chrome`
toolbars/tabs/menus, `dialogs` dialogs/forms/pickers. `form-kit.styles.ts`
(#594), `editor-secondary.styles.ts` and the summary-panel sheets live outside
that aggregator. `test/styles-split.test.mjs` pins composition, no cross-file
duplicate selectors and `@media` wrappers; `scripts/dev/styles-diff.mjs` proves
a move refactor-only. Public selectors: `STYLING-HOOKS.md`. CSS only the
editor renders is not in the first frame (#805): `editor-dialogs.styles.ts` (the
editor-only rules of `dialogs`) and `editor-secondary.styles.ts` (the tray) are
adopted by the lazy editor runtime's constructor (`editor-style-adoption.ts`) into
their old cascade slots — after `dialogs` and after `cardStyles`; ownership and the
reverse ratchet live in `test/editor-dialog-styles.test.mjs`.

## Layout

```
houseplan-card/
├─ src/                                  # card sources (TypeScript + Lit 3)
│  ├─ houseplan-card.ts                  # eager full card: View shell, HA lifecycle, lazy-runtime hosts
│  ├─ houseplan-panel.ts                 # /houseplan sidebar host around one full card (#486)
│  ├─ space-card.ts · space-render.ts    # read-only houseplan-space-card and its static renderer
│  ├─ houseplan-editor-runtime.ts        # lazy Plan/Devices/Background composition root
│  ├─ physical-body-gesture.ts           # editor-only body/column gesture owner (13-purpose port)
│  ├─ backdrop-frame-gesture.ts          # editor-only backdrop gesture/frame owner (14-purpose port)
│  ├─ houseplan-onboarding-runtime.ts    # lazy first-space/import dialogs, independent of the editor
│  ├─ iso-*.ts · pdf/ · stairs*.ts · furniture*.ts  # 2.5D, PDF export, stairs, furniture (own docs)
│  ├─ devices.ts · rules.ts              # device list from registries; icon rules and exclusions
│  ├─ ha-binding-status.ts · device-presentation*.ts  # binding authority; marker face decisions
│  ├─ space-geometry.ts · wall-*.ts · physical-geometry.ts · logic.ts · types.ts  # pure, no Lit/DOM
│  ├─ config-store.ts · config-adoption.ts · command-stack.ts  # config cache, #500 boundary, Undo
│  ├─ sun.ts · day-cycle-render.ts       # window rays, four-phase background (SUN.md)
│  ├─ vacuum*.ts · radar-*.ts · zigbee-topology*.ts · summary-panel*.ts  # live subsystems
│  ├─ hp-dialog.ts · hp-confirm.ts · danger-confirm.ts · hp-help.ts · floating-surface*.ts
│  ├─ editor-runtime-loader.ts · version-recovery*.ts · build-identity.ts · editor-secondary.ts  # lazy loader; #462/#836; tray
│  ├─ editor.ts · space-editor.ts        # Lovelace GUI config editors of both cards
│  └─ editors/ · render/ · styles/ · i18n/  # settings dialogs, SVG projections, sheets, locales
├─ dist/                                 # two stable entries, houseplan-assets.json, hashed chunks
├─ demo/                                 # demo rig and smokes; golden/ (HP-QA-01), performance/
├─ scripts/ · .github/workflows/         # build/bundle gates, release-*.mjs; CI and release
├─ custom_components/houseplan/          # the HA integration
│  ├─ __init__.py · store.py             # setup/unload; versioned stores and per-entry runtime data
│  ├─ websocket_api.py · http_api.py · auth.py  # WS commands, uploads, the one may_write policy
│  ├─ validation.py · coordinate_canonicalization.py  # pure schema validation, write canonicalisation
│  ├─ frontend_registration.py · frontend_assets.py · panel_registration.py · build_identity.py  # resource, chunks, panel, build
│  ├─ import_export.py · decor_assets.py · plans.py  # backup/import, decor images, plan blobs
│  ├─ trails.py · vacuum_routes.py · radar*.py · virtual_lights.py  # live-subsystem backends
│  ├─ config_flow.py · const.py · system_health.py · diagnostics.py · repairs.py · support_*.py
│  └─ frontend/                          # release-only snapshot of dist (#657)
└─ docs/                                 # this documentation
```

Rollup emits two stable roots, `houseplan-card.js` and `houseplan-panel.js`,
plus hashed chunks and `dist/houseplan-assets.json` (graph, sizes, SHA-256).
The panel imports the card chunk by its hashed name, never through the card's
unversioned facade: entries are served without `Cache-Control`, and a stale
facade once ran an old card against the current backend (#535). Both roots keep
the fail-loud stale-load wrapper. View loads only the initial graph; editor,
onboarding, 2.5D (#649), PDF, locale and furniture-art graphs are lazy, each
passing the exact-build fingerprint handshake (one cache-busted retry, atomic
install), and `scripts/bundle-budget.mjs` fails a build whose lazy graph is
missing or leaks into the initial graph. The backend serves only manifest-listed
chunks. Commands and gates: `DEVELOPMENT.md` › Build, › Tests, › Release.

## Key decisions

1. **One repository — integration + panel + cards.** The integration serves
   its own JS; the exact build-specific module URL is the resource identity
   (`?v=<version>&b=<fingerprint8>`, plus `&dev=<sha>` on a dev build, #836), a
   writable Lovelace resource registry is authoritative and `add_extra_js_url`
   the truthful fallback. A build is identified by its frontend fingerprint, not
   by the version number, which consecutive dev builds share. Each
   `houseplan/config/get` carries the authoritative `integration_version`,
   `frontend_fingerprint` and dev `build`: View offers a manual reload, kiosk reloads once per
   backend target in a safe idle state, the space card has no version controller
   (`DEVELOPMENT.md` › Resource registration and version recovery (#462)). After
   migrations succeed, setup registers the public `/houseplan` panel
   (`require_admin=False`, #486): a thin app-bar host around one ordinary full
   card, fail-soft, removed on unload only by the exact owner and setup
   generation (`UX-MODES.md` › Principle; `TESTING.md` › Installation / upgrade /
   removal). In a Sections `layout="grid"` slot HA owns the height: `.stage` is
   the shrinking flex child and transitions use the measured card height, never
   `window.innerHeight`; `getGridOptions()` is full width, 10 rows, min 6 (#648).
2. **Server-side storage, no token.** `store.py` keeps `.storage/houseplan.config`,
   `houseplan.layout` (marker positions) and `houseplan.virtual_lights`;
   `trails.py` keeps `houseplan.trails`. All traffic uses the frontend `hass`
   connection (Integration WS API below); House Plan opens no socket and holds no
   token. localStorage keeps a start-up snapshot and, only if no backend ever
   answered, a local layout. Registries come from one `ha-binding-status` fetch
   and subscription pair per HA connection, shared by every card on the page;
   live rows augment an older snapshot at once and a debounced full reload
   reconciles `disabled_by` even without registry events (`FILTERING.md` ›
   Behaviour).
   Reinstallation (#820) is an admin-only HA config-flow choice, not a runtime
   cleanup action. `previous_data.py` inventories these four fixed Store files
   and `houseplan/{plans,files,assets}` read-only in the executor; only the config
   JSON and, when it has no spaces, the layout JSON (its `optimize_pending` key
   only) are read, without calling Store or triggering migrations. A safe set
   whose config is absent or has `spaces: []` and whose layout holds no pending
   paired write skips the menu and takes the Fresh path (#877); unreadable,
   unsafe or pending data keeps the menu. Restore uses the unchanged setup
   path. Fresh, on final `user` confirmation only, renames
   the complete set to `houseplan/archive/<unique UTC timestamp>/storage/` and
   its three sibling data directories. Archives are outside active discovery,
   quotas and housekeeping and have no automatic retention cleanup. Unsafe
   links/cross-filesystem moves abort before transfer; handled errors reverse
   completed renames, without overwriting files. A failed rollback preserves
   the partial archive and logs its path; this is not a crash-atomic transaction.
   Single-entry/in-progress fences prevent moving an active installation's data.
3. **Reactivity.** Every `hass` update re-renders. Registry rebuilds also run the
   pure `device-area-relocation` resolver: pending ids override stale layout in
   full and static cards at once; the writer deletes those points before
   advancing Area provenance and restores them if the config write is rejected
   (a failed restore leaves the attention marker); only the moved device's
   Undo/Redo is invalidated; limited snapshots never infer movement
   (`CONFIG-COMPATIBILITY.md` › Marker Area provenance (#126)).
4. **One modal contract.** Card modals render through `hp-dialog`: `ha-dialog`
   if registered when the instance connects, otherwise a first-class native
   `<dialog>` for its lifetime (top layer, backdrop, reopened once if `:modal`
   was lost); a late registration never swaps an open surface, and alert
   confirmations stay native for real `alertdialog` semantics. The wrapper owns
   title, initial focus, Escape and a shadow-root-scoped restore-focus session
   (nested dialogs return to their trigger, a replacement to the first opener).
   `flex-content` forwards `flexcontent` so an inner scroller is height-bound
   (#508); the footer stays a full-width slot item; titles wrap; destructive
   actions stay left while Cancel/Save wrap right together. Dangerous actions
   use one eager `HpConfirmController` on `HouseplanCard` plus stateless
   `hp-confirm` (#32): replace-not-queue, every dismissal cancels, a token
   rejects stale decisions, callers re-resolve targets after `await`. Native
   `confirm()` is not a supported surface.
5. **Open passages are negative architecture (#157).** `type=passage` shares
   placement, wall cut and tunnels with other openings but has no leaf, binding
   or 2.5D panel; static wall fingerprints add only passage cuts, so door/window/
   gate output is unchanged (`CONFIG-COMPATIBILITY.md` › Open-passage opening
   type).
6. **One transient-surface contract (#68, #57).** `hp-dialog` keeps a scoped
   LIFO registry for help and colour-picker surfaces: Escape/toast close the top
   one first; a new one replaces the previous only inside the same dialog.
   `hp-help` and `hp-color-opacity` share `floating-surface.ts` placement and
   `floating-surface-controller.ts` (Popover top layer, dialog-owned portal
   fallback). Help is localized by the owning card and exists only when body and
   accessible label are both non-empty. Page-wide lazy runtimes — locales
   (#62, #400) and furniture artwork (#474, #593) — settle after two failed
   attempts into English / no artwork with one toast, never an inert card.
7. **One four-phase environment resolver.** `resolveDayCycle()` (`src/sun.ts`)
   and `src/day-cycle-render.ts` serve View, kiosk and the space card; plan
   content is never phase-filtered (`SUN.md` › Current four-phase background).
   The stage-sized outline root owns the triple drop-shadow and
   `will-change: filter`; its child is only the exact paper alpha silhouette,
   and the plan root gets an explicit stage-sized transform layer so Chromium
   never rediscovers it as an implicit overlap layer (#532, #582).

## Coordinate system

Plan geometry and marker positions are stored normalised on an unbounded canvas:
`0..1` = `NORM_W` (1000) render units, `±5000` validation, `1/240` lattice
(`src/canvas-constants.ts`). Source of truth: `CANVAS.md` › Principle, › Model,
› Grid precision and visual units, › Persisted coordinate canonicalisation.

## Card data model (runtime)

**Optional space model (#113).** Without authoritative spaces there is no
`SpaceModel`: `_spaceModel()` returns `undefined` and never invents one. Its
active-or-first choice serves rendering and navigation only; commands carrying a
stable space id use the exact `_spaceModelById()` and abort on a stale id before
any config, layout, file or service effect (`space-model-selection.ts`). The
first update that sees an authoritative empty `spaces` runs one cleanup (pointer
capture, gestures, draft/history, space dialogs, pending config write, back to
View); recreating a space re-arms it. Pure helpers may return empty results;
mutation entry points guard explicitly.

**`DevItem`** (`src/types.ts`) is rebuilt by `buildDevices()` (`src/devices.ts`)
from the active registry projection plus config markers: id, name, model, area,
space, icon, `entities[]` (active runtime entities only), `allEntities[]`
(metadata only), `primary` (first resolved state entity for single-target
actions; marker faces use the resolved role, `DEVICE-PRESENTATION.md`),
temp/hum, marker metadata and effective `controls`. `bindingStatus` (`active`,
`ha_disabled`, `orphaned`, `unverified`) comes only from
`resolveHaBindingStatus()`, never mutates markers, and gates every plan-level
consumer (Glow, climate, LQI, live text, openings, controls, vacuum).
Auto-discovery takes non-service devices whose HA Area is bound to a space. The
base icon is the first matching icon rule (`"<name> <model>"`) → entity
`device_class` → `mdi:chip`; a device with a `lock.*` entity is always
`mdi:lock`. Duplicate `name|area` pairs are numbered; HA light groups and Z2M
group devices become `lg_<entity>` items that fold their lamps. Hiding is
`FILTERING.md`.
The lazy editor owns `RoomDeviceDiscovery` (#879), a finite Save-scoped
placement ledger. Both room-creation paths capture eligible first placements
before new-device detection. The serialized writer includes their existing
`known_devices` baseline atomically with the room, acknowledging live settings
only after success. It never clears historical attention or exempts later
arrivals; room identity/unique Area validation drops stale intents.

## Live data

State, values, LQI and activity are resolved once per frame into one
`ResolvedDevicePresentation` (see Device markers); explicit `marker.value_source`
and `marker.value_badge` go through `src/device-value-badge.ts`. Decision table,
plate colours and LQI scale: [`DEVICE-PRESENTATION.md`](DEVICE-PRESENTATION.md).

### Presence radars (#485 Stage 1)

`marker.radar` is an optional versioned namespace saved only by the ordinary
config transaction. One backend `RadarCoordinator` per entry alone reads raw HA
states and streams clipped, ACL-filtered frames over `houseplan/radar/subscribe`;
observations, calibration samples and trails never reach config, uploads,
support reports or browser storage. Contract and code map: [`RADAR.md`](RADAR.md);
normative limits: [`specs/485-radar-presence-stage1.md`](specs/485-radar-presence-stage1.md).

### Robot vacuums

`src/vacuum-routes.ts` is the only map-to-space authority (six fail-closed
results, #162; mirrored byte-for-byte by `vacuum_routes.py`), `src/vacuum.ts`
owns telemetry normalization, path arbitration and smoothing, and `trails.py`
records runs server-side. Contract and code map: [`VACUUM.md`](VACUUM.md).
`src/vacuum-view.ts` alone synchronizes tip endpoints against the actual
composed SVG screen matrix; it reads all geometry before DOM writes and keeps
robot identity. The passive path SVG inherits the HTML device-layer camera
once (#871); calibration and trail-source arbitration remain separate.

Full paths (#872) use a single backend `vacuum_path_collector.py` per saved
source/robot with a HA-lifetime physical read lease, not one poll per card.
`vacuum_paths.py` owns bounded ordinary JSON/attribute decoding and the public
allowlist. Run generation in `TrailBook` fences reset proof, late responses
and persistence. Frontend `vacuum-path-geometry.ts` owns immutable revision
material and finite/ordered physical certification; `vacuum-trail-material.ts`
is the server/legacy authority and `vacuum-trail-render.ts` memoizes commands.
`vacuum-local-trail.ts` is a bounded position-only legacy reserve. Source
diagnostics are a read-only projection in `vacuum-trail-diagnostics.ts`;
their UI lives in lazy `editors/vacuum-path-diagnostics.ts`, not either monolith.
Source health, map routing, path quality and final confirmation remain distinct.
For explicit maps (#918), `vacuum-runtime-source.ts` composes route resolution
with the same source's telemetry; both snapshot capture and live sampling use
it. Backend observation remains broad, but only the uniquely matched source
may mutate the current run. `currentVacuumTrailFrame()` shares current-path
arbitration, target trimming and SVG/quota counts between View and diagnostics.

## Sizes

`icon_size` is a percentage of the plan (default 2.5; legacy px values > 8 fall
back to 2.5), converted once at the surface boundary and rendered in `cqw` inside
`.stage { container-type: inline-size }` — [`CANVAS.md`](CANVAS.md) §6.

## Sticky header

`.head` is `position: sticky; top: var(--header-height, 56px)`, so ordinary
dashboard cards keep `ha-card { overflow: visible }` (hidden overflow breaks
sticky). The bounded `panel-host` and Sections `layout="grid"` branches own their
complete height chain and clip at the external slot instead (Key decision 1).

## Device markers

`device-contact-{geometry,scene,snap,walls,collision,floor}` (#866) derive
opening-aware physical contacts, a spatial index, connected components and a
rounded union contour. A gesture moves one indexed marker and repaints only
affected components. `device-contact-render` measures the real shared face at a
fixed core scale and caches bounded metric variants; the lazy fingerprinted live
runtime owns it and its stylesheet. A changed value with the same fitted box and
DOM identity reuses the spatial graph. Full/static adapters share the same geometry.
The hit controller consumes each member's own rounded contact silhouette, never
the whole group's bbox. Icon/text/actions and passive diagnostics stay individual.
The lazy editor resolves contact before independent spacing/grid and carries
one canonical point through preview and the existing writer/history. Optimize
receives positive all-floor face evidence and rechecks contacts against its
candidate geometry; no groups, rotations or attachments enter storage.

`device-icon-roster.ts` is the pure shared eligibility boundary between painted
icons and editor alignment/equal-spacing references (#893). The editor reads
the same render-device snapshot and active LED replacement map as the canvas;
it cannot align to an invisible discovered device. `DeviceDragRetirement`
keeps a bounded retired-pointer tail journal, cleared only by fresh deliberate
pointer/keyboard intent, not a timer. Lifecycle cancellation restores only the
unfinished preview and explicitly repaints the live marker coordinates: Lit's
cached pre-drag style may otherwise skip an imperative left/top rollback.
Released serial writes and their history remain independently owned.

`config.markers[]` records are
`{id, binding: 'device:<id>'|'entity:<eid>'|'virtual', space?, area?, hidden?, removed?, name?, icon?, …}`
plus presentation, light, control, vacuum and radar fields (`validation.py` is
authoritative). Registry devices appear on their own; a `device:` marker
overrides one, `entity:` covers groups/helpers, `virtual` is a manual icon. The
id (device id, `lg_<eid>` or `v_<rand>`) keys the layout. `hidden` is the
reversible hide flag, `removed` a never-rendered binding tombstone ([`FILTERING.md`](FILTERING.md)).

View, kiosk, the static card and the dialog preview share one pipeline:
`device-visual.ts` classifies, `device-presentation.ts` resolves sources, the pure
`device-presentation-policy.ts` owns priority, `device-pulse.ts` owns activity and
`device-face.ts` only paints. `normalizeDeviceDisplay()` is the mandatory read gate
for `display` (`badge|icon_ripple|value|static_icon|value_static_icon`; legacy
`ripple` → `icon_ripple`). The saved coordinate is the icon-core centre;
overlapping 44 px targets get one screen-space owner (`device-hit-owner.ts`),
latched for the whole pointer sequence. Rules: [`DEVICE-PRESENTATION.md`](DEVICE-PRESENTATION.md);
stored fields: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md).

The full card paints from one frozen render-device snapshot per HA frame
(`render-snapshot-capture.ts`, `render-device-snapshot.ts`; the #813 rule pairs
it with its plan geometry). Once the lazy live runtime is loaded its reuse
window (`render-snapshot-reuse.ts`, #850) records which state rows each
device's presentations read and, when a tick changed nothing but such rows,
resolves again only the devices whose rows changed; unchanged rows, DevItems,
the roster and presentations keep their frozen clones. A change of any other
input — registry, roster, layout, config epoch, stored config, card config,
locale/themes, manual lights, the light graph's topology, an activity window —
rebuilds every presentation or the whole snapshot. Without the live chunk
every capture is complete (#848).

The full card's `hidden-device-visibility` owner (#919) keeps browser-local
display intent apart from saved visibility. A bounded projection of the raw
roster reveals only positively active user-hidden rows; snapshots, light,
actions, frame and icon contacts consume those display rows. Raw discovery,
metadata, catalog categories and auto-grid slots retain saved intent. Reuse
keys include the projection and preference; the static card never opts in.

The capture-local `PresentationLightFrame` (#895) indexes that resolved graph
by source key and owner once, with one lazy marker-state choice projection
only when a derived value consumes it. Reuse records the exact consumed light
keys alongside HA row reads; this includes passive sources whose `on` already
encodes incoming driver state and whose `stateEids` may be empty. A lamp tick
therefore invalidates only actual consumers, not every face because an array
identity changed. Unproved/ambiguous graph topology takes the full path. The
current frame/dependency maps are bounded by the live roster and reset with
the existing owner lifecycle; no authority or cross-floor cache is added.

`device-battery.ts` adds an independent own-device diagnostic to the same frozen
presentation. An ownership index is cached against the full HA entity registry;
values come only from active state rows. Entity-bound markers explicitly capture
their physical sensor siblings in the render snapshot, so battery-only ticks
invalidate the correct frame without changing the functional roster or actions.
The default-on shared `settings.show_device_battery` switch does not depend on
face static/live policy; exact `marker.hide_battery:true` adds a per-marker
O(1) gate before the battery resolver, while absence/false inherits the global
choice. Active LED representations omit the indicator. The
passive out-of-flow frame uses one built-in HA MDI icon at the three designer
control sizes, without separate artwork delivery. A continuously sized CSS
drop-shadow is composited on that existing icon; it adds no DOM, observer or
registry scan. Zigbee routes and captions have separate stacking levels: endpoint cores
remain above routes, captions remain above their batteries. Endpoint markers rise
above the route layer as a whole, battery included, so a route copy one level
higher is clipped to their battery frames: routes paint over batteries without
covering cores (#808). The same copy is also clipped to the value-badge frames
of the endpoints, measured in the same layout frame without padding (only the
flex gap separates a badge from its core), so lines and arrows paint over badges
too (#829). A topology snapshot is labelled stale after an hour.

Attachments are staged in `up_*`, promoted into `<config>/houseplan/files/<id>/`
on Save and served by signed `/api/houseplan/content/files/…` URLs (Integration
WS API). Custom Background images use the content-addressed
`<config>/houseplan/assets/` store (`asset_id` = SHA-256 of canonical bytes;
config never carries bytes or URLs) — [`DECOR-EDITOR.md`](DECOR-EDITOR.md) §7.

## Server-side configuration

Empty server installations expose Add space and Import backup (#875). The
file chooser opens synchronously in the user's activation; the File, not its
DOM event, crosses the editor lazy-load. `BackupImportIntent` owns each
instance-local operation through preview/revalidate/apply; close, replacement,
route departure and disconnect revoke late UI results. Writer/kiosk checks do
not require an active space and are repeated after loading and before upload
and Apply. The empty branch renders the existing backup dialog after the
editor runtime has installed its styles. On the empty screen, onboarding and
backup import never open simultaneously; this setup fence does not block the
existing Add space tab/menu on a populated plan during settings import.
Existing server ACL, CAS and paired writes are unchanged.

Optimize maintenance (#892) keeps deletion consent and its source anchor only
in the lazy dialog's memory. `optimize-source.ts` binds the config/layout
revisions and contents, owner evidence and the existing `ConfigWriteContext`
claim, including same-connection user changes; the shared paired
writer checks that anchor after pending writes have finished, before sending
the frozen revisions. A changed source rebuilds the preview without consent;
a retired-authority reply is not adopted. The unguarded Copy space caller
retains its existing contract. Current Houseplan write permission, not a new
HA-admin gate, authorizes Optimize and its paired Undo outside kiosk.

`space-reference-repair.ts` classifies proven-unused missing-space records
separately from live owners, unknown shapes/models and incomplete registry
evidence. The explicit preview option removes eligible whole records (including
unused scale); live-room scale remains a consumer even with an obsolete `s`.
Cleanup neither persists a second snapshot nor calls `layout/set`: Apply and
the existing one-deep Undo still use the server's paired storage transaction.
The report distinguishes current-space and archived-position grid shifts;
vacuum warnings name configured objects and their existing editor path without
changing routes or calibration.

`.storage/houseplan.config` holds `{model_version, spaces[], markers[], settings}`.
A space carries plan-image fields, `rooms[]` (with ordered `wall_ids`),
`wall_segments[]`, `partitions[]`, `wall_columns[]`, `openings[]`, `decor[]`,
`stairs[]` and `settings`. Coordinates keep the historical normalization
(`1.0` = `NORM_W` = 1000 render units) on an unbounded plane with a ±5000 guard
([`CANVAS.md`](CANVAS.md)); `plan_aspect` letterboxes the image and `plan_x/y`,
`plan_scale_x/y`, `plan_angle` transform it ([`DECOR-EDITOR.md`](DECOR-EDITOR.md) §3).
Layout v2 maps `device_id | rl_<roomId>` to `{s, x, y}`. Plan files are
copy-on-write `<config>/houseplan/plans/<space>.<token>.<ext>`, never deleted for
age ([`SCOPE.md`](SCOPE.md)). Migrations: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md).

### Editor gesture owners (#861)

E1 gestures have two editor-lazy owners: `PhysicalBodyGestureRuntime`
owns body drag, square-column rotation and tap/cycle state (13-purpose port);
`BackdropFrameGestureRuntime` owns backdrop drag, derived frame and transforms
(14-purpose port). Neither imports the card or its broad HostPort. Selection,
dialogs, canonical transactions and history remain in their existing owners.
Queue keys use the opaque card identity; state-only reset callers preserve
their existing asymmetry. Begin/end publish a full editor boundary; moves use
the existing live route. The live renderer paints only the moved partition's
hosted openings from the shared resolved preview, suppresses their settled
copies and omits preview hit targets. Other openings are untouched. This is
the sole visible change; E2–E7 editor extraction is not part of E1.

### Editor draft ownership (#851)

`ConfigAdoption` separates the last confirmed config/layout cache from mutable
editor bodies (#890). `restoreCached` seeds only an empty owner; repeated public
`setConfig` changes card-level floor/default options without replacing accepted
revisions, pending edits or history. Accepted writes refresh LS_CFG, while a
storage exception cannot reverse server acceptance. `ConfigWriteContext` fences
queued writes and late replies at HA connection/user replacement; a reconnect
through the same connection retains independent drafts. Foreign authority
retires structural identity/history until that context's config/layout reads
complete. Write queues and pending counters are context-owned: fast new reads
and saves never wait for old transports, whose completion cannot retire a new
counter. Optimistic attempts also lose rollback ownership across contexts even
when both installations have identical content and numeric revisions.
Already subscribed live callbacks also capture that context plus connection
and subscription generation. Retired delivery is refused before any read or
mutation, including the gap before the new paired load installs subscriptions.
The trail callback additionally owns its captured transport and latest request
through `vacuum-trail-refresh.ts` (#901); it rechecks after the read, so an old
success/rejection cannot replace the new trail or its format.
`plan-optimize-undo.ts` owns the existing shared Optimize/full-import Undo tail.
It captures write authority and transport before sending, guards config-read
capabilities and paired adoption (including the backdrop await), then guards
success/error/finally. Foreign HA assignment and detach retire its local lifecycle
and busy/capability state; a fresh operation never waits for the retired transport.
This changes no server CAS/ACL or paired-write protocol and does not touch Apply.
`new-device-ack` owns one explicit visit's attention change and restores
only that ID after rejection, without a background retry loop. Vacuum routes
pass the same optimistic attempt through write-time canonicalization.

`device-editor-access.ts` separates Houseplan writing from HA administration
(#844). The core guards the info footer, direct lazy entrance and each latest,
connected completion; disconnect invalidates the request generation. The
runtime independently guards its entrance, and the core guards acknowledgement,
View dialog paint and warm restoration. Automatic registry lifecycle updates
keep their existing writer-only gate, including kiosk writers. The Area
affordance is administrative outside Plan and passive for Plan writers; the
navigation handler independently checks its current authority.

`editors/dialog-baseline.ts` holds page-memory comparison keys and per-opening
owner tokens, transferred with warm drafts but never serialized. `draft-close.ts`
rechecks ownership after confirmation; `draft-actions.ts` composes the ordinary
form and existing Radar discard into one question and guards editor navigation.
`editors/room-save.ts` keeps a room-settings draft until its own accepted write,
staging through the same runtime/ConfigAdoption boundary as marker saves and
retaining #842's rollback/deferred-write authority. `editor-chain-exit.ts` owns
the failed-finish navigation decision; its leave path only releases session
state. Neither helper writes a schema key, deletes walls or bypasses preflight.

### Persisted colour boundary

Every stored colour is exactly `#RRGGBB`: `src/color.ts` resolves it and
`validation.py::_COLOR` guards writes. Render-time resolvers re-apply a safe
default because old, imported or hand-edited stores are not migrated on read.
HA `rgb_color` is live state: three finite channels, clamped/rounded to 0–255 and
emitted only as generated `rgb(R, G, B)`. The final inline-style sink accepts
only those two forms; arbitrary CSS colour syntax would need a separate
product/security decision and must not be added to an individual sink.

## Room and independent wall geometry

Identity ordering (#845) is a pure shared leaf, `codepoint-order.ts`: Python
Unicode code points, never locale or UTF-16. Both migration ID sets reserve
stairs. The Python materializer mirrors `atomicPolyForRoom`'s split-point
precedence and positive short-edge contract, plus `thicknessCmAt`'s final
compatibility inheritance before previous cm. Its wall key uses the already
documented storage-noise boundary. The independent node proof/Undo protocol
is unchanged. Corpus and room parity run against actual modules in the existing
`geometry_parity` job, without trusting a frontend verdict or repairing on read.

Model v10 (#282, #306, #478): `wall_segments[]` is the authoritative catalog of
atomic room-wall intervals with stable ids, `rooms[].wall_ids[]` orders each
contour, and room polygons plus `walls[]` are read-compatibility projections.
Every accepted Walls-chain edge is an ordinary `partition`; `wall_columns` are
square/circular columns; neither creates or implicitly splits a room or HA area.
`cm:0` keeps a structural axis and identity without masonry; `space.zero_wall_style`
makes it dashed (transmits light) or solid (a zero-area barrier). Reads are
projection-only: a physical-geometry mutation builds a local candidate,
canonicalizes it, materialises the catalog (`src/wall-segment-model.ts` ↔
`wall_segment_model.py`, shared parity fixture), validates references and commits
one config transaction; ambiguity fails closed with no partial config, history or
revision. Model and lineage: [`WALL-THICKNESS.md`](WALL-THICKNESS.md) §1;
migrations and stale-client guard: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md)
(model v8–v10); rationale: [`adr/282-wall-geometry-representation.md`](adr/282-wall-geometry-representation.md).

The validated candidate is adopted in place only at the commit boundary (#826).
Root and id-bearing editor records retain identity; scalar arrays receive their
own shallow copy so shared point tuples cannot overwrite another owner during
recursive adoption. Values and property order match the candidate exactly;
the candidate is never mutated. This is not a full live-model clone or new
pointermove work, and array identity without an id is not a gesture guarantee.

Room-face acceptance uses `wall-face-lineage.ts` to choose provisional carriers
and settle only new-room hints against the partitions left after reconciliation
(#804). A residual keeps its identity without colliding with the promoted room
edge. The common model barrier, host validation and atomic history remain the
authorities; this helper neither allocates IDs nor writes configuration.

`wall-face-room-split.ts` is another lazy Plan-only pure proposal helper (#874):
it proves parent-minus-face as one hole-free component and deduplicates
complementary faces without changing the model. The runtime revalidates a
space/geometry stamp, retains each original wall/partition profile and commits
the split with carrier reconciliation in one existing history/config command.
Refusal/reload closes only the discarded room-face creation form. No View,
pointermove or HA-state rendering path imports or invokes this clipping helper.

Rooms may not partially overlap (lying on a shared wall is legal, a fully nested
island is supported). Merge/Split use **polyclip-ts** (not `polygon-clipping`,
see [`DEVELOPMENT.md`](DEVELOPMENT.md)): Merge accepts a pair only when the union
is one hole-free outline; Split cuts wall-to-wall and the larger part keeps the
room identity (name, area, devices).

`wallBodiesGeometry()` is the single physical masonry for flat full/static
rendering, 2.5D, paper, clean floor and Glow/sun occlusion. Its exterior shell
comes from the union of room centrelines plus surviving `outer` atoms; junctions
follow the bounded mitre/bevel rules (#249, #271, #272, #275, #288, #302, #309,
#310); independent bodies join through `physicalBodySet()` while raw quads keep
editor identity. The result is a typed component set (`ok`, `degraded-extra`,
`failed-core`; #197, #278): rendering keeps every valid component, mutation
preflight rejects `degraded-extra`, `failed-core` fails dark. It is computed state
only — cached per structural geometry, never written back, never rebuilt by HA
state ticks. Contract: [`WALL-THICKNESS.md`](WALL-THICKNESS.md) §2–§4, §9–§11.

Floor-geometry caches are keyed by their inputs, never by the global config
epoch, and their keys and pools come from one module, `src/floor-geometry-key.ts`.
The wall union, physical bodies, inner contours and clean floors key by the
content of one floor record (#744, #769); the union, the bodies and the opening
tunnels keep a bounded pool of recently shown floors (eight, LRU) next to the
active entry, so a warm floor switch builds none of them (#814). The opening
wall index and the sun wedges key by every input they read (#814); an edit of
another floor or a shared setting leaves them warm. Every pool is an
instance-local memo: nothing is persisted, and a remounted card starts empty.

## Markup editor

Card state: `_mode`, `_tool` (`select|draw|column|merge|split|resize|opening|
stairs|wallthick|delroom`), session `_path` on the `GRID_N = 240` lattice
(`_snap`, `CANVAS.md` §9). Committed geometry enters the named 50-command
Undo/Redo stack shared with Background (`DECOR-EDITOR.md` §6, §9); it survives
the echo of its own writes and clears on a newer external revision. A refused
step never clears it (#883, `geometry-history-step.ts`): `_applyGeometryState`
answers `true` or a reason and the cursor moves only on success. A fixed
`floor` elsewhere (owner decision), a not yet authoritative baseline or an
exception is temporary and keeps the command; a missing exact space, an
unrestorable snapshot or an explicit physical/wall-model verdict removes only
that command object from the direction it is in (identity, never name or
floor). One press is one attempt in all four call sites (Undo, Redo,
active-chain Redo, active-segment Undo); an unfit step ends an obsolete
transient Walls chain without a write. Snapshots are not rebuilt after a
removal; node commands keep #843's server path.
Own strict-write refusals (#891) use `PhysicalWriteHistory`: the pending
baseline owns exact command objects. Rollback restores only the physical
carrier, preserves independent presentation state, and rebases presentation
snapshots that contain refused walls so their Undo/Redo cannot resurrect them.
A retired baseline never owns a fresh transaction. The pending-write journal
distinguishes new provisional commands from cursor steps over accepted
commands. A retryable deferred refusal restores accepted identity/cursor using
bounded lane anchors, without displacing a newer top; an authoritative clear
cannot be reversed. Only a proved unsafe step is disposable with its own batch.
Only presentation commands created in that pending batch have their physical
carrier rebased; older accepted Background snapshots stay byte-for-byte intact.
If a send is accepted while newer physical work is queued, that newer batch is
promoted to the exact accepted geometry/reference baseline. Its later refusal
cannot roll back the earlier accepted send or retire its accepted commands.
The active Walls redo
journal survives the transient history reset; explicit finish still retires it.
`wall-node-refusal.ts` names a finite set of proved-invalid codes; unknown or
backend-processing errors retain node commands, and incompatible clients ask
for an update. The backend sends a sanitized retryable processing code before
any write; domain and invalid-request refusals keep their existing codes.
Every
physical-geometry writer crosses one fail-closed boundary (#278,
`checkSpacePhysicalGeometry()`) before history/save, rechecked at the deferred
write; presentation edits bypass it. Contracts: Walls chain, faces, room
deletion, partitions — `WALL-THICKNESS.md` §6, §9–11, `CONFIG-COMPATIBILITY.md`
(#478, #461), `TOUCH-SUPPORT.md`; Resize (#277, #300) — `RESIZE.md`; near-axis
(#290, `src/near-axis.ts`) and the editor-only wall-end alignment magnet of
Walls drawing and node movement (#885, `src/wall-end-align.ts`, in the
`editor-shared` chunk) — `CANVAS.md` §9.3. `reconcileCoincidentPartitions`
(#276/#296/#477) and `normalizeWallIntervals` (#299) run plan-wide only in
explicit Optimize, locally in chain finish/room deletion, never in render or
ordinary saves. Saves strip the legacy root `space.segments`.

### Stairs (#663)

Separate Plan entity, not decor (`STAIRS.md`). Eager `StairViewRuntime`:
symbols, tooltip, guarded navigation; lazy `StairEditorRuntime`: drawing,
transforms, magnets, properties (a plan never loads the editor graph). The root
card keeps lifecycle, shared history/persistence and stage pointer terminals;
pure model, tread/trapezoid geometry and style resolution stay in `stairs.ts`.

The optional `color`/`opacity` and `fill_color`/`fill_opacity` fields are a
snapshot owned by the stair. Missing legacy fields resolve at render/dialog
time from the current decor default but are not written until the user saves
that stair. Screen renderers consume the colour fields; PDF deliberately uses
the same geometry with its existing monochrome ink palette.

## Editor chrome and contextual controls

One stable `.editbar` per editor: `.editbar-tools` (persistent tools,
Undo/Redo) and pinned `.editbar-end` (Close); transient controls never enter
this measured row. Selection actions, tool parameters, hints, palettes and the
approved groups (Opening, Stairs) come from one `EditorSecondaryModel` in the
single light-DOM `.editor-secondary-host` inside `.stage`
(`editor-secondary.ts`): outside the `_hdrH` measurement, pointer events only
on its visible surface, empty in the Device editor (future marker quick
actions go there). Mutating actions revalidate a deterministic `contextId`;
`Delete`/`Backspace` never fall through from it. Product rule: `UX-MODES.md`.

## Doors, windows, gates & passages

`space.openings[]` is plan geometry, not markers: `{id, type:
door|window|gate|passage, x, y, angle, length, host?, contact?, lock?, invert?,
flip_h?, flip_v?}`. `host` `{kind: wall|partition, id, t}` is authoritative and
`x/y/angle` its atomically refreshed projection; an absent host is the legacy
room-wall association, and no host ever falls back to a nearest wall
(`CONFIG-COMPATIBILITY.md` › #132/#157). One `OpeningWallIndex` feeds symbol,
cut, tunnel fill, Glow and the 2.5D face (`WALL-THICKNESS.md` §3–4,
`ISOMETRIC.md`, `LIGHT.md`). The Flat symbol follows easy-floorplan (MIT).
`openingAmount()` maps contact state to 0..1 — no sensor: door/gate open,
window closed; `unknown`/`unavailable` keep that default. Contact and lock are
opening-owned exact references: candidates follow HA binding status, render
reads the frozen active-registry projection (never raw `hass`), neither
consults marker tombstones. The `.oplock` badge never toggles a lock
(`resolveToggleIntent` → no-op, `SCOPE.md`); openings are edited only in Plan.
In View the badge is a named, keyboard-focusable information button; pointer,
Enter and Space open the same existing card without service dispatch (#849).
Its focus outline does not change its Flat/2.5D hit geometry. Device-card rows
share the exact-entity/security resolver in `device-toggle.ts`, with a captured
`infoCardRowContextKey` over current binding, controls and row identities;
state-only HA frames may change direction but never redirect a confirmed row.
Dispatch also consumes a captured claim from the existing `ConfigWriteContext`:
foreign connection/user adoption retires a pending action even in the public HA
frame before Lit removes the outgoing DOM. No second authority owner is added.

## Integration WS API

Space deletion from the editor uses `editors/space-delete.ts`
after confirmation (#819/#826). The caller retains its confirmation copy;
the shared path re-resolves the dialog/space and confirmed marker set, flushes
pending writes, then adopts re-read config/layout rather than the delete reply.
This lazy module imports the editor host only as a type, never the editor runtime.
The card delegates to the editor; the space-settings form port supplies Delete.
Onboarding supplies only create/import controls, not a deletion port/adapter.
The TS pure mirror clears only incoming stair targets after an actual accepted
deletion, matching Python; blocked or absent targets cause no cleanup. The WS
endpoint rejects an absent target before calling its pure candidate.

`space/delete` filters explicit vacuum map routes to the deleted space inside
`_space_delete_candidate` (#822), before the existing paired commit. It keeps
other routes, root vacuum settings and the dock intact; an emptied list stays
`[]` to retain its precedence over legacy calibration. Refusals do not mutate
either Store, and there is no extra config write or schema/WS-key change.

`auth.may_write()` is the single writer policy for WS and HTTP: administrators
always write; `admin_only` (default `true` when unset) restricts writing to
them; with `admin_only: false` other users write unless they belong to
`system-read-only`. A missing entry or incomplete group data fails closed.
Reads are deliberately broader: every authenticated user receives the complete
config/layout (no per-entity projection), trails without `source` entity ids
(#626) and may toggle virtual lights. **W** = writer-only (else
`unauthorized`); runtime-backed commands answer `not_ready` before setup.

| `houseplan/…` | Parameters | Result · domain errors |
|---|---|---|
| `config/get` | `space_id?`, `fields?`, `marker_fields?` (#256; project only the document) | `{config, rev, virtual_lights:{rev,config_rev,off[]}, can_write, can_optimize_undo, undo_kind, integration_version, support_api, decor_assets_api, summary_panel_api, radar_stage1_api?}` |
| `config/set` **W** | `config`, `expected_rev` | `{ok, rev}` · `conflict`, `too_large` (2 MiB), `invalid_format`, `missing_plan`, semantic codes below |
| `layout/get` | `space_id?` | `{layout:{id:{x,y,s?}}, rev, can_optimize_undo, undo_kind}` |
| `layout/set` **W** | `layout`, `expected_rev` | `{ok, rev}` · `conflict` (external clients; the card writes points) |
| `layout/update` **W** | `device_id`, `pos` | `{ok, rev, ignored?: removed\|missing_virtual}` — a tombstoned owner's late drag is acknowledged, not stored |
| `layout/delete` **W** | `device_id` | `{ok, rev}` (`rev: null` when nothing was stored) |
| `space/delete` **W** | `space_id`, `expected_config_rev`, `expected_layout_rev`, `remove_markers?` (#819: the blocking markers go as with the device dialog's Delete, in the same pair write; ignored for the last space) | `{ok, config_rev, layout_rev, removed_layout, removed_markers}` · `space_in_use` (without `remove_markers`), `space_not_found`, `invalid_space_id` |
| `plan/optimize` **W** | `config`, `layout`, both expected revs | `{ok, config_rev, layout_rev, can_undo}` — also the server-side wall-model migration barrier |
| `plan/optimize_undo` **W** | both expected revs | restores the one-deep Optimize/full-import backup · `no_backup` after any later edit |
| `geometry/repair` **W** | `space_id`, `aspect`, `dry_run?`, `undo?`, `expected_rev?` | manual re-transform of one space's positions (HP-1500-01) with one-deep `repair_backup` · `nothing_to_repair`, `no_backup` |
| `export/create` **W** | `kind: full\|space`, `space_id?`, `plan_only?`, `card_version` | `{document, filename}` |
| `import/revalidate` **W** | `token`, `duplicate_policy?` | refreshed preview and current revisions |
| `import/apply` **W** | `token`, both expected revs, `duplicate_policy?`, `confirm_missing_content?` | paired commit; full import gets one-deep undo · `conflict`, `preview_expired`, `content_confirmation_required`, `missing_plan`, `missing_content` |
| `virtual_light/toggle` | `marker_id` | `{marker_id, on, rev}` · `not_toggleable` |
| `trail/get` / `trail/delete` **W** | — / `marker_id` | `{trails:{marker:{current,previous}}}` / `{ok, removed}` |
| `plans/list` **W** / `plans/delete` **W** | — / `name` | newest 60 `{name,url,size,modified,used_by}` + `total` / `{ok, removed}` · `in_use`, `invalid_name` |
| `plan/set` **W** | `space_id`, `ext`, `data` (base64) | `{ok, url}` — kept only for pre-#617 cards; current cards use HTTP |
| `files/migrate` **W** | `from_id`, `to_id` | `{ok, mapping, copied}` — copies, never moves or overwrites |
| `files/cleanup` **W** | `marker_id` | `{ok, removed, kept}` — removes only files the stored config does not reference |
| `assets/list` **W** / `assets/delete` **W** | — / `asset_id` | catalog with authoritative `used_by` / `{ok, removed}` · `in_use` |
| `assets/resolve` | `asset_ids[]` (≤200) | `{assets, missing}`; non-writers resolve only ids the saved config uses |
| `content/sign` | `paths[]` | `{urls}` — 24 h `authSig`, only `/api/houseplan/content/…`, first 200 paths |
| `support/*` **W**, `radar/*` | — | `SUPPORT-PRIVACY.md`, `RADAR.md` |

Semantic write codes: `invalid_config`, `invalid_passage_fields`,
`invalid_partition_opening_host`, `invalid_partition_opening_jamb_margin`,
`wall_model_client_outdated`, `wall_model_migration_blocked` (Optimize),
`junction_limit_<rule>`, `invalid_radar`, `invalid_light_entity`,
`invalid_vacuum_map_route`, `*marker_control*`, `invalid_value_badge*`; paired
writers add `commit_failed`. Events: `houseplan_config_updated`,
`houseplan_layout_updated` (`{rev}`), `houseplan_virtual_light_updated`,
`houseplan_trail_updated`.

HTTP views (`requires_auth`, same policy): `POST /api/houseplan/upload`
(marker attachment), `/plans/upload` (#617), `/assets/upload`
(`DECOR-EDITOR.md` §7), `/import/preview` and `GET
/api/houseplan/content/{kind}/{sub}/{name}` (`nosniff`; SVG only gets a
`sandbox` CSP, HP-1454-01). Only the manifest-gated bundle under
`/houseplan_files/` is public; legacy `/houseplan_files/plans|files` URLs are
still recognised in stored config but no longer served
(`CONFIG-COMPATIBILITY.md` › Legacy content URLs).

**Invariants**

- *Optimistic locking.* Each config/layout writer takes `write_lock`, resolves
  a pending pair, then checks revisions before validation, no-op detection or
  file collection. `expected_rev` may be omitted only at `rev = 0` (#340,
  #356). External writers read `rev` via `config/get`/`layout/get`, send it as
  `expected_rev`, and on `conflict` re-read and retry (#368). A canonical no-op
  keeps revision, events and the maintenance backup.
- *Paired writes* (Optimize, Optimize Undo, full import, space delete) use the
  durable `optimize_pending` intent and one-deep `optimize_backup`
  (`kind: optimize|import`) — `CONFIG-COMPATIBILITY.md` › #491. Events fire only
  after both halves are durable; Store exceptions are resolved by reloading
  and comparing exact payloads; layout-store writes go through
  `async_save_layout_state` so unknown metadata survives.
- *Validation is the server's.* Schema/semantic checks run in the executor
  under the lock; the browser never parses an import. Frontend preflight
  (`src/plan-geometry-preflight.ts`) only avoids doomed calls.
- *Files* (`SCOPE.md` › Standing rule): uploads claim a fresh name
  (`reserve_filename`, `O_EXCL`), plans are copy-on-write
  `<space>.<token>.<ext>` (a space id cannot contain `.`), and `check_quota`
  bounds bytes/files/free disk at upload. `config/set` collects, under its
  lock, only what its own commit replaced; a daily pass runs the collectors
  with the stored config on both sides and sweeps `.upload-` temporaries. A
  newly referenced internal plan must exist (`missing_plan`; import also checks
  attachments). A usable `Content-Length` is checked before streaming, the
  staged size again under `upload_lock`, which also serialises image decoding.
  Collection classifies by **owner**, not by "is it referenced" (HP-1465-01);
  nothing is deleted for being old except `up_*` staging after
  `PLAN_ORPHAN_TTL_S` (1 h), and `plans/list`/`plans/delete` make "we never
  delete" livable:

  | Case | Rule |
  |---|---|
  | Space in both, plan A → plan B (the user picked another image) | removed immediately |
  | Space in both, plan → none (detached; one click undoes it) | **kept** |
  | Space gone (the image was imported and may be nowhere else) | **kept** |
  | Space has a plan plus another file of its own (a rejected save) | **kept** — ageing these out raced the retry |
  | Marker in both, attachment dropped from its list | removed immediately |
  | Marker gone | **kept** |
  | Attachment in `up_*` (a dialog never saved) | removed after `PLAN_ORPHAN_TTL_S` |
  | Marker there, file it never listed (a rejected upload) | **kept** |
- *Import preview* streams ≤8 MiB, rejects duplicate/prototype keys,
  non-finite numbers and future model versions, and keeps the candidate in
  memory for 10 min behind a token bound to the user, candidate digest and
  both revisions (global and per-user caps). *Export* deep-copies one coherent
  pair under the lock and builds outside it.
- *Virtual-light state* lives in its own Store (`CONFIG-COMPATIBILITY.md`);
  toggles reply immediately and coalesce into one delayed durable write,
  flushed before config transitions and unload. A cached snapshot never
  authorizes an optimistic toggle.

**Client side**

- `_writeConfig()` keeps one `config/set` in flight, each carrying the previous
  reply's revision (HP-1454-03). A rejected physical transaction restores the
  earliest server-backed snapshot of every affected space and reloads (#314).
- `src/config-adoption.ts` (#500) owns config/layout body + revision +
  fingerprint. It changes only by authoritative adoption
  (`adoptAuthoritativeGated`, profiles `reload`/`post-write`), own-write
  acceptance (`acceptConfigWrite`, `acceptPairWrite`) or warm-cache restore;
  paired writers take revisions from the re-read. Local staging is limited to
  files pinned by `test/config-adoption-ownership.test.mjs`. Ordinary debounced
  editor saves remain optimistic: a rejection that is neither a revision
  conflict (which reloads) nor a physical-geometry rollback keeps the local edit
  with a failure toast until the next authoritative reload. Writers that must
  undo on rejection capture an `OptimisticAttempt`
  (`beginOptimistic`/`rollbackOptimistic`), which restores the server-backed
  body only while that failed candidate is still current (#442, #500).
- Write preparation never deletes plan objects silently
  (`src/geometry-cleanup.ts`, #842). Every editor write first finds R — the
  `partitions`/`wall_columns` the legacy write filter would drop (bad or
  repeated id, point off the canvas, degenerate partition) and the openings a
  dropped partition hosts — on the config exactly as the operation hands it
  over, so an operation's own deletion (Delete, Optimize) is never R. A
  non-empty R refuses the write before `config/set` with the live config
  untouched (an immediate writer rolls its attempt back as usual) and, instead
  of an error toast, asks one destructive confirmation: «Delete and save»
  removes exactly R and writes the current plan once; «Cancel» sends nothing
  and the next write asks again; teardown refuses without asking. Only a
  decided write runs the normalisation that deletes nothing (columns keep
  unknown fields; the `walls` degradation stays the canonical cleanup).
- An immediate writer that cancels a pending deferred write
  (`_saveConfigDebounced`) carries its content; if the write is rejected and
  its own rollback succeeds, `supersedeDeferredWrite` re-arms that deferred
  write once — never after a conflict reload or a newer adoption. The
  re-armed write sends the live config of its moment and teardown flushes it
  like any other (#842).
- `src/config-reload-authority.ts` (#543): each reload holds a generation-scoped
  claim; a superseded one ends with no side effect.
- `src/layout-write-reload.ts` (#902) fences complete reloads against own
  point-writes, including a write settled after the read started or inside the
  backdrop await. One normal pair gets at most one post-settlement retry;
  another actual overlap re-arms once after that attempt finishes. This is
  event-driven, not polling. Accepted cache never receives an unacknowledged
  overlay; the fresh server revision/body decide external replacement and
  history invalidation. Active-write tokens and waiters retire with HA identity
  or detach. Released drag/history terminals share that generation so an old
  success/error/finally cannot roll back a new owner or release its busy flag.
- `src/card-read-lifecycle.ts` (#824) owns ephemeral full-read transport claims
  for both cards, independent of visual HA deduplication. Disconnect/context
  replacement/navigation fence every awaited adoption and optional tail.
  Context is observed per HA assignment before Lit coalesces A→B→A; transport
  restart waits for the current usable authority, including a temporary HA gap.
  Static attach revalidates the server; a full long return without HA defers.
  The shared continuity controller owns one bounded paint attempt. A timeout
  retains matching staged data without marking a complete frame or self-retry;
  external readiness/update can recover. Canonical: `WARM-REMOUNT.md` §5.1.
- `ContentSigner` (`src/signing.ts`) is the only signer for both cards:
  `MAX_SIGN_PATHS` (200) is shared with `const.py`; the cache is age-aware and
  pruned to live URLs; queued/in-flight are distinct, failures back off and
  in-flight entries expire after `SIGN_INFLIGHT_MS`.
- Room climate is one `roomClimateMap()` pass per hass snapshot (#317) shared
  by full and static cards; exact `entity:` placement beats its parent
  `device:` (no double vote); never call the `areaClimate()` wrapper in render.
- Load, continuity and fixed-floor rules: `WARM-REMOUNT.md` § 5.
- `warm-mode-adoption.ts` completes immediate and delayed editor adoption with
  the original View return snapshot and a request-owned refit hold. Explicit
  mode/space navigation invalidates pending work before lazy-runtime awaits;
  warm header/stage dimensions are published only after the corresponding
  render, including the card-local header offset for pending chrome (#762).
  Adoption completion lives in the lazy editor graph: it only executes after
  that runtime is ready; View retains just cancellation and camera comparison.
  The room draft payload is also built by the installed editor runtime.
  This moves existing room-state reads across the already-defined editor port;
  it adds no room state. #762 records the resulting host-reference/ported-private
  counts in the monolith baseline, without widening its tolerance bands.

## Second card: houseplan-space-card (read-only)

One bundle registers `houseplan-card` (interactive) and the read-only
`houseplan-space-card` (one space; `src/houseplan-card.ts` imports
`./space-card`). User options, `fit` and the deep link: `USER-GUIDE.md` §18,
`CANVAS.md` §4.4, `LIGHT.md` › Which surfaces render pools. Shared modules keep
the two views from diverging: `space-geometry.ts` (pure model/position math),
`space-render.ts` (`renderSpaceStatic()`: plan, rooms and markers through
`buildDevices`, `ResolvedDevicePresentation` and `renderDeviceFace`, no marker
handlers), `glow-scene.ts` (opt-in `light_pools`, per-card bounded caches) and
`config-store.ts` — one module-level `{config, rev, configFingerprint, layout,
layoutRev, layoutFingerprint}` cache and one subscription for all embedded
cards, seeded from `houseplan_card_cfg_v1` and refreshed on
`houseplan_config_updated`/`houseplan_layout_updated` without first clearing
the visible snapshot. `.hp-static-stage` and every descendant
(`*, *::before, *::after`) are `pointer-events:none`, overriding the markers'
44 px opt-in (#564, #664); only the footer button is interactive, asserted by
`demo/smoke_space_card.mjs` with `elementFromPoint`. A card with `floor`
ignores `#space=`.

## Subsystems with their own canonical documents

- **Decor, plan image, furniture, custom images** — `space.decor[]` is a purely
  visual layer with one selection/transform/history pipeline; image bytes live
  only in the asset store: [DECOR-EDITOR](DECOR-EDITOR.md), [FURNITURE](FURNITURE.md).
- **Light and Glow** — one visibility region per source (#71); Glow is an overlay
  independent of the data fill (#55): [LIGHT](LIGHT.md). Shared source entry
  scheduling is owner-local; `LightBarrierPass` shares revisions only inside
  the main card's synchronous render, never across subsequent edits (#789).
  **Room fill** —
  `resolveEffectiveRoomFill()` is the single projection for room floors,
  clean-floor holes and opening tunnels; `room_color` styles only borders and
  names; custom colour and legacy tokens (#56, #581):
  [CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md).
- **Device state, light membership, action** — `resolvedDeviceStateEntities`,
  `resolvedLightSources` and `src/device-toggle.ts` are the only resolvers
  (#94, #251, #318, #381): [DEVICE-PRESENTATION](DEVICE-PRESENTATION.md).
- **Zero-thickness walls, nested rooms** — `resolveZeroWalls()` feeds every
  renderer, Glow and sun (#306): [WALL-THICKNESS](WALL-THICKNESS.md). **Kiosk,
  navigation** — kiosk is a card flag, not a mode; `LS_NAV` stores only the space
  (#93, #210): [UX-MODES](UX-MODES.md).

## Camera and mode transitions (#101, #82)

`KioskCarousel` (#846) owns one interval and one 60s idle deadline with injected
clocks. `cardInteractionIdleSnapshot` is shared with version recovery and reads
only transient state, not layout or geometry. Host capture observes passive
pointerdown/wheel/keydown on plan and local dialogs; pointermove never restarts
the deadline. Open surfaces and camera/gesture work hold both tick and fit.
Dialog close restarts 60s; expired pointer holds resume from a state update, not
a 0ms polling loop. Disconnect/config-disable retire both timers and their
generation. Arrival bypasses saved enlarged zoom before first paint and stores
the same floor-local base preference as Fit all; ordinary navigation still
restores its own preference. `_commitSpace` closes only space-bound View
surfaces on a different accepted id. `view-action-context.ts` resolves exact
current marker/floor and canonical opening/lock identities before service calls;
stale confirmation never becomes permission to act on another floor.

The existing `STAGE_TAP_DISTANCE_PX` pan/swipe classifier cancels the owning
`KioskHoldGesture` as soon as navigation is recognized (#825). Returning to
the press origin cannot re-arm it; sub-threshold jitter is still a hold.
There is no additional threshold or timer.

Two one-token/one-RAF controllers own every animated camera change and leave
no CSS timers or WAAPI animations behind. `ModeTransitionController`
(`src/mode-transition.ts`) is the only timeline for entering, leaving and
switching editors: it interpolates measured chrome height, stage geometry,
world-space camera centre, logarithmic pixels-per-unit, stage/paper colours,
day/night brightness and presentation weights together, deriving each `viewBox`
from the current stage aspect; the stage is inert meanwhile, header tabs stay
live for a retarget. `src/viewport-transition.ts` animates discrete zoom in a
settled mode with the same easing but only `{zoom, viewBox}` (no chrome,
background, layer opacity or CSS transform) and lives in the core View bundle.
The component stays the sole camera writer; ownership boundaries and timings:
[CANVAS](CANVAS.md) › View/editor camera handoff and §5.

LED zoom quality (#789) is a separate owner-local scale-activity deadline,
not another camera writer or a source transition. Actual changes to viewport
width/height set a host attribute before live paint; 160 ms of inactivity clears
it. CSS changes only the existing LED mask bands (48 retained, 24 painted),
without a geometry rebuild or a second SVG. Camera/lifecycle cancellation
clears the deadline; static cards do not participate. Ordinary Glow's pan/fade
blur policy remains independent.

## Settings tiers (owner's principle, 2026-07-26)

Four levels: **global (`config.settings`) → space (`space.settings`) → room
(`room.settings`) → device (`marker.*`)**. Duplicated options are deliberate:
the more specific tier wins and "unset" always means "inherit". Resolution
lives in pure helpers (`spaceDisplayOf`, `roomFillModeOf`, `roomGlowOf`,
`roomTempRangeOf`, `sourceValue`, `resolveToggleIntent`), never inline in render;
each tier keeps its own dialog (General settings, space, room, marker).

## Schema as the source of truth (#33)

The Voluptuous schema in `custom_components/houseplan/validation.py` is the
single owner of the persisted config/layout shape. The generated manifest
`scripts/config-schema.json`, the enum parity test with its self-checking
allow-list, the decision registry `scripts/config-field-registry.mjs` and the
lifecycle fixtures keep every other world honest against it:
[CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md) › Schema manifest and parity.

## No hidden discovery knobs (#44)

Every stored key that shapes device discovery is a visible, supported setting
or does not exist. `settings.group_lights` and `settings.exclude_integrations`
live in the device catalog's Discovery-filters section and are resolved only by
`effectiveExcludedIntegrations()`: [FILTERING](FILTERING.md) › Seeding.

## Contextual Zigbee topology (#54, #457, #464)

#867 separates physical diagnostics (`device-signal.ts`) from functional/action
rosters. Registry-identity ownership indexing is reused across state ticks; own
sibling reads are tracked by the presentation reuse window and included in the
frozen render snapshot even with battery indicators off. `areaLqi` and the card's
room projection share one physical-radio-per-room aggregation. The optional
`hide_signal` flag affects only the system plan line, not sources or controls.
Embedded floor captures pass that same full-registry-owned context to both
presentations and snapshot projection; a newly allocated active projection is
not the ownership key of the diagnostic index.
Topology mapping records all eligible hover aliases while preserving one device
or configuration-ordered entity representative. Cross-floor representatives use
existing named remote bubbles, without routing through the hovered alias. An
actual overlay resize re-renders only that overlay's viewBox/centres before its
DOM-only caption/clip fitting; camera-only fitting does not re-render the card or
start provider work.

The initial View graph holds only the fail-closed settings reader and a dynamic
overlay bridge; the overlay chunk loads only for a saved
`settings.zigbee_topology.enabled === true`, a real HA admin, full-card View and
a non-kiosk surface. General Settings loads provider transport only when an
enabled setting needs status or the admin presses a provider action.
`zigbee-topology.ts` normalises ZHA and Zigbee2MQTT into directional observations
and provider evidence (#798): Parent/reverse Child for end devices, active
destination-zero routes for routers. NWK addresses are provider-scoped; exact
registry ownership maps nodes to markers. Only unique evidence becomes an
arrow. Conflicts, cycles and unknown roles fail closed, including merged
providers; no BFS or strongest-LQI fallback remains. A known next hop need not
prove the complete chain. Mapping/resolution are memoized outside hover.
The overlay's one-entry mapping memo (#906) compares registry material, not the
fresh `haRegistrySnapshot` wrapper: device/entity record identities, revision,
authority/access and freshness/error scalars, plus immutable marker/topology
collections, provider revision, connection and admin identity. Scalar metadata
is captured by value; revision0 limited registries still invalidate on changed
records. Post-render `updated` does not discard a result merely because the
wrapper changed; detach and provider/owner retirement clear the entry. No
deep hash, global cache, TTL or provider request is added to render.
`zigbee-topology-runtime.ts` keeps a per-connection, admin-identity-scoped cache:
ZHA still reads `zha/devices` without a scan. Z2M uses the integration-owned
`zigbee_topology.py` coordinator through admin-only
`houseplan/zigbee/{subscribe,start,cancel}` WebSocket commands (#800). The
coordinator reserves one job per normalized topic before starting background
work, checks retained bridge-info and sends one correlated raw `routes:true`
MQTT request. Closing all frontend clients releases their observers, not the job.
An initial reset and per-topic state events restore running jobs and last-good
maps; session/revision and job identifiers isolate stale replies and cancels.
Map payloads are limited to 2 MiB; at most eight topic slots are held. Only empty
terminal slots may be reclaimed; successful maps are never capacity-evicted.
MQTT is an optional dependency.

There is no overall scan deadline. Transport setup/publishing have 10-second
limits and retained bridge-info a 4-second limit. At 600 seconds an exact-job
cancel becomes available; it cancels HP's wait, not Z2M radio work. Matching
provider errors, invalid maps and MQTT disconnect terminate the job and release
listeners. #912 durably removes the old topic map before an accepted replacement
request, so errors/cancel cannot roll it back. Successful raw maps/original times
alone enter a dedicated entry-owned atomic HA Store; reload restores them stale
without MQTT. Jobs/session/elapsed timers stay volatile. A serialized cache lock
orders success writes, explicit refresh clear and all saved-config OFF writers;
late callbacks/writes cannot resurrect retired maps. OFF clear failure refuses
the config save, and new-result persistence failure is visible, not silently
reported as durable. Topic removal only hides routes. Neither reconnect nor
reopening settings republishes. Integration unload flushes accepted result writes
and clears runtime jobs, preserving only successful durable maps.
Before unload, a `closed` session event invalidates observers even when their HA
WebSocket stays connected; the next explicit scan reattaches to the new coordinator.
The frontend derives elapsed time from server elapsed plus local monotonic time,
without per-second map events or invented progress percentages. Mounted visible
settings alone tick their timer; ordinary hass updates do not resubscribe.
ZHA cache retrieval is never described as a fresh radio scan.
The pointer-transparent overlay is a child of the `.devlayer` camera, projected
once with the markers by `live-viewport.ts`; only the source and drawable
neighbour markers are promoted above it, through transient attributes the
overlay owns and clears. All routes are solid; `zigbee-topology-style.ts` owns
the independent RGB 0/red–128/yellow–255/green palette. Unknown-LQI links have
a black casing under a 2 px grey core and an outer arrow outline. The outline
is 1 px at zoom=1 and scales with the plan, including temporary camera CSS
projection, per the owner's #798 clarification. Local and remote/unplaced routes share one renderer.
Unknown/partial/stale captions never trigger network work; one expiry timer
updates age without requiring another HA event. The resolver's transient
`showIncomplete` distinguishes an unknown per-device uplink from global snapshot
`partial`: known uplinks and every matched coordinator suppress only that caption,
even if cross-provider reconciliation makes a coordinator's route unknown (#816).
Persistence and privacy:
[CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md).

Zigbee caption layout (#802) notifies the lazy live-hover runtime after the
overlay's DOM update and coalesced active-hover resize/scroll/camera changes.
Only the matching pointer device tooltip avoids actual text-caption rectangles
and its source marker, in screen coordinates inside stage∩viewport. A pure
candidate search finds the closest feasible full rectangle or hides the tooltip
until space returns. It does not move markers, start scans or render the card.
Keyboard tooltips retain their own path. Pointer departure/disconnect disposes
the active layout observer/frame; remote caption wrapping updates its short
arrow endpoint in the same post-render pass.

## Live viewport: a transform per frame, a `viewBox` on a budget (#531, #579)

Rewriting the SVG `viewBox` re-rasterises the whole scene, so per-frame writes
made panning crawl. `paintLiveViewport` keeps an anchor (the `viewBox` in the DOM
and when it was written) and moves scene nodes each frame with the HTML layers'
projective transform (`liveLayerProjection`, `transform-origin: 0 0`);
`needsViewBoxRefresh` rewrites the anchor only after `LIVE_VIEWBOX_REFRESH_MS`
(100 ms) or a `LIVE_VIEWBOX_REFRESH_SHIFT` (15 %) shift/scale change — module
constants, not settings. Scene nodes project from the anchor, HTML layers from
the last settled Lit frame; both land on the current view, keeping #451's
one-CSS-pixel marker contract on every frame. `.stage` stays the outer clip, but
a transformed scene SVG gets inline `overflow: visible` so rasterised content
covers the incoming edge, even with the pointer held still (#544); HTML layers
never do. The exposure is bounded by an inline `clip-path: inset(-25%)`
(`LIVE_SCENE_EXPOSURE_CLIP`) set and removed with it — beyond the 15 % refresh
threshold, but never the whole plan: unbounded, a promoted scene grew with
zoom² and at 800 % × DPR 2 exhausted GPU memory (white frames, #689). A scene
marked `data-hp-live-overflow="clip"` — the filtered day-cycle outline — is
projected but never exposed. From the first live paint to the terminal commit a scene SVG stays in
one compositor lifecycle: a refresh or Lit frame may replace its anchor but never
demote/re-promote it — HA Companion WebView shows that as a blank frame (#579).
The day-cycle paper outline joins these roots before the first camera move; the
static card uses its stage-sized form from the first frame (#582, Key decision 7).
Unchanged values are never rewritten, so idle frames stay byte-identical;
`commitHouseplanViewport` removes the transforms and forces the final `viewBox`.

The vacuum SVG is a passive exception inside a live HTML layer (#871):
`data-hp-live-inherited-scene="camera"` rebases only its bounded paint window
via `inheritedSceneClip`, around the same anchor and with the same exposure.
Its `viewBox` and camera transform are not written by this pass. Giving it
`data-hp-live-viewbox="camera"` as well would double-project the trail. This
layout preserves the device/hover/lock/Zigbee stacking context unchanged.

## English and Russian ship whole (#400)

`en` and `ru` are synchronous dictionaries in the initial chunk; `de` and `fr`
load lazily (`src/i18n/registry.ts`), editor-only strings included. At the
decision the 38 settings-help entries of #86 cost 2 654 B gzip (0.9 % of the
initial-View budget); splitting would need a second dictionary half, a runtime
merge, an extra request and a second source for the `en.json` key type (#391).
Budget planning assumes whole dictionaries; revisit only if editor text grows by
tens of kilobytes.

## Backend quality gates (#42)

`tests_backend/requirements.txt` is the single source of backend CI dependencies;
ruff, strict mypy, the `sys.modules` guard, the coverage baseline and the
`geometry_parity` job: [TESTING](TESTING.md) › Backend quality gates.
`const.ERROR_CODES` / `ERROR_CODE_FAMILIES` are THE stable error contract: every
emitted code is registered and localized (scanner test); `invalid_passage_fields`
and `invalid_partition_opening_jamb_margin` carry structured JSON details; the
frontend renders unknown codes localized, code first, raw messages to the console.

## Summary panel boundary (#437)

`settings.summary_panel` is the only shared persistence of this read-only overlay;
`prepare_ordinary_summary_candidate()` is the common backend boundary of
`config/set` and `plan/optimize` (full import bypasses it), and
`config/get.summary_panel_api`, never cached config, grants editing. Persistence
and local keys: [CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md) › Summary panel namespace.
`summary-panel.ts` owns defaults, stable ids, fit predicates and local-key
encoding; `summary-panel-picker.ts` a non-DOM `entity_id + friendly_name` index
reused across state changes; `summary-panel-runtime-loaded.ts` the lazy View
controller — a screen-space, non-SVG sibling of the camera layer outside content
bounds, with one minute-aligned timer and a lifecycle generation binding dialog,
draft, picker and async work to one route/user/permission/kiosk identity.
`summary-runtime-loader.ts` shares code, never state, and provides synchronous
warm `create()` before the first render ([#506](specs/506-startup-performance.md)).
Only `ViewRuntimeBoundary` owns per-host installation/retirement; the unused
legacy attachment/slot API is removed (#909). Factory/pending caches,
fingerprint validation and retry URLs stay on their existing paths.
`summary-panel-editor.ts` loads on the settings button; its revision-checked
shared write precedes the local show choice. #505 styles and the 190 ms phases
stay lazy and never move the camera; editors and the space card never load the
panel. Device totals need an authoritative registry snapshot and dedupe parent
device ids before visual filters; clean area unions canonical room floors per
space with that space's `cell_cm`.

## Private support boundary (#43)

Help & feedback is rendered by the lazy editor runtime even in View; form state
is component memory only. Report controls appear only when
`config/get.support_api` equals `SUPPORT_API_VERSION` (1); release versions are
diagnostic. `houseplan/support/preview` (`may_write`, bounded capability enums,
dialog-scoped id) loads one coherent config/layout pair under the shared write
lock and passes disposable validated copies to `support_package.py`, a strict
projection boundary: a new allowlisted object with package-local pseudonyms and
canonical sorted JSON, never raw storage redacted afterwards. Bytes, SHA-256 and
expiry stay in `HouseplanData` memory, bound to user and draft for ten minutes;
preview, download and submit use those bytes; `preview/discard` (idempotent) or a
confirmed submit consumes the token. `houseplan/support/submit` re-validates text,
resolves only an owned live token and calls `support_transport.py`: one
compile-time HTTPS URL, no redirects, bounded timeouts and response size, stable
local failure codes that never reflect the response. The relay
(`scripts/support-relay/`) deploys separately and is excluded from the HACS
artifact. Content and retention: [SUPPORT-PRIVACY](SUPPORT-PRIVACY.md).

## Mutation tooling boundaries (#558)

`scripts/mutation-gate.mjs` stays the stable CLI but is only an orchestrator and
compatibility export surface over `mutation-registry.mjs` (declarations),
`mutation-selection.mjs` (diff/guard-input selection), `mutation-evidence.mjs`
(witness fingerprints, caught ledger) and `mutation-execution.mjs` (worktree
runs); dependencies never point back to the CLI. Guard-input caching is
invocation-scoped (one resolver, one tracked-file snapshot); persisted success
exists only in the explicit caught-witness ledger. Usage: [TESTING](TESTING.md).

Static readiness (#854) is shared by the normal unit gate and CLI; preparation
policy is a leaf module shared with the nightly runner. Changed input identities
are read-only helpers; static success never writes caught proof. Development CI
keeps only a retired compatibility interface, while nightly explicitly opts in
to applying mutations. Two witnesses of removed development setup code retired
with that code; the nightly environment and outcome contracts are unchanged.

Nightly capacity (#899) uses twenty deterministic modulo partitions of the
unchanged registry, with the same hour-long interruption boundary. Evidence
still binds every shard to one immutable material/workflow/run attempt and
requires successful terminal outcomes before reuse. Ordinary witness repairs
and static declaration checks do not produce caught ledger entries.

Node-drag browser guards declare compilation of their `test-build/` model
fixtures before the browser oracle (#830). The existing runner still separates
setup from assertion evidence; a missing compiled module is never a caught
mutant. The cheap registry test checks all `.mjs` entry files for this readiness,
including browser smokes, rather than assuming that every smoke needs only a
bundle. Product code and nightly-only mutation execution policy are unchanged.

## LED strips: lazy boundaries (#780)

The #863 smoke helper coordinates HA delivery and contemporaneous quality
observations in the browser after a native wheel. It changes no product timer
or renderer. The paired daycycle report is a separate test-only oracle over raw
RasterTask/phase/readiness/environment evidence; no sample is silently removed.

`space.led_strips` belongs to the space; the link is one-way strip → marker
and the device model stays the only owner of state and services. Four modules:

| Module | Graph | Holds |
|---|---|---|
| `led-strip-gate.ts` | initial | which markers a space shows as a strip, the anchor, the page-wide loaders of both chunks |
| `led-strip-card.ts` | initial | delegation only: the Devices toolbar button, the device-dialog section, notes, the LED branch of the device history |
| `led-strip-runtime.ts` (+ `led-strip-geometry.ts`) | lazy `led` | frame, stripe, hit/focus, 2.5D, static card |
| `led-strip-field.ts` | lazy `led-field` | the linear field, loaded by the runtime only for an on strip in a Glow room |
| `led-strip-editor.ts` (+ `i18n/led`) | lazy `led-editor` | the Devices tool, tray, picker, representation switch, LED history commands |

A View without a displayed active strip, and the Devices editor without the
tool or an editable strip, load none of them. «Displayed» is decided before
`import()` (`ledVisible`): an active strip bound to a live device of the
space that is neither hidden nor HA-disabled — the stored marker is checked as
well as the built device list (r1 M4). Each chunk checks the entry
build fingerprint; a failed load is fail-dark for the strips only and retried
on the next explicit entry. Budgets: `LAZY_LED_GZIP_CEILING` and
`LAZY_LED_EDITOR_GZIP_CEILING` in `scripts/bundle-budget.mjs`.

## Outside-findings routing (#926)

Trusted Actions configuration selects only explicit issue IDs; prepare freezes a typed
identity/mode/deterministic path, bound to its output and artifact passport.
The actual Review prompt embeds prepare's server-side snapshot; an external
JSON copy is refreshed immediately before Review and is not the authority.
Integration independently
checks the trusted snapshot, exact companion set/hash/text, and publishes only
the derived reviews/findings path beside the report. Legacy in-flight results
can use only their old no-companion protocol. No arbitrary instructions, new
model capabilities, severity waivers or merge authority are introduced.
Publication normalizes line endings before sealing/writing and binds the exact
Git blob in the report before its machine anchors. SPEC delivery accounting
allows only that added same-issue/stage/round companion, expected header, blob,
size and publisher proof; it remains spec-only trace, not implementation or
release/close membership. The existing SPEC/index and foreign-path checks stay.

## Explicit local amend (#923)

`commit-amend.mjs` owns the narrow npm invocation, pins HEAD/parent/index and
launches Git with fixed `commit --amend --no-edit` arguments. The existing
provenance validator consumes its one-use local context only in staged-message
mode and selects the parent/empty-tree diff. It keeps the same message,
changelog, bundle and golden checks. Native Git's ambiguous hook metadata is
not guessed; ordinary staged commits and historical ranges remain separate.
This is a local workflow contract, not a new CI or author-identity authority.

## Review handoff provenance (#904)

`review-handoff.mjs` owns a bounded syntactic parser and edited-comment selector
shared by collection and format validation. API order and author identity are
not authority; updated timestamp and numeric id select one candidate, including
an incomplete one. The preflight v2 material identity adds that comment's
id/URL/timestamps and exact-text digest. Its canonical snapshot is carried by
the existing sealed prepare artifact and rechecked against fresh API reads at
the model boundary. Scalar material guards, verdict schema, permissions and
merge authority keep their existing owners.

The separate format check (#922) identifies an acceptance row by its first AC
token, so later cross-references cannot replace that row's number. It retains
the existing section, contiguous-number, evidence and track-limit checks; it
does not interpret or approve the meaning of an acceptance criterion.

## Read-only release transport (#921)

`release-gate.mjs` wraps its workflow, candidate-tree and proof-context GETs in
`read-only-fetch.mjs`. That boundary refuses request bodies and non-GET methods;
only EPIPE, ECONNRESET and UND_ERR_SOCKET transport failures get two bounded
retries. It returns HTTP responses unchanged, preserves the final transport
error, and does not interpret candidate evidence. Publication writes and other
consumers of `ci-proof.mjs` are not wrapped or retried by this policy.
