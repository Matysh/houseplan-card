# Open spans + wall-centric Delete — design

> Superseded on 2026-08-06 by the accepted UX-02 decision: opening a boundary,
> closing a boundary, merging rooms, and deleting a room are separate tools.
> This file remains only as the historical rationale for the original open-span
> implementation; current work is tracked in GitHub Issues + Project v2.

Status: **approved in chat** (2026-08-05). Implementation plan follows after
spec review.

## Goal

Replace whole-boundary open-wall toggle with **partial virtual stretches**
(anchor → second point on a shared wall), and make **Delete** operate on walls
(close virtual → merge / delete room) with confirmation.

## Current behaviour (baseline)

- Tool «Открытая граница»: one click toggles `room.open_to` for a room pair;
  **all** `sharedBoundary` stretches between the pair become virtual.
- Tool «Удалить»: click inside a room → confirm → delete room.
- No geometric open-span storage; light zones use `open_to` only.

## Decisions (from brainstorming)

| Topic | Decision |
|-------|----------|
| Data model | Approach **1**: `space.open_spans` + keep `open_to` as connectivity index |
| Open target | Shared wall only; outer wall → toast |
| Gesture | Click1 = anchor P1; click2 = P2 on same edge; P2 clamped to nearest corners either side of P1 |
| Cursor (openwall) | **crosshair** (same as Draw), not pointer |
| Snap | Corner / existing open joint first; else grid projected onto the wall |
| Close virtual | Both openwall (click on span) and Delete (first hit on span) |
| Thickness on open | Clear `walls[]` cm on covered keys immediately |
| Thickness on close | Inherit cm from remaining solid collinear part of same wall; if none → `DRAW_WALL_DEFAULT_CM` (15 cm / imperial) |
| Delete + virtual | First click closes span (no confirm) |
| Delete + shared solid | Confirm → **merge** the two rooms along the **entire** shared boundary |
| Delete + outer wall | Confirm → **delete room** |
| Delete + inside room | Same as outer: confirm → delete room |
| Merge / delete room | Always `confirm()` |
| Openings on virtual | **Forbidden**; remove any openings on a span when it becomes virtual; cannot place new ones there |
| Legacy `open_to` | On read, treat full `sharedBoundary` of the pair as open spans; persist `open_spans` on first save/edit |

---

## §1 Data model

### Storage (per space)

- `open_spans: Array<{ key, … }>` — geometric virtual stretches. Keying aligns
  with `walls[]` (quantised midpoint + direction mod 180°). Store enough to
  recover segment endpoints after rekey (explicit `a`/`b` normalised coords
  and/or length along the edge — implementation detail in the plan).
- `rooms[].open_to: string[]` — symmetric room-id links for
  `openZoneOf` / glow (unchanged consumer API).

### Invariants

1. A span exists only on a **shared** boundary of exactly two rooms.
2. While a pair has ≥1 span → both rooms list each other in `open_to`.
   Removing the last span clears the link.
3. An open span and a positive `walls[]` thickness on the same covered keys
   do not coexist: opening clears thickness; closing restores per rules above.
4. Legacy: `open_to` present, `open_spans` absent/empty → **read path** expands
   each linked pair to its full `sharedBoundary` segment list as virtual spans;
   write them into `open_spans` on the next config save that touches the space
   (or any openwall/delete edit).
5. Geometry lifecycle: resize / undo / scale / split / merge **rekey** spans
   like walls; unmatched keys degrade silently; merge of a pair drops spans
   between those two rooms.

---

## §2 Gestures

### Tool: Open boundary (`openwall`)

1. **Hover** on a shared solid wall: highlight eligible wall; cursor
   **crosshair**. Outer wall: no “hot” affordance beyond default crosshair;
   click → toast (shared only).
2. **Click1**: anchor P1 on the wall (snap: corner/joint → else grid on edge).
   Remember the edge and nearest corners L, R along that edge.
3. **Preview**: segment P1→cursor, clamped to [L, R] on the same edge.
4. **Click2**: P2 in [L, R]. If length below minimum → toast, clear anchor.
   Else write span, clear thickness on covered keys, remove openings on the
   span, refresh `open_to`.
5. **Click on existing virtual span**: close that span; restore thickness
   (neighbour solid / default 15); no confirm.
6. **Esc**, click away, tool change, leave markup: clear in-progress anchor.

### Tool: Delete (`delroom` — wall-centric)

Hit priority: virtual span → shared solid wall → outer wall → point inside room.

| Hit | Action |
|-----|--------|
| Virtual span | Close span (no confirm), same as openwall |
| Shared solid wall | Confirm → merge both rooms (entire shared boundary) |
| Outer wall | Confirm → delete the room that owns that outer edge |
| Inside room | Confirm → delete that room |
| Miss | No-op (optional light toast) |

After closing a virtual span, a later Delete click on that now-solid shared
wall runs the merge path (with confirm).

---

## §3 Thickness, openings, errors, tests

### Thickness

- Opening a span: strip `walls[]` entries (or null cm) for keys covered by the
  span (atomic collinear pieces under the segment).
- Closing a span: if a collinear solid remainder of the same wall still has cm,
  copy that cm onto the newly solid stretch; else apply `DRAW_WALL_DEFAULT_CM`.
- Wall-thickness tool continues to refuse open stretches (toast).

### Openings (doors / windows)

- **Not allowed** on virtual spans.
- When a stretch becomes virtual: **delete** any openings whose centre lies on
  that stretch (same association rules as wall bodies / angle-aware hit).
- Opening tool: refuse placement on a virtual span (toast).

### Errors / cancel

- Outer / not-a-wall / too short / click2 off the anchored edge → toast and
  clear the in-progress anchor.
- Merge and room delete always go through `confirm()`; cancel → no-op.
- Saves stay optimistic like other plan edits.

### Testing

**Unit**

- Clamp P2 to nearest corners; min length.
- Span write ↔ `open_to` add/remove.
- Thickness clear on open; restore from neighbour / default 15 on close.
- Legacy `open_to` → virtual full sharedBoundary spans.
- Rekey after edge move / scale; degrade orphans.
- Opening removal when span opens; placement blocked on virtual.

**Smoke**

- Anchor + P2 → dashed span; glow crosses only when span links rooms.
- Close via openwall and via Delete.
- Delete merge / delete-room confirms; outer open attempt toasts.
- Crosshair cursor in openwall tool.

### Docs / i18n

- Update `docs/ARCHITECTURE.md` (open boundaries), `WALL-THICKNESS.md` (open
  refuses thickness + clear on open), `UX-MODES` / TESTING hints, CHANGELOG.
- New toasts: shared-only, short segment, openings removed, delete/merge
  confirms copy; refresh `title.markup_openwall` / `delroom` hints.

### Out of scope

- Partial merge along only the former virtual segment (explicitly rejected: merge is whole shared boundary).
- Outer-wall virtual openings (“to outdoors”).
- Restoring thickness from pre-open snapshot (neighbour / default only).
- Changing glow math beyond “any span ⇒ rooms linked”.

---

## Implementation sketch (not a plan)

1. Pure helpers: expand legacy, clamp segment, span CRUD, thickness
   clear/restore, opening purge on span, rekey/degrade.
2. Card: openwall two-click state machine; Delete hit priority + confirms.
3. Render: dashed strokes from `open_spans` (fallback legacy expand); trim
   outlines/cuts from span list.
4. Smokes + unit tests; docs/i18n; version bump when shipping.

## Open points for the implementation plan only

- Exact JSON shape of one `open_spans` entry (`key` only vs `key`+`a`+`b`).
- Minimum segment length (e.g. `gridPitch` or fixed cm).
- Whether Delete merge reuses the existing merge-tool code path verbatim.
