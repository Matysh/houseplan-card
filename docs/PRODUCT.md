# Product assessment & market position

*Written 2026-07-05. Sources: GitHub API star counts and HA docs verified 2026-07-06;
see links inline. Update this file when the landscape shifts.*

## What the product is

An interactive floor plan for Home Assistant delivered as one HACS package:
a storage **integration** (server-side config, WS API, file uploads, auth) + a
**Lovelace card** (rendering, room markup editor, drag layout, zoom, live states,
temperature, Zigbee LQI, device metadata with PDF manuals, virtual markers,
en/ru localization). GUI-first: no YAML, no hand-made SVG.

## Competitive landscape (stars verified 2026-07-06)

| Competitor | Stars | Approach | Weakness we exploit |
|---|---|---|---|
| [ha-floorplan](https://github.com/ExperienceLovelace/ha-floorplan) (incumbent) | 1 562 | hand-made SVG + YAML/CSS/JS rules | steep barrier: Inkscape + YAML; no GUI editor; config in card YAML |
| native `picture-elements` | built-in | absolute % coordinates in YAML | trial-and-error positioning, no zones, no editor |
| native Areas/Home dashboard (2025.4→2025.12) | built-in | auto card grid by area/floor | **not spatial** — leaves the visual-plan niche open |
| [Dwains Dashboard](https://github.com/dwainscheeren/dwains-lovelace-dashboard) | 2 049 | auto-generated menus | not a floor plan |
| [Bubble Card](https://github.com/Clooos/Bubble-Card) | 4 391 | GUI card collection | not a floor plan; sets the GUI-quality bar |
| [zigbee-floorplan-card](https://github.com/TheLarsinator/zigbee-floorplan-card) | 71 | LQI over a plan image | single-purpose; validates our LQI feature |
| [kishorviswanathan/ha-floorplan](https://github.com/kishorviswanathan/ha-floorplan) (2026-01) | 155 | external web editor → YAML export | editor outside HA, still YAML at runtime |
| [Padraigggs-ha-interactive-floorplan](https://github.com/Padraiggg/Padraigggs-ha-interactive-floorplan) (2026-03) | 41 | editor+viewer cards, "no YAML" | weeks old, card-only, no server-side integration |
| [easy-floorplan](https://github.com/nicosandller/easy-floorplan) (2026-05) | 11 | draw walls/furniture in the card | drawing-centric, immature |

**Demand evidence:** a dedicated [Floorplan forum category](https://community.home-assistant.io/c/third-party/floorplan/28);
the "100% Floorplan UI" mega-thread (500k+ views); a visible 2025–2026 wave of new
floorplan projects (three launched in the last six months alone). The pain is constant:
*people want a floor plan without Inkscape and YAML.*

## Honest assessment

**Usefulness — high.** A floor plan is the most natural "at a glance" home UI, and the
GUI-first workflow (upload image → outline rooms → devices appear → drag) removes the
exact barrier that keeps most users on lists of entity cards.

**Demand — real but niche-shaped.** Floorplan is a perennial top request, but the
audience is enthusiasts with wall tablets. Realistic trajectory given the field:
hundreds of stars in the first year *if* discoverability is solved (HACS default +
demo GIF + forum post). Bubble Card (4.4k★) proves polished GUI cards can go
quasi-mainstream; ha-floorplan's 1.5k★ with a hostile workflow shows the demand floor.

**Unique position — currently unoccupied.** Nobody else combines: server-side config
(integration + `.storage`, survives dashboard edits, shared across users/devices,
optimistic locking, live multi-client sync) + in-card room polygon editor bound to HA
areas + curated auto-placement + drag layout + LQI/temperature overlays + config flow +
en/ru localization + CI/quality-scale discipline. The newcomers are card-only toys so
far; the incumbent is powerful but YAML/SVG-locked. Our moat grows if we integrate
deeper with the areas/floors registry (Phase 9) — that is the direction HA core itself
is signalling with the native Areas dashboard.

**Risks.**
1. *HA core ships a native spatial plan.* The Areas dashboard is grid-based today, but
   core moving spatial would commoditize us. Mitigation: registry integration, speed.
2. *Discoverability.* 0 stars until the HACS queue (~2 months) clears. Mitigation:
   demo assets + forum/Reddit showcase now, custom-repo installs meanwhile.
3. *Single maintainer bus factor* — mitigated by docs/ discipline and tests.
4. *Frontend API churn* (undocumented hass internals custom cards rely on).
   Mitigation: minimal surface, CI against beta HA (add to Phase 8).

## Recommended next moves (priority order)

1. **Demo GIF + English forum/Reddit posts** — cheapest adoption lever, do before the
   HACS queue clears so the storefront lands with social proof.
2. **Phase 7 quality items** (runtime_data, unloading, storage migrations, single_config_entry)
   — cheap now, expensive later; also a credibility marker for reviewers.
3. **Registry-driven onboarding** (import floors/areas as spaces/rooms suggestions) —
   the feature that makes first-run magical and that no competitor has.
4. **Editable icon rules** — removes the last dacha DNA and answers the #1 predictable
   user complaint ("wrong icon for my device").
5. **Click actions (toggle from the plan)** — most requested behavior in every
   floorplan thread; we currently only open info dialogs.
