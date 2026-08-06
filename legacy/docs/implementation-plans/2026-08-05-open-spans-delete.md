# Open spans + wall-centric Delete — Implementation Plan

> **For agentic workers:** execute task-by-task; checkboxes track progress.

**Goal:** Partial virtual wall stretches (`space.open_spans`) + Delete operates on walls (close → merge/delete room), then ship `v1.59.0-beta.6`.

**Architecture:** Pure helpers in `src/open-spans.ts`; card wires two-click openwall and wall-centric delete; `open_to` remains the light-zone index derived from spans; legacy `open_to`-only configs expand to full sharedBoundary on read.

**Tech Stack:** TypeScript, Lit card, node:test, Playwright smokes, GitHub prerelease.

**Spec:** [`docs/superpowers/specs/2026-08-05-open-spans-delete-design.md`](../../../docs/superpowers/specs/2026-08-05-open-spans-delete-design.md)

## Global Constraints

- Cursor openwall = crosshair (not pointer)
- Openings forbidden on virtual; purge on open
- Thickness clear on open; restore neighbour / DRAW_WALL_DEFAULT_CM on close
- Delete: virtual→close; shared→confirm merge whole pair; outer/inside→confirm delete room
- Version bump to `1.59.0-beta.6` for this ship

## File map

| File | Role |
|------|------|
| `src/open-spans.ts` | CRUD, legacy expand, snap/clamp, thickness+opening side effects, rekey/degrade |
| `src/houseplan-card.ts` | Gestures, render cuts from spans, merge via existing dialog |
| `src/styles.ts` | openwall crosshair |
| `src/i18n/en.json`, `ru.json` | Toasts / titles |
| `test/open-spans.test.mjs` | Unit |
| `demo/smoke_openwall.mjs` (+ hover/delete as needed) | Browser |
| docs CHANGELOG/STATUS/ARCHITECTURE | Ship notes |

## Tasks

- [ ] Task 1: `open-spans.ts` + unit tests
- [ ] Task 2: Wire `_openPairs` / openwall 2-click / openings refuse+purge
- [ ] Task 3: Wall-centric Delete + merge confirm path
- [ ] Task 4: Smokes, i18n, docs
- [ ] Task 5: Bump beta.6, build, commit, tag, GitHub prerelease
