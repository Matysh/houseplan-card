# Audit — prioritized recommendations

> Snapshot: **2026-08-05**. Priorities for humans and agents.
> P0 = do soon (risk or traction). P1 = next engineering cycle.
> P2 = important but schedulable. P3 = niceties / when touching adjacent code.
>
> Status column: update in-place when an item ships (`done YYYY-MM-DD` or
> `dropped — reason`).

## P0 — traction & trust (this month)

| ID | Action | Why | Status |
|---|---|---|---|
| P0-1 | Ship **demo GIF/video** on README (real product motion: glow + tap light + kiosk) | Biggest adoption lever; ROADMAP Phase 10; easy-floorplan is winning attention without our counter-demo | open |
| P0-2 | Publish EN **forum Floorplan + Reddit** posts (drafts exist off-repo) | Social proof before/while HACS #9004 waits | open |
| P0-3 | Refresh **README differentiation** vs easy-floorplan (server sync, areas→devices, overlays — not furniture CAD) | PRODUCT table is a month stale; narrative gap is urgent | **done 2026-08-05** (README + README.ru) |
| P0-4 | Align **write policy**: either default `admin_only=True` **or** drive `_canEdit` from the same option; fail closed if `hass.user` missing | UI↔API inconsistency; household persona assumption | **done 2026-08-05** (`can_write` on config/get, default admin_only on, fail-closed UI) |
| P0-5 | Keep watching **hacs/default#9004** — no code action; do not spam maintainers | Queue is months-scale; custom-repo remains the path | open |

## P1 — maintainability (next engineering focus)

| ID | Action | Why | Status |
|---|---|---|---|
| P1-1 | **Extract** from `houseplan-card.ts`: Plan editor, Devices editor, Decor/backdrop tools, dialogs → separate modules/components; keep pure math where it is | 8691 LOC god-object is the #1 engineering risk | open |
| P1-2 | Enable **`noImplicitAny`** in stages (devices → logic → card shell); introduce a thin typed `Hass` facade | `strict` is currently nominal | open |
| P1-3 | Split **`styles.ts`** by surface (view / editors / dialogs / kiosk) | 2223 LOC CSS sink | open |
| P1-4 | Unit-test **orchestration hotspots**: `_clickDevice` policy wiring, config write-chain conflict, mode enter/exit | Smokes-only today | open |
| P1-5 | Add **`expected_rev` (or per-key CAS)** to `layout/update` *or* document “single active editor” as the contract in ARCHITECTURE | Multi-tablet drag races | open |

## P2 — product depth inside SCOPE

| ID | Action | Why | Status |
|---|---|---|---|
| P2-1 | **Registry-driven room suggestions** after floors-import (bind suggested polygons/areas) | SCOPE J4; PRODUCT “next move”; moat vs card-only peers | open |
| P2-2 | Plan-level **security glance** badge (all locked / N open) | SCOPE known gap; kiosk value | open |
| P2-3 | Touch ergonomics pass on Plan/Devices editors | Admin-on-tablet persona | open |
| P2-4 | Options-flow richness: expose exclude domains / LQI thresholds / clearer `admin_only` | ROADMAP Phase 8 | open |
| P2-5 | Plan upload **auto-downscale** / max-dimension guidance | ROADMAP Phase 9; prevents huge SVG pain | open |
| P2-6 | Replace remaining **real-house README screenshots** with synthetic | STATUS privacy watchlist | open |

## P3 — quality-scale & hygiene

| ID | Action | Why | Status |
|---|---|---|---|
| P3-1 | Measure backend coverage; drive toward **≥95%** or revise the goal honestly | quality_scale todo | open |
| P3-2 | **mypy strict** (or staged) | Platinum todo | open |
| P3-3 | `docs-troubleshooting` + `docs-examples` (Gold) | quality_scale todo | open |
| P3-4 | Tighten MARKER_SCHEMA (`binding` pattern, hex `ripple_color`, positive decor sizes, space id regex) | Validation gaps | **done 2026-08-05** |
| P3-5 | Fix quality_scale filename (`test_ha_config_flow.py`); remove or re-wire dead card `tap_action` | Nits that confuse agents | **done 2026-08-05** (filename fixed; tap_action documented deprecated) |
| P3-6 | Refresh stale doc headers: ARCHITECTURE tree, UX-MODES “no code yet”, PRODUCT competitor table | Truth decay | open |
| P3-7 | Investigate / soften `smoke_opening_measure` magnet `1e-6` placement checks | Known env-sensitive red | open |
| P3-8 | Exception / icon translations | ROADMAP Phase 8 | open |
| P3-9 | Resource cleanup on integration removal + YAML-mode fallback doc | ROADMAP Phase 8 | open |

## Explicit do-not-do (reaffirmed)

Do **not** prioritize these even if competitors ship them:

1. Furniture / wall CAD (easy-floorplan’s game).
2. 3D / glb viewers.
3. Vacuum clean/zone **commands** (display-only stays).
4. Cloud sync / accounts.
5. Music-note / directional TV ripple polish from issue #3 backlog.
6. History rewrite to purge old house assets from git (breaks HACS tags).

## Suggested sequencing for an agent sprint

```
Week theme A — Trust & story
  P0-3 README diff → P0-1 demo video → P0-2 forum/Reddit
  P0-4 write-policy alignment (small code + options default)

Week theme B — Carve the god-object
  P1-1 extract one editor (Devices is smallest) + P1-4 tests for the seam
  P1-2 noImplicitAny on the extracted module only

Week theme C — Moat feature
  P2-1 registry room suggestions (design in ARCHITECTURE first)
```

Avoid mixing A+B+C in one PR. Distribution P0s do not require waiting on P1.

## Success metrics (lightweight)

| Metric | Now (2026-08-05) | Near-term target |
|---|---|---|
| GitHub ★ | 21 | 100+ after GIF + posts + HACS visibility |
| HACS default | #9004 open | merged (external) |
| `houseplan-card.ts` LOC | ~8691 | <5000 after first extract wave |
| Backend coverage | unmeasured | number published in quality_scale comment |
| Open P0 items | 5 | 0 |

## Pointers

- Market context: [`AUDIT-MARKET.md`](AUDIT-MARKET.md)
- Quality detail: [`AUDIT-QUALITY.md`](AUDIT-QUALITY.md)
- Gaps / matrix: [`AUDIT-FUNCTIONAL.md`](AUDIT-FUNCTIONAL.md)
- Guard rail: [`SCOPE.md`](SCOPE.md)
- Living ops: [`STATUS.md`](STATUS.md)
