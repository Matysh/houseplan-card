# Implementation guide: settings dialogs redesign (for the implementing Claude session)

Read this before touching code. It tells you where the four dialogs live in `Matysh/houseplan-card`, what the prototype in `reference/` means, which prototype control maps to which product state key, and what you must not change.

Verified against dev `9683a59` (v1.76.0, 2026-09-18). Re-check line numbers with `grep`; they drift.

## 0. Ground rules

1. **UI only, no global code changes.** Only the markup and styles of the four dialogs change. Every product state key, config key, resolver, save path, permission check and side effect stays exactly as it is. A new control must write the same value to the same key the old control wrote. If a visual decision in the prototype needs a behaviour change, do not improvise and do not ask the repository owner: read `OPEN-POINTS.md` (known cases with proposed defaults) and **ask JB in the chat** before implementing that dialog; keep current behaviour meanwhile.
2. **Process.** `AGENTS.md` Rule #1: product code changes only when the issue carries `S5-ready`, `S6-in-progress` or `S7-code-review` (`gh issue view <NN> --repo Matysh/houseplan-card --json labels`). Branch `issue/<NN>-settings-dialogs`. Commit trailers `Issue: #<NN>` and `User-Visible: yes`. Changelog entries in `docs/CHANGELOG.md` and `docs/CHANGELOG.ru.md` in the same commit. Class D paths (`dist/**`, `custom_components/houseplan/frontend/**`) only via `npm run bundle:sync`.
3. **Prototype JS is a design reference, not code to port.** Read `reference/*.js` to learn the markup, class names, states and copy; do not copy localStorage, demo data, the gallery shell or `room-fill.js` into the product.
4. **Priority when they disagree:** `SPEC.md` > existing House Plan contracts (data, safety, a11y, hp-dialog, touch) > prototype visuals > prototype implementation details.

## 1. Where things are in the product

| Surface | Renderer | State | Styles | Notes |
|---|---|---|---|---|
| Space settings (edit/create) | `src/houseplan-editor-runtime.ts` `_renderSpaceDialog()` (~13614) | `SpaceDialogState` in `src/space-dialog.ts`; `host._spaceDialog` | `src/styles/dialogs.styles.ts` (`.srcrow`, `.dispsection`, `.rhint`, `.colorrow`, `.areasel`, `.namein`, `.helpfieldlabel`) | `hp-dialog data-kind="space" wide`; create mode has import progress and Skip; `switchSpacePlanSource` / `touchSpaceDisplay` guard `displayTouched` |
| Space display section in onboarding | `src/houseplan-onboarding-runtime.ts` (~700–780) | same keys | same | duplicates Display + Room card rows; must get the same controls |
| General settings | `_renderSettingsDialog()` (~10340) + `_renderColorRow()` (~10090) | `host._settingsDialog` `{ colors, glowRadius, bgColor, northDeg, bgMode, sunRays, sunRayOrigin, showRoomTooltip, zigbeeTopology, radarShowLive, busy }` | same | `data-kind="settings"`; Zigbee block is `src/hp-zigbee-topology-settings.ts`; sun rays select in `src/sun-settings-view.ts`; compass `host._renderCompass()` in `houseplan-card.ts` (~10658); `_openBackupExport`, `_pickBackupImport`, `_openAlignDialog`, undo buttons |
| Room settings (edit/create) | `_renderRoomDialog()` (~13987), `_renderRoomSource()` (~13941) | `host._nameSel`, `_areaSel`, `_roomFill` ('' \| none \| lqi \| light \| temp \| custom), `_roomCustomFill`, `_roomTempMin/_roomTempMax` (strings), `_roomTempSrc/_roomHumSrc` ('' = average), `_roomSrcOpen/_roomSrcFilter`, `_roomNameScale/_roomLabelScale` (fractions) | same, `hp-dialog.roomdialog` block | `data-kind="room" wide`; temperature bounds in `src/room-temperature-controls.ts` (`roomTemperatureControls`), parsing in `space-dialog.ts` (`roomTempThresholdDraft`) |
| Device on the plan | `_renderMarkerDialog()` (~12887) + radar/vacuum sections | `host._markerDialog` (keys listed in §5) | same (`.markerlightgroup`, `.markerradios`, `.markerhelpfield`, `.ctrlchips`, `.dropbtn`, `.droppanel`, `.candlist`, `.habindingbanner`) | `data-kind="marker"`; preview `src/hp-device-preview.ts`; `*Touched` / `original*` flags drive save semantics |
| Help tooltip | `src/hp-help.ts`, used via `this._help('<i18n key>.help')` | – | own | keep as is; only its placement changes |
| Colour field today | `src/hp-color-opacity.ts` (`hp-color-opacity`, event `hp-color-opacity-change` `{color, opacity}`) | – | own | new inline field replaces it in the four dialogs only |
| Dialog shell | `src/hp-dialog.ts` (`wide` = `--hp-dialog-wide-width`, 500px) | – | own | scope width/badge changes to `:host([data-kind="…"])` |
| Bool / range inputs | `_boolInput()` (~10067, `ha-switch` fallback checkbox), `_rangeInput()` (`ha-slider`) | – | – | keep using them inside the new rows |
| i18n | `src/i18n/{en,ru,de,fr}.json`, topology strings in `src/i18n/topology/*.json`, support strings in `src/i18n/support/*.json` | – | – | parity tests reject missing keys; placeholders are a contract |
| Tests | `test/space-dialog.test.mjs`, `test/hp-dialog-contract.test.mjs`, room/space/marker unit tests; `demo/smoke_*.mjs` | – | – | `grep -l "_spaceDialog\|_settingsDialog\|_markerDialog\|roomdialog" demo/*.mjs test/*.mjs` |

## 2. Build order (suggested)

1. **Primitives first**, in one new module pair (names are a proposal): `src/settings-form-view.ts` (lit template helpers) and `src/styles/settings-form.styles.ts` (scoped under `hp-dialog[data-kind="space"], [data-kind="settings"], [data-kind="room"], [data-kind="marker"]`). Take sizes and colours from `reference/styles.css`, map colours to HA theme variables (§3). Primitives: `card(title, help?, body)`, `subsection(title, help?)`, `settingRow(icon, title, description?, help?, control)`, `compactRow(icon, title, control)`, `segmented(name, options, value, onChange, disabled?)`, `valueTiles(items)`, `colorTiles(items)`, `colorField(...)`, `chips(items, onRemove)`, `sourceButton + sourcePanel`, `footer(left, status, right)`.
2. **Colour field component** (`hp-color-field` or `compact` mode of `hp-color-opacity`): swatch = `<input type="color">`, hex text, optional opacity number (0–100 in UI, fraction in state), optional Reset. Emits the same `{color, opacity}` shape. Fallback to a hex text input when `input[type=color]` degrades.
3. **Space dialog** (edit + create + onboarding). Smallest surface, validates the primitives.
4. **General settings**, including restyling `hp-zigbee-topology-settings` and `sun-settings-view`.
5. **Room settings** (edit + create queue).
6. **Device on the plan** (largest; keep every conditional branch, §5).
7. Smokes and unit tests, i18n for four locales, changelogs, docs, `docs/design/<NN>-settings-dialogs/` with the reference and `ACCEPTANCE.md` (paired screenshots).

Gates to run before review: `npm run typecheck`, `npm test`, `npm run gate:small`, `npm run bundle:budget`, i18n parity tests, `npm run bundle:sync` for class D.

## 3. Prototype → product token mapping

| Prototype | Product |
|---|---|
| accent `#4a9ec6`, active text `#398fb8` | `var(--primary-color)` (text: same, or `color-mix` darkened for contrast on light theme) |
| active fill `#f3f9fc`, active border `#b7d5e4` | `color-mix(in srgb, var(--primary-color) 10%, var(--card-background-color))` and 30% |
| card background `#fff`, form canvas `#f6f6f6`, plate `#fafafa` | `var(--card-background-color)`, `var(--secondary-background-color)`, mix of the two |
| line `#ddd`, `#e5e5e5` | `var(--divider-color)` |
| ink `#202124`, muted `#666` / `#777`, hint `#8a949b` | `var(--primary-text-color)`, `var(--secondary-text-color)` |
| danger `#db543d` | `var(--error-color)` |
| Roboto 14 px body, 16 px h3, 20 px h2 | HA font family; keep 14/16/20 px or HA equivalents, never below 14 px body |
| radii 15 (dialog) / 11 (card) / 8 (buttons, tiles) / 7 (fields) | keep |
| 44 px controls, 40 px compact rows, 72 px value tiles, 32 px help button | keep |

Dark theme: every colour comes from the token set; the swatch shows the resolved colour without a checkerboard.

## 4. Control mapping per dialog

Value contracts. Any deviation is a bug.

### 4.1 Space settings (`SpaceDialogState`) — see `docs/FIELD-MAP-space.md` for the full table

| Prototype control | Key | Value written | Today |
|---|---|---|---|
| Space name text | `title` | string | `.namein` |
| Grid cell size number + unit | `cellCm`, `cellCmInput`, `cellCmTouched` | via `strictNumber` + `gridCellFieldToCm` (imperial kept) | `#space-cell-cm` |
| Floor plan choice cards | `source` | `'draw' \| 'file'` via `switchSpacePlanSource` | radios `plansrc` |
| Upload / Browse uploaded | `planFile`, `planUrl`, `pickSaved`, `saved*` | unchanged handlers | `_pickPlanFile`, `_toggleServerPlans` |
| Always show room borders row | `showBorders` | via `touchSpaceDisplay` | `_boolInput` |
| Zero-thickness walls segment | `zeroWallStyle` | `'dashed' \| 'solid'` | select |
| Border & name color field | `roomColor`, `roomOpacity` | hex, 0–100 | `hp-color-opacity` |
| Room fill segment | `fillMode` | `SPACE_FILL_UI_MODES` value | radios `fillmode` |
| Fill color field + Reset | `customFill` | `{c, a}` or `null` | `hp-color-opacity` + Reset |
| Comfort range | `tempMin`, `tempMax` | numbers via `strictNumber` | `.tempin` |
| Visible layers compact rows | `hideDecor`, `hideOpenings` (**UI inverted**), `showLqi` | booleans | `_boolInput` |
| Show room names row | `showNames` | via `touchSpaceDisplay` | `_boolInput` |
| Values on the card tiles | `labelTemp`, `labelHum`, `labelLqi`, `labelLight` | booleans; disabled when `!showNames`, values kept | `_boolInput` |
| Room-card font size slider + number + Reset | `cardFontScale` | fraction (UI shows %) | `_rangeInput` |
| Plan background segment | `bgMode` | `null \| 'static' \| 'daynight'` | select |
| Background color field + Reset | `bgColor` | hex or `null` | `hp-color-opacity` + Inherit button |
| Sunlight radios | `sunRays` | `null \| true \| false` | select |
| North select + degrees + compass | `northDeg` | `null` or 0–359 int; inherited value from `northDegOf(settings, {})` | number input with placeholder |
| Light-source glow row | `glowEnabled` | boolean | `_boolInput` |
| Footer Copy / Delete / Skip / Cancel / Save | – | `openSpaceCopyDialog`, `_deleteSpace`, `_skipImport`, `_saveSpaceDialog` unchanged | – |

Removed from the UI (no state change): card preview `_renderCardPreview` under the font slider; `rhint` paragraphs (text moves to `?`).

### 4.2 General settings (`host._settingsDialog`)

| Prototype control | Key | Value written | Today |
|---|---|---|---|
| Display rows | `showRoomTooltip`, `radarShowLive` | booleans | `_boolInput` |
| Zigbee links card | `zigbeeTopology` | unchanged object; `savedEnabled` from `zigbeeTopologySettingsOf(host._settings).enabled` gates provider buttons | `hp-zigbee-topology-settings` |
| Colour tiles (8 fills + 2 glow) | `colors.<key>` | `{c, a}`; UI % ↔ fraction | `_renderColorRow` |
| Glow radius | `glowRadius` | number > 0 via `strictNumber`; unit `gs.unit_m` / `gs.unit_ft` | `#gs-glow-radius` |
| Wall fill plate | `colors.wall_fill` | `{c, a}` | `_renderColorRow` |
| Plan background segment | `bgMode` | `'static' \| 'daynight'` (no null here) | select |
| Background around the plan field + Reset | `bgColor` | hex or `null` (`gs.bg_default`) | `hp-color-opacity` + button |
| North field + Clear + compass | `northDeg` | `null` or 0–359 int | input + `gs.north_clear` |
| Sunlight through windows row | `sunRays` | boolean | `_boolInput` |
| Sun rays segment | `sunRayOrigin` | `'inner' \| 'outer'` via `renderSunRayOriginSelect` callback | select |
| Data card buttons | – | `_openBackupExport`, `_pickBackupImport`, `_openAlignDialog`, `_undoPlanOptimization` unchanged; `_canEdit` gate kept | – |
| Reset to defaults | whole draft | same reset object as today's `gs.reset` button | – |

Keep `gs.sun_missing` callout when `sunStateOf(hass)` is falsy.

### 4.3 Room settings (host fields)

| Prototype control | Field | Value written | Today |
|---|---|---|---|
| Display name | `_nameSel` | string; name auto-filled from area when empty (unchanged) | `.namein` |
| Home Assistant area select | `_areaSel` | area id or '' | `.areasel` |
| "As the space" toggle | `_roomFill` | on → `''`; off → the current space fill mode as starting value (see OPEN-POINTS Q4) | first radio |
| Fill segment | `_roomFill` | `ROOM_FILL_MODES` value; non-custom clears `_roomCustomFill` (unchanged) | radios `rfill` |
| Fill color field + Reset | `_roomCustomFill` | `{c, a}` or `null` (Reset) | `hp-color-opacity` |
| Comfort range | `_roomTempMin`, `_roomTempMax` | raw strings; shown when effective fill is `temp` (`roomTemperatureControls`) | `roomtemprange` |
| Source segment + picker | `_roomTempSrc`, `_roomHumSrc`, `_roomSrcOpen`, `_roomSrcFilter` | '' or `device:…` / `entity:…` from `_roomSrcCandidates()` | `_renderRoomSource` |
| Font sizes | `_roomNameScale`, `_roomLabelScale` | fractions (UI %) | `_rangeInput` |
| Footer | – | `_roomDialogCancel`, `_saveRoomEdit`, `_saveRoom`, `_keepClosedAsPartitions` unchanged; Save disabled by the same `tempValid` / name / `canSaveNew` rules | – |

Removed from the UI: `_renderCardPreview` at the bottom.

### 4.4 Device on the plan (`host._markerDialog`)

| Prototype control | Key(s) | Notes |
|---|---|---|
| Name | `name` | – |
| Binding segment | `bindingMode` (`'virtual' \| 'ha'`) | – |
| Binding picker (button + inline panel + search + Show entities checkbox) | `binding`, `bindingOpen`, `bindingFilter`, `showEntities` | candidates from the existing list builder; `marker.binding_disabled` state kept |
| Room select | `room`, `roomTouched` | options `marker.room_auto` / `marker.room_choose` + rooms |
| Tap action select | `tapAction`, `tapActionTouched`, `tapHintAnnouncement` | keep the announcement text (Target / Now) as the hint |
| Entity to toggle select | `toggleEntity`, `toggleEntityTouched` | conditional, unchanged |
| What to run picker | `tapTarget`, `runFilter` | conditional (`tap.run`), unchanged |
| Ask for confirmation row | `tapConfirm` | hidden for `tap.none` (OPEN-POINTS Q8) |
| Controls other light sources (chips + search list) | `controls`, `controlsFilter` | existing `ctrlchips` semantics |
| Include the device temperature in the room | `useClimateTemp` | conditional (`climrow`), keep as a row |
| Light source segment | `lightRole`, `lightRoleTouched` | Auto label shows `marker.light_role_auto_yes/no` as hint |
| Leading light entity select | `lightEntity`, `lightEntityTouched` | conditional, unchanged |
| Glow mode segment, colour field, brightness slider | `glowMode`, `glowColor`, `glowBrightness`, `glowColorDrafted`, `glowBrightnessDrafted`, `glowTouched` | disabled states and messages (`glow_disabled_*`, `glow_passive_hint`) unchanged |
| Glow radius | `glowRadius` | empty = general radius |
| Icon field + clear + Pin | `icon`, `autoIcon` | `marker.icon_auto`, `marker.icon_pin_auto` |
| Display select + hint | `display` | `display.*` options; `marker.display_hint_*`; `marker.static_alarm_warning` |
| Activity pulse colour / size | `rippleColor`, `rippleSize` | conditional on display mode |
| Value source select | `valueSource`, `valueSourceTouched` | conditional on value display modes |
| Value badge toggle, source, position | `valueBadgeEnabled`, `valueBadgeSource`, `valueBadgePosition`, `valueBadgeTouched` | warnings `value_badge_static / _missing / _duplicate / _empty` |
| Display preview | – | `hp-device-preview` with its Now / Example controls, inside the tinted block |
| Icon size / rotation | `size`, `angle` | two sliders + numbers |
| Model, Link, Description, Manuals | `model`, `link`, `description`, `pdfs` | Attach via the existing file input; chips with remove |
| Additional actions: presence radar, vacuum | `radar*`, `_renderRadarSection`, `_renderVacSection` | same conditions, restyled |
| Banners | `habindingbanner`, `ha_registry_limited`, Open in HA | callouts in Basics |
| Footer | `hideFromPlan`, delete, cancel, save | `_toggleMarkerDialogVisibility`, `_deleteMarker`, `_saveMarker`, same disabled conditions |

## 5. Things the prototype does not show (implement anyway, same style)

Space create mode (import progress, Skip); onboarding Display section; General `gs.sun_missing`, undo buttons, `_canEdit` gating; Room create queue (`room.queue_progress`, Keep as walls) and `canSaveNew`; Device: Entity to toggle, What to run, Include the device temperature, Leading light entity, Value source, static alarm warning, binding banners, radar and vacuum sections, `bindingOpen` disabled state, Show button when hidden. Use `settingRow` / `selectField` / `callout` primitives; do not leave them in the old markup.

## 6. Verification checklist for the PR

- [ ] For each dialog: open, change every control once, save, diff the stored config against a run on `dev` with the same actions (byte-identical).
- [ ] Inverted layers: stored `hide_decor: true` renders Decorative layer OFF; toggling ON stores `false`.
- [ ] Space: `displayTouched` survives source switches in create mode; onboarding writes the same keys.
- [ ] Room: `''` vs mode, `null` custom fill until edited, empty temperature strings inherit.
- [ ] Device: every `*Touched` flag flips only when the user changes that control; `original*` restored on cancel.
- [ ] All `?` open the same text keys as before; no `rhint` text lost (grep the removed keys, each must be used by a `?` or intentionally deleted with a note).
- [ ] 320 / 390 / 560 / 200% text / RU / DE / FR / dark theme captures.
- [ ] Paired screenshots vs `screenshots/*.png` in `docs/design/<NN>-settings-dialogs/ACCEPTANCE.md`.
