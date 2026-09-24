# Декор, подложка, мебель, слои

> Приложение к [`docs/TESTING.md`](../TESTING.md): перенесено оттуда дословно (#634).
> Индекс всех приложений — [`README.md`](README.md).

## Decor composition order (#231)

- [ ] All six decor kinds render in one `.decorlayer` after opaque room/data
      fill, active room-hover fill, opening tunnels and Glow-base rooms/tunnels,
      but before live Glow, sun, physical walls, opening symbols and the HTML
      device/room-label layer [auto: `smoke_decor_layer_order.mjs`,
      `smoke_glow.mjs`].
- [ ] Pixel probes through an opaque room and a filled opening tunnel stay the
      decor colour before/after hover and over Glow base. Restoring the old DOM
      order makes those probes red [auto: `smoke_decor_layer_order.mjs`;
      mutation: `decor-restored-below-room-fills`].
- [ ] The complete #231 golden impact set is reviewed before baseline
      acceptance. The two dedicated Light/opaque-hover and Dark/Glow-base
      scenes contain all five decor types and semantic probes in both rooms and
      the shared doorway. The three existing large-house scenes also change
      because their dense decor grid now renders above Glow-base room fills.
      Reviewed baselines are accepted only from the Linux release artifact
      [golden: `decor-over-opaque-hover-light`,
      `decor-over-glow-base-dark`, `isometric-large-warm-remount-dark`,
      `large-house-zoom-250-dark`, `large-house-warm-remount-dark`].
- [ ] `hide_decor`, the Background editor override and stored config remain
      unchanged; no per-object under-plan compatibility flag is introduced.

## Custom decor images (#51)

- [ ] Background has one **Image** button. PNG/JPEG/WebP/safe SVG upload opens
      the reusable palette; picking a file shows an exact one-shot preview and
      one click creates a 100 cm wide aspect-preserving object (height capped at
      200 cm), then returns to Select [unit: `decor-assets.test.mjs`; auto:
      `smoke_decor_images.mjs`].
- [ ] Image move/continuous resize/four side handles/crossing mirrors/free
      rotation/`Shift` 45° match furniture, while placement and movement have
      no wall magnet. The complete rotated rectangle remains selectable through
      transparent pixels [auto: `smoke_decor_images.mjs`].
- [ ] Full View and `houseplan-space-card` paint the same signed raster/SVG
      under live Glow/walls/devices and obey `hide_decor`. A missing or
      hash-mismatched file paints nothing in View and a selectable crossed
      repair placeholder only in Background [unit: `decor-assets.test.mjs`,
      `test_decor_assets.py`; auto: `smoke_decor_images.mjs`].
- [ ] Upload rejects wrong magic, corrupt decode, oversized dimensions/files,
      forbidden namespaces/elements/attributes/URLs, DTD/entities, processing
      instructions and local-reference cycles. Responses have exact MIME,
      `nosniff` and SVG sandbox CSP [pure backend: `test_decor_assets.py`; HA
      harness: `test_ha_import_export.py` and endpoint tests].
- [ ] Identical canonical bytes reuse one SHA-256 id. Resolve is deduplicated
      and batched at 200; deletion rechecks all spaces and refuses an in-use
      file. Export v2 has hashes but no bytes/signed URLs; v1 remains readable,
      and confirmed missing imports preserve image geometry [unit/pure/HA:
      `decor-assets.test.mjs`, `test_decor_assets.py`,
      `test_ha_import_export.py`].

## Backdrop picture: move & scale (docs/BACKDROP.md, dev)

- [ ] **The frame is there, and only there** (owner 2026-08-04): open a space
      that HAS an uploaded plan image → **Редактор подложки**. It opens on
      Select; the toolbar contains «Картинка-подложка». Select that tool: a
      dashed, rotated frame hugs the picture with four corner handles and one
      upper rotate handle. Switch to Select / Line / Rectangle / Oval / Text /
      Furniture / Erase — the frame disappears and the image is pointer-inert.
      Leave for View, Plan, Devices or kiosk — no frame anywhere. A space with
      NO image has no image tool [auto: smoke_backdrop, smoke_decor]
- [ ] **Opacity is contextual**: under Select or any drawing/furniture/erase
      tool the image opacity is exactly 0.5; under Plan backdrop it is 1.0.
      View, Plan, Devices, kiosk and the static card always use 1.0
      [auto: smoke_backdrop, smoke_hide_layers]
- [ ] **The corner handles are beads, not blobs** (owner 2026-08-05,
      «уменьшить в 4 раза… они постоянно гигантские»): the four dots on the
      picture's frame are small — they must not cover the picture — yet a
      finger still lands on them without aiming. Room Resize deliberately has
      wall-midpoint handles only (its former corner frame is removed); robot-map
      calibration keeps its own frame [auto: smoke_hide_layers, smoke_backdrop,
      smoke_room_resize]
- [ ] **Dragging the picture moves the picture, and nothing else** (owner
      2026-08-04): with the «Картинка-подложка» tool (the cursor over the
      picture is a hand), grab the picture by its body and pull it aside.
      It follows the finger the whole way — it must NOT drift away from the
      cursor or jump when the toolbar changes — while the rooms, walls, doors,
      windows, devices, room names and decor stay exactly where they were.
      Release, reload the page — the picture is still where you left it
      [auto: smoke_backdrop]
- [ ] **One-finger pan survives** (regression, DEV-B58 «таскать план при любом
      масштабе»): back on the «Выбрать» tool, drag across the middle of the
      picture — the PLANE pans, the picture does not move. Same at 50 % and
      33 % zoom [auto: smoke_backdrop, smoke_pan_any_zoom]
- [ ] **The corners scale it evenly**: pull a corner handle. The picture grows
      and shrinks in BOTH directions at once, keeps its proportions (nothing
      is stretched), and the OPPOSITE corner does not move a pixel. Try all
      four corners; the cursor over a handle is a diagonal resize arrow. On a
      tablet the handles are big enough to hit with a finger. Repeat with
      Shift: width and height now change independently, but stay grid-bound
      [auto: smoke_backdrop]
- [ ] **Rotation and numeric properties**: the upper handle rotates around the
      image centre in 5° steps; Shift allows any angle. Double click the image
      while its tool is active, enter width/height in m/ft and an angle, save,
      reload and compare. Esc during a live transform restores pointer-down;
      after release Ctrl+Z restores and Ctrl+Y reapplies it [manual + unit:
      backdrop.test.mjs]
- [ ] **Live size in metres**: while dragging or scaling, a badge in the middle
      of the picture states its real size, «Ш × В», in the same units the wall
      ruler uses (metres, or feet on an imperial HA). Change the space's
      `cell_cm` in its settings and the numbers change with it. The badge
      disappears on release [auto: smoke_backdrop]
- [ ] **Mandatory snap**: after a plain drag the picture's corner sits on a
      grid node (zoom in on the corner — it is on a crossing, not between
      two). After a corner scale one side of the picture ends on a node too;
      holding Shift produces the same snapped result [auto: smoke_backdrop]
- [ ] **«Вернуть картинку»**: the button appears in the backdrop toolbar only
      after the picture has been moved, scaled or rotated. Press it — the picture goes
      back to centred, at its own size and zero angle; Undo restores the prior
      transform, and the button disappears at the reset state
      [auto: smoke_backdrop]
- [ ] **NEW PAPER RULE — the sheet is the rooms** (owner 2026-08-04, changes
      the old behaviour): set a loud `bg_color` (or `daynight`) on a space
      that has BOTH a picture and drawn rooms, then shrink the picture with a
      corner handle. The opaque white/card-coloured sheet follows the ROOM
      CONTOURS — it is no longer a rectangle the size of the picture. The
      scene colour is visible around the rooms, including in the pocket of an
      L-shaped house and between detached buildings. The picture is drawn ON
      that sheet: above it, below the walls, doors, decor and devices. A space
      with a picture and NO rooms has no sheet at all, so a transparent PNG
      shows the scene through itself — deliberate
      [auto: smoke_backdrop + smoke_bg_color, still: demo/shot_backdrop.mjs]
- [ ] **«Вписать всё» does not lose the picture**: drag the picture well away
      from the rooms (or scale it right down), leave the editor, press «Вписать
      всё». The view frames the rooms AND the picture; the "home is that way"
      arrow points at them together [auto: smoke_backdrop]
- [ ] **The static card and the kiosk agree**: put a `houseplan-space-card` for
      the same space on a dashboard and open the kiosk view. Both draw the
      picture at the same offset, independent size and angle, with the same room-contour paper
      [auto: smoke_backdrop, smoke_render_parity]
- [ ] **Old plans are untouched**: a space whose picture has never been moved
      renders exactly as before the update — same place, same size. Nothing is
      written to its config until the first drag [auto: unit test/backdrop.test.mjs
      + tests_backend/test_validation.py]

## «Already uploaded» plan picker (dev, unreleased)

- [ ] **«Already uploaded» is a list, not a stripe**: in both space dialogs
      (new space and space settings, source = "I have a floor-plan image")
      press «Already uploaded» with at least five plans on the server. The box
      is a few hundred pixels tall, the first thumbnail is fully visible inside
      it, and the rest scroll. With nothing uploaded the box shows its message
      instead of clipping it. Repeat at phone width. Measure heights, do not
      trust the DOM: the rows were always there, the box was 14 px
      [auto: smoke_plan_picker]

## The furniture library (docs/FURNITURE.md, dev, unreleased)

## The furniture library (docs/FURNITURE.md, dev, unreleased)

- [ ] **The tool and the palette**: Background editor → **Furniture**. A panel
      opens under the bar with the symbols grouped (furniture / appliances /
      plumbing / other), every tile drawing the real symbol, and the plan stays
      visible behind it [auto: smoke_furniture]
- [ ] **Real size through `cell_cm`**: pick the sofa, click in the middle of a
      room, then measure it against the plan's own grid — it is 2.2 m wide and
      0.9 m deep. Change the space's scale (Space settings → cm per cell) from
      5 to 10 and place a second sofa: it covers the same 2.2 m of the plan,
      i.e. half as many cells [auto: smoke_furniture + furniture.test]
- [ ] **The size fields**: pick the bath, type 1.5 in Width, click — the piece
      is 1.5 m, not 1.7. In an imperial HA profile the same fields read and
      accept FEET, and the stored plan is unchanged when you switch back
      [auto: smoke_furniture (metric); manual for the imperial profile]
- [ ] **The wall magnet**: click near a wall — the piece's BACK lands flat on
      it and it turns to the wall's direction (a bed's headboard against the
      wall, a toilet's cistern against it, a sofa's back against it). Holding
      **Shift** bypasses the wall magnet but still lands through the
      decor/room/grid magnet, never between grid nodes
      [auto: smoke_furniture]
- [ ] **The magnet while dragging**: drag a placed sofa across the room to
      another wall — it turns to that wall as it arrives. Drag it back into the
      middle: it keeps the angle it had rather than snapping straight. On a
      DIAGONAL wall it lands at the wall's own angle [auto: smoke_furniture for
      the axis-aligned case; manual for a diagonal wall]
- [ ] **One stamp per pick**: after placing, the editor is back in **Select**
      with the new piece selected, and the palette is disarmed — clicking the
      plan again does not place a second one [auto: smoke_furniture]
- [ ] **The furniture frame**: four corner beads, four one-axis middle beads
      and a rotate handle; every bead is a quarter of its unchanged hit area.
      Ordinary decor keeps its previous five-handle frame. Grab a furniture
      bead with a finger on a tablet, aiming roughly: it is caught
      [auto: smoke_furniture]
- [ ] **Proportional by default**: drag a corner sideways or down — the current
      ratio is preserved about the opposite corner. Hold Shift to change width
      and depth independently. Two live badges show both in metres (or feet)
      while you drag, and they match a later physical measurement. Both modes
      are continuous and can create a sub-grid size; the four middle handles
      change only width or only depth
      [auto: smoke_furniture]
- [ ] **Crossing and mirroring**: drag a corner or middle handle through its
      fixed opposite edge — the gesture continues with positive stored size
      and the corresponding H/V mirror toggled. `Esc`/pointer cancel restores
      the complete pre-drag object [auto: smoke_furniture + furniture.test]
- [ ] **Rotation**: the handle above the box turns the piece freely about its
      CENTRE (not a corner); Shift snaps to the nearest 45° and can be pressed
      or released during the same gesture [auto: smoke_furniture]
- [ ] **Complete properties**: double click a piece and change its symbol,
      signed width/depth in m/ft, H/V mirror checkboxes, angle, contour
      colour/opacity and line width in cm/in. Signs and checkboxes stay in sync;
      zero/invalid size disables Save. Save keeps its centre and reloads exactly;
      Cancel changes nothing; reopening a non-first symbol selects that option
      [auto: smoke_furniture; manual]
- [ ] **Selection tolerance**: in Select, a press up to 10 physical centimetres
      from a drawn furniture stroke selects it at any zoom/scale; an empty area
      of its bounding box does not [auto: smoke_furniture + source contract]
- [ ] **It is only decor**: a piece takes no tap in view mode, has no entity
      and no state, and does not appear in any room aggregation. Erase removes
      it; Delete removes the selected one [auto: smoke_furniture]
- [ ] **Old plans and old servers**: a plan saved before this release opens
      unchanged. A plan WITH furniture saved by this card and opened by an
      older integration still saves (the backend accepts any well-formed symbol
      id) [auto: tests_backend test_decor_furniture; manual for the old server]
- [ ] **card-mod**: `[data-symbol="toilet"] { stroke: #4fc3f7; }` colours only
      the toilets [auto: smoke_furniture checks the attributes; manual for the
      rule itself]

## Large backdrops (#39, docs/specs/039-large-backdrops.md)

- [ ] A raster whose header claims ≳32 MP opens the warning dialog with real
      resolution/file/memory numbers BEFORE any decode — zero
      `createImageBitmap` calls until a choice is made
      [auto: `smoke_backdrop_guard`, `backdrop-probe.test`].
- [ ] «Reduced copy» honours aspect and alpha: longest side 4096, PNG with
      alpha stays PNG, opaque becomes JPEG; the result flows through the
      ordinary planFile → upload path [auto: `smoke_backdrop_guard`].
- [ ] «Keep the original» stages exactly the picked bytes (blob parity; #617
      replaced base64 with a Blob) [auto: `smoke_backdrop_guard`].
- [ ] Beyond 16384 px per side the dialog offers only Cancel; a failed or
      timed-out reduce shows the toast, leaves staging clean and never
      uploads the declined original [auto: `smoke_backdrop_guard`].
- [ ] Corrupt/truncated headers warn without numbers; SVG bypasses the probe
      and is never rasterised [auto: `backdrop-probe.test`,
      `smoke_backdrop_guard`].
- [ ] An EXIF-rotated JPEG (orientation 6) reduces with the rotation applied:
      the header probe reads the unrotated SOF, the decode honours
      `imageOrientation: 'from-image'`, and the reduced copy comes out
      portrait; dismissal during a running reduce is ignored and a stale flow
      never applies its result [auto: `smoke_backdrop_guard`].

## Plan upload over HTTP and the 8 MB limit (#617)

- [ ] A 5 MiB plan is sent as ONE multipart `POST /api/houseplan/plans/upload`
      and no `houseplan/plan/set`, from the editor and from onboarding; the
      space gets the returned `plan_url` [auto: `smoke_plan_upload_limit`,
      `plan-upload-limit.test`; backend `test_ha_upload.py` stores 5 MiB
      byte for byte].
- [ ] An SVG over the limit is refused at pick time with a toast naming «8»;
      nothing is staged or sent. A raster over the limit opens the #39 dialog
      without «Keep the original»; a reduced copy still over the limit is
      refused with the same toast [auto: `smoke_plan_upload_limit`].
- [ ] A 413 from the server shows «Error: file larger than 8 MB», the dialog
      stays open and not busy, no `config/set` [auto: `smoke_plan_upload_limit`].
- [ ] Server: exactly `MAX_PLAN_BYTES` → 200, one byte more → 413
      `too_large`/`max_mb: 8` with nothing left on disk; non-admin 403;
      bad space id / extension 400; quota 507 [HA: `test_ha_upload.py`;
      pure: `test_plan_upload.py`].
- [ ] One number: TS `MAX_PLAN_BYTES` = Python `MAX_PLAN_BYTES` = the «8» in
      both USER-GUIDEs [unit: `plan-upload-limit.test`].

## Hiding layers: decor, openings, zero-thickness walls (docs/UX-MODES.md)

- [ ] **Room names have one literal off state (#203)**: disable «Показывать
      названия» in the live space dialog, save and reopen it. Full View, kiosk,
      hidden isometric and `houseplan-space-card` contain no
      `[data-hp="room-label"]` and no legacy `text.rlabel`. Plan temporarily
      shows the same draggable HTML card and gear; returning to View hides it.
      Cancel restores the previous setting, while re-enabling names restores
      the saved card position and area icon
      [auto: `smoke_hide_room_names`, `smoke_styling_hooks`].
- [ ] **Each renderer can fail independently**: restoring the old full-card SVG
      fallback, compact-card SVG fallback or hidden-isometric override makes
      the dedicated smoke red
      [mutation: `hidden-room-names-full-svg-fallback`,
      `hidden-room-names-compact-svg-fallback`,
      `hidden-room-names-iso-override`].
- [ ] **«Скрыть декоративный слой»** (owner 2026-08-05): a space with lines,
      labels or furniture on it → space settings → Display → tick the box, save.
      The plan loses all of it, in View, in the Plan editor and in the Device
      editor. Open **Редактор подложки** — everything is back, editable, exactly
      where it was. Untick it: the plan looks as it did before you started
      [auto: smoke_hide_layers]
- [ ] **«Скрыть проёмы»**: tick it on a space with doors, windows and gates. The
      symbols are gone from View and from the Device editor; the **Plan editor
      still draws them**, or the Opening tool would be editing blind. Nothing
      else changed: a lit room still spills light through a door/gate, the sun
      still comes in at the window, a door with a contact sensor still reports
      open/closed in the room card, and the resize tool still refuses to
      shorten a wall past its opening [auto: smoke_hide_layers, smoke_glow]
- [ ] **Zero walls follow the borders switch only in View**: set a wall to
      `0 cm`, then turn **«Всегда отображать границы комнат» OFF**. Its line
      disappears with the borders and returns when enabled. Plan, Devices and
      Background editors always show the line. Dashed/solid light behaviour is
      unchanged while hidden [auto: `smoke_hide_layers`, `smoke_zero_walls`].
- [ ] **Nothing is stored when nothing is hidden**: with both boxes unticked,
      the space's config carries no `hide_decor` / `hide_openings` at all, and
      a plan saved by an older card still opens here unchanged
      [auto: smoke_hide_layers, tests_backend test_hide_layer_settings]
