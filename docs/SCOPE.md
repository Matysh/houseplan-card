# Product scope — what House Plan is and is not

*Fixed with the owner on 2026-07-22. This document is a guard rail: features are
built, improved and accepted **only** if they serve a job listed here. When a new
idea appears, first find its row in this file; if there is none — it belongs to
HA core, to another card, or nowhere. Companion documents: PRODUCT.md (market),
ROADMAP.md (order of work), UX-MODES.md (interaction model).*

## Mission

House Plan is the **spatial "at a glance + quick act" layer** for a Home
Assistant home. Upload or draw a floor plan, outline rooms bound to HA areas,
and the home's devices appear on a live, tappable map: states, climate, alerts,
guarded quick actions. Setup is GUI-only — no Inkscape, no YAML, no external
editors. Everything that is not "look at the home spatially and act on the
obvious" is somebody else's job.

## Target audience

| Persona | Role | Surface |
|---|---|---|
| **Home admin** (primary) | HA enthusiast, house/large flat, 20–200 devices, several floors; sets up and maintains the plan | Desktop browser (both editors live here) |
| **Household members** | Non-technical; consume the plan daily, never edit | Wall tablet (kiosk), phone (companion app) |
| **Guests / kiosk** | View-only glance at the home | Wall tablet |

Design consequence: **View mode is the product** for two of the three personas.
Editors are admin-only tools and must never leak interactions into View
(established by UX-MODES; lock guard, inert openings, no drag in View).

## Core user jobs — the component must close these

| # | Job (user's words) | Status |
|---|---|---|
| J1 | "Show the whole home and what's happening right now" — live spatial overview: device states, room fills (light/temp/LQI), values, multi-floor tabs | **Closed** |
| J2 | "Something is wrong — show me *where*" — leak/smoke/gas pulse, open doors/windows, unlocked locks, red dot on devices HA added silently | **Closed** |
| J3 | "Let me act on the obvious right from the plan" — tap-to-toggle for safe domains, info cards, guarded lock action (explicit button only, never a plan tap) | **Closed** |
| J4 | "From zero to a working plan in one evening, no Inkscape/YAML" — image/PDF/draw, floors-import wizard, room polygons bound to areas, curated auto-placement, editable icon rules | **Closed**; onboarding polish is *partial* (no registry-driven room suggestions) |
| J5 | "Room climate at a glance" — per-room temperature/humidity, comfort-range fills, room-card metrics | **Closed** |
| J6 | "Keep the plan true as the home evolves" — new-device flag, two editors, drag/resize, merge/split, multi-client live sync, optimistic locking | **Closed** |
| J7 | "Is my Zigbee mesh healthy *here*?" — LQI badges, per-room average, LQI fill | **Closed** (kept deliberately: cheap, spatial by nature, no in-plan competitor) |

## Partially covered — improvement backlog stays inside these

- **Touch ergonomics of the editors**: corner handles and grid clicks are small on
  tablets; editors are desktop-first today. Improve, don't redesign.
- **Value display**: single current value per device; units/precision follow HA
  formatting only.
- **Accessibility**: `prefers-reduced-motion` only; no keyboard navigation in
  editors, no ARIA labelling of the plan.
- **Docs/screenshots**: README predates the two-editor redesign.

## Known gaps that fit the mission (build only on owner's request)

- Person/presence shown in rooms (classic floorplan ask; pure J1).
- Plan-level "security glance": one badge for "all locked / N open" (J2).
- Threshold colouring for room-card metrics (J5).

## Out of scope — never build, point users to the right tool

- Automations, scenes, scripts, notifications → HA core.
- Device/entity administration (rename, reassign area, disable) → HA registry
  UIs. We *read* the registry, we never manage it.
- History, graphs, statistics → recorder/history cards. We show now, not then.
- Camera streams, media controls → their own cards; our more-info opens HA's.
- Energy monitoring/analytics → HA Energy.
- 3D / isometric / photorealistic rendering, furniture drawing → niche tools
  (easy-floorplan et al.); we are a schematic live map, not an interior editor.
- A general dashboard framework (menus, popups, theming engine) → Bubble Card,
  Dwains and friends.

## Excess-functionality audit (2026-07-22)

- **Device metadata: links & PDF manuals** — not spatial, but tiny, server-side,
  and used in real installs. Verdict: **keep, frozen** (no growth).
- **Virtual devices** — placeholders for not-yet-installed hardware; serves J6.
  Verdict: **keep, frozen**.
- **LQI diagnostics** — promoted to J7 (differentiator), not excess.
- Nothing found that warrants removal; the mode redesign already moved every
  interaction to where it belongs.

## The component in one breath (README/HACS copy)

> **House Plan** turns your Home Assistant into a live map of your home. Upload
> a plan image (or draw one), outline rooms and bind them to HA areas — your
> devices appear in place, automatically, with live states. Glance at the wall
> tablet: what's on, what's open, what's too cold, what's leaking, what's new.
> Tap to act — safely: locks never toggle by accident. Two built-in editors
> (plan and devices) mean no Inkscape, no YAML, no external tools — ever.

**Tasks it closes:** whole-home live overview · spatial alerts (leak/smoke/open/
unlocked/new device) · safe quick actions · per-room climate · Zigbee mesh
health · zero-to-plan GUI onboarding · keeping the plan true over years.

**Pains it removes:** hand-crafted SVG + YAML floorplans · entity-list
dashboards that hide *where* things happen · silent device sprawl · accidental
toggles of security devices · per-device dashboards that non-technical family
members can't read.
