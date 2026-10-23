# Development and deployment

## Service-check branch isolation (#1040)

The main branch's service ingress acknowledges delivery, not the result of dev
work. `node scripts/service-workflows.mjs --write` regenerates its eight mirrored
files; the no-argument command checks byte consistency. A receiver validates the
exact origin run/attempt and receipt before a single `service-delivery/*` claim.
Do not delete failed runs or claim refs to obtain a green badge. A real delivery
failure stays red; an ambiguous POST is not blindly retried. Review recovery uses
the normal fresh S4/S7 request and existing pending/reconcile guards.

Deployment: accept B/C material through the ordinary review/merge pipeline, then
deliver only that reviewed infrastructure patch onto the current stable main.
Keep product/version files identical to the previous main, regenerate profile
filters for that tree if needed, confirm mirrored ingress parity, and wait for
main's exact-SHA CI/status rollup. No release or tag is created. Old native callers
stay compatible during this transition. For a read-only live probe use a direct
dev `process-metrics.yml` dispatch; never rerun an accepted model review for colour.

## Room appearance (#1037)

Shared compatibility corpus: `test/fixtures/room-appearance.json`, consumed by
`test/room-appearance.test.mjs` and `tests_backend/test_room_appearance.py`.
Run those plus the ordinary validation/support/import-export suites after any
colour-model change. `demo/smoke_room_appearance.mjs` exercises actual colour
pickers, local/inherited captions, zero alpha, Save/Cancel and Flat/2.5D paint;
`demo/smoke_e2e_hooks.mjs` checks the stable semantic hosts. Build and
`node scripts/bundle-sync.mjs` before smokes. Update the generated schema with
`python scripts/dump-config-schema.py`; closed support schema and its relay copy
must remain byte-identical. Full HA harness proof requires pinned Linux CI.

## Declared E2E hooks (#1011)

`docs/data-hp-contract.json` and `STYLING-HOOKS.md` define the DOM contract.
New test hooks use `since: 1.83.0`; the JSON stays outside the runtime graph.
Fields inherit semantic ids/names/capability keys. Scope a field to its owning
dialog/component and reveal its settings section before interacting. HA
component internals remain private.

`scripts/data-hp-source.mjs` parses Lit markup and DOM writers with TypeScript,
including comparisons and nested templates. Contract tests check both directions
of `data-hp`/`data-tool`, read the existing closed menus for three dynamic tool
writers and reject unknown dynamic writers. Source form coverage checks actual
controls (including buttons) and identity arguments at shared primitive calls;
`demo/smoke_e2e_hooks.mjs` proves mounted bindings, Cancel/Discard,
camera updates, contact ownership, vacuum calibration, colour/manual controls,
Properties, PDF, summary, toast routing and phone navigation. Image/support
payloads are synthetic; feedback is never submitted. Manual state uses one
ordinary paste event; the facade's same-turn key burst is not a typing oracle.
`demo/smoke_e2e_primitive_fields.mjs` exercises id-less radar/Properties
callers and the north dial without creating new DOM ids or saving drafts.
Mutation witnesses are only checked statically during development.
`toast-identity-source.mjs` checks translated senders, helper/conditional keys
and forwarding ports across all sources. Single-key junction/Resize label
wrappers derive keys from their source and caller arguments; composed/external text keeps message.
Wrapper discovery is a module-wide structural AST inventory without file/class/name
anchors; tests prove method extraction, module moves and renaming (#624).
The inbox smoke observes successful and refused deletion toast ids; history
checks actual Undo/Redo ids through its ports. Unit tests invoke the deletion
helper and reject ordinary unkeyed/incorrect-key/forwarding-loss inputs.
The initial joint lazy-editor measurement329291 B gzip (+2746 B against326545)
set its ceiling under the owner's small-size-overage permission; final329906 B
stays within its existing2000 B band. Raw reference3335415 B follows the final
measurement (from3312342 B,+0.70%, including known toast ids and forwarding);
final3335895 B stays within the preserved2000 B band. Other limits remain intact.
These bytes are declared attributes/identities.

External journeys install a product ref, then sync and lint its exact contract
(TESTING.md). The current external kind linter enumerates a subset of hooks;
#1010 must collect kind enums from all hooks before using the new trail/upload
selectors. Existing selectors and the schema-1 reader shape stay compatible.
The facade stays outside release bundles. Golden should remain unchanged;
this task does not authorize accepting different pixels.


## Shared HSV presentation (#1008)

`demo/smoke_color_picker_presentation.mjs` samples actual pinned-Chromium
screenshots, independently checking centred white 20px rims, resulting-colour
centres, 10px tracks and H/S/V RGB interpolation. It drives real mouse/keyboard
hover, focus, drag, HEX and SV input in light/dark/custom themes, black/white/gray
and endpoints; checks reduced-motion paint, forced-colors focus, native alpha,
all five settings/decor consumers and the absent-Popover portal at 320px.
Input checks also read placement inline properties immediately after Lit updates,
before RAF can hide an accidental popup-position reset.
Forced-colors checks keep the pointer on the keyboard-focused range so the
hover cascade cannot silently suppress its high-contrast outline.
Synthetic frames/report: artifacts/color-picker-presentation/. The unchanged
dev red witness preceded product edits; private UI-016 files remain local.
Existing picker/consumer/activity and selected settings smokes own validation,
save/cancel and lifecycle regression coverage. Firefox pseudo-elements share
the rules but no executed Firefox/device-GPU proof is claimed. Registered
mutation witnesses are checked statically; development never executes mutants.

## Moon phase direction (#1006)

Keep the astronomy's `waxing` sign all the way to the mask and fingerprint.
Mirror only the mask geometry by changing arc sweeps, never the art or host.
`test/moon-phase-direction.test.mjs` uses selected NASA hourly data with the
existing 2.5 percentage point tolerance. `demo/smoke_moon_phase_direction.mjs`
rasterizes actual production SVGs for both directions on all hosts and compares
lit details against the original designer SVG. Advance the normal 30 s ticker
after changing the browser clock: a hass update may reuse View's render memo.
This headless proof does not claim physical GPU acceptance. Intentional moon
golden changes use selected `ci:golden` evidence; canonical Linux acceptance is before beta.

## Shared dialog composition (#1007)

The room/device form smoke repair (#1013) replaces the stale column-count
oracle with measured field/control boxes at all seven widths. The accepted
stacked grid is a block; Chromium serializes its inactive column declaration
as `minmax(0px, 1fr)`, so splitting on spaces falsely reported two columns.
The shared test oracle checks visibility, full width, containment, order and
37px section spacing. Ordinary negative rectangle inputs test the oracle
without patching product code or executing mutants. Both form smokes retain
their existing colour, draft/save/cancel, footer and overflow assertions and
attest their actual launched Chromium. No product styles or golden change.

The existing lazy form kit owns explicit sections, independent Help/action
regions and disclosures; see [DIALOG-UI-KIT.md](DIALOG-UI-KIT.md). The measured
joint editor graph reached 325007 B gzip during integration (previous lazy
reference 322435 B). The reference carries this explained cost; the 2000-B band,
initial View ceilings and absolute budgets are unchanged. The gallery bundles
from sources only for development and is absent from the shipped runtime.

## Same-ID room-wall restoration (#996)

Only ordinary config/set opts into `allow_room_wall_promotion`; there is no
client payload flag. A stdlib pure proof validates the resolved same-ID axes and
opening before the existing writer persists anything. Import retains its default
refusal and Optimize its separately proved policy. Do not replace the proof with
the broader Optimize capability: it may allow a thicker envelope or residual IDs.
Opening settings compare JSON types, including nested future fields: booleans
must not alias Python's numeric 0/1. Numeric 1/1.0 still round-trips through JS.

`test/helpers/room-opening-host-fixture.mjs` runs production deletion, face
reconciliation and wall identity; its four exact captures are replayed by the Node
unit before Python/HA tests consume them without needing test-build in backend CI.
`demo/smoke_room_opening_host.mjs` drives the real editor and uses the actual pure
promotion proof at its fake HA boundary. This browser oracle intentionally does
not claim complete schema/CAS/permissions coverage: `test_ha_room_opening_host.py`
executes those through the real WebSocket writer and durable store. No private
support export is a fixture. Iterate on those named tests, not the full suite.

The room-opening browser oracle (#1028) honours `PYTHON`; otherwise native
Windows uses `.venv-ci/Scripts/python.exe` when present, then `python`, while
POSIX uses `python3`, matching the existing vacuum recovery smoke. It executes
the same Python bridge once against the unchanged seed before launching the
browser. An unavailable interpreter or broken bridge therefore fails at startup
with its actual cause instead of being caught by config/set and surfacing as a
30-second write timeout. The twelve physical transitions still execute the
production proof; preflight is not counted as an accepted transition.

## HA icon-picker lifecycle (#988)

Follow-up #995 keeps the public HA fill/border tokens themed instead of
transparent and removes the settings sheet's outer `.hpf-iconfield` focus ring.
The inner wrapper already abstains around HA; the text fallback keeps that
wrapper as its sole focus owner. The activity-source group uses the existing
18 px settings interval, including between the manual selector and value.
No HA shadow styles or event handlers are patched. The authentic diagnostic
also loads the pinned HA theme module's official global sheet (`Q`), alongside
theme defaults (`I`), so popup spacing, rounding and WebAwesome tokens really
match the HA host. Its light/dark popup screenshots are ordinary visual evidence,
not accepted golden baselines. `smoke_marker_state_source` measures the actual
manual-control gap and exercises Auto/manual switching and Save; the device-form
smoke checks the fallback's single visible focus owner.

Slotted HA pickers emit their own bubbling WebAwesome `wa-hide`; only the
physical HA dialog's retargeted event may request closing the Houseplan form.
An open native/HA popover consumes Escape before its parent; registered
Houseplan overlays retain their existing priority. The icon-field wrapper
retains geometry but paints no second border around the authentic picker.
`demo/ui-lab/verify-icon-picker.mjs --ha-cache <verified runtime>` exercises the
official 20260930.4 picker (not a fallback), real filtering/selection/clear,
Save/Cancel, dirty close recovery and light/dark mouse/Tab focus. The public
beta.5 before-witness used fingerprint
`326b900b7bdf9b7972fd105d13f04592fe7c66f8892adacb5c9f3e409e87a126`:
opening alone stayed open there, but selection and Escape closed the owner.

## Computed unit partitions (#982)

`npm run test:product` and `npm run test:tooling` share the import graph in
`unit-groups.mjs`; `npm test` remains their complete union. Actual product
imports, emitted-module CLI targets and opaque test-owned dynamic imports
belong to product so emitted modules have a producer. A tool may inspect raw
product source as its dataset: a mixed data-only tooling consumer stays in
tooling; a source-contract test/helper with no tool subject stays in product.
Real URL expressions are parsed as JavaScript; text inside fixture/patch
strings and the canonical mutation-registry leaf cannot import the product.
Computed literal CLI tables follow their actual module imports. A test with
no discoverable repository inputs fails loudly. `--list` explains ownership.
The mandatory `gate:small` computes the needed union from the diff, running
range guards fresh; `--group=all` explicitly requests both. CI separates unit
jobs and requires both job results in frontend proof. Trigger filtering moves
to #980; nightly dispatch still covers both groups.

The legacy producer search first compares mandatory unit-protocol inputs against
the source commit with `git diff --quiet`. A mismatch makes its content key
impossible before downloading any artifact. Without this filter, a partition
change spent over five minutes retrieving old incompatible producers before
the first build. The registry in #981 replaces the broader search separately.

## Icon state source (#977)

Do not substitute the ordinary source into primary, controls or visualSources:
that would retarget actions/RGB and conflate source loss with device loss.
Use shared activity samples and a source signature. Server validation checks
structure/delta; exact runtime ownership is separate. Witnesses:
`test/marker-state-source.test.mjs`, `test_validation.py -k issue977` and
`demo/smoke_marker_state_source.mjs`. Screenshot the page, not the display-contents
hp-dialog host, and keep negative-input witnesses distinct from nightly mutants.
The form-only guard (#978/#979) has cheap getter-trap regressions in
`test/marker-state-source-form.test.mjs`: foreign, disabled and unproven sources
must never be read, while proven own sources retain live option states. The same
browser smoke checks saved foreign/disabled choices and cancellation without
changing the accepted configuration. These are ordinary negative inputs,
not product mutations or reasons to rerun unrelated golden/full suites.

Activity form polish (#979) uses one manual input and the ordinary `hp-help`;
do not reintroduce an external filter, multi-state row state or a second validation path.
The existing smoke observes Save/Cancel, own-source refusal and live preview,
and captures RU/EN light/dark layouts with long names at 1280/720 widths in
`demo/out/activity-preview-979/`. The full-width image is 184px high; its canvas
retains intrinsic safe bounds and scrolling for large rings/badges. Backend,
raw-state equality and the persisted array shape stay unchanged.

Owner refinement #991 puts search inside the expanded shared `sourcePicker`
from #989. `stateSourceOpen`/`stateSourceFilter` are transient draft fields,
excluded from dirty and persistence. Picking the already selected source only
closes the list: it must retain its manual condition and future fields. Retired
callbacks cannot recreate an old form. Reuse `opening.search_ph` and the ordinary
empty-list translation; no new dictionary or selection semantics. The existing
smoke now also captures the open picker in both languages/themes at 360px.

The release fixture `smoke_signal_visibility_ui` opens General settings through
native locator clicks, then observes the real LQI control. Do not return a
CDP-held `settled()` promise across lazy locale/menu changes: Chromium may collect
that promise before the visible entry is observed. Its eight cases and all
keyboard, inheritance, target-size and localization oracles remain unchanged.

## Secondary UI polish (#976)

Device creation binding (#989): `sourcePicker` accepts optional `onClose`, not
an Escape toggle. Keep callback updates separate from registration, register only
after insertion, and release on closure/disconnect. The owner uses
`if (this.host._markerDialog === d)` before changing its draft; an accepted dialog
retirement must never be undone by a stale overlay callback. Its native witness
is `node demo/smoke_binding_ui.mjs`; add `--ha-cache /path/to/prepared/HA` to run
the identical search/selection/Escape/draft scenario with pinned real HA dialogs.
This checks UI behavior, not live-HA configuration or GPU acceptance.

`dialog-presence.ts` owns only a Lit part's accepted-exit presentation;
`dialog-exit.ts` owns its finite, idempotent completion. Owners still decide
whether Close/Save succeeds. Never retain write authority or replace global
DOM removal to animate a dialog. `dialog-return-focus.ts` marks only the actual
return button; the next real input restores ordinary keyboard focus styling.
Accepted native confirmations release their modal authority immediately and
retain only a non-interactive top-layer popover for the exit paint. Their token
is retired before the action resumes; forced context cancellation removes the
presentation immediately. Unsupported Popover API falls back to the bounded
modal exit. A rejected parent's field focus follows the child exit terminal.
The test facade's `settled()` includes retained exits; it never hides a missing
terminal or clicks an inert shell. Other cards/reloaded documents need their
own facade or an explicit terminal wait.
Secondary controls reuse `settings-action.styles.ts`. Descendant pseudo-group
selectors in tagged CSS use `*:is(...)`: the current minifier otherwise removes
the significant space before a bare `:is(...)`.

Inbox row menus retain native details/buttons. On opening, the shared floating
placement flips/shifts them inside the visible body between the dialog's own
header and footer, intersected with the visual viewport. No HA-private scroller
inspection or layout reads during render are needed; a last-row phone hit-test
and pure viewport witness protect the boundary.

Checks: `node --test test/dialog-exit.test.mjs test/editor-secondary.test.mjs`,
`node demo/smoke_ui_polish_976.mjs` and the authentic-HA diagnostic documented
in `demo/ui-lab/README.md`. Native/headless evidence is not a physical GPU claim.
The frozen owner's archive is read-only and stays outside the repository;
only synthetic fixtures and locally generated synthetic comparisons are used.

The wall-node fixture waits for its exact config revision and a painted camera
matching the actual stage, not just visible handles. A real host-width change
exposes the asynchronous-refit gap without writing private state. Warm release
reconciles a changed stage aspect before declaring that size valid; identical
geometry still restores the exact camera. Debug this with the targeted smoke,
not repeated full-CI pushes.

Under the owner's standing minor-size allowance the lazy-editor ceiling moves
318054 →320340 B gzip (+2286 B,0.72%); its2000 B band stays unchanged.
The measured raw bundle baseline moves3247518 →3266117 B (+18599 B,0.57%),
including2192 B after the first976 build for bounded row menus and releasing
native modal authority while retaining exit paint; its2000 B band is unchanged.
Shared forms, locales and bounded accepted-close behavior account for the cost;
no startup/performance improvement is claimed. The warm-camera aspect repair
adds85 B gzip to Initial View (331933 →332018 B). Under the same standing
minor-size allowance its rolling ceiling moves330000 →332018 B, while the
2000 B band and352000 B absolute wall stay unchanged. This avoids byte-golfing
the input-correctness fix; it is not a loading-speed improvement.
All other monolith metrics and bands remain unchanged.

Rebase on #977 (`dev`782c3d3cf) retains both features. The combined build measures
Initial View333689 B gzip and lazy editor322218 B gzip, inside the ceilings/bands
above. The upstream raw baseline3267000 B becomes3285837 B (+18837 B,0.58%)
under the same minor-size allowance; the2000 B band and other metrics stay.
This is measured merged-source cost, not a performance improvement or a reason
to discard either task's accepted behavior.

## Device issue explanations (#972)

`device-issues.ts` classifies active HA alarm-capable states. Only `homeconnect_ws`
problem binaries with one of the three exact pinned Home Connect Local 1.12.5
service translation keys are maintenance; an exact unique-id suffix is used only
when no translation key exists. Unknown metadata retains alarm severity.
`device-presentation` captures all current visual and critical sibling causes once;
`device-issues-view` shares the read-only groups between the info card and preview.
Static icon info resolves details lazily from the accepted snapshot. The passive
yellow wrench is left of the complete shell, outside value, battery and LQI badges.
No fields, polling, acknowledgement or service calls are added.

Witnesses: `node --test test/device-issues.test.mjs`,
`node demo/smoke_device_issue_reasons.mjs`; four `device-issues-*` golden scenes.
The 55-state fixture anonymizes entity names; registry metadata is reconstructed
from upstream commit `a950e5438d479df3b97582edb8901adf10ad8726`, not captured HA metadata.
The initial View rolling ceiling moves 327895 → 330000 B gzip under the owner’s
standing size permission: measured current graph 330002 B, 2107 B above the old
ceiling. Its 2000 B band and absolute 352000 B wall remain. This is a size
allowance for explanations/locales, with no loading speed improvement claimed.
The raw bundle metric baseline moves 3231572 → 3241135 B (+9563 B, 0.30%);
all delegate/port/harness metrics stay equal. Its 2000 B band stays enabled.
After the pipeline rebased onto #973 (`dev` 77d763f26), the generated baseline
selected dev's 3237078 B value. The combined source measures 3247518 B in CI
39401052477 (+10440 B, 0.32%); only `bundleBytes` is restored to this measured
value under the same owner permission. The 2000 B band and other metrics remain.

## Vacuum generation witness (#974)

The `full_snapshot_book_lifecycle` backend guard must reject a foreign generation
with a new digest and admissible revision. Repeating an accepted snapshot also
returns false without the generation check and cannot witness that guard.
The same candidate is then accepted with the current generation, ruling out
digest/revision, provider/map and run-identity refusals as alternative causes.

The delete/recreate case keeps marker, route, map and source equal, changes the
run generation, and checks that an old reply leaves the replacement's complete
stored data unchanged. It runs both live and after a JSON round trip; a current
generation positive control must still update the path. Execute the existing
`node scripts/backend-test-guard.mjs full_snapshot_book_lifecycle tests_backend/test_ha_vacuum_paths.py`
in the pinned Linux HA harness. The mutation definition and guard stay intact;
ordinary PASS and `mutation-gate.mjs --check` are not nightly caught evidence.

## Ecovacs image bridge (#939)

Use the public `homeassistant.components.image.async_get_image`, never a
self-HTTP token URL, coordinator or vendor service. Decode the recognized
deebot-client 18.7.0 SVG in the executor. Source and robot must be enabled
Ecovacs registry entries on the same device; an invalid second marker cannot
poison the legitimate source lease or borrow its geometry. Inactive sources
have no continuing poll after their final checks; reload must not cancel an
underlying physical read and start an overlapping replacement.

`tests_backend/test_vacuum_ecovacs.py` uses synthetic renderer-shaped payloads;
`test_ha_vacuum_ecovacs.py` exercises the real Image API, authenticated writer
ACL, recorder/Store, coalescing, backoff, final checks and the shipped ten-second
timeout. It requires the pinned Linux HA harness, not native Windows pytest.
`node --test test/vacuum-ecovacs-client.test.mjs` follows test-build compilation.
`node demo/smoke_vacuum_ecovacs.mjs` follows `npm run bundle:sync`: visible raster
pixels, manual fit controls, Cancel, rejected Save/Retry, late preview and all
four View/kiosk Flat/2.5D combinations. The synthetic fixture is not field
evidence of update frequency on every Ecovacs model. No user's map is committed.

Matched Windows/pinned Node builds at base `2e2830ca0` and the complete #939
feature measure initial View 325049→326735 B gzip (+1686), total bundle
3219833→3228965 B (+9132), host references 5891→5916 (+25). The references carry
only those deltas: initial ceiling 323767→325453, bundle baseline
3219838→3228970, hostRefs 5888→5913. Inherited gaps (1282 B, -5 B and +3 refs),
all bands and the absolute View wall stay unchanged. The eager cost is the
small frame validator/projection needed by ordinary View; SVG decoding and
image bytes stay server-side, manual preview/fit controls remain editor-lazy.

## Offline UI Lab (#964)

For fast interface iterations use the separate [UI Lab](../demo/ui-lab/README.md):
`npm run bundle:sync`, explicit `npm run ui-lab:prepare`, then `npm run ui-lab`.
The genuine product bundle and pinned HA controls run against a synthetic/local
mock, with theme/language, hot CSS overrides and session export/import. No real
HA backend, device action or credentials are involved. Private fixture/assets
remain outside Git; the established demo and CI capture paths are unchanged.
The lab is a presentation tool, not evidence of backend correctness or release
acceptance. Its focused checks are `node --test test/ui-lab-*.test.mjs` and
`npm run ui-lab:smoke` after preparation; ordinary task gates still apply.

#956: a root z-index cannot overtake a browser top-layer modal. HA's public
footer slot and the native footer both provide an in-modal, out-of-flow notice
mount; do not put the message in the HA shell's external fallback overlay
portal. The presenter owns one DOM node, never a Lit-owned child part or a
hidden second live region. Its reroute disables live announcements before
moving already announced text. The shared style uses a Lit CSS array (the
static CSS minifier deliberately rejects template interpolation).
`node demo/smoke_modal_toast_956.mjs --matrix` checks real failed saves in all
four forms, both themes and two viewports. `--lifecycle` checks nested confirm,
AX/live-region events, keyboard input, replacement/expiry and detach; repeat
with `--native` for the fallback. The independent lettering reference is an
oracle-owned manual popover captured only AFTER the actual product pixels;
it uses the same loaded document fonts, but cannot hide an actual failure.
Ink contrast tolerates LCD/grayscale antialiasing and one-pixel raster phase,
not absence of text. These are synthetic/headless checks, not manual assistive
technology or physical-device acceptance.

### Approved editor polish (#963)

The shared history renderer and existing static CSS minifier keep this polish
inside the unchanged bundle/connectedness bands. Summary/form-kit CSS wraps
only static template pieces in `css` tags; interpolation boundaries keep their
original whitespace. The existing frozen form-kit tests still compare the
ordinary TypeScript output byte for byte. Rollup compacts those same static
pieces without changing selectors, values or order. Caption-only selection
formatters and unused translations leave the product with their removed UI.

The owner's 2026-10-19 size allowance raised the initial View ceiling by
2317 B (323767→326084), retaining the 2000-B band and 352000-B hard wall.
After the independently accepted #939 delta, the combined reference carries
the same allowance: 325453 + 2317 = 327770 B. The initial combined WSL build measured
3231084 raw bytes, 114 B above #939's 3228970 baseline plus its 2000-B band.
The same owner allowance carries only that 114-B excess into the raw baseline
(3229084), retaining the band and #939's host-reference values. Avoid changing
accepted rendering or adding another extraction solely for this 0.004% excess.
Restoring both descriptive toolbar hints adds 488 raw bytes: matched Windows
and WSL builds measure 3231572 B. The same allowance carries that text into
the raw baseline (3229572); its 2000-B band remains unchanged.

`demo/smoke_ui_polish_963.mjs` measures the expanded intrinsic panel, native
commands/rotation, keyboard filter, tooltip timing/lifecycle, data preservation
and narrow headers. The device-toolbar hint matrix hovers both descriptive
actions in all four locales, checks the visible shared bubble and its real
ARIA owner, and preserves server config/layout. `smoke_ui_polish_963_reference.mjs` reconstructs the exact
approved prototype from immutable generic sources and the original public Git
bundle (see `docs/design/963-ui-polish/README.md`). Both sides use synthetic
fixtures, identical camera/font/DPR and official HA Frontend20260930.4. This
task-only pin does not replace the ordinary HA harness pin. Use
`HP_UI_963_HA_WHEEL` for an existing verified wheel; otherwise it downloads the
pinned public package. `HP_QA_SEGOE_DIR` reads installed Windows fonts without
copying them into the repository. Without it, both sides use official HA Roboto.
`HP_UI_963_VIDEO=1` records the paired object switches. Reports, PNGs and video
live in ignored `artifacts/ui-polish-963/`; owner exports are never inputs.
`smoke_ui_polish_963_touch.mjs` uses real touchscreen input: button focus from
a tap must not arm keyboard help or suppress the original zoom action.

The authentic HA fixture must await bootstrap in both original scripts. Patch
the product module before converting the plain stub script into another module;
otherwise the first module gets two awaits and the product gets none. Slow HA
can then replace HTMLElement after hp-dialog registration and throw an illegal
constructor. The #955 Save-paint smoke keeps a delayed bootstrap input to cover
this ordering; official HA factories, registry and style bytes are not patched.

The frozen #963 Save caption supersedes #955's optical Y offsets: text and check
share the approved unshifted alignment in all four languages. Preserve the
painted lettering comparison with the frozen reference when changing the footer;
the icon, target size and other footer consumers retain their prior contracts.

#940 vacuum source-first: a schema-valid explicit empty is a complete native
value, not failed normalization. Keep that distinction before the normalizer
loses it; all-invalid nonempty input must fail. Provider path/session authority
outranks inferred dock/grace boundaries. The collector's attempt fence is
separate from run generation, because empty/new source observations can
supersede an executor response without rotating a run. The fallback switch
uses ACK-only staging on the existing serialized transport, preserves newer
unrelated edits and rolls back the native checkbox immediately while pending.
The form-kit event argument is optional; existing optimistic toggles are unchanged.
Support schema changes are byte-identical in the relay; deploy its accepted
version by the relay README before a HACS release sends the new reason/boolean.
No relay deployment or real-device/GPU acceptance is implied by headless tests.

The shared colour popup keeps the full opacity caption at intrinsic width;
the adjacent range absorbs remaining space. The number input still reserves
three digits and its native stepper. Both text and numeric content are measured
in the browser so solving one crop cannot silently introduce the other (#955).

The LED representation action row in the four-form settings shell inherits
spacing and the single divider from its section. Its inner legacy `.row` must
not inherit the generic dialog footer border or padding. The LED geometry
scenario measures the actual two border boxes and first button alignment;
other dialog footers retain their existing contract (#955).

Device-only profile help belongs in the existing tools dictionary, already
awaited by EDITOR_LANGUAGE_RUNTIME. Onboarding uses the shared settings
dictionary and must not download these editor-only messages. Both extracted
profile presenters receive the same private tools translator; no additional
namespace or language-loading gate is needed (#955).

The four forms use hp-settings-select for every dropdown, including profile
fields and the mobile section selector. Its native child holds values and
options only; the visible button, menu, animation and reduced-motion rules
belong to the component. Do not retain a second native ::picker stylesheet
in settings-dialogs.styles.ts. First-run onboarding keeps its own controls.


#955 AC3 includes an ordinary sensor as well as the complex Device profiles.
The eight-scenario genuine-HA matrix has a ZHA temperature/humidity/battery/LQI
sensor with five shared sections; its setup lives only in that smoke and does
not change the immutable four-case comparison dataset. --case=sensor runs a
bounded supplemental scenario and writes case-sensor.json rather than replacing
the full-matrix receipt. The default remains all scenarios; unknown case names
and mixing --case with --fast refuse, so an empty selection cannot look green.

Action-plus-help wrappers must not inherit form-label typography. Keep the
real vacuum summary button; position its separate help beside the border,
and use the shared hpf-button-help row for actual links/buttons. A label-row
span styled as a button shrank the control and made Documentation bold/underlined
in native captures. The ordinary Device smoke checks real summary ownership,
context help and no unintended picker toggle; native viewport checks follow.

Seven approved Device profile hints in four lazy locales add raw bytes: the
current full build is3113735 B versus3109077 B (+4658 B). The ordinary unused
gate refused only that metric, with no dead code. Per PROCESS §3/§8, record
the reason in #947 and set only bundleBytes to this measured fact in the same
product commit. The2000 B band, other metrics and all gzip/hard ceilings stay
unchanged (View322935, editor287470, onboarding32296 B gzip). Final Linux
validation still judges the exact published material.

A visual comparison with the immutable Device v6 found missing profile help
that layout-only checks could not detect. Ordinary unchanged-product checks
reproduced missing source/live/path and radar profile/room help. Restore those
shared instant help controls without changing write boundaries or source values;
clicking the help inside the vacuum disclosure must not toggle the picker.

The Device witness additionally selects a second external light through the
real search UI, observes two friendly-name chips, and discards that draft before
reopening the immutable-v6 visual fixture. This exercises the complex two-target
case without changing the agreed one-chip reference dataset or before/after
snapshot values. The final ordinary Cancel/no-command checks cover that addition.

The first post-r1 normal push was correctly refused by the unit gate: replacing
Room's generic fill.none consumer left that base key unused. Remove it from all
four base locales; the new lazy room.fill_none remains the sole label owner.
No test allowlist or gate was weakened. The other build/budget/unused gates in
that attempt passed; only the dead-key consumer check failed.

Code review #946 r1 found one copy mismatch: the Room none option reused the
generic “Нет” instead of the approved “Без заливки”. Add the specific lazy
Room label in all four languages. The v4 smoke now compares all five real option
value/label pairs to the immutable reference DOM. On the unchanged r1 product
it failed with exactly none/Нет versus none/Без заливки; this was an ordinary
new regression check, not a temporarily patched implementation or mutation run.
The other four labels already matched. Space has no separate None UI option
(its accepted custom/0% representation remains unchanged). Save/resolvers and
all six control values are unchanged.

`smoke_room_save_retry_946` rejects the first real public config/set call and
uses the visible Room footer twice. It verifies the retained field and accepted
config, a rendered error alert, re-enabled Save and exactly one accepted retry.
The pinned native-HA screenshot exposed the pre-existing notification paint
order issue #956, reproduced on24f7ab2 too; DOM visibility is not claimed as
proof of visible notification. This adds the AC5 draft/rollback/retry witness
without changing product or capture inputs.
The native asset loader really reads `tests_backend/requirements.txt` to
authenticate its frontend pin. The browser-input guard therefore permits exactly
that metadata file for smoke, while still excluding all backend suites and all
backend inputs from golden/performance. This is the same narrow protocol later
used by #947, brought forward with its first Room consumer; no dependency is hidden.

The #945 localized signal witness sets HA language on each fresh card instead
of restarting it with `setConfig`. It observes the public Devices mode before
the actual settings entry, rather than awaiting a CDP-held transition promise.
The first reset-wait adapter still produced "Resulting promise was garbage
collected" in CI at setMode; the component-reset step is now absent. Keyboard,
44px target, translation, inheritance and popup assertions remain unchanged.

The synthetic climate registry now uses the approved v6 HA name “Термостат
гостиной”, independently of the plan label “Климат гостиной”, just as the LED
fixture already did. A real picker observation checks both names separately.
This is a fixture correction, not a product binding change; before/after captures
must both be refreshed so their data snapshots remain byte-identical.

Final climate-v6 source eca913f9 on matched Linux/ext4 measures
editor286949/onboarding32058/raw3109289/initial322935. Relative to the same
Room source284636/31428/3096669, the complete Device feature costs
+2313/+630/+12620. References286938/30382/3109077 preserve the inherited
11/1676/212 gaps; every band and absolute initial limit stays unchanged.
The additional climate visual correction costs12B editor and470B raw against
the prior full-profile measurement, rather than borrowing #955's polish band.
Its existing four-profile smoke and neighbouring climate average/save/reopen
smoke pass. Native202checks pass again with the unchanged synthetic dataset.

The exact Device v6 comparison also exposed a retained climate caption replacing
the approved Room metrics heading and contextual help. Restore the shared
subheading/compact toggle/help primitives; keep the same useClimateTemp draft
writer. The existing four-profile smoke observes the heading and immediate help
without a duplicated permanent caption. No climate aggregation changes.

Owner arbitration on #947 (18 October 2026) requires the whole Device dialog's
documentation, not only the radar subsection. Both USER-GUIDE languages now
describe the same five shared tabs, conditional Vacuum/Radar sections, actual
picker/preview, climate and charge/signal field locations, named control chips,
metadata/files and footer/save boundaries. RADAR.md also documents the section
selector, operational pause versus removal and compatibility entry. Obsolete
Additional actions/manual-declaration instructions have been removed from the
current guides; immutable mocks and historical review findings remain intact.

The complete profile gate ran all selected browser smokes successfully; its
only failure was the now-unused base dictionary key `vac.section`, replaced
by the grouped v6 heading. Remove that key from all four locales; the nine
dead-key/consumer checks pass again. No translation fallback or UI value changes.

The immutable-v6 screenshot comparison exposed two retained legacy profile
layouts. Vacuum now uses common heading/source/status/path controls and keeps
every technical map/path value in expandable diagnostics. Its source/live/path
writes and calibration/routing workflows retain their existing semantics.
`vacuum-settings-section.ts` extracts that presentation from the runtime;
the runtime remains a delegate. Radar uses the approved data/target/shared
source/mount/service groups, common fields/switches and named target removal.
No sensor recognition, source math, config shape or setup state machine changes.
Vacuum map selects also use the shared animated list. New labels cover all four
locales. Full-suite witnesses navigate each newly opened Device dialog to its
visible pane; the first-frame observer opens the collapsed diagnostic content
and still measures its first painted frame. Technical values are not removed.
Fresh matched Linux/ext4d356fc8a measures editor286937/onboarding32058/
raw3108819/initial322918. The unchanged Room A is284636/31428/3096669;
own complete-feature deltas are+2301/+630/+12150. Carrying those deltas onto
the Room references gives286926/30382/3108607, preserving inherited gaps
11/1676/212, all bands and every absolute/initial limit. Counter references
stay145/363/5564/103/101; actual hostRefs5577 stays inside its25band.
The earlier “final #947” paragraph below is historical pre-profile material.
This cost belongs to the approved complete Device v6 feature; #955 still has
to fit its own existing band relative to the accepted Device material.

The inherited #945 preview witness uses Room v4's own sample typography
(16px name and 12px metrics), while retaining the independent space-base
times room-multiplier checks and the Cancel persistence assertion (#946).

Device screenshot comparison against immutable v6 keeps the LED explanation
contextual, places tap-confirmation help beside its label, uses the common
information callout for toggle guidance, and separates the model/link fields.
These are presentation changes; the action guards and saved values are unchanged.

The #947 full-suite adapters navigate the approved panes before clicking or
focusing their controls. The automatic MDI icon is checked in the actual picker
or glyph fallback, and the static preview retains plan parity for icon/state/
satellites/rotation while using standard size (the plan keeps its1.4x size).
Binding mode is selected by stable radio value instead of its shortened label.
The first-paint style witness uses a recognized radar fixture, watches hidden
pane visibility as well as mounts, and keeps all cold-View/lazy-sheet checks.
## Properties panel (#931)

Code-review r1 repairs preserve the existing colour-picker mode contract:
the panel uses `flat-swatch compact-swatch`, fitting its 15px slot; colour tiles
keep `cover-swatch` and their alpha checkerboard. Opening metadata names resolved
adjacent rooms in plan order, contour metadata uses canonical ownership or exact
legacy boundary containment. Stored names are quoted, never auto-inflected.
The approved reset glyph and removal instructions (including tooltip line breaks
and arrow) are retained. Native dialog routing is exercised across all applicable
families at desktop/narrow widths, with invalid drafts and a real delayed HA ACK.
The full golden capture rejected a compact-layout leak into native solid colour
plates; none of those unrelated frames was accepted. `flat-swatch` governs paint
only, `compact-swatch` opts the new panel into the tiny host layout. Native
plates keep the original inline-flex/40px geometry (computed flex as a flex item).
The rejected full golden capture records the original visible regression;
the layout oracle now measures the revealed Appearance section at all six
light/dark320/360/560 combinations, not hidden controls. Three r1 declarations remain
static-only during development.
After integrating accepted Room v4 (#946), the r1 source measures hostRefs5830,
bundleBytes3193871 and editor313015 B gzip, all inside the existing approved
references/bands. Initial View324274 B gzip remains below its unchanged ceiling.
No further ceiling or band is raised. Golden reconciliation carries Room's
three already accepted frames and the previously accepted #931 frames; it is
not a new visual acceptance. A fresh complete WSL capture follows publication.

The full #931 rebase CI exposed the old dangerous-confirmation witness taking
its DOM snapshot while the already-revealed boot veil still faded. A controlled
1.2 s gap reproduced the same failure 3/3 times: only `.bootveil.off` disappeared
before the warm gate; the warm body itself stayed identical. The witness now
waits for the public veil and the stage's `hpsettle` startup grace to leave
before its snapshot, without a fixed sleep, normalization, weaker assertion or
product change. The latter also prevents a later class-only cleanup from
polluting the same exact DOM oracle. Failure diagnostics
separate pre-gate settling from an actual warm-gate body mutation.
The corrected witness passed 3/3 normal and 3/3 controlled-gap runs; the
diagnostic gap and CPU throttling were removed before publication.

The editor-only modules are under `src/editors/properties/`; do not import them
into initial View. `demo/smoke_properties_panel.mjs` checks real controls and
writers. `demo/capture_properties_panel.mjs` captures the actual product beside
immutable approved references, verifies their manifest and asserts panel/group
bounds. Read-only installed Segoe UI fonts are needed for comparable typography
(`HP_QA_SEGOE_DIR`); fonts are never bundled. Output goes to `output/properties-931`.
Never update approved references to make the implementation pass. Generic golden
success is additional regression evidence, not design acceptance.

The theme smoke checks computed colours for six browser/HA-mode combinations;
absent HA `darkMode` uses CSS colour scheme, while an explicit HA mode wins.
The test facade opens full device settings through the native double-click
entrypoint in wide editors, where one click now selects the properties target.

Owner-approved #931 budget refresh (2026-10-18,
[decision](https://github.com/Matysh/houseplan-card/issues/931#issuecomment-6250557931)):
`hostRefs` 5564→5833, total bundle bytes 3088841→3184691, lazy editor gzip
283610→311520 (including the CSS-theme correction). These are measured reference values, not added tolerance: the
25-reference / 2000-byte bands, initial View limits and performance gates stay
unchanged. The panel and its copy remain demand-loaded in the editor graph.

After accepted Space v7 (#945) landed while the #931 full CI was running, the
combined source measures hostRefs5844, bundleBytes3193692 and editor312703 B
gzip. The same owner-approved three references are refreshed to those joint
facts; Space's onboarding reference and all bands/View/performance limits remain
unchanged. The previous #931 material passed full CI39139573032, but does not
stand in for the combined-source checks or matrix78 capture.

The #945 localized signal witness sets HA language on each fresh card instead
of restarting it with `setConfig`. It observes the public Devices mode before
the actual settings entry, rather than awaiting a CDP-held transition promise.
The first reset-wait adapter still produced "Resulting promise was garbage
collected" in CI at setMode; the component-reset step is now absent. Keyboard,
44px target, translation, inheritance and popup assertions remain unchanged.

## Portable full backup (#936)

Cancellation regression (#971): a ZIP upload has a random 32-hex operation id
before HTTP starts. Cancel uses that exact user-scoped id even when the response
body was aborted and no preview token arrived. Keep early-cancel tombstones
bounded (64/user, 256 total) and expiring; cancellation repeats do not renew TTL.
Never sweep all of a user's sessions to solve `zip_busy`. Cleanup must await
that session's executor workers and respect a durable pending journal. Native
archive smoke covers both a late reply and an aborted response body; the HA
archive suite exercises real HTTP/WS cancel and immediate retry. Private support
backups are not repository fixtures.

Container v1: `manifest.json`, the old `document.json`, optional `zigbee.json`,
deduplicated `images/<sha256>.<ext>`. Closed manifest descriptors bind actual
sizes/hashes/refs and explicit incomplete reasons; transport `authSig` is
removed from image URLs. Version, duplicate/extra entries, unsafe paths,
symlink/special/encrypted entries, CRC/hash and actual image decoding fail
closed. No `extractall` or network fetching. ZIP is not diagnostic Help JSON.
Session directory creation fsyncs its parent before any durable intent;
file opens use no-follow/nonblocking and check regular descriptors, so a FIFO
cannot hang a worker before validation.

Caps: compressed/expanded 2 GiB each; 1600 entries; manifest 2 MiB; document
8 MiB; snapshot uses existing provider limits. Plan/decor/attachment image caps
stay 8/2/50 MiB with existing aggregate quotas. 64 KiB streams and executor
image validation keep ZIP bytes off the HA loop. Private marked staging has
4 GiB aggregate reservation, 512 MiB minimum free space, one heavy session per
user/two globally and ten-minute TTL. Durable pending intent owns its files
instead of expiry; no public URL or token goes into the archive.

Run `python -m pytest tests_backend/test_ha_backup_archive.py` in the real HA
venv plus existing import/Zigbee/support suites. Tests inject failed/lost-ACK
Store writes and filesystem publication failures at I/O boundaries (not
mutated guards), then verify disk reload/entry restart. The native witness is
`node demo/smoke_backup_archive.mjs`: actual entrypoints, native chooser and
Python-produced archive bytes with synthetic HA transport, not live-HA proof.
Regenerate its synthetic frozen fixture via
`python -m pytest -s -q tests_backend/helpers/backup_archive_fixture.py` and
capture the `HP_BACKUP_FIXTURE` JSON into `demo/fixtures/backup-archive-v1.json`.
The backend suite rereads those committed ZIP bytes with the real parser.
Client tests cover consent, raw legacy input, cold loader cancellation and
late token/blob ownership. Run the old backup-transfer/empty-import smokes too.
Proxy HTML/413 errors use stable translated backup codes; download also
requires the authenticated endpoint's ZIP MIME instead of saving a login page.
New mutation definitions are static-checked only; execution remains nightly.

Portable recovery (#973) uses `portable_recovery.py` for both transfer directions,
not a catch-all validation exception or the client geometry optimizer. Export
dry-runs its real document against empty target state; JSON/ZIP repair consent
keeps the prepared copy. Run `python -m pytest tests_backend/test_portable_recovery.py
tests_backend/test_ha_portable_recovery.py tests_backend/test_ha_import_export.py
tests_backend/test_ha_backup_archive.py` in the HA venv. The new native witness is
`node demo/smoke_portable_recovery.mjs`: real chooser/dialogs, four locales and
narrow width, actual backend-produced JSON/ZIP fixture, no invented success
config. The HA test rereads both committed ZIP streams and verifies actual
preview/materialized targets against the fixture. Private reproduction ZIPs
remain outside the repository and are never applied to live HA during testing.

`backup-archive-lazy.ts` loads ZIP UI/transfer code only for backup operations;
localized new copy uses the existing tools namespace. No renderer/frame work.
Owner approval for #936 accepts exact total 3,042,858 B and lazy editor
273,105 B gzip, retaining both 2,000 B bands and every other budget. This is
an explicit feature-cost acceptance, not a performance improvement.
Keep the generated bundle out of ordinary commits (`npm run bundle:clean`).
Before downgrade, resolve durable pending restore/Undo with this backend;
never let an old version ignore a new recovery journal. Existing image files
are retained, including after Undo; no orphan inference is allowed.

## Approved settings visual contract (#948)

Compare actual dialogs to the immutable `docs/design/settings-dialogs-944`
references with identical data and viewport. `smoke_settings_mock_match_948`
checks General's reference labels, width/navigation proportions, left close,
full-width light/radius controls, compass guidance and footer-status order,
plus the real colour-plate interaction and 320/390 px fitting. It writes paired
reference/actual desktop images. The raw reference uses runtime Lucide icons;
without that runtime its icon pixels are absent, so those images establish
layout only, not an icon raster comparison. Inspect actual icons separately.
This focused witness complements the full golden matrix and the other forms'
visual comparison; it does not certify all four dialogs by itself.
Matched Linux builds of the pre-refinement `6ffed73a` source (product-identical
to pipeline `68735d36`) and the visual refinement before review-r1 fixes measure 280396 → 280863 B gzip in
the lazy editor. Only its own +467 B enters the rolling reference, preserving
the inherited 1412 B gap and 2000 B band. Initial View is 323416 → 323450 B;
its reference/absolute ceiling and the onboarding ceiling are unchanged.
Raw files in the same isolated published base/candidate builds are 3054747 →
3058911 B (+4164, chiefly the approved lazy copy and shared presentation). Carry
only +4164 into `bundleBytes`; its inherited −2098 B gap and 2000 B band remain.
All other coupling metrics are unchanged and their references are preserved.
Review-r1 adds ordinary negative unit inputs for ignored discovery plus stale
registry rows, configured-disabled/failed entries and the single undo slot in
`settings-sections.test.mjs`. The actual render consumes that undo projection.
`smoke_settings_select` checks 160 ms item transitions and reduced motion in
the actual list and its dialog-owned fallback. Desktop navigation changes at
550 px as approved; outer/inner ray captions identify the selected example.
The embedded Zigbee form shares that same layout, uses the card's explicit
language, places contextual help on controls and keeps topic status beside its
heading with full-width scan guidance below. A live HEAD request to the approved
`https://houseplan.tech/convert/` returned HTTP 200 on 2026-10-18.
Matched `28597553` and r1 builds measure editor 280863 → 281160 B (+297) and raw
3058911 → 3060586 B (+1675). Carry only those own deltas into the same rolling
references; bands, initial/onboarding limits and all coupling counts stay fixed.
Settings-only toggle rows remove the legacy 11 px vertical padding, retaining
44 px targets and the shared 18 px section separators. Help flows inline after
wrapped labels. The old standalone topology heading/help contract remains; its
unit witness accepts the embedded instance flag and still checks both locale keys.
The full `f11b709a` capture correctly refused three unexpected device-catalogue
frames: shrinking every `instant` help trigger moved that unrelated dialog.
Keep size/hover scale as custom properties inherited only from `settings-layout`
hosts, with the original 32 px default elsewhere. The ordinary cross-dialog
scenario in `smoke_settings_mock_match_948` measures settings 22 px / catalogue
32 px. Its new browser-dependent mutant is registered, not executed; a fresh full
published-source capture must prove the catalogue frames unchanged before acceptance.

## Room CO₂ (#920)

Compile the usual test-build and run `node --test test/room-co2.test.mjs
test/devices.test.mjs test/render-snapshot-incremental.test.mjs`; after
`npm run bundle:sync`, run `node demo/smoke_room_co2.mjs`, plus the room-climate,
tooltip and isometric-label smokes named in the issue. The new native-input
witness covers default/off, source selection outside every HA Area, unsaved
preview, cancel/save/reopen, refused write and retry, unavailable/real-zero
states, stationary hover updates, kiosk and static-card non-expansion.
Screenshots are generated under `artifacts/room-co2`. The golden matrix adds
`room-co2-flat-light` and `room-co2-iso-dark`; accept only those new scenes and
the intentionally changed room/space source forms after full attested capture.
Backend validation, full/space backup round-trip, diagnostic pseudonyms and
HA read-ACL capture have named tests in the corresponding backend suites.
The closed support schema is mirrored byte-for-byte into the relay; run
`python -m unittest discover -s scripts/support-relay/tests -q` as well.
Before a HACS build with these fields ships, deploy the accepted relay schema
through the staging/discard then backed-up production sequence in its README.
CO₂ mutations are readiness-only during development, execution is nightly.
No subscriptions, timers or geometry migration are introduced. The editor
previews a newly selected unsaved source against the active registry; the
painted plan keeps its immutable accepted snapshot.

To bound the feature cost, preview rendering and room-only source
copy/help stay in the lazy settings graph. `space-dialog-draft.ts` projects
the same saved/default fields for editor and onboarding/import; queued imports
retain their intentional `customFill: null` distinction. Unit vectors and the
existing create/default/copy/room/space form smokes cover this shared projection.
The owner allowed modest increases in issuecomment-6241350905. Matched builds
of b8964e5f7/current source measure initial View 324822→324687 B gzip,
lazy editor 270966→271892 B gzip and total dist 3026587→3026930 B. Only the
editor rolling reference increases by its measured 926 B (269485→270411);
absolute budgets, both 2000-B bands, all other ceilings and monolith limits stay.

## Space settings redesign (#945)

`smoke_space_settings_form` exercises actual controls, independent font bases,
CO₂ text, raw invalid values, validation across sections, links to General,
dirty/save/cancel/reopen and 320/390/1280 px layouts. The existing font, battery,
signal, layer, create/default and CO₂ smokes retain their functional oracles;
only control discovery/intentional visibility expectations follow the new UI.
`test/space-settings-945.test.mjs` covers fallback, explicit 100% over legacy
200%, invalid scalars, local battery overrides, background compatibility and
coupled borders. Snapshot reuse tests include in-place battery-policy edits.
Backend validation and transfer vectors cover all three new scalar settings,
normalisation idempotency and unknown-field preservation. The support schema
mirror must remain byte-identical and be deployed before the beta. No mutants
are executed during development; registry checks are static readiness only.
The shared animated selector is already delivered in #948; its cost is not
charged a second time here. Existing ceilings and bands remain unchanged.

## General settings redesign (#948)

`smoke_general_settings_form` covers save/cancel/error, exact stored battery
modes, color picker writes and numeric validation. `smoke_settings_navigation`
checks mounted draft retention, compass synchronization, button/select cursors,
three live HA palettes and 320/390 px field/footer geometry. The topology-job
smoke remains the server-scan lifecycle oracle. Mutant definitions for the
former Clear button and opacity input now target the corresponding empty-north
and atomic picker writes; static readiness is not caught evidence.

Matched baseline 24f7ab2f (same product as 9c6d58c1) measures initial View
324822 B gzip, lazy editor 270966 B and total 3026587 B. The new forms measure
324415 / 276724 / 3048067 B: View shrinks 407 B; lazy editor grows 5758 B,
total grows 21480 B. Only those measured costs move the rolling editor/total
references; inherited gaps, bands and initial/absolute budgets remain intact.
Settings-only CSS has a separate adoption module so onboarding does not pay for
the new navigation/presentation sheet. Its graph is 29839 B gzip, within its
unchanged ceiling/band. WSL tooling units run with a Linux-only PATH: inherited
Windows folders can turn a deliberately missing command's ENOENT into EACCES.

## Removing room darkness (#943)

After `npm run bundle:sync`, run `node demo/smoke_room_dimming_removed.mjs`
(actual screenshot RGB comparisons and public settings controls), alongside
the Glow/LED, opening-tunnel, decor, live-pan and isometric AC smokes. Before
the renderer change the same no-light legacy input fails at RGB delta 234;
the unchanged baseline frame/log is retained in `artifacts/943/prechange-pixel`.
Unit palette tests, backend strict legacy validation/full-backup round trips
and the support-package palette parity/export test cover the separate data
boundaries. Run the full `python3 -m pytest -q tests_backend`, not just frontend
checks. Keep the byte-identical `scripts/support-relay/hp_relay/support_wire_schema.py`
mirror in sync and run `python3 -m unittest discover -s scripts/support-relay/tests -q`;
that separate CI suite checks both real validators and rejects a retired role
in diagnostic wire data while full user backups retain storage compatibility.
No load-time migration or new schema version is required. The frozen
base-only text assertion is retired, not replaced with a monolith regex.
Accept only visually reviewed full golden artifacts through the normal pinned
Linux or attested-WSL workflow. Mutants are not executed during development;
ordinary old-code RED evidence is not mutation execution. Budgets stay fixed.

## Contact outlines during zoom (#951)

After `npm run bundle:sync`, run `node demo/smoke_device_contact_zoom.mjs` and
`node demo/smoke_device_contacts.mjs`. The zoom witness uses the existing frozen
designer board (45-unit core calibration), an inclined wall and real native
pinch/button/wheel/pan input. It checks the screen matrix of the actual path,
effective border widths, accepted config/layout and contact work counters during
intermediate frames, plus the shared static card. Its PNGs live in
`artifacts/951/zoom`; `HP_CONTACT_ZOOM_ARTIFACTS` changes only the output folder.
An inline SVG drifts when a core is smaller than its inherited font line; a
fixed SVG stroke also differs from ordinary CSS borders. The repair is local
CSS, including the ordinary border's whole-pixel rounding (`round(down, …, 1px)`;
[CSS round](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/round)).
The shared-width fallback remains for older engines. No per-frame DOM measuring
or geometry/cache policy is added. Mutation declarations are static readiness
only; execution remains nightly-only. Accept only the two intentionally changed
device-contact goldens through the normal full Linux/attested-WSL workflow.

## Device catalog operations (#930)

Run `node --test test/device-inbox.test.mjs test/device-inbox-930.test.mjs`
after the usual test-build compilation, and after `npm run bundle:sync` run
`node demo/smoke_device_inbox_delete.mjs`, `node demo/smoke_device_inbox.mjs`
and `node demo/smoke_device_inbox_batch.mjs`. The new smoke enters through
native catalog controls and real fixture config/layout events. Its 155 virtual
markers cover filtered Select all beyond 100 rows, cancellation/refusal, exact
accepted deletion and a target moved during confirmation. The existing batch
oracle `inactiveRowNotSelectable` is intentionally replaced by the stronger
`inactiveRowsDeleteOnly`: deletion selection is allowed, whole-set Hide/Show
still sends no write. Mutation execution remains nightly-only.

The measured #930 source graph keeps 361 port members and 103 ported privates;
host references grow 5463→5539 (+76) because the shared single/batch deletion
owner reuses the existing adoption, cleanup and identity ports instead of a
second command implementation. Final source `c4df5e57e` emits 3026029 JS bytes
(+11503 over 3014526), including four lazy locale dictionaries, space projection
and deletion UI. The ratchet reference remains the earlier 3026010-B measurement;
the last 19 B do not need a further reference increase.
Matched clean dev `d36364b2` measures initial View 324886 B gzip and lazy editor
269876 B; final source `c4df5e57e` measures 324826 (−60) and 270889 (+1013).
Delete loads only
on demand; its locale labels stay in the editor graph; the shared confirmation
shell retains its narrowly keyed list rule. The existing
raw-URL retry ABI keeps the shared translation adapter in `editor-shared`.
Only the earlier measured 953-B editor cost is added to its rolling reference
(268532→269485); the final extra 60 B are absorbed by the existing band rather
than increasing the reference again (the inherited gap was 1344 B). Absolute budgets, both
2000-B bands, initial-View ceiling, core ceilings and browser guideline stay put.

Area/room membership is indexed once per catalog projection; the 2000-row unit
counts actual Area property reads instead of judging a noisy timing threshold.

Three existing catalog golden scenes intentionally change. Accept their fresh
images only through the normal full Linux/attested-WSL artifact workflow; no
threshold or baseline waiver. Temporary builds are not task commits: use
`npm run bundle:clean` before committing ordinary sources.

Local WSL caution: a wrapper forwarding `gh` to the Windows executable does
not respect the Linux `GH_CONFIG_DIR` used by isolated pre-push unit fixtures.
Run the real online `process-gate --issues` separately with that wrapper, then
keep it out of the normal push/test PATH. The standard pre-push hook and full
`gate:small` still execute; do not disable either to hide this environment leak.

## Initial Plan tool (#928)

`plan-entry-tool.test.mjs` covers every geometry collection independently,
including opening-only, zero-thickness and non-geometry negative inputs.
After `npm run bundle:sync`, `node demo/smoke_plan_entry_tool.mjs` uses real
editor/tool buttons and server config delivery, then checks first-click draft
behaviour and config/layout write absence. Drawing scenarios on an existing
plan must explicitly select Walls instead of relying on the former default.
Warm adoption and the explicit space-copy/new-space Walls start are separate.
`wall-node-editor.test.mjs` checks legacy duplicate-ID entry, no mutation/capture,
strict-write rejection, recovery on a valid snapshot and unknown-error rethrow.
`smoke_wall_face_lineage` retains its real duplicate rollback scenario: it must
remain reachable through default Select without weakening the malformed fixture.

## Vacuum route recovery (#918)

`test/vacuum-routes.test.mjs` exercises the common route-source resolver;
snapshot tests retain cameras outside the vacuum's HA device. The executed
diagnostic consumer tests check suppression priority, the shared SVG count,
quota exhaustion and RU/EN output independently of sampled/native quality.
`tests_backend/test_trail_recorder.py` covers source/event order, refresh,
unavailable and ambiguous maps, and strict orphan-to-route generations;
`test_ha_vacuum_paths.py` exercises real Store teardown/restart and late callbacks.

After a fresh `npm run bundle:sync`, run
`node demo/smoke_vacuum_route_recovery.mjs`,
`node demo/smoke_vacuum_path_fidelity.mjs` and
`node demo/smoke_vacuum_multifloor.mjs`.
The recovery fixture uses the actual Python recorder and public serializer
with synthetic sources; its output is installed before mounting the card.
The browser checks painted SVG and puck geometry in Flat/2.5D desktop/mobile,
cold opening/reopening during cleaning, negative routes and diagnostic text.
No reporter export is shipped. Full HA coverage requires Linux/WSL; a native
Windows pure-subset pass is not a Store/lifecycle result. Mutation definitions
are registered and checked statically; execution remains a nightly responsibility.

## Local hidden-device display (#919)

`hidden-device-visibility` owns the per-user/card browser preference and one
bounded display roster; saved marker and raw discovery rows are never changed.
The default-off roster retains its original identity. Node tests cover positive
lifecycle authority, immutable projection, identity/storage failure and complete
versus incremental snapshots. `smoke_hidden_device_toggle` enters through native
desktop/catalog/touch actions and checks reload isolation, no mutation writes,
ordinary HA toggle/drag, lighting parity, explicit Fit and the static card.
`smoke_mobile_view_header` includes read-only users and 320/390 px targets.
Three golden scenes cover ordinary reveal, disabled service ghosts and 2.5D LED.
The #953 linked-light phase also checks an exact HA driver call and no dormant
manual toggle after revealing saved-hidden rows; an ordinary unlink input checks
the inverse ownership. A direct bound HA lamp cannot witness this roster boundary.
Mutation witnesses are registered for nightly execution only (PROCESS §2.7).

## Device copying (#935)

`test/device-copy.test.mjs` covers first-free numbering, effective appearance,
deep independence, incoming entity/marker aliases, unavailable sources, measured
capsule footprints and internal-only attachment mappings. `device-copy-editor`
units execute the actual command callbacks for stale revisions, source retirement,
failed attachments and foreign-HA replies, including a newer operation in flight.
`tests_backend/test_ha_marker_copy.py` uses authenticated HA WS, real schemas and
Store I/O fault injection to hold ACL/CAS, graph validation, coherent rollback,
concurrent copies and independent file bytes. Ordinary faults are not mutants.

`HP_SMOKE_CHECKS=1 node demo/smoke_device_copy.mjs` uses native context clicks,
ordinary and automatic devices, LED selection, lost/rejected replies and a cold
reader of the saved wire pair. Horizontal SVG strokes have zero bbox height:
click their actual transformed midpoint, never `force` visibility or invoke a
private handler. Right-button pointerdown must not arm a device drag/hold.
Use `crypto.getRandomValues`, not secure-context-only `randomUUID`, so copying
works on ordinary HTTP HA installations too. The command stays in the lazy editor
graph; the fixture stores cloned accepted bodies rather than echoing requests.

Seven #935 mutation definitions protect the native right-button order, copy ACL,
both revision checks, graph validation, paired commit call site and shared file quota. Only static
readiness is run in development; compilation/caught outcomes belong to nightly.
File COPY uses the same upload lock and unchanged byte/count/disk limits as a
normal attachment upload. The negative fixture fills the real quota with small
files; it does not patch a limit or execute a mutant.

The owner-approved editor-performance extension fixes contact-wall invalidation,
not the benchmark. A read-only CPU profile attributed 128 ms of the local decor
terminal update to `syncContacts`, 123 ms of it to `_wallUnionGeometry`.
`test/device-contact-card.test.mjs` failed on the original real floor key for an
ordinary decor resize input, then passed with the contact-only projection. It
also checks real architectural changes, visibility and differing preview/model
records. The 200-face contact-work browser smoke verifies changed decor preview,
exact cancel, unchanged positions/ink and zero wall/contact rebuilds. The
`contact-wall-key-includes-decor` definition is static-only until nightly.
Timing proof remains the unchanged interaction profile and its existing limits.

## Explicit amend provenance (#923)

Stage the intended correction, then use `npm run commit:amend -- --no-edit`.
This replaces HEAD while retaining its message; only `--no-edit` is supported.
It runs the real Git hook with a one-use local context pinned to the repository,
HEAD/parent and index tree. The hook judges the complete proposed commit, not
only the increment since HEAD. Thus both changelogs already in that commit
count, but reverting/removing either required change does not. The index must
not change in pre-commit: inspect/restage those edits and retry if it does.

No automatic detection of native `git commit --amend`, environment-only mode
switch, `--no-verify`, custom hook path or pathspec is offered. The private
context file is bounded and accepted only in this Git directory's private
temporary subdirectory (no symlink); unrelated environment paths are never
consumed. It is consumed once and removed on success/failure, and is a local
invocation contract, not protection against an author who controls their own
Git hooks. Ordinary `-m`/`-C HEAD` new commits and historical CI stay strict.
Merge commits are intentionally unsupported by this command. Root commits use
an empty-tree base. Tests: `node --test test/commit-amend.test.mjs
test/commit-provenance.test.mjs` (real Git, real commit-msg and npm entrypoint).

## External converter (#937)

`scripts/sh3d-convert/README.md` owns the two-source converter build, fixture
provenance, limits and separate-site deployment/rollback. Build with
`node scripts/sh3d-convert/build-page.mjs`; `--check` also checks the generated
canonical wall runtime. It is not a card bundle and adds no YAML parser to the
HACS frontend. Run the named Node, pure/HA backend and offline browser commands
from that README before handing it off. Deploy the accepted payload only to the
existing `/convert/index.html`, preserving the site's extra analytics wrapper,
with a timestamped backup and digest check. No stand restart or release tag.

The #941 URL regression is covered by ordinary negative inputs (signed/unknown
queries and fragments) and a full conversion asserting no sensitive URL in the
document or report. Only bounded literal image selectors are accepted; keep the
standalone artifact rebuilt before the offline browser smoke and site rollout.

The #937 dependency changes the common build fingerprint, not the card's import
graph. Fresh control/task builds measured 2,972,687/2,972,707 raw bytes (different
internal aliases in two chunks); the raw-byte accounting base is 2,972,707.
The 2,000-byte band and other coupling metrics are unchanged. The issue records
the exact control material and comparison; this is not a YAML runtime addition.

## Device-contact evidence (#866)

The frozen designer corpus is `test/fixtures/866-designer`; the original geometry
hash is `1e5076ac432af256ecff2fca0a013a86381cd72e7dff8fa63a726eb309160660`.
`smoke_device_contact_designer` compares actual production paths and core centres
with the frozen renderer, all twelve cases at 32/56/96 reference pixels. It saves
paired PNGs, numerical errors and material/browser metadata under
`artifacts/866/designer`; no per-marker registration or baseline fitting is used.
`smoke_device_contact_walls` uses native camera/drag input for the 35/50/100/200%
matrix and both sides of H/V and ±30/45/75-degree walls. `smoke_device_contacts`
covers actions, cancellation, exact writer/history, static and projection parity.
`smoke_device_contact_work` adds 200 real markers with joined rows and badges:
unrelated HA frames and a changed value reconciled through unchanged public card
options retain the index when its fitted box is unchanged. This does not claim
that the separate HA dependency classifier is itself tested by that options step.
These headless witnesses are not physical GPU or owner field observations.
The normal golden matrix additionally captures the twelve arrangements together
in both themes. Keep its reviewed-source acceptance independent of the numerical
designer comparison; neither reference-only tests nor a new baseline prove AC1.

## Nightly witness repair (#917)

The five failures in run `38853768073` belong to test infrastructure: two
mutation preparations failed TypeScript compilation; the first-gesture branch
lacked a direct ordinary input case; two isolated omissions were masked by
independent healthy protections. Keep those protections in production.
The stale-door definition bypasses immediate cleanup and stale-floor
reconciliation together. The wall-tool witness now calls the compiled real
renderer with a retained valid dialog/cache; mounted paint remains covered by
the other wall-selection browser witnesses. JSON substitution retains
`JSON.parse` typing, and the re-arm substitution keeps callback narrowing.
Ordinary units plus `mutation-gate --check` establish baseline and static
readiness only; actual caught claims require nightly execution or an explicit
owner-authorized exception under PROCESS §2.7.

The ordinary repository metadata unit opts into `verifyPublishedStable` after
a stable ships. If its version is the next cycle's previous stable, it verifies
the reachable exact tag's catalogue and unchanged release body, then the current
authored RU/EN sections as usual. Missing/foreign tags and changed old notes
fail closed. The option cannot be combined with stable publication; the CLI
does not expose it, and a new publication still checks the HEAD catalogue.

## Backdrop terminal witness (#908)

`smoke_grid_scale_invariance` asserts computed cursor and stage class after
trusted CDP touchCancel, at 5 cm and 1 cm grid scale. `smoke_backdrop` adds
move/scale/rotate × touchCancel/Esc/native capture-loss cases, config/layout/
revision/history/write ledgers, immediate restart and normal release/Undo.
Capture release is delivered by Chromium on the next native mouse move; the
oracle requires its trusted lostpointercapture before mouseup. Two completed
animation frames bound terminal observation, with no artificial HA tick.
The independent temporary camera-outline class is not a cursor/tool class.

## Stage dialog input (#900)

`demo/smoke_canvas_surface_gestures.mjs` uses a canonical wall-model fixture,
native mouse selection and capture, intermediate dialog rectangles and the
wire/history ledger. Compile `test-build` before this smoke; the input tool is
`data-tool="wall-thickness"`, while its internal enum remains `wallthick`.
After a synthetic pinch, use native pointer input for the next deliberate action
so the existing compatibility-click barrier can re-arm. No private gesture setup
or camera mutation is needed. The launched pinned browser is attested; this is
headless evidence, not physical touch, HA-shell or owner/GPU acceptance.

## Editor gesture owners and held opening preview (#861)

`physical-body-gesture` and `backdrop-frame-gesture` use bounded purpose ports,
not the card/HostPort; their units cover thresholds, snapping, queued terminal
ordering and state-only reset asymmetry. The existing lazy-runtime AST guard
also rejects retained legacy aliases and eager imports. The common physical,
backdrop, free-walls and partition-opening native consumers were committed
green on accepted source before extraction and stay unchanged afterward.
`smoke_partition_openings_preview` separately observes actual painted leaf ink,
exact hosted door/window identity at two held targets, one visible copy,
untouched other hosts, Esc, release, native Undo and trusted CDP pointercancel.
It records the production write/history path, not field/GPU acceptance. Static
mutation declarations are checked for applicability; execution remains nightly.
The candidate `editor` profile registers common physical/backdrop and the
held-preview ordinary floor; the default native command runs every registered
profile. Its observable floor remains enforced by the automated native runner;
the report does not require a manual owner field/GPU receipt (#929).

## Information-card confirmation and lock information (#849)

`node --test test/device-toggle.test.mjs test/view-action-context.test.mjs`
covers the visible/enabled checkbox projection, exact row resolver, fresh
direction, missing/disabled/secure targets and identity-only context keys.
The existing one-shot confirmation guard is exported by the same context
module and called by the card; executable units cover consume-before-exec,
cancel/replacement, repeated and reentrant acceptance, and a throwing action.
The existing kiosk retired-confirmation mutation anchor follows that helper;
only its static declaration is checked locally, not executed.
`node demo/smoke_info_card_confirm.mjs` enters through genuine long-press,
entity-row buttons, real confirmation DOM, HA config/registry/state events,
Tab/Enter/Space and coarse-pointer taps. It records service target/count and
the actual painted shell's public animation calls. Cancel, retired/repeated
accept, replaced membership and unavailable targets cannot dispatch or animate;
read-only kiosk keeps permitted controls. A canonical door badge opens only
information, while its explicit Unlock button still asks separately. Flat
hit size remains about 15 px; keyboard focus adds no hit-box padding.
`node demo/smoke_info_card_context.mjs` replaces the public HA connection or
user with identical floor/marker/entity ids. The old actual DOM listener is
delivered synthetically in that same frame, before Lit clears the old surface;
this is not claimed as a trusted native click. Neither outgoing nor incoming
authority may receive that command. Accepted foreign pairs and fresh native
confirmation remain positive controls. A changed registry parent alone does
not cancel an explicitly configured, unchanged entity-id target.
Six registry witnesses cover the mounted consumer boundaries; local checks
only validate declarations/anchors, never claim nightly mutation outcomes.
The older `smoke_card_controls` now enters through its actual marker/card and
asserts the exact allowed direction/receiver, not a mandatory generic `toggle`
verb. Its existing forbidden-lock-input probe still records zero secure calls;
the new badge/unlock smoke exercises the sanctioned information/action surface.

## Optimize cleanup consent and authority (#892)

`node demo/smoke_optimize_cleanup.mjs` exercises the actual settings, cleanup,
Apply and Cancel controls, unchanged live room scale/placement and capability
revocation. It proves UI/adoption, not the demo stub's durable storage or Undo.
The real authenticated Optimize/Undo websocket tests own backend pair/CAS,
one-deep restoration and durable-intent recovery.
Their fresh authenticated reader also verifies the canonical stored pair and
existing `can_optimize_undo`/`undo_kind` handshake before GUI-fixture claims.

`node demo/smoke_optimize_context.mjs` adds actual disabled retained-only action
discovery, a real General settings Save held at public `config/set`, Apply
waiting for that pending writer, a current registry-owner arrival and full ↔
partial registry updates delivered through the public HA fixture event bus.
Every changed proof drops deletion consent without a write. Separate held Apply
replies preserve an independently accepted foreign pair for connection and
same-connection user changes; an ordinary state frame still adopts its own
confirmed result. Before the claim fix the ordinary probe failed 2/10 checks:
missing disabled control and an old user response replacing the new user's pair.
The same smoke then applies through the GUI, remounts a new card against the
same canonical fixture store, reads both saved bodies, uses the actual GUI Undo,
and cold-remounts again to read the whole restored record and renewed diagnostic.
Its scoped paired wire adapter mirrors existing response/CAS/snapshot fields;
it is explicitly synthetic and does not replace real HA backend evidence.

The preview stores an existing `_configWriteGuard()` closure in its memory-only
source. Both the pending-write barrier and post-response adoption consume that
original claim; recomputing a current claim cannot renew the old confirmation.
No second context owner, persisted field or Copy space policy is introduced.
Registry declarations are checked statically; development never runs mutants
or claims their nightly caught outcome.
The AC3 classifier/optimizer unit uses exact storage-canonical coordinates and
two floor scales. Its largest deleted-floor displacement disappears only when
that record is selected for removal; every remaining displacement still lies
under the final candidate's reported maximum.

`smoke_optimize_coincident_partition` waits for the real legacy-body migration
write after its original Undo oracle, before requesting an independent second
preview. Without that observation, the new source barrier correctly refreshes
the stale preview instead of sending a second Optimize, and the old consumer
mistakes an unoptimized partition for the intended canonical Thickness target.
The ordinary unchanged consumer passes on accepted `dced034b` and fails on
`70cd8b76`; the natural `waitForWrites` adapter restores all ten original
expectations and adds explicit second-Apply/canonical-host preconditions.
It does not flush/cancel the writer or weaken the pending-write negative above.

## Editor reference/retirement witnesses (#893)

After `npm run bundle:sync`, `npx tsc -p tsconfig.test.json` and
`node scripts/fix-test-build.mjs`, run:

```
node --test test/device-icon-roster.test.mjs test/device-drag-retirement.test.mjs test/device-spacing.test.mjs test/wall-end-align.test.mjs test/live-editor.test.mjs
node demo/smoke_editor_guides_lifecycle.mjs
node demo/smoke_wall_guide_ownership.mjs
node demo/smoke_align_guides.mjs
node demo/smoke_device_equal_spacing.mjs
```

The first native witness compares references to real painted icons, toggles LED
replacement and retires both a pending first move and an already painted guide.
Its real mouse move is trusted; hidden is emulated and pagehide/pageshow are
explicitly dispatched, not real bfcache/device acceptance. It checks the entire
layout, DOM rollback, capture/guides, zero writes/history/services and immediate
fresh keyboard/drag, plus a released-but-unacknowledged write control.
After the real Enter/open and Escape/close positive, an explicitly synthetic
late click retains the cancelled physical pointer id. Read-only observations
first prove shared click/drag/hold suppression is clear, so that negative
isolates physical-pointer retirement rather than another activation barrier;
it does not classify a compatibility MouseEvent after new keyboard intent as stale.
The frozen #362 source contract checks the exact mode refusal precedes
`stopPropagation`, not textual adjacency: #893 inserts another read-only refusal
between them. Its remaining CSS/input assertions stay intact, and the interval
also refuses action side effects. This adapts a structural fixture, not product code.
The Walls witness records actual HA config writes and exact off-grid preview
identity for H/V and 0/20 cm walls, with endpoint/axis/closure/Shift/ambiguous
negative owners. A trusted CDP pinch reaches 50%/200% in light/dark themes;
four stage PNG observations are in `artifacts/issue-893/`, not accepted baselines.
The original alignment/equal-spacing assertions remain unchanged. Static
mutation readiness is not mutant execution or physical/GPU acceptance.

## Shared signal settings witnesses (#876)

`test/signal-visibility.test.mjs` executes the global/local/YAML compatibility
matrix and read-only bounded policy. `demo/smoke_signal_visibility.mjs` uses
actual form inputs and the fixture's config event bus with independent full,
static and kiosk cards. `demo/smoke_signal_visibility_lifecycle.mjs` holds an
actual queued write across closing/reopening and a lazy entry across permission
revocation; no private configuration/draft assignment seeds its result.
`demo/smoke_signal_visibility_ui.mjs` measures the new targets and exercises
native Space/Tab/radio-key dispatch in RU/EN, 360/1280, both themes.
Strict backend and actual full/space/plan-only transfer witnesses are named
`issue_876`; the schema manifest is regenerated with `scripts/dump-config-schema.py`.
The local radio group alone has 44px labels; existing radio groups are unchanged.

## Pre-release subscription ownership fix (#890, PROCESS §11.4)

`node demo/smoke_config_authority.mjs` explicitly pushes the retired A server
through its actual event bus after a held A save, while B's own config/layout
responses remain pending. B uses an isolated bus rather than copied A listeners.
Before the early callback fence, this exact command fails
`lateAEventDoesNotStartConfigOnlyReadInB` and `bReceivesItsOwnAuthority`: a second
config-only B read cancels the mandatory pair. The oracle now includes B layout
revision 2, not just config revision/title. Both View and editor queue controls
remain in the same smoke. No fixture-wide #896 code, post-await trail guard,
schema, ACL, timers, baselines or budgets are changed by this repair.
Positive controls return from accepted B to A and deliver a current A server
push after A→B→A plus the next public HA frame. They do not certify readiness
in a coalesced transition with no subsequent HA frame. The old subscription
slot is reset on authority change so the accepted-load path renews ownership.

## Kiosk carousel and action context witnesses (#846)

`node --test test/kiosk-carousel.test.mjs test/view-action-context.test.mjs`
uses injected clocks and exact canonical carriers: deadline independent of cycle,
held surface/pointer, pause from close, no catch-up, inactive configuration,
dispose/reconnect and deleted/moved/rebound target refusal. Shared reload-hold
coverage remains in `test/version-recovery-card.test.mjs`.
`node demo/smoke_kiosk_cycle_context.mjs` enters through real DOM and HA config
events. Playwright's boundary clock is installed before the reloaded document
creates timers; it does not write private deadlines or open fake private dialogs.
Native oracles cover room fit/idle reset/persisted arrival, dialog keyboard/wheel,
pointer hold, navigation closure, stale door/marker refusal, exact single current
dispatch and detach/config-disable. The old danger-confirmation lock fixture now
opens a canonical door through its actual badge and accepts/cancels the actual
dialog, instead of inventing an unowned `_openingInfo`.
No new config fields, migration, private test writes or budget relaxation.

The #949 startup barrier `demo/helpers/kiosk-viewport-ready.mjs` runs before
freezing the clock, while native CSS can still complete. Hiding the kiosk header
can trigger `.stage.hpsettle`'s 250ms height transition after boot. Jumping JS
time to the 60s idle deadline does not advance that CSS timeline; a legitimate
ResizeObserver callback can then cancel the fit being tested. Readiness checks
height animation state, positive live/accepted size, fonts and pending Lit/refit,
not the expected zoom. Its 5s bounded failure prints the actual setup state.
`test/kiosk-viewport-ready.test.mjs` covers running/paused animation with equal
boxes and queued refit; the original 60s/90s/300ms assertions remain unchanged.
Evidence and retained red outcomes: [kiosk clock diagnosis](analysis/949-kiosk-clock-evidence-2026-10-17.md).

## Synthetic QA boundary (#896)

`demo/srv/fixture-state.js` is an in-memory wire fixture, not a backend validator.
`config/set` and `layout/set` replace cloned whole documents with `expected_rev`
CAS; `layout/update` takes the actual `{device_id,pos}` message (no revision
field), replacing only that position; `layout/delete` takes `{device_id}` and
returns `rev:null` for a missing key. No-op writes do not create revisions.
Config/layout revisions are independent and refusal does not mutate either.
Server pushes still publish normal events. Service-state updates preserve the
current HA connection/user/wrappers, while `__serviceCalls` records ordered
cloned actual arguments across successive `__mkHass()` instances. Synthetic
on/off semantics are unchanged; this does not emulate HA domain state machines.

Static golden/docs capture installs a temporary recursive shadow-root style
observer with one owned constructed stylesheet, never a DOM node that Lit could
adopt as its root end anchor. Membership is restored after a lazy Lit first
commit; reset removes only that sheet, preserving current component sheets.
It restores `attachShadow`, styles and capture clock/CSS overrides in
`finally`, including stability-only and failed captures. This is harness-only;
the media modes observed before preparation are restored too, so capture's
reduced-motion setting cannot leak into a subsequent ordinary transition test.
dynamic transition tests use ordinary CSS. `captureScriptSha256` now hashes
canonical-LF capture code plus `browser-args.mjs` and its literal local module
dependencies; those arguments also enter source/visual fingerprints. This is
not a hash of the browser: launched binary/pins keep their independent
attestation. Legacy receipts remain readable but cannot authorize proof reuse
without the current identity. Re-capture/accept before release through the
normal process; do not rewrite image/baseline manifests to make identity green.

## View hold and page lifecycle witnesses (#847)

`smoke_view_hold_lifecycle` uses cold View, trusted CDP touch and real mouse.
It observes light state rather than wrapping the fixture's replaceable hass,
finds the actual invisible 44px target edge for a <4px mouse release, and uses
iframe focus to produce actual window blur. Hidden visibility and pagehide /
pageshow(persisted) are explicitly emulated/dispatched, not real background or
bfcache acceptance. Capture loss is named as dispatched when native release is
unavailable. The positive room-name tap observes Chromium's trusted implicit
loss after up; Android delivery remains a field hypothesis, not a headless claim.
Pure units execute the hold clock/generation and shared subscriber disposal;
registered mutants are checked statically and executed only by the nightly job.
Space-change probes keep mouse and touch down for 750 ms after both hash and
facade navigation. They observe the trusted contact's pending owner before
navigation and its immediate teardown on the actual floor change, then check
inertness before release and the first fresh native tap on return. Mouse has no
implicit capture; observed absence of terminals excludes an independent up/loss.
`_commitSpace` currently cancels twice: its explicit hold cancel and its
unconditional `_closeInfoCard` → `_interruptViewGesture` path. The compound
registry witness disables both only inside that navigation boundary (the close
becomes conditional on an already open card). Removing just the first cancel
was equivalent and cannot prove it individually necessary (CODE-REVIEW-847-r2
M1). Author checks applicability only; execution remains nightly-only (#709).

## View entry and document recovery witnesses (#894)

The full WSL capture exposed an inherited block line-box offset in the new
44px Area button: its inner `ha-icon` must keep the old inline-flex host.
`node demo/smoke_room_link.mjs` now measures the shadow SVG, not only the outer
label and metric boxes. Before the fix all four DPR/theme cases fail painted
icon parity (2.64–3.64px vertical drift); the touch floor remains unchanged.
The new browser mutant is declared only; catching it remains nightly evidence.

`smoke_view_entry_recovery` uses accepted config events and trusted keyboard/touch
on RU/EN 360/1280px cards; an injected queued old lock target tests dispatch
independently of Lit reusing a button with a new listener. Current rebound names
are checked before that injection; accepted #846 closes the stale-action popup,
so the next current action reopens its real badge instead of changing the guard.
The inherited carousel context smoke closes that now-current popup with Escape
before the next fresh-badge case. Its document-reload witness seeds #896's
cloned wire store constructor rather than reassigning the old CFG constant.
It also retains the
room-name mouse activation through its stable shared pointer owner.
`smoke_room_link` retains View/Plan name and metric geometry: the 44px Area
hit box extends away from the name without enlarging its inline footprint.
Native post-release implicit capture cancellation of the older delayed touch
room-fit remains a separately recorded lifecycle finding, not an #894 fix.
`smoke_esc_dialogs` opens the canonical current badge before its Escape oracle.
`smoke_warm_view_marker`
opens and edits a genuine View draft, replaces its element and delays/fails only
the chunk transport. It checks visible draft, Close/retry, write rights,
disconnect and newer intent with no hidden marker or extra acknowledgement.
It also replaces the HA account during the delayed chunk to prove ownership.
`smoke_kiosk_viewport_recovery` wheels and pans the actual stage, advances only
the existing deadline and lets the browser really reload the document. Its boot
fixture changes card options/server replies, not restoration fields; fixed,
single and deleted floors, active carousel and matching-version controls remain.
Shared full/preview/static group parity includes device: as well as entity:.
Golden intent is named opening/group presentation and the 44px native Area
control footprint; only reviewed artifacts may update the affected baselines.
The four new expensive guards are declared for nightly mutation execution only.

## Optional View runtime recovery (#848)

`view-runtime-boundary.test` proves bounded retries, warm factory sharing,
retirement before construction, the existing discard decision and visible
in-flight recovery. `version-recovery.test` exercises terminal chunk failures
against every existing safety category and a claim already consumed by a
version mismatch, including multiple hosts and remounts. Unknown entry builds
cannot acquire an automatic failure-reload claim.

`smoke_view_runtime_recovery` controls real root/dependency404 responses on the
production module graph, not private runtime fields. It observes fresh nonce
requests and rejection cached in the browser module map; RU/EN360/1280 controls
use actual keyboard/touch and retain a notice beyond the old toast lifetime.
Summary's root has a named entry and its editor-shared picker/icon leaves stay
in a separate lazy shared chunk: otherwise Rollup replaces its public exports
with internal namespace aliases, breaking the raw URL import. The retry
URL injection and its missing/duplicate roots are unit-tested by bundle-assets.
No full release or GPU acceptance is claimed by focused headless evidence.
The final integration uses accepted #894, preserving both warm marker/opening
reconciliation and the existing shared version-recovery controller.

`smoke_view_runtime_dirty_reload` uses a real dirty marker form. Native modal
input keeps the background Reload inert; Escape and the actual Cancel retain
the exact draft, while explicit Discard closes it without saving. Only then
does the reachable Reload perform one real document navigation. This is not
claimed as GUI execution of the defensive reload/discard resume branch (which
has its own unit proof). The callWS observer belongs to the pre-navigation
document only: zero observed writes and no draft before navigation prove the
discard, not all writes of the new document or durable real-HA persistence.

`smoke_view_runtime_kiosk_recovery` refuses the actual live root and its one
nonce retry on an enlarged cycle-zero kiosk. A real held pan still blocks
recovery after the normal pause expires; release allows exactly one real
document reload with the exact floor, zoom and pan. Browser-native navigation
history and a lost document-local sentinel observe that boundary: Playwright's
clock replaces performance entries and keeps its mocked timeOrigin across
documents. A second terminal failure and warm remount retain the same consumed
build/session claim and persistent manual Reload, with no new automatic attempt.
The manual notice calls `_reloadDocument()` through its dirty-navigation guard;
the automatic controller keeps #894's `_reloadDocument(true)` camera memo.

The resumed #848 unit diagnosis on accepted `3e10b8ad` found 20 failures:
19 shared-summary preference regressions and one stale exact shell anchor.
The shared preference reader keeps the established `location.pathname` key;
it must not introduce a `/` fallback from a detached synthetic host. Existing
Masonry, saved scale, lifecycle and measured-layout expectations are unchanged.
The shell anchor now requires the recovery notice between the retained body and
the existing version/danger siblings, preserving their exact order. Focused
summary runtime/presentation, optional-space shell, loader, version and boundary
tests pass 77/77. Final mandatory core/native gates and the accepted #894
enlarged-kiosk coupled regression are separate evidence, not implied here.

The next mandatory core caught the after-build summary-root assertion: Rollup
places the implementation in the named `summary-panel-runtime-entry-*` chunk,
not the old `summary-panel-runtime-loaded-*` path. The existing lazy-runtime
contract recognizes those two concrete root forms while retaining its full
no-summary-in-initial-View and action-free form assertions. The recovery smoke
also seeds Zigbee settings before #896's fixture-store clone is constructed;
changing the detached `CFG` object afterwards is not a server update. The
corrected native run passes all 53 original checks, including real root and
dependency failures, same-build retries and the detached/current warm controls.

The focused native is green (53 assertions): real root404 retry, dependency404,
foreign fingerprint, aggregated double-click and warm-instance cases execute.
Its 360px document uses an actually responsive host rather than cropping the
demo's fixed 780px card. The detached witness drains already queued initial
Lit/header work while the actual imports remain held; only then does it release
the roots and require no construction or late host update. Neither correction
changes a production guard, baseline, budget or expected final behavior.

### Summary loader cleanup (#909)

`summary-runtime-loader.test.mjs` keeps all five warm/dedup/retry/reset and
retirement cases on the live `create()`/`ensure()` and `ViewRuntimeBoundary`
paths. The shared boundary's existing tests still verify synchronous warm
adoption and stale-context refusal. The unchanged summary native consumers
verify first/warm/reconnect behavior; cleanup adds no new runtime wrapper.
The existing `summary-runtime-attaches-after-first-render` declaration now
targets the actual boundary warm lookup and its current unit guard, not the
removed attachment method. Static readiness is not mutation execution/caught.

## Config writer authority witnesses (#890)

`smoke_config_authority` exercises a real GUI Save followed by public setConfig,
fixed/default floor changes, storage quota failure, cold cache, device-editor
acknowledgement and a delayed write across foreign HA intake. Repeated same
connection assignment is the preserving control. `smoke_vacuum_route_draft`
plants a >9-decimal transform tail and an independent deferred unknown-field
edit before the real route Save, so an omitted canonical attempt cannot hide
behind an already-normalized fixture. Unit tests cover accepted-cache identity,
per-ID acknowledgement, distinct RU/EN errors and context generation. Registered
mutants run nightly only; ordinary development checks anchors and negative cases.

## Focused golden repaint (#881)

Owner option b keeps all Chromium arguments unchanged. The golden runner uses
`captureGoldenFrame` only to repaint the root background of the focused
battery/Zigbee overlap scene for two frames, restore its exact inline value
and priority, and wait two more frames before the normal screenshot. Other
scenes bypass the barrier. Behavioural Node tests cover scope, frame order and
restoration on failure; the registered mutants run only in the nightly gate.
The single baseline is accepted from a reviewed full CI artifact, with the
original 10/0 threshold and all other PNGs retained.

## Nightly witness repairs (#887)

The 2026-10-14 mutation run exposed three different failures. Vacuum certificate
fixtures now include gentle turns without the separate sharp-turn shortcut;
each accepted chord checks finite, monotone progress as well as distance. A
perpendicular-distance-only oracle cannot certify temporal order.

The shared-room-cut mutation must replace both own-carrier lookups with the
first face's default. Removing only `carrier?.cm` is equivalent on this path:
`_wallSourceCmAt(midpoint, ...)` reads the same saved carrier. The existing
native room-split smoke already checks divergent 0/15/25 cm profiles.

The marker Save mutation supplies the introduced `forgetMarkerBaseline`
import as a second patch, so a missing symbol is not mistaken for an assertion
failure. Cheap definition tests retain these constraints. Development runs
ordinary tests and `mutation-gate --check` only; applied-patch compilation and
actual caught verdicts remain the nightly workflow's responsibility. Product
geometry, marker behaviour, limits and schemas are unchanged.

## View/editor permission boundary (#844)

`demo/smoke_view_edit_permissions.mjs` starts without editor preload, counts
the runtime named in the real bundle manifest, uses HA `config/get` responses
for roles and holds the actual chunk for revocation/latest/disconnect races.
Fixture state arrives through `__hpTest.setServerConfig`, including its cache;
an uncached private config assignment followed by `setConfig` tests a stale
fixture, not acknowledgement. Warm-restore fault injection uses a draft opened
by the real footer; ordinary entries/mode changes use UI. The standalone
runtime unit independently proves no acknowledgement under a denied host port.
The HA harness test uses actual `config`/frontend `get_panels`: plan writing
does not grant HA administration. No backend ACL, config schema or i18n changes.
Golden kiosk frames intentionally lose the Area icon; capture is evidence,
not permission to accept a baseline or claim owner/GPU acceptance.

## Full vacuum paths (#872)

Compile `tsconfig.test.json` then run `test/vacuum-path-geometry.test.mjs`
for independent finite-segment/ordered error, 100k budget, affine and curve
oracles. `tests_backend/test_vacuum_paths.py` exercises the actual pure codec;
`test_ha_vacuum_paths.py` uses real HA EntityComponent, executor, Store and
collector owners with offline providers/clock. Its real camera import needs
the pinned HA camera dependency `PyTurboJPEG==1.8.3` in the HA harness venv,
installed by `tests_backend/requirements.txt` locally and in CI. The pin comes
from that HA release's camera manifest; an importable core alone does not
install every optional integration codec. Do not stub/skip the public camera
import to make collection green.
`demo/smoke_vacuum_path_fidelity.mjs` observes the card WS/render boundary,
native endpoints/gaps, stale-quality diagnostics and shared render quota;
`smoke_vacuum_camera.mjs` remains the native pan/pinch ownership witness.
The owner's personal map is never committed. Static mutation readiness does
not mean mutants ran. Installed-version snapshot and voluntary owner/GPU observations
remain separate from synthetic and upstream evidence. Canon: `VACUUM.md`.

## Ordinary history refusals (#883)

#891 extends this boundary to strict physical writes. `PhysicalWriteHistory`
tracks command object identities against the earliest pending baseline;
rejection restores physical fields only and rebases independent presentation
snapshots containing that carrier. Never substitute a name/floor sweep or
`clear()`. A new pending baseline is not owned by a delayed refusal.
`wall-node-refusal.ts` is shared by native drag and history; processing failures
have `node_move_backend_unavailable`, not a forged invalid-geometry verdict.
Focused witnesses: `node --test test/geometry-history-refusal.test.mjs
test/node-refusal.test.mjs`, `node demo/smoke_wall_chain_history.mjs`,
`node demo/smoke_node_history_context.mjs`, and `pytest
tests_backend/test_ha_websocket.py -k 'issue_891 or issue_803'`.

The node-history smoke's two-Undo toast witness (#1030) observes the first
rendered `history.undone` message before sending the second native key. The
toast presenter intentionally replaces a pending announcement before its next
animation frame; a MutationObserver cannot recover a first message that never
entered the DOM. This is a visible-result barrier, not a sleep or a wait for the
config write. The wire order, exact snapshots, both message texts and original
assertions remain unchanged; do not add retries or queue notices in the product
to satisfy the old observer's assumption.

`src/geometry-history-step.ts` is one ordinary Undo/Redo attempt over the real
`CommandStack`: `_applyGeometryState` returns `true` or a reason; `retry` and
`pinned` keep the command, `space`/`state`/`geometry` remove exactly that object.
`test/geometry-history-refusal.test.mjs` drives the real runtime, stack, adoption
and wall model; only the HA wire, card shell (fixed floor) and physical verdict
are substituted. The `#883` block of `test/command-stack.test.mjs` pins identity,
order and the no-restore rule. The native `demo/smoke_geometry_history_refusal.mjs`
creates every step by mouse, pins a floor with a live public `setConfig` and
injects only the history-boundary physical verdict (unsafe or a throwing
checker). It removes the isolated page's warm cache before `setConfig`;
otherwise the cached older revision is repainted over the session's own accepted
writes and the next write conflicts (pre-existing, outside #883). Missing-space
and corrupted-snapshot refusals are unreachable from the UI and stay unit-only.
`origin/dev` fails both witnesses (the smoke shows the stack going 2→0). Mutation
anchors are checked statically; each was caught by hand (patch → guard → rollback).

## Editor draft ownership and failed-chain exit (#851)

`src/editors/draft-close.ts` fences each opening; `draft-actions.ts` connects
existing discard copy to marker/room controls and editor navigation.
`room-save.ts` reuses config-adoption's optimistic boundary and closes only its
own accepted form. `editor-chain-exit.ts` revalidates floor/mode/geometry/session
after confirmation; leaving a refused chain never deletes stored partitions.
The native witness is `node demo/smoke_editor_draft_exit.mjs`; set
`HP_SMOKE_WIDTH=390` for its touch-enabled mobile variant. Use
`demo/verify_ha_dialog_discard_recovery.mjs` with the offline authentic HA fixture
to verify nested modal reopening **and editable focus**, not only visibility.
Its component evidence is not live HA authentication or owner/GPU acceptance.
The baseline `ece52121` fails the native dirty new-device Escape before fault
injection; session guards have static mutation definitions, not local caught proof.

## Vacuum camera attachment (#871)

`test/vacuum-view.test.mjs` covers full affine inversion, invalid matrices,
robot pairing, recovery and read-before-write ordering; `live-viewport.test.mjs`
retains one camera and bounded clip rebasing. The pinned native
`demo/smoke_vacuum_camera.mjs` records every held pan/pinch/zoom frame in
Flat/2.5D View and kiosk, HA telemetry, source subpaths, render/resource counts,
hide/static/disabled/route retirement and real mount/disconnect recovery.
Raw evidence lives in `demo/out/vacuum-camera-871/frames.json`, not in git.
The old dev witness gave 93.41px path and 186.80px tip displacement; a settled
frame alone concealed both. Existing multi-floor and live-pan coverage are
companion gates. Mutation anchors are checked statically; execution belongs
to the night. Optional real-GPU owner observations remain separate from headless green.
No source/route/calibration/schema, smoothing or UI settings change.
The raw bundle ratchet deliberately moves from 2,803,783 to 2,806,821 B
(+3,038 B) for the typed inverse/batched DOM guard and bounded inherited paint
window; only `bundleBytes` changes. Initial View is 304,498 B gzip, inside the
existing 320,000 B budget and +2,000 B ratchet band. Bands and all other
monolith baselines stay unchanged; rationale is recorded in issue #871.

## Authoritative layout fixtures (#880)

`smoke_grid_snap.mjs` waits for both serialized config writes and debounced
point-wise layout writes before replacing server fixtures. It waits again after
config adoption, which can schedule Area-relocation writes. A late `rl_r1`
receipt previously advanced the card from fixture revision 9 to 10 before its
reload. Revision checks stay strict; the three Optimize fixtures also assert
exact layout content. No product transport/timer is changed.

`node --test test/hp-test-write-barrier.test.mjs test/hp-test-facade.test.mjs`
covers independent queues, chain replacement during rendering, bounded waits,
rejection and disconnect without clearing pending state.
`node demo/smoke_layout_fixture_barrier.mjs` holds a receipt after a native label
drag: the no-barrier negative detects fixture content loss even when its
revision is accepted; the positive waits for the receipt and delivers once.
Run it with `node demo/smoke_grid_snap.mjs` after build/bundle-sync; repeat the
grid smoke sequentially and concurrently to exercise the fixture boundary.

## Intentional room placement and discovery (#879)

`room-device-discovery.test.mjs` covers finite capture, ambiguous/stale rooms,
old attention IDs, rejected and delayed actual serialized writes.
`smoke_room_device_discovery.mjs` observes native ordinary/batch/multi-room
Save, device dots and catalog rows, atomic config payloads, cancellation,
pre-debounce Undo, server rejection/retry, later discovery while Save is
pending, reload and a read-only second card despite layout-write failure.
The Undo timing injection is a labelled negative probe, not native-input evidence.
Compile `tsconfig.test.json` and run `scripts/fix-test-build.mjs` before the
smoke. Existing new-device and Area-relocation smokes are companion witnesses.
The mutation registry guards runtime capture and atomic-payload wiring.

## Empty-screen backup entry (#875)

`smoke_empty_backup_import.mjs` starts a genuinely cold document with an empty
authoritative config, then uses native filechooser/keyboard/dialog controls.
Its synthetic HA transport logs preview/apply and forbids config/layout writes;
it does not claim backend validation or atomicity. It covers cancelled and
replaced previews, permissions, missing-content confirmation, conflict,
full/space/plan-only/empty results, locales/narrow layout and lazy retry.
Keep the chooser before async runtime loading, snapshot the File and reset the
input before awaiting. The operation epoch and focus callback are transient;
close never cancels an Apply transaction already sent to the server. Compile
the test build for `backup-import-intent.test.mjs`; the existing lazy-editor
and backup-transfer smokes remain required neighbours. No model migration.
The r1/M1 neighbour keeps a settings preview pending on a populated plan and
dispatches both real Add space DOM handlers (tab and narrow header menu),
requiring a visible create form, no writes on Cancel and the surviving import.
This is a labelled background-handler probe, not native input through a modal
scrim. The opposite empty-screen probe retains mutual exclusion; the former
unscoped guard fails the populated tab assertion before the fix.
After rebasing onto dev `75aafe0f`, source builds measure initial View
305216 -> 306032 B gzip (+816), lazy editor 258523 -> 258740 B gzip (+217).
The initial rolling ceiling is recentred to fact minus 1000 (305032 B),
retaining the 2000 B band, absolute 320000 B wall and low-headroom warning.
The raw bundle baseline records the measured 2819806 B; coupling baselines
and lazy budgets are unchanged. This is accounting, not a performance gain.
The owner separately approved the runtime line ceiling 12030 -> 12107 after
the rebase (dev 12074 + 33 existing #875 integration lines). The M1 fix itself
adds no runtime lines. The 50-line core band is unchanged; no unrelated import
refactor is included solely to satisfy the combined post-rebase ceiling.

## Composite room closure (#874)

`wall-face-room-split.test.mjs` preserves the reported floating-point geometry
without private HA data and exercises containment, complementary/equal faces,
islands, self-contact and ambiguous cuts. `smoke_wall_face_room_split.mjs`
uses native drawing and dialog buttons, then checks actual config/set results,
atomic Undo/Redo, 0/15/25cm carriers, residual IDs/openings, synchronous refusal,
server rejection and config-update invalidation. Compile `tsconfig.test.json`
and run `scripts/fix-test-build.mjs` before this smoke; the mutation registry's
compiled smoke guard does this explicitly. Race/overlap injections are labelled
negative probes; they are not happy-path evidence. Existing lineage and overlap
smokes remain companion witnesses. No generated bundle is committed here.

## Connected-floor Select node movement (#834)

The 10.10 nightly (#864) failed at 52/110.260 ms CPU/input-to-paint p95; one
diagnostic attempt failed again at 48.9/105.378 ms. These were real budget
failures, not the schedule warning. The unrelated stale docs fingerprint was
updated by the canonical derived bot with 11 byte-identical witnesses.
Select now groups uncovered wall strips before clipping to their common
centre, while leaving room assembly and all mandatory proof stages unchanged.
`wall-node-edges.test.mjs` compares actual filled regions, holes and facade cuts,
counts delegated sweeps, injects every grouped-stage failure and verifies
individual fallback isolation. Failed grouping replays the entire old phase.
The room-group/tree drafts were discarded because they reduced baseline reuse;
timing workloads, input clocks and 50/100/150 ms budgets are unchanged. Local
reports are diagnostic; final Linux CI is the acceptance witness.

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
inputs. 32 fixed probes (#952) include 0.1 ms clock-quantisation bounds, require at
most 1 ms uncertainty, and must remain consistent with independent post-gesture
probes; the complete fixed series runs regardless of early precision, without
adaptive extension or retry-until-pass. Unavailable calibration stays FAIL with
gesture/phase, all received raw probes and precision/count diagnostics; invalid
transport retains partial evidence. The original eight-probe CI failure is not
retroactively accepted, and different probe-count protocols are not pooled in
the fixed-series comparison. Native CDP events use their own
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
a compositor presentation timestamp. The budgets are 55/121/150 ms: input-to-paint p95 was raised from 100 to 110 ms (#850) and then main-thread and input-to-paint by 10 % (#898), both by owner decisions of 2026-10-14.
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

#845 makes this matrix mandatory in the existing `geometry_parity` job:
`npx tsc -p tsconfig.junction-parity.json && node scripts/fix-test-build.mjs`,
then both `junction_parity.py` and
`wall_node_parity.py --build-dir=test-build/junction-parity`. Missing build,
Node or loader material fails, never skips. The matrix adds pair/T/2×2-X/L,
T-partition and shared-opening room plans on/off grid, complete candidate and
cross-idempotence comparison, and exact Undo/Redo with browser `before_space`.
`test/fixtures/845-wall-identity-parity.json` is the common D1–D6/number witness.
`test/wall-identity-corpus.test.mjs` and its read-only helper enumerate nested
JSON configs, exported demo factories and the actual stand CFG; the pre-change
`845-wall-corpus-identities.json` passport records membership/input identity,
catalogue order and room/opening references. It cannot auto-accept new configs.
The same corpus is compared in Python. Incomplete current-model test fixtures
pin only fresh UUID entropy in each runner; product randomness is unchanged.
Source RED probes, independent negative corpus probes and static mutation
readiness are distinct from nightly mutant execution. No snapshot/format/gesture
change and no headless claim of live HA or real-GPU acceptance.

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
20 276 B gzip guard (`node scripts/node-editor-bundle-budget.mjs`; 18 KiB until the owner's +10 % decision of #898); it does not
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
The lazy Optimize boundary also shares wall-merge, coincident-partition and
device-contact collision leaves (#866); none may introduce a static import
back into the editor runtime. The retry-URL build plugin checks the emitted
chunk's actual export metadata for the fingerprint, language runtime and
constructor before injecting its opaque URL; mangled internal aliases fail
the build rather than silently breaking the second network attempt.

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

## Support diagnostics v2 (#942)

Measured accounting after integrating #918/#919: the dev baseline 355 port members,
5425 host references and 2,993,396 emitted bytes becomes 361 / 5463 / 3,014,526 B.
This includes the new runtime-source/display ports of #918/#919 and #942's four diagnostic adapters;
the shared batched reader keeps #918's source, display priority and counters.
The additional references are read-only, opt-in
diagnostic adapters to existing accepted presentation/overlay/panel decisions;
there is no new delegate or background collector. A separate lazy diagnostic
chunk and four lazy translated coverage dictionaries account for the new bytes.
The preview parser was extracted from the editor rather than growing its core.
The accepted frame's immutable source/runtime/server cut is used even while a
newer WS event is awaiting paint. The measured baseline is updated in the same issue/commit; ratchet bands,
core-file ceilings and actual entry/chunk budget limits are unchanged.

API1 is not the package schema: config/get advertises `[1,2]`; old requests
default to frozen v1. New frontend + old backend stays visibly limited v1;
explicit malformed/future v2 fails, never silently downgrades. Persisted model
and export schemas are unchanged. Inventory and exact tests:
[SUPPORT-DIAGNOSTICS.md](SUPPORT-DIAGNOSTICS.md).

The stdlib schema source is
`custom_components/houseplan/support_wire_schema.py`; its relay copy must be
byte-identical. Update both in one task and run the actual validator/HTTP tests,
not just a source comparison. The browser v2 smoke bridges synthetic form input
to the actual pure Python builder in an isolated package namespace; it needs
only stdlib Python, not HA or pip on browser CI. LED inventory/counts were
relocated unchanged to a shared pure module to avoid importing validation
dependencies just to count strips. The four responsive screenshots are ignored
artifacts and require visual inspection. No private support report is a fixture.

Relay deployment is a separate post-S8 step: staging in discard mode first,
then backed-up prod, preserving env/spool/rates/retention. Do not release a
v2-capable HACS package before the issue records deployment proof. See
[relay README](../scripts/support-relay/README.md) for the compatibility,
isolation and rollback sequence. This task does not itself authorize a HACS tag.

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

## Zigbee mapping reuse witness (#906)

For incomplete-data explanations (#1005), run
`node --test test/zigbee-topology-diagnostics.test.mjs` after compiling test-build,
then `node demo/smoke_zigbee_incomplete_reasons.mjs` after `bundle:sync`.
The unit matrix executes all warning/unknown-route categories, exact mapping,
failed-stage compatibility and deduplication at the 1000-node/6000-warning bounds.
The pinned-browser witness opens actual General Settings, drives public HA/config
inputs and provider events, and measures the native spoiler, status typography,
light/dark narrow wrapping, escaped labels, topic separation and owner retirement.
Its fixture counts real read/scan RPCs; opening details never starts a request.
Screenshots and structured observations go to `artifacts/zigbee-incomplete-1005/`.
Keep `smoke_zigbee_topology_job` and `smoke_settings_navigation` as neighbouring
action/dirty-form witnesses. Mutation declarations are checked statically only.

`test/zigbee-mapping-memo.test.mjs` executes the compiled overlay render and its
post-render lifecycle with an ordinary provider fixture lacking direct device
IDs. A Proxy counts real registry enumeration, not elapsed milliseconds: the
unchanged-code witness repeated four enumerations after an unrelated update;
the semantic memo repeats none, with the exact placements and routes preserved.
The unit matrix includes limited revision0 record replacements, entity-only
discovery, marker binding/visibility/floor/access, provider revision and A→B→A
owners. HA registry/marker collections use immutable identity; copied scalar
metadata prevents a reused mutable wrapper from concealing an access change.
Native Zigbee hover/resize remains the browser geometry witness. Mutations are
declarations only outside the nightly executor; use `mutation-gate --check`.

## Local contour in 5 minutes (локальный контур за 5 минут, #633)

For the enable-and-refresh settings flow (#1031), run
`node --test test/zigbee-topology-action.test.mjs` after compiling test-build,
and `node demo/smoke_zigbee_enable_refresh.mjs` after build + bundle sync. The
smoke uses the real General Settings owner with delayed/refused CAS replies;
it checks save-before-load, clean/dirty baselines, retired contexts, keyboard
activation and translated 360px layouts. It uses synthetic data, not a live HA.
The disconnect case first proves a live metadata lease, then requires both
metadata and runtime subscriptions to stay released after the held save resolves.
Each reload awaits the lazy editor runtime before opening settings; the harness
two-frame `settled()` wait alone does not guarantee editor readiness on a cold load.
After rebasing onto the #1011 semantic hooks, both the stable action/field hooks
and toast identities remain intact. The combined build is 3,339,916 bytes
(+4,501 versus that dev baseline, about 0.135%); only the byte ratchet is updated.

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

### Frontend producer and short local loops (#856)

Asset-generating scripts imported by tests must keep all pack I/O behind the
explicit CLI entry guard. Furniture's tolerance import previously regenerated
three tracked modules during parallel `npm test`, allowing `--check` to read
an O_TRUNC window (#884). Do not regenerate to hide a stale check: reproduce
in a disposable copy. `test/furniture-assets.test.mjs` protects import purity,
the controlled write/read boundary, strict stale/missing refusal and exact
explicit CLI output, including POSIX symlink entry. Product art is unchanged.

`npm run gate:plan` derives required product/tooling sets from the real diff
and the import/data dependency closure. Imported tools keep every computed
consumer, including product tests; a scripts/ prefix cannot discard them.
Unknown inputs select both. Optional
`npm run gate:tooling` does not build the product; `npm run gate:product` builds
and runs every emitted-tree consumer. Their test-file union is exactly the
ordinary unit suite; neither subset alone replaces `npm run gate:small` or the
pre-push hook. Root `tsc --noEmit` is already part of build; test-config emit,
`fix-test-build` and `noUnusedLocals` have different contracts and remain.

Validate restores dist/test-build from a complete successful producer run/attempt,
byte inventories, known Node/OS/architecture/runner image and proven content inputs.
V1 remains exact-SHA. Schema2 (#954) independently reads ancestor Git objects as
data, compares reusable product inputs and binds SHA/tree/run/attempt separately.
The source must be an ancestor or this same issue's own pre-rebase producer;
an unrelated sibling issue cannot supply trust merely by matching bytes.
Only closed pure product units are reused; the disjoint FS/Git/process/dynamic
and tooling group always runs on the consumer. The full union is still required.
Red/cancelled/incomplete/expired/foreign or changed config/pin/toolchain evidence
means a fresh producer. Diff guards, bundle policy/budget and unused checks
still run fresh. The source run is printed; no cache hit is a green verdict.

Push and dispatch share one up-front task plan: labels and visual/render risk
select full and golden independently. An already pending exact push can wake
its sealed review request on completion; it does not need a duplicate dispatch.
An explicit issue dispatch queues behind the active push; its successful producer
can then be restored, not cancelled halfway through. New pushes supersede old
material. Protected dev/night/release concurrency and full coverage stay separate.

Heavy check transfer reads a direct executed producer ci-proof across branch
cache boundaries. Ancestor/tree, independently recomputed source/consumer keys,
source run/attempt/jobs, each producer's actual environment (all three smoke
shards, not the later aggregation runner), 24-hour lifetime and exact perf
profile set must agree; API absence/unknown evidence means fresh execution.
No transfer chains, green-by-cache-bit, red/cancelled/partial producer or foreign
repository is accepted. Only requested groups are searched.
The source's stamp-producer script must match too, not only its proof aggregator.

Local gate receipt is private under .git/hp-local-gate-v1. It restores verified
dist/test-build and the pure unit result for unchanged inputs, including dirty/
untracked files, environment and policy; fresh groups and guards still execute.
Receipts are invalidated before an attempt, sealed only after full success and
unchanged inputs, expire after 24 hours and have no CI/review authority.
Manual npm and pre-push use the same lifecycle entry. Git's injected exec-path
prefix and WSL_INTEROP's per-invocation transport socket are normalized; Windows
environment names compare without case (#960). User PATH, MSYS/tool options and
otherwise unknown variables still invalidate proof. Git for Windows also adds
shell search paths and MSYS metadata: that different environment conservatively
runs the complete gate again instead of reusing a manual receipt.

Night, merge-after-rebase and release readiness free the runner while pending.
Completion/reconcile authenticate repository, source attempt/path, child SHA
and immutable request state. Pending is not PASS. A full release still needs
Validate, full performance and exact-ref real-HA E2E; no timeout/partial result
publishes. If intent expires or a one-shot dispatch claim has ambiguous delivery,
inspect the source/child run and issue summary; repair the cause and issue a new
explicit command (S7 for integration, nightly dispatch, or the original tag's
release/publish-prerelease dispatch). Never clear a live claim to retry blindly.

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
  `HP_PREPUSH_GATE=1`. Run the final gate once; the unchanged pre-push uses its
  verified local receipt and reruns metadata/range guards. Do not disable the
  hook to avoid a duplicate build.

## Local Windows workstation

Nightly witness repair (#1012) keeps the original 2026-10-22 run's red/escaped
outcomes separate from ordinary local proof. `smoke_isometric_live_touch`
observes #1002's single owner-addressed core path, no casing, Flat/2.5D geometry,
both native corners and the exact endpoint; it no longer requires removed paint.
`smoke_moon_phase_direction` retains only the historical pending panel import
with `evaluateRetainedAction` and mounts each surface synchronously. Its masks,
clock, art/edge/area/hemisphere oracles and tolerances remain unchanged. A clean
WSL baseline reached the end, so it does not establish the original GC frequency.

The historical `settings-help-size-leaks-into-catalogue-948` ID now also checks
an ordinary unscoped public `hp-help` target (32px): #976 intentionally made the
catalogue compact (22px), so expecting it to expose a changed default is obsolete.
Both real compact-dialog checks remain. The Zigbee heading witness targets an
authoritative local 14px override: #1007's shared compact-disclosure specificity
masked the old weaker override. Its existing two-theme 12px guard is unchanged.
IDs/guard commands remain, counts do not change; static readiness is not caught
evidence. No mutated product, bundle or guard runs outside the nightly workflow.

Native workflow fixtures require Git for Windows (including Git Bash) and real
`jq` on PATH (#960). Install jq once with `winget install --id jqlang.jq --exact
--source winget`, then open a new terminal; this is the standalone upstream
[Windows build](https://jqlang.org/download/). WSL's system32/bash.exe cannot
execute files from a native Windows checkout. The fixture helper resolves Bash/sh
from the active Git installation, keeps runner flags and script bytes unchanged,
and gives explicit fixture tools precedence on PATH. It does not skip failed
commands or replace jq. Shell interpolations use forward-slash paths; native
Node still reads the same files. Existing native-Windows exclusions remain.

Candidate reviews-index uses an explicit credential-free child environment.
On Windows libuv fills absent required variables from the parent; empty PATH/user
variables plus the export's own TEMP prevent that implicit inheritance. Only the
Windows root remains necessary for Node; filesystem/process permissions still
apply. Pre-push captures Git's ref stream before any child and isolates auth
stdin, including when gh is a Windows executable reached through WSL interop.

Sections resize smoke (#924) waits for the real mode-transition busy flag to
clear before sampling steady geometry; it never waits for the asserted `auto`
style as readiness. Its active-transition setup scenario retains all fourteen
original checks and adds one regression. Pinned Chromium identity and bounded
`SECTIONS_DIAGNOSTICS` samples report actual rectangles, inline height, mode,
phase/busy/preparing flags and timing, also in timeout errors. The historical
isolated false result did not record those flags, so its precise cause remains
unknown; the new ordinary scenario proves a sufficient legal timing path only.
Run `HP_SMOKE_CHECKS=1 node demo/smoke_sections_resize.mjs` after coherent build.

The CI contract is **Node.js 22 + Python 3.14**. Do not use Codex's bundled
Node 24 or an unpinned machine Python environment as proof that a release will
pass. The pins are not declared twice: `node scripts/toolchain-pins.mjs` reads
them from `validate.yml`, `tests_backend/requirements.txt` and the lockfile, and
`npm run toolchain:check` compares the machine with them (#496). `.nvmrc` and
`.python-version` carry the same values for nvm/uv/pyenv; a test keeps them equal.

CI resolves the existing Python minor once in `reuse` (#1032). Backend and
geometry parity install that exact `needs.reuse.outputs.python_version`, so
different runner-image caches cannot independently select different patches.
That output comes directly from setup-python, including a registry/API fallback.
The actual-version stamp still rejects mismatches; Node records its actual
`process.versions.node`, and no toolchain version or trust rule is relaxed.

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

The lazy-editor style witness (#967) starts its first-frame observer before
the opening action. `evaluateRetainedAction` owns a public JSHandle containing
the action promise, polls only its settled status and reads the value/error
synchronously; returning a pending promise through CDP is not a lifetime root.
Both handles are disposed on completion/refusal, and a non-completing action
fails a named 20-second cap rather than retrying. A pinned ordinary weak-owner
GC control and release check complement the unchanged first-frame/cascade,
remount/retry checks. They do not diagnose a historical CI failure as product
regression or flake merely because a later repeat passed.

Version-recovery's config/layout/asset refusal probe (#975) uses the same
`evaluateRetainedAction` boundary. Its original sequence and version, terminal
toast and kiosk/reload assertions remain unchanged; a named 20-second action
deadline replaces an unbounded pending CDP result, without retries. A Node-side
`finally` also detaches the test-owned offscreen card on refusal/deadline, so
the normal card disconnect cleans up its timers/subscriptions. The reported
three CDP failures remain historical evidence: a clean local baseline on the
same dev passed, and this change does not establish which original await was
pending or attribute a product regression to #973. The retained runner's six
unit cases and the existing native weak-owner GC control establish lifetime,
exactly-once, original-error, timeout and handle-release behavior separately
from the version-recovery product oracles.

Marker state-source QA (#987) uses that same retained runner for the historical
`smoke_marker_state_source` editor-to-static-card action (original line 121).
The sequence remains `setMode('view')` → `whenDefined` → configure/append the
static card → existing settled/plan-parity checks. The action has a named
20-second deadline, no retries; existing assertion budgets do not increase.
The initial current-dev run reached the final preview check without CDP loss;
the original failing inner await and failure frequency therefore remain unknown.
That run also found the field-order oracle still expecting pre-#1007 siblings:
it now checks adjacent sections and the picker's painted position below Display,
without dropping any original result or changing the accepted form.

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

Ship-review test repositories (#925) set `maintenance.auto=false` and
`gc.auto=0` in their own local config, including the sandbox's bare origin.
They never change owner/global Git configuration. Both fixture after-hooks use
native recursive `rmSync` with ten retries and 50 ms linear backoff; exhaustion
still throws. The ordinary child-fixture test checks effective local settings,
real commit/push and completed cleanup, while all original patch-id/cherry-pick
and workflow assertions remain. This hardens the known ENOTEMPTY cleanup path
without claiming to establish or reproduce its historical race cause.

Dev-build test repositories (#969) apply the same bounded-cleanup contract to
their own bare origin, working clone and stand clone. `receive.autogc=false`,
`maintenance.auto=false` and `gc.auto=0` are local fixture settings: the receiver
is configured before the first push, and clone `--config` writes the settings
before fetching. Their root/index `finally` blocks use the native ten-retry,
50 ms linear-backoff removal options without suppressing exhaustion. Ordinary
tests check all three local configs, real publish/fetch, completed removal and
propagation of an assertion failure. The original integration-tree, stale-build,
backend/dist and HA update/rollback assertions are unchanged. This does not
claim to reproduce or identify the exact writer behind the historical CI
`ENOTEMPTY` in `origin.git/objects/pack`; no owner/global config or production
publisher/updater changes are needed.

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

`node scripts/repo-weight.mjs` (#860) records read-only host/platform/material,
raw KiB loose+pack metrics and logical tracked PNG/bundle bytes. It never runs
GC or modifies history, LFS or quota. Compare growth only for the same clone
and phase: a WSL partial clone or a without-GC snapshot cannot satisfy the
Windows post-GC checkpoint. The 2026-10-25 decision remains with the owner.

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

Off LED fill (#1043): `smoke_led_strip_tube` compares actual tube pixels with
an independent Canvas reference that erases the body beneath the 70%-opaque
inner band, including transparent, white and coloured backgrounds; it retains
the on-state oracle. This catches opacity applied over the dark outline itself.
`smoke_led_strip_glow` checks off/on/unavailable/on opacity through public HA
updates in both themes and projections, as well as the static-card combinations.

Presentation seams (#907): `test/config-write-context.test.mjs` checks the known
RU/EN context mapping while preserving unauthorized/unknown fallbacks;
`test/space-reference-repair.test.mjs` covers own/inherited prototype-key names,
empty/non-string values, unchanged classification and immutable inputs.
`smoke_device_preview_parity` changes public HA/card locale options in the same
open form, waits only for the parent Name label and then judges child text
independently. `smoke_placement_context_message` reaches the actual early refusal
through a registry-Area queue, a normal deferred transport rejection and a public
HA gap; full wire/server/toast observations exclude another write or false success.
No guard/ACK/history patch is used. Native baseline/fixed raw and true exits live
under `artifacts/907/`; these headless witnesses are not owner/real-GPU acceptance.

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
- The #1016 retirement is prepared separately by #1021: Git-proven deletions
  of duplicate dist files need no fake Release trailer; other bundle changes
  remain release-only, including deletion of installable frontend files.
- The only committed bundle is `custom_components/houseplan/frontend/` (#1016),
  changed only in a beta/release candidate (#657). Rollup writes ignored
  `dist/houseplan-card.js`, `dist/houseplan-assets.json` and content-hashed chunks under
  `dist/houseplan-assets/`; `npm run bundle:sync` builds and lays that tree out into the
  untracked demo copy, and `npm run bundle:clean` restores only the integration
  snapshot, preserving local dist for smokes/proof receipts (the `commit-msg`
  hook refuses bundle changes without a `Release:`
  trailer). The candidate runs `npm run bundle:release`, which also updates the
  integration snapshot `custom_components/houseplan/frontend`.
  `node scripts/bundle-policy.mjs --verify HEAD` is the check CI and `gate:small` run:
  build integrity always, byte parity with the committed copy only on a commit that
  changes the bundle or is a candidate; `node scripts/bundle-tree.mjs dist
  custom_components/houseplan/frontend` stays the read-only parity check of release automation.
  `test/bundle-tree-committed.test.mjs` checks the Git inventory for a forbidden
  second dist copy, then verifies the committed frontend manifest and every
  payload blob, independent of any local build. Candidate readiness and the local
  publisher read that snapshot. Both existing publisher workflows keep their
  build → mandatory dist/frontend byte-parity → stage sequence: their standalone
  JS is byte-identical to the saved snapshot and ZIP comes from Git. Those
  workflows need no edits. Publisher ratchet reporting uses
  `node scripts/ratchets.mjs report --warn --committed`, including bundleBytes.
  Tightening and ordinary budget checks still require a fresh dist build.
  The computed unit partition also follows actual compiled-output FS reads in
  transitive tools, even when dist/test-build files are absent or ignored. The
  Select-only node budget belongs to the build-backed product lane; output
  declarations and fixture strings alone still belong to no-build tooling.
  Builds also recover orphaned flat hashed House Plan chunks if an old
  tracked-dist checkout overwrote/removed their manifest: both the output name
  and emitted build-fingerprint signature must match. Unknown files are kept
  (and still rejected by the integrity guard); output-directory symlinks are
  refused before cleanup. Only generated files inside the explicit output root
  are removed, not the HACS snapshot or arbitrary directory contents.
  Validate/proof artifacts, dev-build, bundle-sync, performance comparison and
  UI Lab keep using generated dist. Historical fixed-SHA readers stay unchanged.
  This removes duplicate paths/checkout bytes, not duplicate Git blob storage:
  identical dist/frontend trees already have the same object ID. No history is
  rewritten, and converter-local `scripts/sh3d-convert/dist` stays tracked.
- The first-space/import dialog is a separate `houseplan-onboarding-runtime-*`
  chunk. Do not fold it into `houseplan-editor-runtime-*`: empty-install
  onboarding is a View prerequisite, while a configured View must request
  neither lazy runtime until the corresponding user intent.
- 2.5D rendering is a separate `iso-scene-render-*` chunk. A View with
  `settings.volumetric_view` off (#649) must not request it. Its normal import and content-hashed retry
  must pass the same source-fingerprint handshake before Iso installs atomically;
  `houseplan-assets.json` records the graph as `lazyIsometricFiles`.

### GitHub funding metadata in the CI input inventory (#915)

The Sponsor button file is repository metadata, not an executable Validate
input. `scripts/check-inputs.mjs` declares its exact path in `NOT_AN_INPUT`
with a reason; adding it to a branch must not fail the coverage inventory or
select every check. Do not exclude the whole `.github` directory or YAML:
unknown neighbouring files and workflows remain guarded. The ordinary
inventory and affected-check cases in `test/check-inputs.test.mjs` work even
before the metadata file arrives from `main`.

### Nightly witness repair (#962)

The 2026-10-19 artifacts exposed different witness failures, not one product
regression. The fills navigation label duplicated the card title, so a generic
source substring could survive a missing card heading. The scoped form-card
contract now checks the consumer's own heading. Native radio checked state can
change without a Lit handler; the #955 smoke also reads the draft and rendered
selected preview after both label click and keyboard selection. The #947 smoke
measures each hidden native select's actual box as well as HA body overflow:
clipping a padded/min-sized control is not zero layout extent.

Properties completion tests cover an observed conflict after the external value
returns, and a no-op draft whose baseline changed before sync. The image-ratio
mutation uses a runtime condition so TypeScript still narrows the nullable ratio;
the history mutation assigns size after copying so it retains the original
optional/null field type. `pytest -k plan_opacity` selects the named opacity
test, including null/bool/string/nonfinite refusals.

The two support-v2 witnesses used `pytest.fail` inside HA websocket callbacks.
That raises BaseException outside ordinary protocol error handling and strands
the waiting client until the runner timeout. Capture now records entry and
raises an ordinary support error; an inert async transport records entry and
returns a local test ID. The test boundary asserts zero calls and the exact
refusal response, with bounded waits. No external transport, timeout increase,
outcome reclassification or skipped checks are needed. Ordinary tests and static
readiness run during development; changed mutants are not executed or claimed
caught before the next nightly run.

### Negative evidence in development and review (#905)

The common policy in PROCESS §2.7, TESTING, the role digests and the actual
Review prompt applies to every track/stage. Ordinary negative inputs run
against unchanged code. A temporary manual patch to implementation, its compiled
`test-build`/bundle copy, guard or budget followed by execution is a mutation,
even without the registry and even if restored afterwards; only the nightly
workflow executes those witnesses. Registration, static `--check` and ordinary
PASS are not caught proof. A declared witness is reported as not executed.

`test/process-digests.test.mjs` reads the actual Review scalar, renders its
current expression surface for stage/track fixtures and rejects the retired
pure-unit/restore permission. Ordinary invalid text/declaration inputs and the
unchanged static registry reader prove the distinction without applying patches;
synthetic outcome records test taxonomy, not real nightly caught evidence.
The prompt word ceiling, tools/permissions, max-turns and verdict schema remain
unchanged. Normal build/test generated outputs and the external REVIEW_DOC are
still allowed and isolated by publication's existing index/tree cleanup.
This is instruction consistency, not a Bash sandbox or a guarantee that a model
cannot disobey. Historical review documents and accepted product verdicts stay
immutable; the observed #903/#901 manual substitutions are evidence for this
follow-up, not commands to reproduce.

## Maintenance diagnostics

### Evidence accuracy and historical errata (#910)

`node --test test/node-performance-report.test.mjs test/process-digests.test.mjs`
checks the uniformly-dirty triple against an otherwise identical clean control,
input immutability and this explicit checklist text/local links. It does not
change the signature guard or judge prose semantically. The checklist is here,
linked from TESTING, without expanding its fixed 880-line budget.

Короткая проверка перед итогом автора/ревьюера (не новый исполнитель или
автоматический fact-checker):

- `executed`: назвать фактически исполненные SHA/tree, команду, время,
  observable result и истинный child exit; будущий SHA не называть измеренным.
- `reused`: дать исходный материал и ссылку на прежний proof; переиспользование
  не выдавать за собственный повторный запуск.
- `equivalence`: назвать сравниваемые материалы, полный проверенный корпус и
  пределы эквивалентности; совпадение содержимого — не новое измерение.
- `not run / unknown`: отсутствие запуска или потерянные имя/stack/причину
  сохранить явно; поздний PASS не объясняет старый неизвестный FAIL задним числом.
- Числа брать из конечного списка исполненных случаев/счётчиков, проверять сумму
  и не удваивать reused checks. Golden threshold PASS, nonzero differingPixels
  и byte-identical witness floor — разные величины, не взаимозаменяемый допуск.
- Для длинной команды до краткого display сохранить raw stdout/stderr,
  команду, material и истинный exit существующим runner или перенаправлением;
  статус дочернего процесса не терять за `tee`/обвязкой. Усечённый tool display
  не объявлять полным raw. Секреты и приватные полные transcripts не публиковать.
- Исторические поправки — датированная additive errata с первичными ссылками;
  original verdict, машинные anchors и raw не переписывать. Пример:
  [ограниченная errata](analysis/910-evidence-errata-2026-10-15.md).

`test/process-digests.test.mjs` защищает только явный текстовый контракт и
локальные ссылки этого раздела, не семантическую истинность отчётов. Только
восемь названных исторических записей уточняются без benchmark/native/mutant replay.

### Later review clarifications (#927)

[Four dated clarifications](analysis/927-evidence-errata-2026-10-17.md) separate
literal counts, module loading from validation, native cohorts from unit/CI
execution, and profile selection. They supplement #910 without editing the
four original reports, verdicts, machine anchors or raw, and without historical
test/benchmark/native/mutant replay or a new semantic-checking mechanism.

### Outside review findings routing (#926)

Legacy `process-resume` binds the frozen findings snapshot to its trusted `repo`
argument as well as the prepared issue/stage/cycle (#961). `prepared.json` does
not supply repository authority; an extra `repo` field cannot override the
controller. A complete sealed green result with its exact merge intent remains
a successful no-op, leaving Validate completion to merge continuation. Foreign
or corrupt policy, broken seal/companion and epoch/body/material drift still
refuse without relabel/model dispatch. Pre-#926 issues-mode receipts remain
compatible. `test/pipeline-outcomes-897.test.mjs` exercises both current modes
through the real Linux CLI with an offline API fixture, plus hostile resealed
inputs and no-write assertions. Historical #957 artifacts reproduce the original
failure and validate unchanged after the authority fix; they are never rewritten.

With owner authorization, set the repository Actions configuration variable
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES` to a JSON array of explicit issue IDs
before S4/S7, e.g. `[926,927]`. Empty/`[]` restores the default issue route;
malformed/oversized values fail closed. Do not place this setting in issue text,
handoff or source. Existing settings permissions remain unchanged. This change
does not enable the variable in the live repository.

Prepare freezes one run's route. To revoke an in-flight route, cancel that run
and start a new request; editing the variable alone does not change its snapshot.
The actual Review prompt embeds the server-side prepare snapshot; the JSON
file is a checkable copy, refreshed after setup. A mismatch stops the reviewer
without issue creation; the mutable file cannot choose another route.
File mode publishes `docs/reviews/findings/<issue>-<stage>-r<round>.md` with the
review; the regular archive link repair keeps its link reachable later. These
companions remain under reviews, not implementation/release membership.
Publication normalizes line endings and records an exact Git blob binding
before the unchanged machine-anchor tail. SPEC companions need the same
publisher, exact path/header/blob and added-file proof; they never confer
implementation/close eligibility. New reviews require the typed snapshot;
in-flight old workflows retain only the
old issues protocol. This is instruction delivery, not a Bash sandbox. See
[PROCESS §10.4](../PROCESS.md#104-событийный-конвейер-метка-как-триггер).
GitHub documents [configuration variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)
and [caller variables in reusable workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).

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

The published integration is labelled as a dev build (#836):
`custom_components/houseplan/BUILD.json` holds
`{"schema": 1, "channel": "dev", "source": "<full SHA>"}`, and only the `version`
value of `manifest.json` gets the suffix `+dev.<sha8>` (the rest of the file is
byte for byte the tree's; a manifest that does not parse or lacks a string
`version` is not published). Both are added after `integrationTree` is
computed, so the hash still describes the content without the label: two
sources with the same integration and different SHAs give one tree, the script
answers `unchanged`, and the installed copy keeps the SHA it was installed
from. The `dev` tree, betas and releases never carry a label. What the label
gives: Home Assistant's integration page shows `1.80.1+dev.024b6595` (the
pinned loader accepts it — `tests_backend/test_ha_build_identity.py`), the
module URLs carry `&dev=<sha>`, so the console prints
`HOUSEPLAN-CARD v1.80.1 · dev 024b6595` and «About» links the SHA to its
commit, and `houseplan/config/get`, the plan export and the support report get a
separate `build` field (`{channel, source}`) — never on a release or a beta.

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
- **The version number is the last beta's — labelled.** The identity of what is
  installed is `custom_components/houseplan/BUILD.json` (the SHA it was
  installed from), the `updated` line and `.dev-build-tree`. A support report
  sent from this installation carries `build`; the support relay accepts it
  only after its #836 redeploy (`scripts/support-relay/README.md`).
- **Rollback:** `rm -rf /config/custom_components/houseplan && mv
  /config/houseplan-dev-prev /config/custom_components/houseplan`, then restart
  — or redownload a release in HACS. The installed hash travels with the copy,
  so the next trigger installs the head again unless the automation is off.

## Frontend cache and the "empty view"

- The card module URL is `?v=<VERSION from const.py>&b=<first 8 of the bundle
  fingerprint>` (#836): browsers keep the ES module in memory cache, and a new
  build changes the URL even at the same version once HA restarts (or the entry
  reloads) and re-reads `frontend/houseplan-assets.json`. A bundle copied without
  that manifest falls back to `?v=<VERSION>` — then **bump VERSION in const.py
  and restart HA**, or a plain F5 keeps the old version. An ordinary task commit
  bumps neither `VERSION` nor the committed bundle: both change only in a commit
  with a `Release:` trailer (#657, `PROCESS.md` §1).
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
- **A build is its fingerprint, not its version (#836).** Consecutive dev builds
  share a version, so `build_identity.py` reads, once per entry setup in the
  executor, the bundle fingerprint (`frontend/houseplan-assets.json`, schema 1,
  64 lowercase hex) and the dev label (`BUILD.json`, see «Tracking the head of
  dev»); anything malformed or missing means "unknown" and never raises. The
  card and panel register as `<url>?v=<VERSION>[&b=<fingerprint8>][&dev=<SHA>]`
  — exactly `?v=<VERSION>` without either — and the Lovelace resource is updated
  in place (`updated`), a repeated build stays `existing`. `config/get` adds
  `frontend_fingerprint` (64 hex or `null`) and `build` (`{channel: "dev",
  source}` or `null`); `integration_version` is unchanged.
- The card compares versions **and**, when both sides know theirs, fingerprints:
  equal versions with different fingerprints are a mismatch. An unknown
  fingerprint on either side (an old backend, the `__HOUSEPLAN_SOURCE_FINGERPRINT__`
  placeholder in unit tests) keeps the version-only comparison. The kiosk
  target is `<backend version>@<fingerprint8>` (the version alone when unknown):
  a new build of the same version gets one automatic attempt, the same target
  never a second. At equal versions the notice shows `<version> · dev <sha8>`
  or `<version> · <fingerprint8>` on each side; at different versions only
  versions.
- The card's code runs in a content-hashed chunk whose own URL has no query, so
  both entry wrappers (`entryFallbackPlugin`) record their `import.meta.url` in
  `globalThis.__HOUSEPLAN_ENTRY_URL__` before any chunk loads; the first one in a
  document wins. The console banner and «About» read `dev=<40 hex>` there
  (`src/build-identity.ts`) — the build the tab **runs**; a stale tab learns about
  the newer backend from the version notice, not from «About».
- Targeted checks while changing this contract are:

  ```text
  python -m pytest tests_backend/test_ha_frontend_registration.py tests_backend/test_ha_setup.py -q
  python -m pytest tests_backend/test_ha_build_identity.py tests_backend/test_ha_panel_registration.py -q
  npx tsc -p tsconfig.test.json
  node scripts/fix-test-build.mjs
  node --test test/version-recovery.test.mjs test/build-identity.test.mjs
  node demo/smoke_version_recovery.mjs
  node demo/smoke_build_identity.mjs
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

## Review handoff identity (#904)

Acceptance formatting (#922) uses the first AC token on a line; references
such as `AC6 … согласовано с AC1-4` no longer hide AC6. This is not a new spec
grammar or semantic approval. Missing AC/evidence and the three-AC show limit
are still rejected, and quoted/fenced examples remain excluded. Regression:
`node --test test/review-preflight.test.mjs`.

`scripts/review-handoff.mjs` shares the colon/heading grammar between collection
and validation. A handoff starts with Done after quoted/fenced examples are
removed; ordinary reviewer prose is not a candidate. This is syntactic selection,
not a new authorization rule for comment authors. All API pages are flattened;
the greatest `updated_at` wins, then the stable numeric comment id. An incomplete
newest candidate is selected and rejected with its URL/field names rather than
being replaced by an older complete comment. Unknown/conflicting provenance is
a setup refusal, not a freshness guess.

Preflight results use `houseplan-review-preflight/v2`; v1 is not reusable as a
v2 proof. The existing scalar material identity additionally carries the selected
comment id, URL, creation/update timestamps and SHA256 of the exact raw text.
The canonical base64url snapshot travels through prepare outputs and an additive
field of the existing sealed `prepared.json` schema 1. The existing model-boundary
step freshly collects comments and refuses a different snapshot before calling
the model. A tampered but rehashed prepared file also fails its expected-output
comparison. Spec stage has no code handoff requirement; semantic approval, token
ceilings, review cycles and merge/release authority are unchanged.

`test/review-preflight.test.mjs` executes both real workflow boundaries against
local Git/API fixtures, including edit-after-prepare and sealed-snapshot drift.
It retains the earlier body/SHA/tree/track/active-request refusal matrix.

## Dependency and cache gotchas

- **polygon-clipping is a trap**: its `.d.ts` declares named exports but the ESM build has only
  a default export — tsc or the runtime breaks, whichever you appease. Use **polyclip-ts**
  (proper ESM + native types; same results). It brings `bignumber.js` and `splaytree-ts`;
  their measured weight in the built graph is below (#814).
- **Redeploying the same version changes the resource URL only through the fingerprint**
  (`/houseplan_files/houseplan-card.js?v=X&b=<fingerprint8>`, #836). The backend reads the
  fingerprint at entry setup, so the new URL — and the version notice for a tab still on the old
  JS — appears after HA restarts or the entry reloads. A redeploy without
  `frontend/houseplan-assets.json` (a hand-copied entry) keeps `?v=X`: bump the version or
  hard-refresh (Ctrl+Shift+R).
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

`node demo/smoke_room_metrics_alignment.mjs` (#1039) checks live room captions
and independently opened offline SVG downloads across projections, scales and
roles. `HP_ROOM_ALIGNMENT_EVIDENCE_DIR` optionally keeps a private SVG/PNG pair.
The live caption with an Area action intentionally keeps its composite centre;
the exported name has no action and centres over its readings.

The print/SVG export witness is `node demo/smoke_svg_export.mjs` (#1036), after
`npm run bundle:sync`. Optional `HP_SVG_EVIDENCE_DIR` stores private SVG/PNG pairs
and the mobile dialog. It uses the pinned browser, real controls/downloads and a
network-blocked standalone SVG page; comparison keeps the same synthetic View
frame/projection. `node demo/smoke_pdf_export.mjs` protects the existing PDF path.

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

Field policy (#929, owner decision 2026-10-16): manual owner dev/stand/GPU
acceptance is optional on **every** channel, including stable and RC. No special
owner receipt, GPU model, video/trace link or repeated human attestation is
required. Missing optional observations produce neither a blocker nor a request
to perform them. Supplied incomplete/stale observations are diagnostic warnings,
never accepted as real field proof. An explicit authenticated rejection or
revocation of the current material still blocks publication.

Scene intent is separate: #889 still permits an absent additional scene plan
only for committed canonical `X.Y.Z-beta.N`, declaring no intentional pixel
changes. Strict channels retain the reviewed scene-plan requirement for
`ci:golden` tasks; invalid supplied plans refuse on every channel. The exact
full CI proof, fresh coherent bundle, reviewed baseline acceptance, declared
scene boundaries, witness floor, ship review and public asset passport remain
mandatory. There is no CLI/env waiver, and the channel is read from the
candidate's committed package version.

The owner explicitly accepted `v1.81.0-beta.4` on the stand by chat on
2026-10-16 and said that message was sufficient without an evidence link
(#916). The reviewed `field-decisions/v1.81.0.json` binds this one promotion
to the exact public beta SHA. Preparation checks its published status, ancestry,
unchanged product/dependencies/build/capture inputs (apart from the seven
version values), and the latest authenticated `hp:stable-field-decision`
comment in #916. The comment is transparently agent-recorded from the human's
words, not a fabricated per-issue/native/GPU receipt. This historical decision
also waives additional scene plans only for that product-equivalent promotion;
its identity and declared scenes remain checked. #929 removes mandatory field
receipts generally, without changing this recorded history or its scene-plan
scope. Vetoes, malformed supplied plans, undeclared golden drift and all
automatic checks still refuse. New product/capture changes invalidate this
historical promotion approval; future stable versions need no field waiver.

Documentation's device-preview scenario (#959) opens the existing Appearance
section before scrolling the unchanged `.content` owner. It keeps the real
preview, viewport, clipping and full-visibility refusal; capture determinism,
stability, pixel witnesses and canonical artifact acceptance remain mandatory.

### Primary prerelease path

Before the existing owner publish command, run `npm run release:prepare` on a
clean exact-candidate checkout. This command performs only GETs/local reads:
it cannot create a tag, release, baseline, workflow dispatch or announcement.
Its identity includes SHA/tree, verified two-copy bundle manifest, canonical
pins/workflow, candidate ledger, fresh issue bodies, scene plans and full
Validate proof. A missing/stale/red/partial proof is an actionable blocker,
not a cache hit. Repeat with unchanged inputs yields the same identity. Stable
performance/E2E and batch-review contracts remain additional publisher gates.

On strict (non-beta) channels, for a merged/closed `ci:golden` task the repository owner reviews an explicit
scene plan in that issue. `release:prepare` prints its issue/body/material keys;
`npm run release:prepare -- --list-scenes` lists existing IDs with mode/theme/
viewport, so no hidden catalogue knowledge is needed. The owner comment is:

```text
<!-- hp:candidate-plan
{"schema":1,"issue":123,"body":"<fresh body digest>","issueMaterial":"<prepare key>","change":["<existing scene ID>"],"new":[],"reason":"Reviewed intentional change"}
-->
```

An explicit empty plan means no intentional pixel change. The latest owner
record wins, including malformed/revoked records; a claimed owner inside JSON
does not authenticate it. Plans are tied to delivered file contents and issue
body, never inferred from a red screenshot. Existing `_beta-derived.yml` and
golden acceptance commands still review the declared artifact; prepare never
executes them. Undeclared differences/new scenes remain forbidden.

For large frontend features and geometry/viewport changes the report supplies
ordinary and risky-neighbour cases, scripts and observable oracles. To run the
additional automated native diagnostic, use
`npm run release:native` (or `-- --profiles=geometry,view`) on the clean
committed candidate after preparing its emitted test helpers/demo bundle.
The runner uses real browser pointers in the existing node/topology and live
coverage scenarios, enforces the launched browser pins, records actual
environment, script/output hashes and observed checks. Timeout/exit0 without
the required check inventory is not PASS. Native evidence is **not** human
acceptance; a successful headless run never claims field/GPU acceptance.

The owner may voluntarily inspect the dev stand or their ordinary browser;
this is not a gate for tasks, merges, betas, RCs or stable releases. Do not ask
for a `hp:candidate-acceptance` JSON record, GPU details or evidence links as a
condition of progress. Existing optional records retain their exact-material
limits and diagnostics; malformed or stale field records do not block or
require renewal. An explicit current owner rejection/revocation is different
from a missing observation and remains a publication veto. Neither automated
native output nor an agent-authored note may fabricate a human/GPU observation.

`release-prerelease.mjs`, `publish-prerelease.yml` and `release.yml` all check
fresh candidate readiness before public work. Prepare alone grants no publish
authority: the separate owner command/confirmation, full Validate and existing
release gates remain mandatory. Comments are read in at most ten 100-item
pages; overflow fails explicitly rather than silently missing a revocation.
Publishers refresh this check immediately before tag/publication, not only at
the earlier gate. Their `--publication-check` permits only untracked generated
`houseplan.zip`, `release-assets/`, `passport/`, `existing-public/`; tracked
bundle/source/config changes or other untracked files still refuse. The normal
prepare/native path requires a fully clean checkout.

Night red diagnostics fetch the current Validate attempt's jobs and failed
steps (at most 100; overflow refuses) and retain exact SHA/run/job/step URLs.
They distinguish unknown from structured exact-attempt, complete environment/
harness/product assertion or reviewed intentional-scene evidence. A single
same-SHA green elsewhere is not flaky proof. At most one observed retry with
complete matching SHA/environment supports `bounded-flaky-evidence`, never
PASS or issue guilt. The live path stays `unknown` when those structured
receipts are unavailable; no automatic retry, baseline acceptance or diagnostic
category changes gate colour. Errors preserve the original red gate outcome.

Prepare the candidate as usual: synchronize every version field, add dated RU
and EN changelog sections, update the one production frontend snapshot with
`npm run bundle:release` (since #657 the only commit that may change it; it
carries the `Release:` trailer), then lower the ratchets to the candidate's
facts with `node scripts/ratchets.mjs tighten` (#699: it rewrites the core line
caps, the gzip graph ceilings and `scripts/monolith-baseline.json` from the
fresh `dist/`; commit them with the candidate) and write the
short bilingual body in `docs/RELEASE-NOTES.md`. That file is the one current
instance of the **prerelease** `## Основное` / `## Highlights` template; its two
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
issue authorship is irrelevant. Membership creation and immutable verification
read all reachable parents in that range (#958), preserving each task's own
delivery SHA even when a merge names another issue. The previous release tag
is still selected on the first-parent line; unreachable branches, history before
that tag, proven SPEC-only delivery and Release-only repetitions stay excluded.
The prerelease is staged as a draft and receives
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
Both publishers use `release-bookkeeping.mjs` for closing comments (#970).
After public asset and HACS verification, it probes the existing full release
CI policy again for the manifest's exact candidate before any issue operation.
The comment links the selected green Validate proof, the release and both
technical changelogs pinned to the release tag (`GITHUB_SERVER_URL` supplies
the GitHub host). Missing, light-only, foreign or red proof refuses bookkeeping;
the latest compatible full run still decides. The per-tag marker remains the
idempotency key: retries repair labels/close without another comment, and
already marked historical comments are not rewritten.
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

**Transient proof reads (#921).** Local release readiness may encounter a dead
socket after blocking catalogue reads. Stale keepalive reuse is a hypothesis,
not a proven historical root cause. `release-gate.mjs` now applies the same
bodyless-GET-only transport to its workflow list, candidate tree and proof
context reads: at most three attempts, with 100/400 ms pauses, only for EPIPE,
ECONNRESET or UND_ERR_SOCKET. HTTP errors (including auth/rate limits), malformed
JSON/evidence, aborts and exhausted transport failures still fail closed; no
release/tag/asset write is retried. `node --test test/release-read-retry.test.mjs`
covers provider failures and a real loopback socket close, exact/foreign/red or
missing readiness, bounded exhaustion and the no-write boundary. This is not an
actual publication and does not claim to reproduce the original keepalive cause.

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

Beta ship reports (#897) go to the first actual stable containing the reviewed
beta tag/material and the report's introducing commit. A stable with that
beta's exact version need not exist; unknown tags/materials or unproved ancestry
stay live. Dry-run is read-only. Continuation errors retain bounded redacted
step and run/attempt/material identity; `reviewed-patch-changed` re-requests
review only for the same fresh S7 epoch, never reuses the old green. Inspect
other failures instead of assuming a merge or retrying ambiguous CAS delivery.

Archive link auditing and repair (#839) operate on rendered Markdown links,
not literal inline/fenced code examples. Actual missing links, including links
inside quotations, still fail the audit; example source is never rewritten.
The review index retains ship reports and interprets their own canonical
`Итог: High … · Medium …` summary (High blocks, Medium is owner advice under
PROCESS §11.7). A missing/quoted/inherited summary remains unknown; ordinary
code/spec reviews still require their own recognized verdict. Do not weaken the
live-index recognition threshold or drop ship reports to make archival pass.

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

### Agent-authored stable notes and release accounting (#838/#840)

The agent writes the net user-facing difference since the **previous stable**,
not since the last beta. Scripts never draft prose or classify issues. Russian
comes first, English second with equivalent meaning. The canonical authored
sources are `docs/changelog_user_stable_ru.md` and
`docs/changelog_user_stable_en.md`, newest releases first. Start with the
owner-approved 1.80.1 example in these files; its historical milestone link is
only a style example, not evidence of retrospectively verified membership.
Add a new section during stable preparation, not per task or beta.
`docs/CHANGELOG.ru.md` and `docs/CHANGELOG.md` remain technical/commit-oriented
history for tasks, betas and releases; never replace them with user prose.
Each language contains:

1. The heading `## Релиз Houseplan X.Y.Z` / `## Houseplan X.Y.Z release`, then a simple introductory paragraph (owner's shorter title, #841).
2. 1–5 short, human major-feature paragraphs, each starting with a suitable emoji instead of a bullet and a **bold short title**, with issue-number links **at the end**.
3. Optionally a short paragraph about fixes/polish of previous-stable behaviour.
4. A compact link to all eligible issues in this release's GitHub milestone.

Separate the heading, introduction, every feature, other-changes paragraph
and collection link with a blank line. Prefer a few clear user actions over
implementation details or long feature inventories.

If there are no major features, omit the list entirely: intro + short fixes
paragraph. With no user-visible changes at all, don't invent fixes or filler.
Infrastructure/documentation and repairs to newly introduced beta functionality
are absent from stable prose and its milestone. Performance of behaviour that
already existed in the previous stable is eligible `stable-fix` work. The final
description of a major feature incorporates its beta refinements without
advertising those repairs as separate stable changes.

Before S7, the author adds one reviewed JSON record per issue under
`docs/release-ledger/<previous-stable>/<NN>.json`. Required: `schema: 1`, `issue`,
`baseStable`, `category` (`major`, `infra`, `stable-fix`, `line-fix`), and a factual
`rationale` anchored to the previous stable. Eligible categories also need
`summary: {ru, en}` user-facing facts; `line-fix` needs `introducedBy` (the issue
that first added the missing-in-stable feature). For mixed tasks classify their
net user-visible result: `major` if a large feature is delivered, otherwise
`stable-fix` when previous-stable behaviour improves; incidental infrastructure
and within-line repairs do not change eligibility. This is release accounting,
not a task backlog. Beta changelogs and `User-Visible` trailers still retain
their existing per-commit contract.

`docs/release-ledger/cycle.json` explicitly binds the previous stable, the
intended stable tag and an existing GitHub milestone number/title. Do not guess
a milestone from an issue label or whichever milestone happens to be open.
Current planning binds `v1.83.0` to milestone 9 (`1.83`), with `v1.82.0` as the
previous stable (owner choice on #1005). If the owner chooses
a different next stable (for example a hotfix), the release author explicitly
updates that binding before collecting facts. After a stable ships, the next
task opens the next cycle with the new base and reclassifies carried tasks;
old records remain immutable history, not defaults for the new baseline.

The trusted merge controller checks the record in the accepted candidate and
lands it with the task. Only after successful dev push does it idempotently set
the configured milestone for `major`/`stable-fix`, or remove that milestone for
`infra`/`line-fix`. A different planning/historical milestone requires curator
resolution, never silent replacement. API failure leaves S8 truthful and prints
a bookkeeping-only recovery command; do not merge again:

```sh
git fetch origin dev
node scripts/release-ledger.mjs reconcile --candidate=<merged-SHA> --issue=<NN>
```

For a stable candidate, fetch tags and build the **data-only** catalogue:

```sh
npm run release:notes -- vX.Y.Z
node scripts/release-ledger.mjs catalogue --candidate=HEAD --tag=vX.Y.Z
```

The catalogue intersects classified implementations with `Issue:` commit evidence
in previous-stable..candidate, excluding release-promotion trailer repetition.
All reachable parents are read in topological order: a merge's own issue
trailer must not hide another task delivered through its second parent (#916).
The bounded GitHub JSON transport accepts up to 8 MiB per response and still
fails explicitly on overflow, invalid JSON or CLI failure.
SPEC publication uses the versioned `Delivery-Phase: spec-review/v1` terminal
trailer (#903). `task-delivery.mjs` checks the publisher identity/subject, exactly
one new SPEC document for the issue plus optional INDEX, and its own machine
body/tree/verdict anchors against Git objects. Historical publisher commits
without the trailer receive the same checks; other C-only commits do not.
The heading accepts `# SPEC-REVIEW-NN-rN` and the publisher's existing
`# SPEC-REVIEW — issue #NN, заход rN` form (#950). Both must name the exact
issue and round of the sole added SPEC file; this is not a title-only exception
to provenance. The original #928 publication is read unchanged. To exercise the
compatibility and negative inputs, run `node --test test/task-delivery-903.test.mjs
test/release-ledger.test.mjs test/review-preflight.test.mjs`.
The immutable trace remains in catalogue `specDeliveries`, outside implemented
entries, prerelease membership, closure evidence and user milestone selection.
Unknown/malformed phase or an unsuitable diff fails closed. The producer and
both membership creation/verification use the same phase contract.

Before publishing a SPEC, `review-material.mjs retain --sha=<commit> --tree=<tree>`
retains the sealed original material at `refs/heads/review-material/spec-<tree>`
(#957). A create-only lease prevents rewriting an existing ref; matching trees
are idempotent. Retention failure stops document publication. These refs are
permanent evidence, not task branches or release tags, and do not trigger Validate.
Do not delete them when the task branch is merged or the review is archived.
The shared delivery reader lazily fetches a missing tree from origin's retained
refs; historical rescue refs such as `review-material/946-spec-r3-original` are
accepted only when the advertised commit's root tree matches exactly. Existing
objects need no network. A missing/mismatched tree remains an explicit refusal;
publisher, exact SPEC/index/findings delta, body and verdict checks still run.
Neither fetching objects nor retaining a ref changes membership or authorizes S8.
`node --test --test-name-pattern='#957' test/task-delivery-903.test.mjs` exercises
a real rebase plus single-branch fresh clone without alternates, immutable and
legacy retention, create races, unavailable/wrong material and invalid publishers.

Already published manifests may retain a SPEC/promotion SHA as ancillary trace
alongside their own actual implementation SHA; verification requires that
implementation evidence and still checks every listed SHA against the exact
candidate history. New manifests list implementation evidence only.

The schema-1 agent classification stays mandatory for real implementation.
At both merge and catalogue boundaries its blob must differ from any entry
preceding that issue's first A/B delivery in the stable range: a doc-only
placeholder cannot authorize later code; formatting and unknown extra fields
do not renew that decision. A record added with implementation
or afterwards can support subsequent repairs. No runtime plan/schema migration
or automatic release category inference is involved.
Missing/stale classifications fail closed: the agent must research and classify,
not fall back to beta bullets or `User-Visible: yes`. Reconcile eligible records,
then verify milestone membership is exactly the catalogue's user issues:

```sh
node scripts/release-ledger.mjs verify-milestone --candidate=HEAD --tag=vX.Y.Z
npm run release:notes -- vX.Y.Z --write
npm run release:notes -- vX.Y.Z --verify
node scripts/release-contract.mjs vX.Y.Z --stable
```

Extra unmerged/infra issues in the milestone must be investigated and removed or
reassigned by the curator; never advertise unshipped work. The query omits state
filters so closed issues remain visible. Publication verifies this equality
again. The agent writes both user changelog sections using this format
(one language per file; the English file has the equivalent English heading
and prose):

```md
<!-- release: vX.Y.Z -->
<!-- base: vPREVIOUS.STABLE.VERSION -->
## Релиз Houseplan X.Y.Z

Пользовательское описание того, что изменилось с предыдущего стабильного релиза.

🧱 **Короткое название.** Конкретное крупное изменение. [#123](https://github.com/Matysh/houseplan-card/issues/123)

🔋 **Ещё одно изменение.** Коротко о пользе для человека. [#456](https://github.com/Matysh/houseplan-card/issues/456)

Коротко о других исправлениях уже существовавшего поведения.

[Все пользовательские изменения](https://github.com/Matysh/houseplan-card/issues?q=is%3Aissue%20milestone%3A%22TITLE%22)
```

`--write` mechanically copies these already-authored RU/EN sections into
`docs/RELEASE-NOTES.md` with release/base/language markers, after validating
them against the candidate catalogue. It never drafts or shortens prose.
`--verify` and the publication contract require the projection to match the
two user files exactly; missing locales/tags, stale bases and divergence fail
closed. This is the GitHub release body consumed by the HACS/HA update dialog;
there is no separate updater inside the card and no new runtime fetch path.

Use the actual tag/base and `milestoneQuery()` URL, not the placeholders. Zero
major issues means zero bullets; up to five bullets can group multiple major
issues using compact number links. No obligatory small-fixes line, full raw URLs,
engineering headings or internal tasks. The agreed release title is the only
visible heading. Independent review judges the narrative
accuracy; deterministic checks judge candidate membership, structure and links.
Previously published bodies, including v1.80.1, are not rewritten.

Telegram reads the exact tagged RU section from `changelog_user_stable_ru.md`.
`telegram-release.mjs` mechanically escapes text and converts the release title
and bold text to HTML bold, and Markdown links to HTML anchors. Emoji and blank
lines survive unchanged. There is no extra old heading/footer, generated summary,
English duplicate or byte clipping. If the complete rendered announcement exceeds
4096 UTF-16 units, shorten the authored prose before publishing; never truncate
Unicode or links. The release contract dry-renders the complete announcement
before publication to reject oversized prose early. The existing post-public-verification announcement trigger and
prerelease silence stay unchanged. Tests do not send messages to the channel.

### Prerelease notes (unchanged)

The beta body remains the concise bilingual `## Основное` / `## Highlights`
template below with immutable links to both detailed changelogs. Do not apply
this legacy template or its obligatory grouped bullet to new stable releases.

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
**prerelease** format. Stable publication uses the agent-authored narrative above.

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

## Durable Z2M maps (#912)

`python -m pytest tests_backend/test_ha_zigbee_topology.py -q` owns real HA
Store/entry reload and authenticated WS behavior. It checks persisted map bodies,
not only write call counts: original timestamps, no operational job fields,
clear-before-publish/ACK, errors/cancel/reload, late callbacks, successful
replacement, failed new-result save, failed clear and public config/set refusal,
saved OFF, topic-list changes, capacity and corrupt/foreign/future payloads.
The initial ordinary reload witness is red on the unchanged pre-implementation
source; no mutated product is executed locally.

Runtime units cover authoritative absent-result clears, durable capability,
stale feed restores and visible persistence errors, retaining ZHA's old contract.
The existing `smoke_zigbee_topology_job` adds a restored public-feed fixture,
actual keyboard Update, failure/replacement and another client's saved-OFF reset.
It proves browser adoption/UI, not backend disk durability or real radio/GPU
acceptance. Static mutation declarations are checked only; execution is nightly.

## Thickness selection witness (#911)

The existing `smoke_wallthick_standalone` includes public native room/partition
openings, single visible live/settled selection during input and camera/dialog
movement, complete no-write snapshots, Apply/Undo, floor/tool/View and remount
retirement. Its synthetic setup uses the canonical model helper and server
facade, never a private dialog assignment. `wall-thickness-selection.test.mjs`
covers current target/width resolution and stale/foreign refusal without a browser.

General v10 visual acceptance (#948) compares the composed approved HTML, not only raw field tables: the 2.5D switch is first in Appearance. Four phase previews reuse DAY_CYCLE_PALETTES in dawn/day/dusk/night order; no View colour or phase rule is changed.

Matched WSL builds for final #948 v10 including themed action states (base aaea81353): editor281245→282379B gzip (+1134), raw3061177→3069720B (+8543). Only those deltas carry into editor/raw references (280882/3071227); inherited gaps1497/−1507B and bands remain. Onboarding30661→31044 stays within unchanged29374+2000 band. Initial View323451→323525 stays within its unchanged ceiling/budget. No absolute ceiling is raised. The settings footer is a sibling of the form, so its theme tokens are generated from the same form-kit token source at the settings-dialog owner; hover/focus must visibly tint the background, not only alter the colour of an invisible ghost border. Ordinary mock-match measures both light and dark hover states.

The #948 final visual pass also aligns the maintenance rows and themed converter link with v10. The deployed converter was checked over HTTPS200 and exposes Sweet Home3D plus Easy Floorplan YAML/JSON. Legacy smoke603 no longer injects a temporary mutant stylesheet: its ordinary off/on geometry assertion now measures the real shared General toggle, and settings-toggle-track-box-model-603 records the old box-model regression for the nightly runner only. No mutant is executed by the adapted smoke.

The final native-HA settings shell uses HA’s public header slot to render the same approved heading and close control as the fallback. The existing hp-close/dirty/discard owner remains unchanged. Its own footer slot wrapper has zero padding so HA cannot double the form footer insets. The settings content divider stretches to the body bottom, and successive toggle rows retain 18 px on both sides of the divider. Authentic pinned-HA captures cover all six General sections, 320/390/1280 px and three live themes; the actual close/discard recovery diagnostic also covers all four dialog owners. No HA shadow styles or component factories are patched.

After integrating accepted #936, the final #948 cost is remeasured against the same-toolchain clean bd6fb6616 source: editor273116→283621B gzip (+10505 own bytes), raw3043070→3089053B (+45983). Carry only those deltas onto dev references273105/3042858, yielding283610/3088841 and preserving inherited gaps11/212B and all bands/absolute budgets. Other source metric references are exactly dev’s145delegates/363ports/5564hostRefs/103portPrivates/101harnessPrivates; the actual integrated hostRefs5570 stays within the existing25band. Earlier #948 measurements above describe its pre-936 source, not a second budget increase. The General file chooser retains ZIP and JSON from #936 while its existing leaveFor guard still protects the settings draft; archive preview/apply/undo remain the accepted backupTransfer owner.

Space v7 visual parity (#945): editor-only optional north/navigation ports select the single source list and stacked identity fields; onboarding keeps its existing choice cards and persistence. The shared fieldGrid stacked variant, settings-only image/actions, metric grid, object footer and HA height variables preserve the default General layout. The object footer retains visible action names at320px and a separate commit row; the old footer-width smoke now witnesses that approved layout while preserving all containment/44px and non-settings wide-dialog checks. `smoke_space_settings_form` reads the unchanged v7 reference and exercises real source/save/validation/font/CO₂ controls against the public synthetic fixture. Source legacy show_borders=true/hide_openings=true is deliberately retained before Save; derived openings follow borders under the accepted migration. Authentic before/after raw input hash399cc1d32b61150ed80e3e859ce82f91b93739a3284f5ab1034ebad56a22bd6e;36fit/theme checks cover4sections×320/390/1280×3themes. SVG bytes are installed before seeding the image URL, avoiding a misleading cached thumbnail in captures. No agreed HTML is edited.

Matched WSL own-cost accounting for final #945 on General d496a749: editor283621→284685B gzip (+1064), onboarding31050→31438B (+388), raw3089053→3098026B (+8973). References become284674/29762/3097814, retaining inherited gaps11/1676/212B and all existing bands. Initial View323648 remains below unchanged322937+2000 and352000 budgets. Static metric references are unchanged; hostRefs5581 remains inside5564+25. This accounts for the shared source-list/image/metric UI and localized help, not a claimed performance improvement.

Final #945 after unused-copy cleanup, measured with an explicit fresh bundle:sync
on published fee606da in Linux/ext4: editor284720, onboarding31445, raw3097493.
Against the same General A (283621/31050/3089053), own deltas are1099/395/8440.
Final rolling refs284709/29769/3097281 retain inherited gaps11/1676/212 and all
bands/absolute limits. Prior Space visual-cost measurements above predate copy
cleanup. Pre-push/golden wrappers restore committed D files on exit: a restored
dist manifest is never a measurement of current source; use fresh bundle:sync.
Golden matrix78 keeps both hidden-opening View scenes aligned with the coupled
borders/openings choice. All geometry/pixel oracles and thresholds stay intact.

The final #945 full CI exposed six older browser witnesses outside the selected
smokes. Their adapters now use the coupled boundary/opening visibility policy:
tunnels remain painted with hidden boundaries; masonry cuts are checked again
after restoring visible boundaries; a legacy hide_openings flag alone leaves
the visible isometric structure and its physical cuts intact. Styling-hook
fixtures explicitly enable boundaries before checking opening selectors.
The fill-transition witness edits alpha in the actual picker, retaining the
same deterministic transition sampling and tolerance. Signal visibility uses
the approved three-option select with real keyboard input. Its synthetic
touch context now verifies an actual360px CSS viewport (the old mobile context
expanded the desktop demo to980px and never exercised the narrow section menu).
Popup target geometry is measured after its opening animation with0.01px
floating-point tolerance around44px. This is a test-only repair: no product A,
golden baseline, pixel threshold, physical geometry oracle or budget changed.

Review #945 r1 M1: the existing Room dialog now reads cardNameScale and
cardLabelScale separately. Its legacy hint remains unchanged when both bases
match; a translated split hint names both bases when they differ. The preview
multiplies each base by its corresponding Room multiplier. The executed Space
form witness saves150%/75%, edits Room200%/150%, and checks the rendered54px/
12.6px preview plus both named bases and cancellation without a config write.

Room settings #946: exercise the inherited/own fill select and independent bounds, all three source pickers, name/metric sizing, dirty/discard and WS refusal. The labelled preview is synthetic; assert actual readings on the plan and tooltip separately.

Historical pre-cleanup #946 Linux/ext4 build: Space v7 -> Room v4 changes lazy editor
284685 -> 284681 B gzip (-4), onboarding 31438 -> 31448 (+10), and raw bundle
3098026 -> 3097197 (-829). Carry only those own deltas: rolling references become
284670 / 29772 / 3096985, retaining the inherited 11 / 1676 / 212 B gaps and all
bands/absolute limits. Source counters remain 145/363/5564/103/101; actual Room
host references are 5567, within the existing band.

Final #946 on the reviewed Space A after copy cleanup: fresh Linux/ext4 bundle
editor284636/onboarding31428/raw3096669, versus final Space284720/31445/3097493.
Own deltas -84/-17/-824 produce refs284625/29752/3096457, preserving inherited
gaps11/1676/212 and every band/absolute limit. Source counters stay unchanged;
actual hostRefs5567 remains inside5564+25. The measured Room A is identical to
ce6c75d1; the parent rebase adds accepted test/review changes, not product code.


Device settings #947: smoke_device_settings_947 uses the four approved synthetic datasets and captures 390px light/dark plus desktop, checking 320/390/1280 in three live HA palettes, fixed preview size, rotation, unavailable source, friendly chips, clean/cancel and no commands. smoke_radar_setup retains its independent SVG matrix, calibration and save-boundary oracles through the legacy Details entry. Run actual HA dialog/picker checks separately; a fallback text input is not proof of the real HA MDI picker.

Historical pre-fidelity #947 size evidence (superseded by the final matched build): Room source `3a969edd` in Linux/ext4 measures
279944 B gzip for the lazy editor; the Device implementation and shared visual
corrections measure 281142 B (+1198 B). Only that measured cost moves the rolling
editor reference 278984 → 280182. The inherited 960-B gap, 2000-B band, initial
View limits and absolute budgets remain; the total-byte reference is unchanged.

Final #947 visual acceptance compares the immutable Device v6 structure on all
four approved datasets. `smoke_settings_native_select_947` mounts genuine pinned
HA components, opens the radar's long lists at 320/390/1280 px and verifies the
real body's scroll extent, popup keyboard/focus and unchanged config on Cancel.
Clipping the retained native select alone is insufficient: legacy padding and
overflow must also be contained. The corresponding regression is declared for
the nightly runner; development checks are ordinary positive tests and static
registry validation, never a claim that the mutant was executed.

Historical pre-cleanup matched #947 Linux/ext4 build (Room f6063a23 has identical A to measured
Room fad22f28): editor 284681 -> 286230 B gzip (+1549), onboarding 31448 -> 31991
(+543), raw bundle 3097197 -> 3105505 (+8308). Carry those own deltas onto the
Room references: 286219 / 30315 / 3105293, retaining inherited gaps 11 / 1676 /
212 B and every band/absolute limit. Actual initial View is 323110 B under the
unchanged 322937 +2000 ceiling and 352000 absolute budget. Counter references
stay 145/363/5564/103/101; actual host references 5574 fit the existing 25 band.

Historical pre-profile #947 on its reviewed parent A: fresh Linux/ext4 editor286270,
onboarding32010, raw3105417, versus final Room284636/31428/3096669. Own deltas
+1634/+582/+8748 produce refs286259/30334/3105205, keeping gaps11/1676/212
and all bands/absolute limits. Initial322945 stays under unchanged322937+2000
and352000. Counter refs remain145/363/5564/103/101, actual hostRefs5574.
The measured Device A is identical to28e4cece; the parent rebase changes
accepted tests/review history and generated baselines, not product code.

### Discard-confirmation polish (#990)

`demo/smoke_discard_dialog_polish.mjs` observes the native confirmation in a
real unsaved General settings flow: entrance mid-paint, automatic versus Tab
focus, close hover, Back/Escape/X and Discard, reduced motion, and an unrelated
warning. It retains screenshots at matching desktop/light and narrow/dark
viewports. `HP_990_CAPTURE_DIR` can separate before/after captures; it changes
only artifact destination, not product inputs or acceptance criteria.

The native #947 smoke depends on `tests_backend/requirements.txt` solely for the
verified Home Assistant frontend wheel pin. `check-inputs` asserts that exact
one-file dependency; backend suites remain outside all browser inputs. Its page
is registered with `watchPage`, and both fixture integrity and the ordinary
`finish` error verdict must pass. Approved-reference pages use the same guard.

Settings polish #955 keeps one interaction-paint module for form/footer actions,
discard confirmations and colour-picker confirmation, including the fallback
portal's complete CSS. Settings help opens immediately on an actual mouse entry;
embedded hosts forward the card's pointer modality. Focus/tap and coarse-pointer
sizing remain available. The shared settings shell fixes its
outer height via HA's public min/max-height tokens; its body alone scrolls.
Toggle labels and switches share the first grid row; captions occupy the next
row. Label wrapping balances complete words instead of leaving an orphaned tail.
The colour number field reserves space for100 and the native stepper. Settings
cards override the form-kit's clipping at sufficient specificity, preserving
compact action hover/focus rings. Ray-origin cards are native labelled radios,
with direct click and arrow-key selection of the existing setting; SUN rendering
and stored values are unchanged.

`smoke_settings_polish_955` mounts pinned real HA factories/CSS, checks all four
forms and four Device cases at1280/390/320px, including480px height and three
theme palettes, then verifies Keep/Discard and unchanged server config. It
exercises every available help/colour path, representative select paths and
all visible form/footer actions, including picker confirmation. `--fast` is the
same General-only positive witness for declared nightly mutations; it is not a
substitute for the full cross-dialog matrix. Geometry waits for popup animation
where appropriate; immediate help is checked separately before its hover paint
settles. Development runs the stock positive tests and static registry readiness,
never claims that the new mutants have executed.

Follow-up alignment checks compare a Range over the rendered label text with
the switch and help SVG centres. Comparing only the title container missed its
unused bottom space. Inline help follows the final text line, with a4px gap.
Palette titles keep the last word and help together so the icon cannot become
an orphaned line. Embedded Zigbee forwards pointer modality through its
shadow root, so instant mouse help keeps the shared no-sticky-touch contract.
The unclipped Room comfort block uses a shrinkable grid track at320px instead
of hiding overflowing number fields behind the card boundary.

Screenshot comparison uses the immutable approved HTML and real HA dialogs at
the same viewport/DPR with the pinned frontend's Roboto400/500/700 font files.
`applyHaDialogTypography` is opt-in fixture setup, not a product font override;
ordinary tests retain their existing fixture environment. Before/After captures
use identical data and font setup. Side-by-side, opacity overlay and a blurred,
adjustable-threshold difference map support review; a pixel ratio alone never
accepts the design. Shared checks cover all four forms and conditional profiles.

The #955 optical label adjustment was superseded by the approved #963 unshifted
footer. `buttonPaint` still measures actual PNG ink and the nested SVG centre;
the four-form checks retain the44px target, visible lettering and centred label
and check. The #963 paired fixture independently compares that lettering with
the immutable prototype in all languages/themes. Its observed Roboto offsets
are RU/FR2px, DE1.5px and EN0.5px on both sides. This is the approved geometry,
not a relaxed comparison against a generated current-product reference.
Wrapped help shares one final-word renderer; non-input field headings use the
same inline layout, while real input labels retain their native for linkage.
Emitted settings CSS drops redundant whitespace to stay inside the existing
raw-bundle band; source rules retain one line each and no ceiling is raised.

The inherited #605 alpha witness identifies the complete colour-tile caption,
including its final-word span, rather than assuming one child holds all text.
Its alpha, checkerboard, foreground and draft-persistence oracles are unchanged.

The final profile comparison found a cascade conflict: the generic later-row
toggle padding overrode the subsection's no-border spacing. The unchanged-code
native Radar probe measured41px from its subsection to the first rendered
label, instead of the intended10–30px range. The shared adjacent-subsection
rule removes the extra18px, and the matrix measures the visible gap in every
consumer rather than checking a CSS property name.

The four dialog roots carry their resolved interface language.
`smoke_settings_button_alignment_955` checks painted letters, label and nested
SVG centres for all four forms at1280/390px in all four languages (32
combinations), using the approved #963 alignment. The shared
profile body actions also retain44px targets, checked across all seven cases.

Paired screenshots exposed a second avoidable navigation line: the extra1px
button border left117px for Space's active Appearance caption, while the
approved borderless button had119px. The ordinary native probe was red with
two lines at1280px. Matching the reference's borderless navigation restores one
line without forced nowrap; the full geometry matrix checks this visible result.

An ordinary inherited-font input exposed English Save1.5px low in Segoe with
body line-height2.1. The smaller English adjustment also centres that neighbour;
the focused guard supports `--demo-font --line-height=2.1`, changing only host
typography, never injecting a fix into the component. The font stack falls back
to Roboto when Segoe is absent; the actual Segoe neighbour was measured on
Windows. The existing optical-lettering registry witness stays static checked
only; no development mutation execution.

## Browser progress checks on task pushes (#983)

`task-ci-plan.mjs` uses the same bounded task plan for push, S7 and merge on
ship/show/ask (#1044). It reads the complete task diff from its merge base with
`origin/dev`, not merely the last push; range guards retain their separate
`GREEN_BASE`. Smokes come from changed entries,
smoke-select and declared AC; unproven source/shared harness coverage adds the
bounded visual minimum. `ci:full` explicitly requests the full matrix.
`ci:golden` requests connected scenes plus the issue's visual intent. An unknown
render connection requires an explicit scene plan, with an actionable error;
it never silently skips the change or expands to every Golden scene.

Store visual intent in the existing `docs/release-ledger/<previous-stable>/<NN>.json`
entry. Obtain `baselineIndex` with `node scripts/task-visual-intent.mjs --baseline-index`:

```json
"visual": {
  "schema": 1,
  "baselineIndex": "<SHA-256 printed by the command>",
  "golden": [
    { "id": "geometry-view-dark-fit", "expectation": "change", "reason": "Opening jamb now reaches its wall face" }
  ],
  "smokes": ["smoke_modes.mjs"]
}
```

Use `change` for an existing frame and `new` for a new scene; include a concrete
reason for each. The current task's scenes and connected cases are captured;
pending intents of earlier tasks are considered only for those selected scenes.
`node scripts/task-visual-intent.mjs` prints the aggregate for the current cycle
and accepted index. A new accepted index expires the old intents; after a rebase
onto it, refresh the task's plan only if an intended change remains outstanding.

The selected worker uses canonical capture and its semantic assertions, verifies
each existing baseline hash/browser, and allows only the declared pixel delta
or declared missing new baseline. Errors, undeclared differences, missing output,
signals and timeouts fail. New pending scenes may make the complete baseline
index stale; that does not invalidate a checked individual frame. It writes
`artifacts/browser-selected/golden/` (frames, diffs and per-scene reports), never
global baselines. The author reviews those images and records IDs, observed
changes and artifact/run link in the handoff. A green expected-delta check alone
does not say that a person reviewed the image.

`proof.json.browserPlan` records selected coverage, intent and actual job result.
Compatible task proof serves S7/merge; it never proves release completeness.
Nightly captures the full matrix and distinguishes declared pending visual drift
from errors/unexpected changes. Its pending visual result cannot mint a reusable
accepted-Golden producer or satisfy release policy. Before beta, beta-derived
aggregates current pending intent with explicit release inputs; canonical full
acceptance still requires complete Linux provenance, all scene checks, environment
witnesses and review of the combined result. Undeclared changes refuse acceptance.

## Path profiles for push and PR (#980)

`validate-product.yml`, `validate-tooling.yml` and `validate-docs.yml` are
computed outputs of `node scripts/ci-profiles.mjs --write`. Edit the shared
recipe in `validate.yml` and domains in `ci-profile-paths.mjs`; regenerate after
adding or changing a test's ownership. `test/ci-profiles.test.mjs` detects drift.
Product covers unknown inputs conservatively; known docs/tooling/output paths
are excluded. Tooling unit filenames come from `unitGroups`, without a hand list.
Tooling runs its no-build suite; `.github` changes also request HACS/Hassfest.
Docs run preflight and publish progress in the same runner, without npm/build.

The shared display name preserves the existing `workflow_run` trigger in main;
`run-name` identifies the profile. Consumers register exact workflow paths in
`ci-workflows.mjs`; a matching display name grants no authority. Full dispatch
stays in `validate.yml`. Non-product proofs cannot satisfy product policy.
A product proof names the profiles required by the complete candidate range;
missing/pending companions request canonical validation, red companions fail.
Only canonical completed runs advance the old range/classification induction;
a narrower push profile cannot erase an unjudged ancestor. Night and release
continue to request full policy. The proof schema stays `houseplan-ci-proof/v1`.


## Cross-branch CI proof registry (#981)

`ci-proofs` is an orphan data branch excluded from every validation push entry.
CI publishes `proofs/<job>/<key>.json` through a private Git index and a CAS push;
a lost lease fetches the winning tip and merges addresses again. The checkout,
index and task branch remain in place. Lookup uses one shallow fetch, then
parallel cached source-API/artifact requests; it never scans recent run history
or reads branch-scoped success caches. A JSON address is authenticated against
the immutable ci-proof artifact and actual completed source attempt/jobs.

After changing imports/test ownership, run `node scripts/ci-profiles.mjs --write`
and `node scripts/ci-registry-inventory.mjs --write`. The committed inventory is
computed with TypeScript during authoring/fresh guards; lookup needs no npm ci.
Frontend job runs build/types/pure units only when no compatible source exists.
Bundle distribution and product guards always assemble/verify the exact current
bytes, run FS/Git/process units, range, budget/unused and backend manifest checks.
A beta alias validates all seven existing synchronized release mirrors (root
package/lock, lock root package, integration manifest/const, both CARD_VERSION
literals) before masking their scalar values. Dependencies, formatting and all
other bytes remain significant. A reused beta rebuilds its exact versioned
bundle and emitted helpers, then runs one smoke on that bundle; changed trees
run the complete demanded matrix. HACS/Hassfest remain fresh for candidates.

`validate.yml` has `fresh=true` for explicit fresh execution; night always sends
full=true/fresh=true, an actual stable candidate cannot reuse. A stable version
string on an ordinary issue/dev task does not make it a stable release.
`candidate=true` is validation-only
and publishes no tag/release. Before the new reader reaches accepted dev,
review/merge dispatches automatically use the fresh v1-compatible migration
route. Additional registry fields preserve the legacy required-check ID list;
new readers independently require fresh bundle/product-guard execution.
The old transfer-marker CLI is frozen fail-closed. Old frontend proof helpers
remain read compatibility; workflows no longer discover producers through them.

Pre-push reads the same registry under its real local tools/platform and verifies
restored dist/test-build inventories. Mismatched tools require fresh execution;
no CI image/environment is invented. The private local receipt remains a local
accelerator with fresh range/filesystem guards and grants no CI/review authority.

Source authentication also compares immutable Git tree objects independently of
both serialized keys. Product paths, job roots, closed inputs, transitive trust
code and the computed inventory must match; beta allows only validated mirror
scalars. Actual source/current workflow recipes include lookup, proof writing,
fresh guards and bundle production. Canonical and product variants share a
key over both registered recipe variants; the source records the variant that
actually executed. Source Git/file API responses are cached per immutable SHA;
local pre-push supplies its real committed snapshot, including unpublished HEAD.

Lookup's own checkout is sparse: ordinary file identity uses immutable Git blob
content IDs plus modes, independent of commit ancestry. Only trust/config files
and beta scalar mirrors need their bytes; bundles and baseline images are not
downloaded for lookup. Network authentication has an eight-second
lookup deadline and unavailable/slow sources fall back to fresh jobs. Actual
Node flags/options, locale and timezone are part of the recorded environment;
local reuse never substitutes CI image values. The proof publisher alone has
contents:write and skips fork PR index writes.
