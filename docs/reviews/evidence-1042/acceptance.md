# #1042 — stale appearance witnesses

Infrastructure only (B/C), based on dev `2c6156c73ebe9b37d8e4b1570d10212b67696242`.
No product, styles, bundle, schema, gate or golden changes.

The first full #1035 Validate failed these old expectations:
[39911468144](https://github.com/Matysh/houseplan-card/actions/runs/39911468144).
#1037 explicitly moved appearance colours to spaces. The old general-form
selector either found no wall picker or hit the background picker; an unrelated
General save also intentionally freezes effective legacy space colours.

Executed on the unmodified dev product with pinned Playwright 1.62.0 /
Chromium 151.0.7922.34:

- `node demo/smoke_dialog_polish_605.mjs` → PASS: light/dark, widths 320/360/560;
  eight alpha tiles and exactly two remaining flat plates (background and light),
  a real light alpha change, legacy wall draft isolation, ten uppercase hex labels,
  a 40px native light trigger, picker opening, reset/action geometry and icon MDI
  selection. The misplaced wall colour row must remain absent in General.
- `node demo/smoke_general_settings_form.mjs` → PASS: General plan has only the
  explicit background plate, `gs-glow-color` writes its own colour/alpha while
  leaving legacy wall colour unchanged. All earlier dirty/cancel/save/rollback,
  sibling preservation and battery preference assertions remain active.
- `node demo/smoke_room_dimming_removed.mjs` → PASS, 28 checks: explicit legacy
  **space** `room_color=#c84927`, `room_opacity=0.25` and **general**
  `fill_colors.wall_fill={c:#143a52,a:0.35}` become exactly the independent literal
  `name_color={c:#c84927,a:0.5}` and `wall_fill={c:#143a52,a:0.35}` on
  Save; the complete remaining spaces/config equality remains strict. Cancel
  still preserves raw config, only one explicit Save writes, and the retired
  dimming pixels/roles remain absent.
- `node demo/smoke_room_appearance.mjs` → PASS: actual moved wall colour/alpha,
  room overrides, reload, static/isometric presentation, narrow themes, plus its
  solid 40px wall-fill trigger at alpha 0.3. This keeps the old plate protection
  at the control's new location.

Source count and registered guards are unchanged. `mutation-gate --check` is
static readiness only (execution 0, caught unknown); no mutants were executed.
The full local gate and exact push CI are recorded in the issue handoff.

Review M1 correction: removed the unused general `border_color` input. Both
materialized results now differ from defaults in colour and alpha, so ignoring
either legacy input cannot satisfy the ordinary strict equality. The +0.25
name-alpha convention is the accepted #1037 contract; expected literals do not
call the production resolver. No mutant was executed to make this claim.
