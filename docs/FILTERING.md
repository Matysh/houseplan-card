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

## What a marker SHOWS

A marker's live indication — the yellow «on» plate, the «open» frame, the
breathing `covermove` ring, the state-morphed icon, the ripple — speaks for
ONE entity of the device, resolved in this order:

1. the marker's bound **controls**, if it has any (a stateless remote or a
   virtual wall switch mirrors what it drives, not itself);
2. a **lit light** among its entities (owner's principle 2026-07-29: the glow
   spot and the badge may never disagree);
3. the device's **cover**, when the marker's tap action is explicitly
   «Открыть/закрыть» (`tap_action: 'cover'` — `coverEntityOf`, the same helper
   and the same entity the tap drives);
4. otherwise the **primary** entity (`primaryEntity`).

Rule 3 was added 2026-08-04 on the owner's report: his Aqara «Roller shade
driver E1» curtains ship the `cover.*` hidden by the integration and a visible
`switch.*_reverse_direction`, so `primaryEntity` picked the service switch —
the plan showed no ring while a curtain travelled, no «open» frame, no
`curtains` / `curtains-closed` morph, and a yellow «включено» plate whenever
the reverse-direction option happened to be on. The tap had already been
taught to find the cover among ALL the device's entities (2026-08-04, the
same `coverEntityOf`); the indication now follows it.

**Why it hangs on the explicit action and not on «the device has a cover».**
Choosing «Открыть/закрыть» in the marker dialog is the only statement the card
has that means *this marker IS the curtain* — and the dialog offers that option
for exactly the devices where a cover exists. Tying the indication to it keeps
one answer to «what is this marker»: the option offered, the entity tapped and
the state shown are the same entity, decided in one place. Nothing changes
behind the user's back for a mixed device (a lamp that also owns a blind, a TRV
with a service switch): those keep their primary until their owner says
otherwise, and even with the action chosen a lit light still wins rule 2. The
cost is that a curtain left on «Инфо-карточка» still indicates its primary —
one click in the dialog away, and the honest reading of what the marker was
told it is.
