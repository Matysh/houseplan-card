# The furniture library — top-view symbols in the decor layer

Status: **implemented (dev, unreleased).** Code: `src/furniture.ts` (the
table, the geometry, the wall magnet, the resize — all pure and unit-tested),
`src/houseplan-card.ts` (the `furniture` tool, `_renderFurnPalette`,
`_furnPlace`, `_furnMoveUpdate`, the shared `_dt*` frame),
`custom_components/houseplan/validation.py` (`DECOR_SCHEMA`, furniture
branch). Tests: `test/furniture.test.mjs`,
`tests_backend/test_validation.py::test_decor_furniture`; smoke:
`demo/smoke_furniture.mjs`.

The shape: `{kind:'furniture', symbol, x, y, w, h, color, width, angle?}` —
a **new** decor kind, so no existing plan carries one, nothing is migrated,
and every plan written before this validates and renders byte-for-byte as
before.

## 1. Why a plan needs furniture and not icons

A house plan with rooms, doors and devices still does not look like a plan of
a *home*. What tells a stranger which room is the bathroom is not the label
«Bathroom» — it is a bath, a toilet and a basin drawn where they stand. The
competing card solves this by making the user bring their own SVG; we already
draw the walls, so the pieces are ours to draw too.

**The symbols are ours, drawn in code.** This is the one design decision worth
arguing, so: every general-purpose icon set — Material Design Icons included,
and `@mdi/js` is already in this bundle — draws a **pictogram**, a sofa seen
from the front inside a 24 × 24 square. A plan is drawn **from above** and
**to scale**: a sofa is a 2.2 × 0.9 m rectangle with a back along one long
side. Stretching a 24 × 24 front view into that rectangle produces a drawing
that was never meant to be stretched; on the plan it reads as an icon lying on
the floor. It also fights the renderer: a non-uniform `scale()` distorts the
stroke, and the usual cure (`vector-effect: non-scaling-stroke`) freezes the
stroke in screen pixels, so a furniture outline would stop scaling with zoom
while every other decor shape kept scaling.

So `src/furniture.ts` holds ~30 symbols as primitives in a **unit box**, and
`furniturePathD(symbol, w, h)` generates one `d` string at the piece's real
size. The stroke is then an ordinary `stroke-width` in render units, exactly
like a decor rectangle. The whole library costs a few kilobytes of source and
needs no asset pipeline, no build step and no second set of preview images —
the palette draws its thumbnails with the same function the plan uses.

Two conventions every symbol obeys, and they are the whole contract:

- the box is `0..1 × 0..1`, `x` right, `y` **down** (SVG);
- **`y = 0` is the BACK** — the side that goes against a wall. A sofa's back,
  a bed's headboard, a wardrobe's rear panel, a worktop's edge and a toilet's
  cistern are all "the back", and that is what makes §5 mean something;
- nothing is filled. A plan is a drawing.

## 2. The licence, and what we did not use

The project is MIT and the symbols ship inside the bundle and through HACS, so
only a licence permitting commercial use and modification **without attribution
in the UI** is usable: public domain / CC0 / MIT / Apache-2.0 / BSD / ISC /
SIL OFL. What was checked, from the repositories and licence pages rather than
from hearsay:

| Set | Licence | Attribution in the UI? | Top view? |
|---|---|---|---|
| Material Design Icons (`@mdi/js`, Pictogrammers) | Apache-2.0 (`Pictogrammers Free License`: icons Apache-2.0, code MIT) | not required ("appreciated in your about screen") | **no** — 24×24 pictograms |
| Tabler / Lucide / Phosphor / Iconoir | MIT / ISC / MIT / MIT | no | **no** — pictograms |
| Font Awesome Free | CC BY 4.0 | **yes** | no |
| Game-icons.net | CC BY 3.0 | **yes** | no |
| Flaticon / Freepik / Vecteezy / Adobe Stock / Noun Project | proprietary or CC BY | yes / unusable | mixed |
| [`1337GameDev/FloorPlanSVGSymbols`](https://github.com/1337GameDev/FloorPlanSVGSymbols) | **MIT** | no | **yes** |

So a ready-made, correctly licensed **top-view** set does exist — exactly one,
a 70-file MIT repository by Richard Duerr. It was read and **not used**, and
the reason is not the licence:

- coverage is partial and shaped for a different job (electrical receptacles,
  smoke detectors, five window types; no wardrobe, no desk, no single bed, and
  a sofa that is assembled from `CouchLeft` + `CouchMiddle` + `CouchRight`);
- the files are raw Inkscape output — `sodipodi` namespaces, unused gradient
  `defs`, absolute `translate(-1366,-1443)` transforms, hard-coded
  `stroke:#000000` inline styles, arbitrary `mm` viewBoxes. Every one would
  need stripping, re-origining, re-normalising and re-colouring to
  `currentColor` before it could be used, which is the same work as drawing it
  — without the freedom to pick the real-world proportions.

The set is recorded here because its licence is genuinely compatible: if we
ever want a symbol we do not have (an electrical panel, a fan), taking it from
there is legally free — MIT, one copyright line in `LICENSE`, no UI credit.
**Nothing from it is in the bundle today.** Our symbols are original, and the
licence question is therefore closed rather than managed.

`@mdi/js` stays where it is — the *toolbar button* for the library is
`mdi:sofa-outline`, an icon in a toolbar, which is what pictograms are for.

## 3. The palette

The decor bar gains a seventh tool, **Мебель / Furniture**, next to
line/rect/oval/text. Choosing it opens a panel between the bar and the plan —
not a modal: where a sofa goes is a question about the plan, and the plan must
stay visible while it is answered.

- symbols are **grouped**, and the groups are the point: `мебель` (12),
  `техника` (8), `сантехника` (6), `прочее` (4 — stairs, fireplace, plant,
  rug). No search box: thirty items in four labelled rows are faster to scan
  than to type at.
- every tile draws the real symbol through `furniturePathD`, fitted into
  40 × 40 **keeping its real proportions** — so a sofa reads as a sofa and a
  toilet does not become a square.
- picking a symbol **arms** it and fills the two size fields with its default.
- **Width** and **Depth** are in metres or feet, by the HA unit system
  (`hass.config.unit_system.length`), and are editable **before** the click.
  The config stores centimetres-through-`cell_cm` either way: a unit system is
  how a user reads a plan, never what the plan is (docs/STYLING-HOOKS.md §6).

### The symbols and their default real sizes

Widths are measured **along the back edge**, depths away from it. Where the
owner's list gave a pair without an axis, the pair is kept and the axes follow
from the back edge — a toilet is 0.4 m wide and 0.7 m deep, not the other way
round.

| Group | Symbol | W × D, m | | Symbol | W × D, m |
|---|---|---|---|---|---|
| мебель | Диван `sofa` | 2.2 × 0.9 | | Кресло `armchair` | 0.9 × 0.85 |
| | Журнальный столик `coffee_table` | 1.1 × 0.6 | | Обеденный стол `table_dining` | 1.4 × 0.8 |
| | Круглый стол `table_round` | 1.2 × 1.2 | | Стул `chair` | 0.45 × 0.45 |
| | Письменный стол `desk` | 1.2 × 0.6 | | Двуспальная кровать `bed_double` | 1.6 × 2.0 |
| | Односпальная кровать `bed_single` | 0.9 × 2.0 | | Тумбочка `nightstand` | 0.45 × 0.4 |
| | Шкаф `wardrobe` | 1.0 × 0.6 | | Стеллаж `bookshelf` | 0.8 × 0.3 |
| техника | Холодильник `fridge` | 0.6 × 0.65 | | Плита `stove` | 0.6 × 0.6 |
| | Посудомоечная машина `dishwasher` | 0.6 × 0.6 | | Стиральная машина `washer` | 0.6 × 0.6 |
| | Сушильная машина `dryer` | 0.6 × 0.6 | | Телевизор `tv` | 1.2 × 0.3 |
| | Кондиционер `ac` | 0.9 × 0.25 | | Бойлер `water_heater` | 0.45 × 0.45 |
| сантехника | Унитаз `toilet` | 0.4 × 0.7 | | Ванна `bathtub` | 1.7 × 0.75 |
| | Душ `shower` | 0.9 × 0.9 | | Раковина `sink` | 0.6 × 0.45 |
| | Кухонная мойка `kitchen_sink` | 0.8 × 0.6 | | Биде `bidet` | 0.4 × 0.55 |
| прочее | Лестница `stairs` | 1.0 × 2.8 | | Камин `fireplace` | 1.2 × 0.4 |
| | Растение `plant` | 0.4 × 0.4 | | Ковёр `rug` | 2.0 × 1.4 |

Sizes are **defaults, not limits**: the fields overrule them before the click
and the corner handles overrule them after.

## 4. Placing: the tool is a stamp

Press on the plan → the piece appears **centred on the press**, at its real
size, selected, and the editor **switches back to `select`**. One pick, one
piece: the owner asked for «сразу выделен», and a tool that keeps stamping
until you disarm it is a tool that stamps a sofa the next time you meant to
pan. The palette is disarmed with it, and leaving the tool disarms it too.

Real size is `cell_cm`, the one scale this card has:
`w_norm = (cm / cell_cm) × GRID_PITCH / 1000`. A 2.2 m sofa on a plan drawn at
5 cm per cell is 44 cells; on a plan drawn at 10 cm per cell it is 22, and it
covers the same 2.2 m of wall in both.

Under this tool existing shapes are **inert**, like under every drawing tool
(the rule from 2026-08-04): the press must reach the stage even when it lands
on a sofa that is already there. Without an armed symbol the press does
nothing at all and the plane still pans — a click must not stamp whatever was
chosen last week. `Esc` disarms the symbol first, then clears the selection,
then leaves the tool, then leaves the editor.

## 5. The wall magnet

While a piece is **placed** or **dragged**, the nearest wall within six grid
cells (≈ 30 cm on a default plan) claims it: the piece's **back edge lands on
the wall** and the piece is **turned to the wall's direction**, with its body
on the side the finger is holding it (so a sofa dragged along the inside of a
wall never flips through it). The offset **along** the wall is still quantised
to the grid, so a row of kitchen units lines up.

Walls are the **derived room edges** (`roomEdges`) — the same walls an opening
snaps to. There is no wall entity to be bound to and no room id is stored: a
piece keeps absolute coordinates and survives every later edit of the rooms.

**Shift suspends the magnet**, and with it the grid snap — our general
contract (docs/CANVAS.md §9.4). Out of the magnet's reach the drag is the
ordinary grid snap on the shape's own anchor, and the angle the piece already
had is kept: dragging a turned wardrobe into the middle of a room must not
straighten it.

## 6. Selecting: one frame, two shapes

A selected piece wears **the text block's frame** — dashed box, four corner
handles, one rotate handle on a stem, with the hit radius at 1.8 % of the
visible view and the visible bead at a quarter of that (docs/LIVE-TEXT.md §3,
the owner's «уменьшить в 4 раза»). Reusing it is deliberate: it is the same
question ("how big, which way round?") asked about two different things, and a
third set of chrome would only be a third set of bugs. What differs is
confined to two places:

- **the pivot.** A label has an anchor and must never walk away from it; a
  piece of furniture has a box, and turning a sofa about its top-left corner
  is not what anyone means by turning a sofa. So: the anchor for text, the
  **centre** for furniture (`_dtPivot`).
- **what a corner means.** For a label it is one font multiplier. For
  furniture it is **width and depth, independently**, about the opposite
  corner.

**Why independent and not proportional.** A picture has one true aspect ratio
and stretching it is a lie — which is why the backdrop scales uniformly. Furniture
is the opposite case: the ratio is a fact about *this* sofa, and the next one
is 1.8 m long with the same 0.9 m depth. A uniform handle would force the user
to make a bed deeper in order to make it wider, i.e. to state something false
about the room. So both axes move. Shift is not "keep the ratio" — it is what
it is everywhere else in this card: off the grid.

Without Shift each dimension is quantised to a whole cell, which on an on-grid
piece also puts the dragged corner on a node. That is what "snap to the grid"
has to mean when both sides move.

**Rotation** is the handle above the box, in **5° steps**, Shift past the step
— the same step a device icon and a text block turn in. Turning back to zero
removes the field, so a straight piece stores no angle at all.

**Live measurements.** While a corner is dragged, two badges show the piece's
real width and depth in the HA unit system, centred on the edges they measure.
They are `.measurelabel`, fed by the same `_fmtLen` (`segmentCm` over
`cell_cm`) the wall ruler, the room resize and the backdrop badge use. There is
one way this card ever states a length.

The frame needs **no measuring pass**: a piece's box is its config, so the
frame appears in the same render as the selection, not one after it (a text
label still needs `getBBox`, because only the browser knows how wide a word
came out).

## 7. Styling hooks

Per docs/STYLING-HOOKS.md §3, every piece carries
`data-hp="decor"`, `data-id="<its id>"`, `data-kind="furniture"` and
`data-symbol="<sofa|toilet|…>"`. So card-mod can colour all the plumbing, or
one particular bed, without us shipping a CSS field:

```css
/* every bathroom fixture in blue */
.decorlayer [data-kind="furniture"][data-symbol="toilet"],
.decorlayer [data-kind="furniture"][data-symbol="bathtub"] { stroke: #4fc3f7; }
```

The colour and the line width are the decor style's, chosen in the bar like
any other shape's, and are stored per piece.

## 8. Backend

`DECOR_SCHEMA` gains a fourth branch: `symbol` required, `^[a-z0-9_]+$`,
≤ 32 characters; `x`/`y` the usual ±`CANVAS_LIMIT`; `w`/`h` strictly positive
and capped by the same limit (a size, not a coordinate); `angle` optional,
−360…360. `color`/`width` come from `_DECOR_COMMON` unchanged.

The symbol is **not** validated against the card's list. The backend must
accept a plan written by a NEWER card, and a card that has learnt a new symbol
must not wait for the integration to be updated before the user can save. An
id this build has never heard of simply renders as nothing — `furnitureSymbol`
returns `null`, `furniturePathD` returns `''`, and the shape is skipped.

## 9. What this is not

- **Not a device.** A piece of furniture has no entity, no tap action, no
  state and no part in room aggregation. A sofa that switches the light is a
  device marker standing on a sofa.
- **Not a 3D or an interior planner.** No layers, no z-order beyond
  configuration order, no collision detection, no "does the door open into the
  bed" check. A plan is a drawing, not a CAD model.
- **Not a user-extensible library.** No symbol upload, no custom paths in the
  config: an arbitrary path from a config is an SVG injection surface, and the
  card already refuses to be a place where users paste markup.
- **Not a wall-hugging constraint.** The magnet is a *placement aid*, not a
  binding: once placed, a piece keeps absolute coordinates and does not follow
  a wall that is later moved. Binding furniture to walls is what would make a
  room resize (docs/RESIZE.md) start dragging sofas around, and that is a
  bigger promise than a decor layer should make.
- **Not a stamp that keeps stamping.** See §4.
