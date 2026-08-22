# Plan image backdrop

Status: current in v1.60.0. The complete Background editor contract is in
`DECOR-EDITOR.md`.

## Placement model

The source image is first fitted proportionally into the square plan canvas by
`fitInSquare(plan_aspect, NORM_W)`. The optional transform is then applied:

| Field | Meaning | Default |
|---|---|---:|
| `plan_x`, `plan_y` | top-left offset from the fitted rectangle, normalised by `NORM_W` | `0` |
| `plan_scale_x`, `plan_scale_y` | independent width/height multipliers | `1` |
| `plan_angle` | rotation around the transformed rectangle centre | `0°` |
| `plan_scale` | legacy uniform fallback for both axes | `1` |

`planRect()` is the single reader used by the full card, static card and content
bounds. New writes remove `plan_scale`; **Оптимизировать планы** converts it
losslessly to both axis fields.

## Editor behaviour

The Background editor opens on **Select**, never on the image tool. The image
is interactive only under **Plan backdrop**:

- body drag moves it;
- four corner handles preserve ratio by default;
- `Shift` allows independent axes;
- the upper handle rotates in 5° steps, or freely with `Shift`;
- double click opens numeric width, height and angle;
- `Esc` restores the transform at pointer-down;
- release creates one named command in the shared 50-step history;
- Reset removes all six transform fields and is itself undoable.

In the Background editor the image is at opacity `0.5` under every other tool
and cannot receive pointer events from the controller. Under Plan backdrop it
is opaque. View and the other editors always show it at opacity `1`.

Move and resulting top-left coordinates are grid-bound. Width and height are
quantised when resized or entered numerically. There is no positional modifier
that bypasses the grid.

## Rendering and content

The image is purely decorative and never changes rooms, walls, openings,
devices, Glow or sun geometry. It is still a content item for fit/pan bounds.
For a rotated image all four rotated corners contribute to those bounds.

Layer order, top to bottom:

```text
devices and room labels
opening symbols / physical and virtual walls / late room-hover outline
sun rays
live Glow pools
decor
room hover fill / Glow-base rooms and tunnels / data room fills and tunnels
plan image
room-shaped paper
scene background
```

The paper remains room-shaped; an image without rooms does not create opaque
paper behind itself.

## Ownership

| Concern | File |
|---|---|
| fitted/transformed rectangle and rotated bounds | `src/space-geometry.ts` |
| gestures, frame, numeric dialog, history/reset | `src/houseplan-card.ts` |
| full-card SVG image | `src/houseplan-card.ts` |
| static-card SVG image | `src/space-render.ts` |
| schema ranges | `custom_components/houseplan/validation.py` |
| legacy conversion | `src/plan-optimizer.ts` |
