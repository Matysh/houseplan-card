# UX redesign: three modes (approved 2026-07-21)

> Approved design for reorganizing all card interactions into three tab-like modes.
> Driven by the owner's mandate and confirmed by real user feedback
> ([issue #3](https://github.com/Matysh/houseplan-card/issues/3): *"When moving the
> map around, I sometimes move the doors/sensors around"*). This document is the
> source of truth for the implementation iterations below. No code has been changed yet.

## Principle

A segmented control in the card header with three tabs; the active one is visually
highlighted, and edit modes add a colored frame around the stage so the mode is
obvious at a glance:

**[ 👁 View ] [ 📐 Plan ] [ 🔧 Devices ]**

- **View** is the default and the only mode after every load (edit modes are never
  restored across reloads).
- **Plan** and **Devices** are shown only to admins when `admin_only` is on.

## View — display and device interaction only

Allowed: pan/zoom (wheel, pinch, buttons), switching spaces, device tap
(info / more-info / toggle per settings), long-press → info card, opening tap →
door/lock info card (with an explicit Unlock/Lock button when a lock is bound —
the only way to operate a lock from the card; plan-icon taps never toggle locks),
room tap → HA area, hover tooltips (name, temperature, signal).

Removed from this mode (they move, not die):
- icon dragging ("drag anywhere", v1.9 — consciously reversed),
- room-label dragging,
- opening dragging along walls and double-click properties (v1.23.1),
- every edit button in the header (+device, 👁 show-all, ↺ reset, ⬡ rules, ⚙ general,
  per-space gear, markup toggle).

Header in View: space tabs, device count, zoom cluster. Nothing else.

## Plan — geometry and appearance of the space

- Toolbar tools: Outline room, Delete room, Merge, Split, Opening (place / drag along
  walls / properties), Room labels (drag positions — labels are part of the plan).
- Space gear dialog (title, plan image / hand-drawn, scale, Display section, show_lqi),
  add space, floors import, delete space.
- ⚙ General settings (fill palette) lives here — it is about the plan's appearance.

## Devices — placement and marker configuration

- Icon dragging (ONLY here). Click on a device opens the **edit dialog directly**
  (binding, name, icon, size/angle, display badge/ripple + colors, tap override,
  model/link/description/PDFs, room).
- + add device/entity/virtual, hide device, ↺ reset layout, 👁 show-all (curation
  tool), ⬡ icon rules.

## Deprecations decided

1. "Drag anywhere" (v1.9) — reversed by this design.
2. Opening drag / dbl-click properties in view (v1.23.1) — moved into Plan.
3. The markup toggle button — replaced by the Plan tab.
4. Legacy localStorage mode (card without the integration) — candidate for removal
   in the next major; adds branching for a half-working scenario.

## Approved follow-up features (from issue #3, by priority)

1. State-reflecting icons (open/closed door variants etc., like core HA).
2. `display: value` — show the measurement instead of an icon.
3. Light color in the icon/ripple (RGB lights).
4. Alarm visual (leak/smoke/doorbell): red pulse overlay.
5. Rooms as sub-areas without an HA area + manual device placement by room id.
6. Backlog (not planned): music notes for players, directional TV ripples.

## Implementation iterations

- **It.1 — mode shell:** the segmented control, mode state, View-mode gating of all
  edit interactions/buttons (biggest UX win, smallest surface).
- **It.2 — Plan tab:** move markup tools + space dialogs + labels drag + openings
  editing under Plan; colored frame indicator.
- **It.3 — Devices tab:** drag + direct-edit click + curation tools under Devices.
- **It.4+:** follow-up features 1–5 above, each its own release.
