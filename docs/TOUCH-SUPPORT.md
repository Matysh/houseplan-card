# Touch support policy

Approved by the owner on **2026-08-08**. This document is the source of truth
for product scope, implementation trade-offs, documentation and release
acceptance on touch devices.

## Product contract

House Plan is a **touch-first product in View and kiosk**, but its editors are
**desktop-first administration tools**.

| Surface | Desktop browser with mouse/keyboard | Touch/coarse-pointer device |
|---|---|---|
| View | Fully supported | **Fully supported; must be convenient and reliable** |
| Kiosk | Supported | **Primary supported environment** |
| View dialogs and safe device actions | Fully supported | **Fully supported** |
| Plan editor | **Reference editing environment** | Best effort; partial, awkward or missing operations are allowed |
| Device editor | **Reference editing environment** | Best effort |
| Background editor | **Reference editing environment** | Best effort |

Users must be told to create and maintain plans in a desktop browser. A tablet
or phone may expose the editor tabs, and individual operations may work, but
editor parity with desktop is not promised.

## What “fully supported View” means

On phones, tablets, wall panels and HA Companion apps, the ordinary View must:

- render the plan and current states correctly;
- support convenient pan, pinch zoom and space switching;
- provide a touch path for essential information that desktop exposes through
  hover;
- open and close View dialogs without clipping their essential content or
  actions;
- perform supported device actions safely and predictably;
- remain usable after backgrounding, resize, orientation changes and warm
  remount;
- preserve kiosk gestures and prevent accidental editor interactions.

A touch-only failure in View is a product defect, not an accepted limitation of
the editor policy.

## What “best-effort editors” means

On a coarse-pointer or no-hover device, an editor operation may:

- have less convenient hit targets or gestures;
- require a workflow that is practical only with a mouse and keyboard;
- omit a desktop-only shortcut or precision interaction;
- be hidden or disabled when no safe touch interaction exists;
- have a documented layout or usability limitation;
- be intentionally deferred when touch parity is disproportionately expensive.

This is an explicit scope decision. New editor features are designed and
accepted against the desktop reference environment first. Touch editor support
is added when it is cheap, robust and does not complicate the desktop model.

## Safety floor that still applies to touch editors

“Best effort” never permits:

- data corruption or silent loss of saved plan data;
- an unsafe Home Assistant service call;
- bypassing permissions or destructive confirmation;
- leaving the card permanently stuck outside View;
- an editor exception that breaks ordinary View or kiosk;
- saving unintended geometry merely because a pinch, pointer cancellation or
  second touch was misread as a click.

If a desktop interaction cannot be translated safely to touch, prefer a clear
disabled/absent action and a desktop recommendation over a deceptively working
control.

The shared editor context tray follows this safety floor: its visible surface
owns its pointer events, narrow action rows scroll internally, and a press used
only to dismiss an explicit group/palette is consumed instead of falling
through to the plan. Pinch/pan outside the tray remains scene-owned. This is a
safety guarantee, not a promise of full touch parity for editor precision work.

During a View/editor visual transition the moving stage is inert while the
header tabs remain available. A pinch, cancelled pointer or synthetic click
cannot operate stale geometry; leaving the editor is always a single safe
action. The decorative smoothness of the editor chrome remains best effort on
coarse-pointer devices, while the correct final View frame is release-blocking.

## Deliberate degradation rule

When an editor change would be expensive to implement correctly for touch, the
change may ship as desktop-only or with reduced touch behaviour if all of the
following are true:

1. View and kiosk are unaffected.
2. Plan data and device actions remain safe.
3. Desktop editing is complete and tested.
4. The touch limitation is deliberate, described in the user-facing
   limitations and, where useful, next to the affected workflow.
5. Existing automated touch-editor coverage is explicitly updated or
   reclassified in the same change; it is not silently ignored.
6. The release notes mention the limitation when it is material to users.

An accidental regression is not made acceptable merely by calling it
best-effort after discovery.

## Input classification

Do not classify support from screen width alone.

- `pointer: coarse`, no hover, touch pointer events and mobile/Companion
  environments are touch scenarios.
- A narrow desktop window with a fine pointer remains a desktop editing
  scenario.
- Hybrid laptops must keep both View paths usable. Their editors may use the
  desktop path when a fine pointer and keyboard are actually available.
- Stylus editing is best effort unless a specific feature explicitly promises
  it.

## Testing and release gates

Release-blocking guarantees:

1. View on desktop.
2. View and kiosk on representative touch/mobile environments.
3. All editors on desktop with mouse/keyboard.
4. The touch-editor safety floor above.

Touch-editor feature parity is not a general release gate. Targeted tests may
still protect individual touch workflows that the product intentionally keeps;
removing such a guarantee requires an explicit scope/documentation change, not
just deletion of the failing test.

Stable-release manual coverage must include at least one phone/Companion View
and one wall-tablet/kiosk View. Editor smoke coverage on touch is scoped to
safe entry/exit, no accidental mutation during multi-touch, and any separately
promised workflow.

## Documentation rule

Every user-facing description of the editors must recommend desktop for plan
creation and maintenance. Documentation must not imply full touch-editor
support merely because the tabs are visible on a tablet. New editor feature
specifications and code reviews must state one of:

- `Touch editor: supported`;
- `Touch editor: best effort / intentionally degraded`;
- `Touch editor: not exposed`.

If touch work is omitted because of cost, that is an accepted product decision
only after it is written down.
