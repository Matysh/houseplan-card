# История прогонов и партий

> Приложение к [`docs/TESTING.md`](../TESTING.md): перенесено оттуда дословно (#634).
> Индекс всех приложений — [`README.md`](README.md).

## Last self-run

**v1.21.1 (2026-07-16), full audit of v1.16–v1.21.** All `[manual]` items pass (73 frontend
tests, 12 backend). New smokes on the synthetic home: `smoke_merge_split` (merge fuses
adjacent rooms keeping the survivor's id; non-adjacent refused with a toast; split creates
the new room, cancel keeps the room whole, along-wall cut refused) and `smoke_split_nonsnap`.
Finding turned into a fix (shipped this release): **Split required the click to land on a grid
node**, so it silently failed on rooms whose walls are not grid-aligned (imported/legacy
polygons) — the click now snaps to the nearest wall instead of the grid, and `splitRoom()`
still rejects a bad cut. README (en+ru) gained the merge/split/ruler/scale documentation it
was missing. The earlier self-run record follows.

**v1.14.0 (2026-07-06), headless demo harness + unit suites.** All `[manual]` items pass
(43 frontend tests, 11 pure + 12 HA-harness backend tests, `smoke_space_settings`,
tap/hold/wizard/rules smokes). Bugs found during the run, fixed in the same release:
1. Edit dialog: switching an existing space from image to "draw" kept the old
   background (`plan_url` not detached) — fixed.
2. `_stateClass` crashed on state objects without `entity_id` (domain is now
   derived from `d.primary`, which the state was looked up by) — fixed; found by
   the 150-device perf item of this checklist.
3. Perf item measured: 162 devices build in ~14 ms, re-render ~1 ms — well within budget.
4. (earlier rounds) long-press phantom after `pointercancel`; `_saveConfigNow`
   conflict without resync — fixed in v1.13.2.
Unchecked boxes above (real browsers/devices, multi-tab live sync, Companion apps)
require hands on real hardware — they remain for the human pass.

## Batch 2026-08-04 (dev, unreleased)

- [ ] **Room borders have no teeth** (owner 2026-08-04): draw a room with a
      sharp corner (a wedge with a 30-60° apex, or an L) — the corner is
      ROUNDED off by the stroke's own radius, never a spike sticking out past
      the two walls and never a flat bevel. Same in the plan View, in the Plan
      editor and on the static `houseplan-space-card`; a room with OPEN
      boundaries (its trimmed outline) has round corners too
      [auto: smoke_render_parity, still: demo/shot_room_joins.mjs]
- [ ] **The Background editor measures what you draw** (owner 2026-08-04, «в
      редакторе подложки у линий писать длину»): while a decor LINE is being
      dragged out, a badge on the MIDDLE of the segment shows «length · angle»
      in the HA unit system (`cell_cm`, metres or feet) and turns green on a
      45° multiple — exactly the badge a wall gets in the Plan editor. It
      updates on every move, is absent before the drag has any length, and is
      gone the moment the shape is committed. Rectangles show «W × H» plus
      area; circles show `R`, and non-circular ovals show `Rx × Ry`
      [auto: smoke_decor]
