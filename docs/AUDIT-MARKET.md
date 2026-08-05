# Audit — market potential & competitors

> Snapshot: **2026-08-05**. Star counts via GitHub API the same day.
> Supersedes the competitor table in `PRODUCT.md` (2026-07-05) until that
> file is rewritten. Re-verify numbers before any public claim.

## 1. Demand shape

| Signal | Evidence |
|---|---|
| Persistent pain | HA Community “Floorplan” category; “100% Floorplan UI” mega-thread (500k+ views historically) |
| 2025–2026 wave | Multiple GUI floorplan projects launched within months (easy-floorplan May 2026, Padraigggs Mar 2026, House Plan Jul 2026, plus older SVG/YAML tools) |
| Audience | Enthusiasts with wall tablets / panel dashboards — **niche but sticky** |
| Adjacent proof | Bubble Card (~4.4k★) shows polished GUI Lovelace cards can go quasi-mainstream; ha-floorplan (~1.6k★) with a hostile workflow shows a demand floor for *spatial* UIs |

**Verdict:** demand is real. The bottleneck is not “do people want a plan?” —
it is “which GUI-first story wins attention before HA core ships something
spatial.”

## 2. Competitive landscape (2026-08-05)

| Project | ★ | Updated | Approach | Overlaps us | Where we still win | Where they win |
|---|---:|---|---|---|---|---|
| [ha-floorplan](https://github.com/ExperienceLovelace/ha-floorplan) | **1584** | 2026-07 | Hand SVG + YAML/TS rules | Visualization power | Zero Inkscape/YAML barrier; shared server config | Max customization, mature ecosystem, contributors |
| [easy-floorplan](https://github.com/nicosandller/easy-floorplan) | **430** | 2026-08-04 | In-card draw walls/furniture/devices | **Direct peer** — GUI, no YAML | HA **integration** + `.storage`, area-bound rooms, auto devices, vacuums/sun/glow/kiosk, quality-scale CI | Furniture drawing, faster growth, press (DE blogs), simpler “draw a house” story |
| native `picture-elements` | built-in | — | % coords in YAML | Overlay icons on image | Editor + zones + shared layout | Zero install, official |
| native Areas / Home dashboard | built-in | evolving | Grid by area/floor | “At a glance” home | **Spatial** plan | First-party discoverability |
| [Padraigggs interactive floorplan](https://github.com/Padraiggg/Padraigggs-ha-interactive-floorplan) | 42 | 2026-04 | Editor + viewer cards, push to dashboard YAML | GUI editor | Server store, room polygons↔areas, overlays | Polygon light zones, camera animations, YAML export |
| [zigbee-floorplan-card](https://github.com/TheLarsinator/zigbee-floorplan-card) | 73 | 2026-04 | LQI over image | LQI overlay | Full product, not single-purpose | Narrow clarity |
| Dwains / Bubble Card | 2k / 4.4k | — | Dashboards / card kits | GUI quality bar | Spatial niche | Distribution, brand |
| **House Plan** (us) | **21** | 2026-08-05 | Integration + card, room markup, server layout | — | See §3 | Traction, HACS default pending |

### Critical change since PRODUCT.md (2026-07-05)

`easy-floorplan` was listed at **11★ / immature**. One month later it is
**≈430★**, actively released (v0.8.x), and getting third-party blog coverage.
That collapses the old claim that the GUI-floorplan niche is “currently
unoccupied.” The niche is now a **race**, and they are ahead on attention.

House Plan is **not** the same product: we refuse furniture/wall CAD
(SCOPE / ROADMAP non-goal) and instead ship a **storage integration**,
area-linked rooms, multi-client layout, and curated overlays. That moat is
real — but only if users *find* us and understand the difference in one
demo GIF.

## 3. Our moat (still valid)

Nobody else currently combines all of:

1. **Server-side config** — HA integration, `.storage`, optimistic `expected_rev`,
   live multi-client sync, survives dashboard YAML edits.
2. **In-card room polygon editor** bound to HA **areas** → auto device placement.
3. **Curated overlays** — glow pools, temp/LQI fills, sun wedges, vacuum trails,
   cover morph, lock invariant.
4. **Operational maturity** — quality_scale.yaml, 4-layer tests, signed content +
   SVG CSP, diagnostics/repairs/system_health, dual en/ru docs.

Card-only peers store config in Lovelace YAML (or push into it). That is fine
for one admin laptop; it is weaker for family tablets and multi-user homes —
exactly our persona split in SCOPE.md.

## 4. Potential (honest)

| Horizon | Realistic outcome | Depends on |
|---|---|---|
| Near (HACS default + demo assets) | Low hundreds of ★; Telegram + forum traction | #9004 merge, GIF/video, EN forum/Reddit posts |
| Medium (12 months of polish + registry depth) | Contender in the GUI-floorplan shortlist; maybe 0.5–1.5k★ if narrative sticks | Differentiation messaging vs easy-floorplan; onboarding magic |
| Ceiling | Unlikely to dethrone ha-floorplan’s power-user base; unlikely Bubble-scale | Niche size + single maintainer |

**Usefulness:** high for the target personas (admin builds once; household/kiosk
use View). **Commercialization:** none intended (MIT, local-first) — success =
installs and unpaid maintenance load.

## 5. Strategic risks

| Risk | Severity | Mitigation |
|---|---|---|
| easy-floorplan owns the “no YAML floorplan” mindshare | **High** | Sharpen README differentiation (server sync, areas, overlays); ship demo GIF now |
| HA core ships a native spatial plan | **High (latent)** | Deepen floors/areas registry integration; speed of iteration |
| HACS default #9004 stuck for months | **Medium** | Custom-repo path works; social proof before merge |
| Single-maintainer bus factor | **Medium** | Docs + tests already strong; avoid feature sprawl |
| Frontend API churn (`hass` internals) | **Medium** | Minimal surface; CI against current HA in harness |
| Scope creep toward furniture CAD | **Self-inflicted** | SCOPE non-goals — do not chase easy-floorplan feature-for-feature |

## 6. Positioning recommendation

**One sentence:** *House Plan is the shared, area-aware live map of your Home
Assistant home — not a drawing app for furniture.*

Lead with: multi-device sync, bind room→area→devices appear, glow/climate/sun/
vacuums, kiosk for wall tablets. Acknowledge: if you want to *draw walls and
sofas from scratch*, use easy-floorplan; if you have a plan image and a real HA
registry, use House Plan.

## 7. Distribution checklist (status)

| Lever | State (2026-08-05) |
|---|---|
| Public demo | **Live** — https://demo.houseplan.tech (`demo`/`demo`) |
| Dev stand | https://dev.houseplan.tech |
| Telegram | https://t.me/ha_houseplan |
| HACS custom install | Works |
| HACS default | **Queued** — hacs/default#9004 open since 2026-07-06 |
| Demo GIF / video in README | Still a ROADMAP Phase 10 open item |
| Forum Floorplan + Reddit posts | Drafts exist off-repo; posting still open |
| Stars | **21** — traction problem, not a product-depth problem |

## 8. What to refresh next

When stars or competitor maturity move materially, update **this file first**,
then sync the table in `PRODUCT.md`. Do not leave PRODUCT as the only market
doc — it already went a month stale while easy-floorplan 40×’d.
