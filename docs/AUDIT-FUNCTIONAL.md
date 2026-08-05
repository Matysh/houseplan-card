# Audit — functional integrity & gaps

> Snapshot: **2026-08-05**, product **v1.58.0**.
> Cross-check of claimed surface (README / STATUS / SCOPE) against code and
> tests. Mission lens: SCOPE.md — *spatial at-a-glance + quick act*.

## 1. Mission fit

SCOPE personas:

| Persona | Primary mode | Fit |
|---|---|---|
| Home admin | Plan / Devices / Background editors | Strong — full geometry + marker tooling |
| Household members | View | Strong — tap toggles, room cards, glow/climate |
| Guests / kiosk | View + `kiosk: true` | Strong — editors blocked, swipe/cycle |

Jobs J1–J7 are marked **Closed** in SCOPE; J4 (onboarding) still **partial**
(floors-import exists; registry-driven room *suggestions* do not). That matches
code reality.

**Systematicity grade: high.** Features hang off a coherent model:

- spaces → rooms (polygons) → derived walls → openings
- markers bound to device/entity/virtual → layout points
- settings tiers: global → space → room → device
- View is the product; editors are admin-colored frames (UX-MODES)

Excess features (PDF manuals, virtual devices, LQI) are consciously **kept /
frozen** rather than deleted — unusual and correct for a shipping tool.

## 2. Claim ↔ code matrix

| Feature area | Claimed | Implemented | Tested | Notes |
|---|---|---|---|---|
| One HACS package (integration + card) | ✓ | ✓ | CI hacs/hassfest | Matches |
| GUI room markup (no SVG/YAML) | ✓ | ✓ | smokes + logic units | Matches |
| Doors/windows + lock invariant | ✓ | ✓ | smoke_lock_*, logic | CR-1 held |
| Islands / merge / split / open_to | ✓ | ✓ | units + smokes | Matches |
| Room resize | ✓ | `resize.ts` | units + smokes | Matches |
| Decor + backdrop transform | ✓ | ✓ (v1.58) | backdrop tests/smokes | Paper = room contours |
| Infinite / square canvas | ✓ | ✓ | canvas smokes | Matches CANVAS.md |
| Align-to-grid | ✓ | `align-grid.ts` | units | Matches |
| Auto devices by HA area | ✓ | `devices.ts` | units | Matches |
| Explicit hide-from-plan | ✓ | ✓ | smokes | FILTERING.md |
| Editable icon rules | ✓ | ✓ | — | Matches |
| Tap: info / more-info / toggle / run / cover | ✓ | ✓ | logic + smokes | Security model intact |
| Glow + door sectors | ✓ | ✓ | smokes | Island light block = known limit |
| Temp / LQI / light fills | ✓ | ✓ | units/smokes | Matches |
| Room cards + per-room settings | ✓ | ✓ | smokes | Matches |
| Kiosk | ✓ | ✓ | smokes | Matches |
| Vacuums + server trails | ✓ | `vacuum.ts` + `trails.py` | units + smokes | Display-only (intentional) |
| Sun / daynight / wedges | ✓ | `sun.ts` | units + smokes | Matches |
| `houseplan-space-card` | ✓ | ✓ | smokes | Matches |
| Signed content + SVG sandbox | ✓ | ✓ | HA tests + smokes | Matches |
| en/ru i18n | ✓ | ✓ | key-parity test | Matches |
| Floors-import wizard | ✓ | ✓ | — | Exists; suggestions gap below |
| Registry room suggestions | PRODUCT / J4 | **Partial / missing** | — | Gap |
| Music notes / TV ripples | UX backlog | **Absent** | — | Intentional not-planned |
| Furniture / wall CAD | competitor feature | **Absent** | — | Non-goal |
| Vacuum commands | user ask often | **Absent** | — | VACUUM.md non-goal |
| Cloud sync | — | **Absent** | — | Non-goal |

**Integrity conclusion:** marketed surface and shipped surface align unusually
well. The main integrity risks are **docs drift** (ARCHITECTURE/UX-MODES/PRODUCT)
and **auth UI↔API default mismatch** (see AUDIT-QUALITY), not phantom features.

## 3. Cross-cutting integrity themes

### 3.1 Coordinate & geometry story — coherent after evolution

Legacy fixed pixel canvas → normalized square → infinite canvas with bounds.
Migrations + `geometry/repair` + dual-store `geom_pending` show the team treats
coordinate changes as product-critical (correct). Frontend `space-geometry.ts`
and backend `validation.py` intentionally mirror limits (±5000) — two sources of
truth, but tested.

### 3.2 Security story — mostly coherent

| Surface | Policy | Coherent? |
|---|---|---|
| Lock / alarm from plan icon | Never actuate | Yes — tested |
| Lock via door-card button | Explicit labeled control | Yes — SCOPE CR-1 |
| SVG plans | Sandbox CSP + signing | Yes |
| Config/layout writes | `may_write` | **Split** with UI admin gate |
| `run` tap | automation/script/scene only + optional confirm | Yes |

### 3.3 Multi-client story — mostly coherent

Config writes: CAS + write chain. Layout point updates: rev bumps but **no**
conflict surface — fine for one editor, weak for two tablets dragging at once.

### 3.4 Filtering story — cleaned up

Old hardcoded “dacha DNA” filters → editable icon rules + explicit hide flags
(v1.51). Documented in FILTERING.md. Good systematic cleanup.

## 4. Gaps (build only with intent)

### In-mission polish (SCOPE already lists most)

| Gap | Persona impact | Notes |
|---|---|---|
| Registry-driven room suggestions | Admin first-run | J4 partial; biggest *product* unlock left |
| Touch ergonomics of editors | Admin on tablet | Partial |
| Value-display richness | Household | Partial |
| a11y beyond `prefers-reduced-motion` | All | Keyboard/ARIA weak |
| Plan-level security glance (“N open / all locked”) | Household / kiosk | SCOPE known gap |
| Person / presence in rooms | Household | SCOPE known gap; presence ripples exist at marker level |
| Threshold colouring for room metrics | Household | SCOPE known gap |
| README / screenshot lag vs redesign | Adoption | Distribution, not function |

### Engineering gaps that feel like product bugs

| Gap | Why it matters |
|---|---|
| Default `admin_only=False` while UI hides editors from non-admins | Non-admin can still mutate via raw WS — surprise vs household persona |
| Opening-measure magnet placement flake under pinned Chromium | One smoke red; pixel-precision path |
| Demo.html needs hass nudge / F5 for icons | Harness quirk; confuses manual demo in a raw browser |

### Explicit non-gaps (do not “fix” by building these)

- 3D / glb
- Furniture / wall drawing (easy-floorplan territory)
- Vacuum start/zone commands
- History graphs, cameras, energy
- Cloud collaboration
- Becoming a general dashboard framework

## 5. Systematicity scorecard

| Question | Answer |
|---|---|
| Is there one mental model? | Yes — spaces/rooms/markers/settings tiers |
| Do modes prevent tool leakage? | Mostly — UX-MODES + kiosk hard-block; View is default |
| Are overrides predictable? | Yes — more specific settings win |
| Do security rules have a single owner? | Tap: `resolveTapAction`. Write: `may_write` (UI duplicate — debt) |
| Are frozen excesses documented? | Yes — SCOPE excess audit |
| Is the roadmap still pointing at the mission? | Phase 8–10 are quality/distribution; Phase 9 leftovers are registry/docs — aligned |

**Grade: A− for functional systematicity.** The product feels designed, not
accreted — with the structural exception of the Lit shell size (quality debt,
not a feature-model debt).

## 6. Suggested integrity checks for future agents

Before merging a feature:

1. Does it serve J1–J7 or a SCOPE “known gap”? If neither → reject or rewrite.
2. Does it introduce a second policy for taps, writes, or file deletion? → fold
   into `resolveTapAction` / `may_write` / collection rules.
3. Does it need a migration? → dual-store / repair path, not silent reshape.
4. Is it tested at the right layer? Pure math → `npm test` / pytest; pointer UX
   → smoke with `check`/`finish`; never a smoke that always exits 0.
5. Dual CHANGELOG + STATUS/ARCHITECTURE/TESTING updates in the **same** commit.
