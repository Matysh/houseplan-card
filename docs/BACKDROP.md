# The backdrop picture — the spec (source of truth)

*Owner-approved 2026-08-04. Companion to docs/CANVAS.md (the plane the
picture lives on) and docs/RESIZE.md (the other transform frame).*

Until v1.58.0 an uploaded plan image was nailed to the canvas: centred, at
its own proportions, filling the square. If it did not line up with the
rooms you had drawn — or with the rooms you were about to draw — the only
recourse was to edit the file. And because it filled the canvas, it also
decided where the opaque **paper** was, which quietly made a picture plan
and a drawn plan two different kinds of thing.

This closes both. The picture is now **one of the objects on the plane**:
it can be moved and scaled like anything else, it counts as content for
the frame, and it no longer makes paper of its own.

---

## §1 Model — three optional numbers

A space gains three optional fields, next to `plan_url` / `plan_aspect`:

| Field | Meaning | Units | Range |
| --- | --- | --- | --- |
| `plan_x` | offset of the image's **top-left corner** from its default place | normalised (as rooms, decor, openings) | ±`CANVAS_LIMIT` (±5000) |
| `plan_y` | the same, vertically | normalised | ±`CANVAS_LIMIT` |
| `plan_scale` | **one** uniform multiplier for both sides, anchored at the (already offset) top-left corner | multiplier | `0.01 … 100` |

There is **no rotation** and no independent width/height: the picture keeps
its own aspect ratio for ever, which is what makes "scale" a single number.

**The absence of all three is exactly the pre-v1.58.0 behaviour.** No
migration runs, nothing is written into anybody's store, and a plan that has
never been through the backdrop editor renders bit-identically. Junk (a
string, `NaN`, a zero or negative scale) is treated as absence, not as an
error — the same reading rule the rest of the geometry uses.

One function owns the arithmetic, `planRect()` in `src/space-geometry.ts`:

```
base   = fitInSquare(plan_aspect, 1000)      // the centred default
rect.x = base.x + plan_x * 1000
rect.y = base.y + plan_y * 1000
rect.w = base.w * plan_scale
rect.h = base.h * plan_scale
```

`spaceModels()` calls it, so **every** consumer — the full card, the static
`houseplan-space-card`, the kiosk, the content frame — reads the same
rectangle. The card's model cache key (`_cfgFingerprint`) carries the three
fields, so a drag invalidates the memo.

`validation.py` mirrors the ranges (`PLAN_SCALE_MIN` / `PLAN_SCALE_MAX`
alongside `CANVAS_LIMIT`). Detaching the image (space dialog → «Нарисую
комнаты вручную») deletes all three: there is nothing left for them to
describe, and a stale transform must not silently apply to the next upload.

---

## §2 The transform frame

**Where.** The **backdrop editor** (`mode: 'decor'`, «Редактор подложки»).
The frame is on screen as soon as that editor opens (tools **select** and
**«Картинка-подложка»**); the drawing tools own the drag, so the frame
steps aside for them. Nowhere else: View, the Plan editor, the Device
editor and the kiosk never touch the picture. A space with no image never
grows a frame, and its toolbar is unchanged.

**What.** A dashed outline on the picture's rectangle plus four
finger-sized corner handles (radius = 2 % of the visible view, so they stay
grabbable at any zoom — the same rule the vacuum fit frame uses). The
outline never takes a pointer; the handles do, with `setPointerCapture` and
`nwse-resize` / `nesw-resize` cursors. Under the picture's own tool the
stage cursor is `grab`, and `grabbing` while a gesture is live.

**Move** — press anywhere inside the picture and drag, **under the
«Картинка-подложка» tool**. Why a tool and not just the select tool: the
picture's body is most of the screen, and claiming it would take away the
one-finger pan of the whole plane, which the owner asked for on 2026-08-04
(«таскать план при любом масштабе») and `smoke_pan_any_zoom` guards. The
corner handles are precise targets and need no such protection — they are
live whenever the frame is. The gesture is also only started INSIDE the
rectangle, so pressing beside the picture pans even under its own tool.

**Nothing may rescale the stage mid-gesture.** Two things wanted to, and
both moved the picture away from the finger before they were stopped:

* the picture is a content item, so dragging it GROWS the editor's content
  frame, which rescales the view — `_frameOf()` therefore returns the
  memoized frame untouched while `_bdDrag` is live, and catches up on
  release;
* «Вернуть картинку» appears the moment the picture has moved, and the
  toolbar sits above the stage — so it is withheld until the gesture ends.

**Scale** — pull a corner. Uniform, about the **opposite** corner, which
stays exactly where it was (the mechanic borrowed from the vacuum
calibration panel). `k = max(|dx| / base.w, |dy| / base.h)`, so the gesture
follows whichever axis you pulled harder, and both sides then follow `k`.

**Nothing else moves.** Rooms, openings, devices, decor and room labels are
untouched by both gestures — this is a picture-only transform, and the
smoke asserts the room geometry is byte-identical afterwards.

**Undo** is the «Вернуть картинку» button in the backdrop toolbar: it
appears only once the picture HAS been moved, and it deletes the three
fields (back to centred, own size).

---

## §3 THE PAPER IS THE ROOMS — and only the rooms

*This is a behaviour CHANGE, deliberately.*

The opaque "paper" exists so the scene background — `bg_color`, or the
`daynight` sky (docs/SUN.md) — never bleeds through the plan itself. Until
v1.58.0 it had two forms: the ROOM CONTOURS for a drawn plan, and **the
image rectangle** for a picture plan.

The second form is gone. The paper is now `paperRoomShapes(space.rooms)`
in every case:

* one opaque shape per room, in exactly the room's own geometry — an
  L-shaped house or a pair of detached buildings never grows a bounding
  rectangle;
* an empty space has **no paper at all**, image or no image;
* its colour is unchanged (`styles.ts .hp-paper`): white on a hand-drawn
  plan (`.stage.noplan`), the theme card background where an image is
  attached. `daynight` dims it via the `.zoomwrap` brightness filter only —
  its alpha stays 1.

**Layer order**, top to bottom, in both renderers:

```
devices / labels
sun wedges and rays
walls, openings, room fills, decor
THE PICTURE                     ← above the paper, below the geometry
the paper (room contours)
the scene background (bg_color / the daynight sky)
```

**The consequence, and the owner knows it:** a picture with transparency
over a space with no rooms drawn shows the scene background through itself.
That is the honest reading of "the paper belongs to the rooms" — draw the
rooms and the paper appears under them.

---

## §4 The picture is content

`contentItems()` has always counted the image rectangle as one content item
alongside the rooms; it now counts the **transformed** one. So the frame,
«Вписать всё», the zoom floor and the pan slack (docs/CANVAS.md §4–§5) all
follow the picture wherever it is dragged, and a picture scaled down to a
quarter tightens the frame around it instead of framing empty plane.

`iconUnit()` deliberately does **not** count it: an icon is a percentage of
the drawn plan (docs/CANVAS.md §6), and scaling the backdrop must not
resize every marker on it.

---

## §5 Snap

Both gestures obey the canvas snap contract (docs/CANVAS.md §9):

| Gesture | What is snapped |
| --- | --- |
| move | the resulting **top-left corner** — the anchor, not the delta, so one drag is enough to put a legacy off-grid picture onto the lattice |
| scale | the dragged corner **along the picture's longer side**; the scale is then read back off it |

The fixed corner of a scale keeps its (on-grid) place and the long side
lands on a node. The short side follows from the aspect ratio and generally
does **not** — that is what "uniform, no stretch" costs, and it is the
right trade: a picture whose proportions drift is a broken picture.

**Shift** suspends the snap for the duration of the gesture, exactly as
everywhere else (§9.4). The `±CANVAS_LIMIT` clamp rides along regardless —
`_snap()` and `clampCanvasN` are the only bound either gesture has.

---

## §6 Live measurements

While the picture is dragged or scaled, one badge rides its centre with the
picture's **real size**, width × height, through the space's `cell_cm` and
the HA unit system (metres or feet). It is the same `_fmtLen`
(`segmentCm` → `formatLength`) and the same `.measurelabel` element the
wall ruler, the opening shoulders and the room resize use — the card states
a length exactly one way.

---

## §6b One tool at a time — a drawing tool owns the canvas

The backdrop editor has seven tools, and they are **exclusive**: only
**select** talks to an existing shape, only **erase** deletes one, only
**«Картинка-подложка»** grabs the picture's body, and the four drawing
tools (**line**, **rect**, **ellipse**, **text**) do nothing but create.

The rule exists because of a concrete failure (owner, 2026-08-04): *«нельзя
поставить начало линии на конец другой — при клике на конец выделяется
первая линия, а не начинает рисоваться новая»*. The shape's own
`pointerdown` handler ran first, stopped the event and did nothing under a
drawing tool, so the press never reached the stage and no draft was born —
exactly on the one spot where a new line most wants to start, since §5's
snap anchors include every line end.

So, under a drawing tool (and under the picture tool):

* `.dshape` is `pointer-events: none` — an existing figure is not a target
  at all, and the cursor is the stage's;
* `_decorShapeDown` returns before `stopPropagation` for any tool that is
  not select/erase, so a synthetic press cannot swallow the gesture either;
* `_decorPointerDown` only looks for a shape under the pointer for
  select/erase, and otherwise starts the draft at the pressed point;
* the transform frame's corner handles stay off (§2) — they were the first
  thing taught not to swallow the first point of a line.

Selecting, moving and the text dialog's double-click therefore live in the
select tool only. `demo/smoke_decor.mjs` asserts both halves: a press on an
existing line starts a new line **from that end** under the line tool, and
still selects and grabs it under select.

---

## §7 What is deliberately NOT done

* **No rotation.** A skewed scan is a scan to re-take, not a plan to skew
  the whole editor's maths for.
* **No non-uniform scale.** See above: the picture keeps its ratio.
* **No numeric fields** in the space dialog. The frame is the interface;
  the numbers exist for the config, not for typing.
* **No per-room clipping of the picture.** It is one rectangle.
* **No transform for the sun's paper/wedges.** Those follow the rooms, and
  now so does the paper — one rule, no second geometry.

---

## §8 Where it lives

| Concern | File |
| --- | --- |
| the rectangle (`planRect`, `PLAN_SCALE_MIN/MAX`), content items | `src/space-geometry.ts` |
| the frame, the gestures, the live badge, the reset | `src/houseplan-card.ts` (`_bd*`, `_renderBackdropFrame`) |
| the frame's look, the paper, the cursors | `src/styles.ts` (`.bdframe`, `.hp-paper`) |
| the static card's copy of the paper + picture order | `src/space-render.ts` |
| the stored ranges | `custom_components/houseplan/validation.py` |
| unit coverage | `test/backdrop.test.mjs` |
| DOM coverage | `demo/smoke_backdrop.mjs`, `demo/smoke_bg_color.mjs` §11 |
| screenshots | `demo/shot_backdrop.mjs` |
