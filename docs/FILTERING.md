# Filtering: the explicit "hide from plan" flag

Agreed with the owner 2026-07-29. This document is the source of truth for the
mechanism; the code follows it.

## Principle

Whether a device is on the plan is an EXPLICIT, per-device fact: the
"Hide from plan" checkbox, stored as `marker.hidden`. The old on-the-fly
filtering algorithm survives only as the SEEDER of those flags — it decides
the initial value once, and the user owns the flag from then on.

## Data model

- `marker.hidden: true` — hidden from the plan. For an auto device without a
  marker, hiding creates a stub marker (this mechanism predates this spec).
- `marker.hidden: false` (marker present) — explicitly VISIBLE: the seeder
  never touches a device that has any marker, so unhiding must KEEP the stub
  marker. That is the re-seed protection.
- No marker — never evaluated by the seeder yet, or a plain physical device.
- `settings.filter_seeded: true` — this config has been materialised.
- `settings.show_all` — removed (deleted during materialisation). The old
  toggle was shared config state; the new one is a local editor tool.

## Seeding

"Non-physical" = the old filter rules: excluded integration domains, model
"Group", scene-like models, bridges, myheat children, and individual lamp
devices in an area covered by a light group (when group folding is on).

The seeder runs on the editing client (write permission required) whenever
devices rebuild, and creates `hidden: true` stub markers for non-physical
devices in BOUND areas that have NO marker. It is idempotent: marked devices
are never revisited. It fires on:

1. first load of a config without `filter_seeded` (materialises the current
   behaviour; nothing changes visually, the flags become real and editable);
2. an area newly bound to the plan;
3. a new device appearing in a bound area — non-physical ones are hidden
   silently (no red dot); physical ones keep the red-dot flow.

Until a config is seeded (`filter_seeded` absent), `buildDevices` applies the
LEGACY runtime filter, so a read-only client on an old config sees exactly
the old behaviour until an editing client materialises it.

## Behaviour

- Hidden devices ARE built (flagged `hidden`), but not rendered in any mode,
  except the device editor with "Show hidden devices" on — there they render
  ghosted (translucent, dashed) and clicking opens the dialog to untick.
- "Show hidden devices" (rename of "Show all") is LOCAL, ephemeral state of
  the current tab.
- Room LQI counts hidden devices (owner's decision).
- Hidden devices are NOT content for the CONTENT FRAME (docs/CANVAS.md §4,
  audit DEV-2C947-01). The frame is presentation: an object the plan does not
  draw may not decide what the plan opens on. Hiding a marker that had once
  been dragged into the yard used to leave the visible house a dot in the
  corner of a frame 112x too wide — on the full card and on
  `houseplan-space-card` alike. They keep their place in the auto-grid roster
  (so a visible neighbour does not move when one is hidden) and in every
  aggregation listed here; only the frame stops seeing them, ghosts in the
  device editor included — reaching a ghost is the pan slack's job (§5).
- Light fill and glow do NOT count hidden devices — an invisible device casts
  no visible light (owner's decision). Room climate is registry-wide and
  unaffected, as before.
- The checkbox appears in the dialog of EVERY device kind, virtual included.
- "Remove from plan" disappears for auto/entity devices (the checkbox is the
  one way to hide); a virtual device's "Delete" remains a real deletion.
- Duplicate names are still numbered, light groups still fold — those are
  aggregation, not hiding.
