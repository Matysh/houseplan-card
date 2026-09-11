# PDF export

House Plan can save the current space as a one-page A4 architectural PDF.
For administrators, the printer button appears in the card header between
**General settings** and **Help & feedback**. The export is always a flat plan,
even when the card currently uses the isometric view.

![PDF export options](images/10-pdf-export.png)

The PDF always contains the physical architecture: walls, partitions, columns,
zero-thickness walls and door, window, gate and passage openings. Device
markers, Home Assistant states, Glow, sunlight, vacuum trails, room colours and
Zigbee topology are intentionally excluded.

The dialog can additionally include:

- room dimensions and clean floor areas;
- room names;
- furniture and other Background-editor decor;
- the current space backdrop, when one is configured.

The selected options are remembered in this browser. The export reads the
current plan but never changes it.

The dialog is designed to remain usable down to a 320 CSS px-wide View area.
It does not require horizontal scrolling; on narrow screens its actions stack
vertically while retaining touch-sized controls.

## Sheet and measurement rules

The output is a single A4 sheet. House Plan builds the complete print scene
first — architecture, enabled dimensions, names, decor and backdrop — and then
chooses portrait or landscape and the smallest standard scale that fits all of
it. The complete scene is centred on the usable sheet,
so optional content is not pushed into a fixed reserve or left outside the
centred area. The footer shows the scale, a 1 m or 5 ft scale bar, a vector
compass when north is configured, the date and the House Plan version. There
is no architectural symbol legend.

For unusually large plans, House Plan continues the scale series in steps of
50 until the complete scene fits. If the architecture itself cannot fit on one
A4 sheet at any scale, export stops with an error instead of producing a
clipped file.

Physical walls, partitions and columns use a `#7f7f7f` base with a consistent
45-degree hatch. Openings remain clean cut-outs through both the base and the
hatch. Zero-thickness walls keep the existing dashed print convention and are
not hatched.

Areas use the same clean-floor geometry as the room information card. Internal
dimensions follow the inner wall faces; external dimensions follow the outer
physical outline. Only horizontal and vertical measurements are printed;
genuinely diagonal edges are omitted rather than projected into misleading
dimensions. Within one room contour or one connected outer ring, equivalent
opposite measurements are shown once on the side with more free space. Equal
lengths in different rooms, disconnected rings or unrelated walls are never
deduplicated globally. Labels are centred on their measured wall and arranged
in consistent lanes clear of the wall body. Units follow Home Assistant. Very
short internal edges use a tick instead of unreadable text. A value that has no
room beside its own wall is not printed at all: it is never pushed through a
wall, a room name or an area, and it is not moved to a separate list beside the
plan. Until v1.74.0-beta.2 such values went into a numbered "Internal
dimensions" column; that column cost the drawing a whole step of the scale
series and turned the sheet sideways, so it was removed and the drawing grew by
about a third instead.

For a rectangular step in an exterior facade, the chain retains enough
horizontal and vertical values to reconstruct the outline: both neighbouring
facade sections, the step height and one copy of its depth. An extension line
may leave the physical corner to which it belongs, including a short
collinear/solid prefix, but it is rejected if it touches architecture again
after reaching free space. This narrow source-corner rule prevents both lost
step dimensions and dimension lines drawn through another wall.

## Images, fonts and limits

Backdrop and decor images are embedded locally in the browser. They are not
sent to a conversion service. Embedded image data is limited to 25 MB; an
unavailable image or exceeded limit stops the export and leaves the dialog open
so the options can be changed.

Text uses an embedded subset of Roboto Regular covering the four House Plan
interface languages. The bundled font is distributed under the Apache License
2.0; its license is stored in `assets/fonts/LICENSE`.

The resulting file is named
`houseplan-<space-name>-<YYYY-MM-DD>.pdf`. Browser and Home Assistant mobile-app
download handling determines its final Downloads location.
