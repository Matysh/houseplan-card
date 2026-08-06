# Project audit — index

> **Archived:** this is the v1.58.0 snapshot. The current product audit is
> [`docs/PRODUCT-IMPROVEMENT-PLAN.ru.md`](../../../docs/PRODUCT-IMPROVEMENT-PLAN.ru.md).
>
> **Audience:** future humans and agents. Read this before proposing features,
> refactors, or go-to-market work. Snapshot date: **2026-08-05**. Product
> version audited: **v1.58.0**.
>
> **Policy at the snapshot date:** this pack supplemented `PRODUCT-2026-07-05.md`,
> `STATUS.md`, `SCOPE.md`, `ARCHITECTURE.md`, `ROADMAP.md`. When they disagree
> on *current* market numbers, prefer this pack until `PRODUCT.md` is refreshed.

## Pack contents

| File | What it answers |
|---|---|
| [`AUDIT-MARKET.md`](AUDIT-MARKET.md) | Potential, demand shape, competitors, positioning, risks |
| [`AUDIT-QUALITY.md`](AUDIT-QUALITY.md) | Implementation quality, architecture, security, tests, tech debt |
| [`AUDIT-FUNCTIONAL.md`](AUDIT-FUNCTIONAL.md) | Feature integrity, systematicity, claim↔code parity, gaps |
| [`AUDIT-RECOMMENDATIONS.md`](AUDIT-RECOMMENDATIONS.md) | Prioritized actions (P0–P3) with rationale |

## Executive verdict (one screen)

**House Plan is a high-craft, scope-disciplined product in a niche that suddenly
got a fast-growing peer.** Engineering quality (validation, tap security, CI
layers, quality-scale honesty, docs discipline) is well above typical HACS
cards. The dominant risks are no longer “can we build it?” — they are
**discoverability**, **maintainability of a 8.7k-LOC Lit god-object**, and
**losing the GUI-floorplan narrative to easy-floorplan** (≈430★ vs our ≈21★
as of 2026-08-05; a month earlier PRODUCT.md listed easy-floorplan at 11★).

| Dimension | Grade | One-line |
|---|---|---|
| Product mission / scope discipline | **A** | SCOPE.md is unusually sharp; non-goals held |
| Feature depth vs mission | **A−** | Jobs J1–J7 closed; a few polish gaps |
| Implementation quality (backend) | **A−** | Strong WS/HTTP/auth/file races; coverage % still todo |
| Implementation quality (frontend) | **B** | Pure modules good; card shell is a maintainability bomb |
| Test strategy | **A−** | 4 layers + smoke policy; human matrix stale |
| Competitive moat (technical) | **A−** | Server-side storage + area-bound rooms still unique |
| Competitive position (market) | **C+** | Traction lagging the wave; HACS default still queued |
| Distribution / social proof | **C** | Demo stand exists; forum/Reddit/GIF still open |
| Bus factor / docs | **B+** | Excellent docs; single maintainer |

**Do not** expand into 3D, furniture CAD, vacuum commands, or cloud — SCOPE
forbids them and competitors already own parts of that surface. **Do** close
the distribution gap and keep the moat (registry depth, multi-client storage,
overlays that feel like a home — not a drawing app).

## How agents should use this

1. Before a feature: check `SCOPE.md` → then `AUDIT-FUNCTIONAL.md` gaps → then
   `AUDIT-RECOMMENDATIONS.md` priority.
2. Before a refactor: read `AUDIT-QUALITY.md` top-10 debt; prefer extracting
   from `houseplan-card.ts`, not rewriting working pure modules.
3. Before go-to-market or README claims: read `AUDIT-MARKET.md` — star counts
   and competitor maturity change monthly; re-verify with GitHub API.
4. After acting on a P0/P1 item: update the relevant AUDIT file’s “Status”
   line in the same commit (short note + date), and bump STATUS.md watchlist
   if the project-level state changed.

## Method

- Read: PRODUCT, STATUS, ARCHITECTURE, ROADMAP, SCOPE, UX-MODES, TESTING,
  CONTRIBUTING, quality_scale.yaml, manifest, key `src/` + `custom_components/`
  modules.
- Metrics: `wc -l`, bundle size, `npm`/`pytest` inventory, GitHub API star
  counts (2026-08-05), hacs/default#9004 state.
- Code-quality pass: god-object sizing, auth UI↔API, tap-action model,
  validation parity, test layer map.
- Explicitly **not** a full security penetration test or coverage measurement.

## Related living docs

- Market rationale (older): [`PRODUCT-2026-07-05.md`](../PRODUCT-2026-07-05.md).
- Guard rail: `SCOPE.md`
- Current ops snapshot: `STATUS.md`
- Design: `ARCHITECTURE.md`, `CANVAS.md`, `BACKDROP.md`, `VACUUM.md`, `SUN.md`
