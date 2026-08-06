# Audit — implementation quality

> Snapshot: **2026-08-05**, product **v1.58.0**.
> Severity: **critical / major / minor / nit**. No critical RCE found under
> normal HA session auth.

## 1. Architecture snapshot

```
src/                         Lit 3 Lovelace cards (houseplan + space-card)
  houseplan-card.ts          ~8691 LOC — orchestration god-object
  logic.ts / devices.ts / …  extracted pure modules (good)
  styles.ts                  ~2223 LOC CSS-in-JS
custom_components/houseplan/ HA integration (storage, WS, HTTP, trails)
dist/ + frontend/            committed bundle (CI byte-compares)
demo/                        Playwright harness + smoke_*.mjs
tests_backend/               pure + HA-harness pytest
```

Bundle: **≈449 KB** raw / **≈128 KB** gzip — acceptable for a full editor+viewer.

## 2. What is strong

### Backend

- Single write-auth helper (`auth.may_write`) with **fail-closed** when entry
  missing (audit B2 lesson documented in the module).
- Voluptuous validation with **cross-language option-list tests** that parse
  `DISPLAY_MODES` / `TAP_ACTIONS` from `logic.ts` — rare and valuable.
- Config CAS via `expected_rev`; plan COW + quotas; never-delete-on-inference
  file policy (SCOPE).
- Geometry migration with durable `geom_pending` intent (HP-1490 class).
- Content HTTP: `requires_auth`, signed URLs for `<image href>`, SVG CSP sandbox.
- Diagnostics / repairs / system_health present; `quality_scale.yaml` mostly
  **honest** (`test-coverage`, `strict-typing`, docs todos marked todo).

### Frontend (extracted brain)

- Tap security model in `resolveTapAction` — locks/alarms never toggle from the
  plan; cover garage/door/gate guarded; `run` limited to automation/script/scene.
- Pure geometry / devices / sun / vacuum / resize / align-grid / signing modules
  with solid `node:test` coverage (~270 tests).
- Shared `config-store` + space-geometry/render for `houseplan-space-card`.
- Optimistic UI without rollback is **documented intentional** (ARCHITECTURE).

### Process

- Four test layers + smoke policy (“`[manual]` must have a failing auto check”).
- Dual CHANGELOG (en/ru), SCOPE guard rail, CONTRIBUTING five-minute loop.
- CI: hacs + hassfest + frontend + backend + smoke job.

## 3. Findings (ranked)

| # | Sev | Finding | Where |
|---|---|---|---|
| 1 | **major** | God-object card: ~8691 LOC, ~359 methods, ~125 private fields; `render()` ~382 lines. Smokes-only coverage for orchestration. | `src/houseplan-card.ts` |
| 2 | **major** | `strict: true` hollowed by `noImplicitAny: false`; ~200 `any` sites in the card alone; `hass: any` everywhere | `tsconfig.json`, card / devices / logic |
| 3 | **major** | Write-policy split: UI `_canEdit` is always admin-gated; API default `admin_only=False` lets **any** authenticated user write via WS/HTTP | `houseplan-card.ts` ≈L247–249, `auth.py` |
| 4 | **major** | `_canEdit` fails **open** when `hass.user` is missing (`is_admin !== false`) | card ≈L248 |
| 5 | **major** | `styles.ts` ~2223 LOC — second maintainability sink; untested | `src/styles.ts` |
| 6 | **minor** | `layout/update` has no `expected_rev` — multi-tablet last-writer-wins per point | `websocket_api.py` |
| 7 | **minor** | Marker `binding` is bare `str`; `ripple_color` not hex-matched; decor `w`/`h` allow negatives via `_NORM` | `validation.py` |
| 8 | **minor** | Card-level `tap_action` / `resolveTapAction` cardDefault is dead / ignored — confusing API surface | `types.ts`, click path |
| 9 | **minor** | Store `_async_migrate_func` is a no-op; real migrations live ad-hoc in setup | `store.py`, `__init__.py` |
| 10 | **nit** | `quality_scale.yaml` cites `test_config_flow.py`; file is `test_ha_config_flow.py` | quality_scale.yaml |
| 11 | **nit** | Duplicated `fireEvent` / `navigate` in card + space-card | both files |
| — | positive | Forbidden-domain tap model + confirm + cover guards | `logic.ts` |
| — | positive | Signed content + SVG sandbox | `http_api.py`, `signing.ts` |

**No critical** auth bypass of HA sessions found. Closest systemic issue is
finding #3 (API openness vs UI) under the default options.

## 4. TypeScript & tooling

| Item | State |
|---|---|
| `tsc --noEmit` in build | Yes — correct (rollup TS plugin can warn-and-ship) |
| ESLint / Prettier | **Absent** |
| `noImplicitAny` | **Off** |
| Frontend unit of the Lit class | **None** |
| mypy strict (backend) | quality_scale **todo** |

## 5. Test map

| Layer | What it proves | Gap |
|---|---|---|
| `npm test` (~270) | Pure logic, i18n parity, tap security, geometry | Not the card shell |
| `pytest` pure | validation.py without HA | — |
| HA-harness (py≥3.13) | setup, WS races, auth, upload, geometry repair | Coverage % unmeasured |
| `demo/smoke_*.mjs` (~100) | Real pointer/UI against fake hass | Pixel flakes (`smoke_opening_measure`); no Safari/Companion matrix |

Human checklist in TESTING.md last full self-run recorded at **v1.21.1** while
product is at **v1.58.0** — auto net grew; documented human pass did not.

## 6. Docs drift (quality of truth)

| Doc | Drift |
|---|---|
| `ARCHITECTURE.md` intro | Still mentions old `src/data/house.ts` / 1489×1053 era in places; square/infinite canvas sections newer |
| `UX-MODES.md` header | Still says “No code has been changed yet” — Phase 11 shipped |
| `PRODUCT.md` competitor table | **Stale** — easy-floorplan 11→430★ (see AUDIT-MARKET) |
| `STATUS.md` | Generally current as of 2026-08-04 |

Docs discipline is a project strength; these drifts are fixable and should be
treated as debt, not ignored.

## 7. Top 10 technical debt (actionable)

1. Split `houseplan-card.ts` into shell + Plan/Devices/Decor editors + dialogs.
2. Turn on `noImplicitAny` incrementally; type a thin `Hass` surface.
3. Align write policy: wire UI to `admin_only`, or default `admin_only=True`.
4. Fail closed on missing `hass.user`.
5. Add CAS / expected_rev to `layout/update` (or document single-writer assumption).
6. Split `styles.ts` by feature surface.
7. Tighten MARKER_SCHEMA (`binding`, colors, decor extents, space ids).
8. Unit-test orchestration hotspots (`_clickDevice`, write-chain conflicts, modes).
9. Real Store migrations or document setup-time migrations as the only path.
10. Remove or re-wire dead card-level `tap_action` / cardDefault.

Detailed priority and sequencing: [`AUDIT-RECOMMENDATIONS.md`](AUDIT-RECOMMENDATIONS.md).

## 8. Quality-scale honesty check

| Claim | Audit view |
|---|---|
| Bronze structural items `done` | Accurate |
| Silver unloading / owner `done` | Accurate |
| Gold diagnostics / repairs `done` | Accurate |
| `test-coverage` / `strict-typing` / docs examples `todo` | Accurate — keep them todo until measured |
| `config-flow-test-coverage` path typo | Nit — fix filename in yaml |

Overall: self-assessment is trustworthy; do not mark coverage done without a number.
