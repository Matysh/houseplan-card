# #931 implementation evidence

This is author evidence, **not an independent review verdict**. The issue body
revision 2.1 and `SPEC-REVIEW-931-r3.md` govern acceptance.

## Design comparison

Approved references stay at
[`approved-2026-10-18`](../../design/931-properties-panel/approved-2026-10-18/README.md),
publication commit `825d6aef8cb79211830c634c08090080602dcfc5`.
Their 31-file manifest is verified before and after capture; no reference is
regenerated, masked or edited. The reference renderer is used read-only for
control-bound measurements, never substituted for the actual product.

[`actual/index.html`](actual/index.html) pairs all nine panels and the HA variable
dialog. Each panel also has its full-screen actual PNG. All captures use 1920×1080,
DPR 1, RU, light theme and the pinned Playwright/Chromium. Installed Segoe UI fonts
are loaded read-only for typography; no font files are distributed.
[`capture.json`](actual/capture.json) binds product source/bundle fingerprint,
reference manifest and all screenshot hashes. [`measurements.json`](actual/measurements.json)
contains actual panel/group/control bounds and reference deltas. Capture rejects
panel/group bounds or common/type-specific controls outside 1 CSS px; it also
checks the 560×448 dialog at (680,300). Images are actual product output, not a
new golden baseline.

Reproduce from a freshly built/synchronised bundle:

```sh
HP_PROPERTIES_CAPTURE_DIR=output/properties-931/comparison node demo/capture_properties_panel.mjs
```

### Semantic differences from illustrative fixture values

- Numeric inputs retain the existing unit adapter (decimal dot, no grouped
  thousands). They are editable number controls, not static formatted spans.
- The door's physical inside-corner gap is 244 cm with a 12 cm wall, not the
  demonstrator's centreline-like 250 cm. The visible reference and field use the
  **same** physical resolver. Width still keeps centre. Room direction labels use
  the actual room name in quotes instead of guessing Russian declension.
- Text bounds are measured from the actual HA-resolved string and font, not
  forced to the demonstrator's illustrative 200×30 cm. The current resolver
  supplies `22.4 °C`; no new rounding/locale rule is introduced.
- The existing device face/HA icon and native full-properties tray remain.
  Selection adds the approved teal outline/handles/tag; it does not redesign
  device state colours or unrelated navigation/furniture around the panel.
- Dynamic metadata describes the actual target/floor. The main-image metadata
  says “Основная картинка плана”; no synthetic room name is persisted.
  Following r1, opening metadata lists the resolved adjacent names in room-list
  order; a contour lists its actual owner(s), including exact legacy boundary
  matching. RU preserves the stored case/name in quotes (“Контур «Гостиная»”),
  rather than attempting the demonstrator's illustrative genitive “гостиной”;
  this applies the same no-guessed-declension rule as §7.3. Empty/ambiguous
  context retains the generic type/floor instead of inventing a room.
- After accepted #945, opening symbols follow the same saved display choice as
  borders. The fixture has a plan image and no explicit show_borders override,
  so Devices/Background full-screen frames no longer show the unrelated door;
  the Plan editor still exposes its physical opening. Panel controls, crop
  bounds and approved designer files remain unchanged.

These differences are exposed for independent inspection, not masked as a pixel
match. The accepted shell, grouping, controls, states, actions and selection
vocabulary remain the implementation target.

## Executed behavioural evidence

- `node demo/smoke_properties_panel.mjs`: native wall/opening/column/device
  selection, Enter+blur deduplication, invalid/escape, 959/960, suspended number
  and invalid HEX, colour confirmation/no intermediate writes, delayed-save
  pending controls (no dropped new input), ratio/centre,
  text cancel/insert/caret/newline, alpha zero/reset, device Undo and zero HA
  services. All matrix families/subtypes render through the production owner;
  selection leaves server config unchanged. Short viewport and six theme
  combinations are exercised through computed background/text colours, not
  just a theme attribute. Missing HA mode follows browser CSS; explicit HA wins.
- `node demo/smoke_editor_styles_lazy.mjs`: cold View/kiosk/static/onboarding,
  first-frame styles, two cards, warm remount and retired/failed imports passed.
- `node demo/smoke_color_picker.mjs`, `node demo/smoke_editor_gestures.mjs`,
  `node demo/smoke_device_position_history.mjs`,
  `node demo/smoke_physical_body_characterization.mjs`: existing neighbouring
  colour, touch/cancel, ordered history and physical gesture contracts passed.
- The seven `test/properties-*.test.mjs` files: 39 tests including r1 room-context coverage,
  strict parser, field/lane authority, transform/physical semantics, targeted
  patches, actual runtime writer/rollback/history and RU/EN copy.
- `python -m pytest tests_backend/test_validation.py tests_backend/test_config_schema_manifest.py tests_backend/test_support_package.py tests_backend/test_ha_websocket.py tests_backend/test_ha_import_export.py -q`:
  **574 passed, 1 skipped** on the joint #931/#945 source (previously552), including actual HA entry reload/storage and
  plan-only alpha transfer, not just mocked Python validation.
- `node scripts/model-invariants.mjs --config test/fixtures/config-lifecycle/current.json --json`:
  zero violations (four existing legacy wall-key notes, no rewrite).

The complete local gate and branch full/golden CI are reported in the issue
handoff, not inferred from the targeted checks above. Headless evidence is not
owner or real-GPU acceptance.

## Protective AC → witness → negative oracle

### Code review r1 repairs (joint source with accepted #946)

| Finding | Repair and executable oracle |
|---|---|
| H1 room context | Named contour owners (canonical IDs or exact legacy edge), resolved opening neighbours. Catalog units reject generic metadata; capture asserts actual room context. Stored names retain case/quotes as explained above, not guessed inflection. |
| H1 reset/removal | Reset path equals the immutable reference SVG. Removal words and tooltip bounds compare to reference DOM; line breaks/arrow match the panels. |
| H1 solid swatch | No conflicting cover flag. Computed trigger has no checkerboard, inner opacity is 1, width15px; flat corners/border match the reference. General alpha tiles retain the #615 predicate and checkerboard. |
| M1 modal exclusivity | Fifteen native object/subtype routes open full dialogs at1920/959. Invalid wide drafts block opening; hidden narrow drafts are invalidated with no write; wide panel is inert. A real held config/set ACK defers the text dialog and then opens it exactly after success. Missing beforeIntent loses that deferred retry and fails. |

The combined-source panel smoke, `smoke_color_picker` and
`smoke_dialog_polish_605` passed. All nine actual panels/full screens and the
variable dialog were recaptured; immutable manifest31/31, common controls max0,
type controls max0.78125 CSS px, tooltip bounds within1. The changed pairs were
visually re-read against approved PNGs. Complete CI is reported in the handoff,
not inferred from these targeted checks. New bases are not needed: the r1/Room
source fits all existing references/bands and the unchanged initial View limit.

| AC | Witness | What goes red |
|---|---|---|
| AC1/3 | panel smoke, catalog identity tests, cold/lazy smoke | View has no panel; 959 has zero panel nodes; wrong floor/binding resolves null |
| AC2 | paired PNGs + measured common/type controls + manifest | >1 CSS px or changed approved hash fails capture; independent visual review still required |
| AC4/6 | transforms/physical/catalog tests, native opening smoke | bad numeric suffix/range, T/X edit, overlap/not-fit or changed physical reference rejects |
| AC5 | controller/runtime tests + picker/resize smoke | invalid/ESC/no-op have zero writes/history; `properties-resize-forgets-internal-hex-draft` registered, not executed |
| AC7 | panel smoke, text patch tests | Cancel retains original; Enter is newline; Insert is one saved template at caret; >200 rejected |
| AC8 | targeted patch/copy tests + HA reload/export tests | sibling/null/absence retained; null/bool/string alpha rejected; plan-only alpha must survive |
| AC9/10 | table-driven native dialog smoke at 1920/959 + delayed real HA writer | each non-device family rejects invalid wide drafts, makes the wide panel inert and invalidates hidden narrow drafts; a pending text edit opens its full dialog only after ACK; missing deferred retry or an omitted inert flag fails |
| AC11/12 | actual runtime writer/history tests + controller authority | failed/preflight/conflict restores owned state/exact cursor; newer sibling/authority cannot be overwritten |
| AC13/14 | short/dark and existing touch/lazy smokes; budget gates | cancelled gesture writes nothing; cold View requests no editor; old bands/View ceilings remain |

Twelve new mutation declarations are static witnesses only. The r1 additions
cover the solid swatch and deferred native dialog handoff; existing #615 colour
tile/plate guards keep their source contract. `mutation-gate --check`
does **not** execute them and is not a caught verdict; execution remains nightly.
