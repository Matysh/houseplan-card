# #373 — Tight house framing for `houseplan-space-card`

Issue: [#373](https://github.com/Matysh/houseplan-card/issues/373)

## Scenario

The **home administrator** embeds `custom:houseplan-space-card` in a compact
Home Assistant dashboard for household members, a wall tablet or a phone. The
stored space also contains a large backdrop or auxiliary objects outside the
building, but this card is meant to show the house itself as large as possible.

The administrator selects a tighter frame for this one card instance. View and
kiosk consumers then see the complete structural plan without the ordinary
outer breathing room; no editor is involved.

## What the person sees before and after

Before, the static card keeps a 5% outer frame and lets non-house content widen
the view; after opting in, the complete house geometry touches the available
frame without intentional padding, while backdrop, decor, labels and devices
outside the house no longer make the house smaller.

## Problem

`renderSpaceStatic()` currently calls `spaceFrame(space, placed, 0.05)` (or the
per-edge #372 variant for `title: ""`). That frame is deliberately the broad
content frame from `docs/CANVAS.md`: rooms, the transformed backdrop and visible
placed objects can all vote, and the result is padded by 5% of its longer side.
This is correct for the existing default and for the full interactive card, but
it wastes scarce dashboard area when the embedded card is intended to show the
building rather than every auxiliary object.

The reporter chose the non-cropping alternative in the latest issue comment:
remove the 5% padding, keep all house geometry visible, and derive the fit from
room/house geometry instead of backdrop or decorative objects. A CSS-`cover`
mode that can crop the house is explicitly not requested.

## Scope

- only `custom:houseplan-space-card`;
- one opt-in Lovelace card setting, `fit: house`;
- visual-editor choice between the existing frame and the tight house frame;
- a zero-intentional-padding structural frame containing every rendered room,
  room wall, independent wall/draft, column, zero-thickness wall and visible
  door/window/gate symbol;
- exclusion of backdrop image, decor, room labels, device markers and their
  badges from the `house` frame vote;
- safe fallback to the existing frame when the space has no valid structural
  geometry;
- consistent geometry, themes and touch/desktop View behaviour;
- en/ru/de/fr UI strings, RU/EN user guide, architecture/canvas contract,
  changelogs and targeted tests.

## Non-scope

- any change to the full `custom:houseplan-card`, its Fit all action, View,
  kiosk, editors, zoom, pan or outlier hint;
- CSS `cover`, aspect-ratio distortion or any mode allowed to crop structural
  house geometry;
- hiding, deleting or moving backdrop, decor, labels, markers or devices;
- changing marker size, room-label position, Glow, sunlight, wall geometry,
  opening state or HA actions;
- changing the stored House Plan model, backend schema, `space.view_box`,
  config/layout revisions, exports or imports;
- arbitrary user-configurable padding values;
- changing the #372 meaning of `title: ""` in the default frame;
- automatically enabling the new mode for existing cards.

## Behaviour contract

### Public card configuration

```yaml
type: custom:houseplan-space-card
space: ground_floor
fit: house
```

1. `fit` accepts `content | house`.
2. Missing, empty or unknown `fit` resolves fail-safe to `content`.
3. `content` is the exact current behaviour: the current content voters,
   main-mass/outlier policy and 5% padding remain unchanged. Existing YAML
   without `fit` must produce the same frame.
4. `house` selects the new tight structural frame described below. It never
   becomes the implicit default.

### Tight structural frame

5. The structural frame contains the union of all finite, sane visible
   architectural extents for the selected space:
   - room polygon/rectangle floors;
   - the complete outer envelope of positive-thickness room walls;
   - independent walls, saved wall drafts and columns;
   - zero-thickness room and independent wall axes;
   - the full visible state-independent envelope of door, window and gate
     symbols, including wall jambs, leaf tips and swing arcs in either state.
     An open passage contributes through its structural wall/tunnel geometry
     and has no extra standalone symbol.
6. All structural items participate. The broad content-frame outlier vote may
   not discard a detached room or wing in `house` mode: sane structural
   geometry is part of the house and must stay visible.
7. The resolved structural union receives **zero intentional padding** on all
   four sides. Bounds still include the actual rendered wall/symbol stroke
   envelope, so “zero padding” may not clip a stroke by half its width.
8. Backdrop image, decor, room labels, device markers, value/LQI badges, pulse
   shells and purely visual Glow/sun extents do not enlarge this frame. They
   remain rendered in the same coordinate system and may be clipped when they
   lie outside the structural house frame; this is the user-confirmed trade-off.
9. The SVG, marker layer, room-label layer, backdrop, day-cycle environment and
   continuity overlay all consume the single resolved `viewBox`. Nothing is
   independently translated or scaled after the fit is chosen.
10. If no valid structural item exists (for example an image-only or empty
    space), `house` falls back atomically to the ordinary `content` frame. It
    must not create an empty, zero-sized, NaN or infinite `viewBox`.
11. Structural computation is state-independent. Opening sensor changes,
    device state updates, Glow animation and language/theme changes do not
    resize the card or move the house inside it.

### Interaction with existing options

12. `title`, `show_button`, `light_pools`, state/value options and footer deep
    links retain their existing semantics.
13. With `fit: content`, explicit `title: ""` keeps #372: only the top 5%
    padding disappears, while side/bottom padding remains.
14. With `fit: house`, all four intentional frame paddings are already zero;
    `title: ""` only removes the header and does not change the structural
    `viewBox` further.

## UX and accessibility

- The Lovelace visual editor exposes one dropdown labelled **Framing** with:
  - **All visible content** → `content`;
  - **Tight to house geometry** → `house`.
- A missing legacy value is displayed as **All visible content**. A subsequent
  visual-editor save may materialise `fit: content`; this is semantically
  lossless.
- No crop/cover choice is shown.
- The schematic remains `pointer-events:none`, non-focusable and read-only.
  The existing footer button remains the only interactive element.
- No new hover, gesture or animation is introduced. The frame is identical on
  fine/coarse pointers, narrow/wide cards and light/dark themes.

## Data model, migration and compatibility

The field belongs only to the Lovelace card instance:

```ts
interface SpaceCardConfig {
  fit?: 'content' | 'house';
}
```

- no House Plan server-config or layout field is added;
- no model/store/schema version or backend validation changes;
- no data migration and no write to Home Assistant storage;
- old cards and old YAML remain on the `content` path;
- current code normalises only at read/render and visual-editor boundaries;
- an older frontend ignores the unknown Lovelace key and renders its historical
  content frame, without damaging House Plan data;
- rollback is therefore data-free.

## i18n

Add complete keys to `src/i18n/{en,ru,de,fr}.json` for:

- Framing;
- All visible content;
- Tight to house geometry.

The technical YAML literals `content` and `house` are not translated. Missing
translations may not leave a raw key or an unlabelled select option.

## Performance and bundle

- Frame resolution remains one bounded O(rooms + walls + openings + columns)
  pass per structural render candidate.
- HA state-only ticks reuse/calculate the same structural fingerprint; they may
  not introduce DOM measurement or `getBBox()` layout reads.
- No second hidden SVG, canvas raster scan, network request or dependency.
- Existing `fit: content` cost and output remain unchanged.
- Initial View bundle budget is not raised.

## Touch and themes

- `houseplan-space-card` is a View surface, so narrow phone and wall-tablet
  rendering is release-blocking.
- The new mode is presentation-only and must not cause horizontal overflow,
  clipped structural strokes or a zero-height card at representative 320 px
  and 900 px widths.
- Pointer/tap behaviour is unchanged; the stage stays inert and the footer tap
  target stays usable.
- Light/dark and day-cycle modes share exactly the same structural frame.

## Affected files and modules

- `src/space-card.ts` — public `fit` type/default and static-render projection;
- `src/space-editor.ts` — localised framing dropdown and legacy/default
  projection;
- `src/space-render.ts` — select ordinary vs structural frame and keep one `vb`;
- a narrow pure helper in `src/space-geometry.ts`, `src/render/opening-symbol.ts`
  or a dedicated static-frame module — finite structural items and opening
  envelopes without DOM measurement;
- `src/i18n/{en,ru,de,fr}.json` — editor labels;
- `test/**` — pure frame/config/opening-envelope regressions;
- `demo/smoke_space_card.mjs` — real-card comparison and View/touch contract;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, `docs/ARCHITECTURE.md`,
  `docs/CANVAS.md` — public and canonical contracts;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — release bullet linked to #373.

## Acceptance criteria

- **AC1 — default compatibility:** missing/empty/unknown `fit` and explicit
  `fit: content` produce the same numeric `viewBox`, stage aspect and #372
  title interaction as the pre-change control fixture. **Evidence:** unit tests
  plus `demo/smoke_space_card.mjs` comparing four configurations.
- **AC2 — tight structural frame:** on a fixture with an oversized transformed
  backdrop, far decor, far marker and room label, `fit: house` excludes those
  items from its bounds, removes all four intentional 5% pads and yields a
  strictly tighter frame than `content`. **Evidence:** pure unit assertions and
  browser smoke over the rendered SVG `viewBox`.
- **AC3 — no structural crop:** rooms, positive/zero walls, independent walls,
  drafts, columns and door/window/gate envelopes in their extreme states are
  all within the `house` frame including visible strokes. **Evidence:** pure
  geometry table tests and a browser semantic-pixel/bounds witness that fails
  when any structural edge is clipped.
- **AC4 — stable and safe fallback:** an empty space, image-only space,
  collinear structural geometry and invalid/unknown `fit` always produce a
  finite positive frame; image-only `house` equals the ordinary content frame.
  Opening/device state ticks do not change it. **Evidence:** unit + browser
  smoke with state substitution.
- **AC5 — editor/i18n contract:** the GUI displays the default and house choices
  in en/ru/de/fr, saves exact literals, reloads them, and never offers cover.
  **Evidence:** unit/source contract plus browser editor smoke or review of an
  existing faithful `ha-form` harness.
- **AC6 — View/touch parity:** tight mode renders without horizontal overflow
  at 320 px and 900 px, in light/dark/day-cycle, keeps the stage inert and keeps
  the footer action unchanged. **Evidence:** targeted browser smoke and code
  review.
- **AC7 — performance:** state-only rerenders do not perform DOM geometry reads
  and the structural pass stays bounded; bundle budget remains green.
  **Evidence:** code review, `npm run bundle:budget` and existing static-card
  performance profile before beta.
- **AC8 — documentation and release:** RU/EN guide documents `fit`, its default,
  the intentional auxiliary-object crop and its interaction with `title: ""`;
  architecture/canvas docs describe the second static-only frame; both
  changelogs link #373. **Evidence:** docs/process gates and code review.

## Automated test plan

1. Pure unit: validate the `fit` resolver (`undefined`, `content`, `house`,
   unknown) and prove the default branch retains current padding.
2. Pure unit: build a synthetic structural scene containing a polygon room,
   thick wall envelope, zero wall, independent wall/draft, column and every
   opening type; compare exact finite structural bounds and zero padding.
3. Pure unit: substitute closed/open/extreme opening amounts and prove the
   state-independent envelope and resulting frame do not change.
4. Pure unit: add far backdrop/decor/marker/label items; prove ordinary content
   widens while house bounds do not. Add a detached valid room and prove it is
   retained rather than outlier-rejected.
5. Pure unit: empty/image-only/collinear/invalid inputs fall back to a finite
   positive ordinary frame.
6. Extend `demo/smoke_space_card.mjs` with control, explicit `content`, `house`
   and `house + title:""` cards. Assert numeric frames, no clipped structural
   edge, common overlay coordinates, unchanged footer deep link and inert stage.
7. Repeat tight mode at narrow light and wide dark widths and change a door
   sensor/device state; the viewBox remains stable and no overflow appears.
8. In the implementation cycle run `npm run typecheck`, `npm test`,
   `npm run build`, `npm run bundle:sync`, `npm run bundle:budget`,
   `node scripts/no-new-any.mjs --base origin/dev --head HEAD`,
   `node scripts/check-docs.mjs`, smoke selection and the named target smoke.
   Run full golden/smoke/performance and exact-SHA Linux Validate before beta,
   following the process.

## Risks

- **Zero padding clips the outer half of a wall or opening stroke.** Mitigated
  by structural visible-envelope math and AC3, not by reintroducing arbitrary
  padding.
- **Backdrop/decor still votes through `spaceFrame()`.** Mitigated by a separate
  explicit structural-item path and AC2; the ordinary helper remains untouched.
- **Stateful door movement resizes the card.** Mitigated by one conservative
  state-independent opening envelope and AC3/AC4.
- **A detached building is mistaken for an outlier.** Mitigated by using all
  sane structural items for the house union and the detached-room test.
- **The default changes accidentally.** Mitigated by an explicit resolver whose
  fallback is `content`, numeric compatibility tests and no implicit opt-in.
- **Auxiliary content is intentionally clipped but undocumented.** Mitigated by
  the GUI wording, guide warning and AC8.
- **Static and full cards drift.** The new path is static-only by contract; all
  existing shared geometry primitives stay canonical, while the full card's
  content frame remains unchanged and covered by existing canvas tests.
- **Docs screenshot fingerprint changes after `src/**`.** The canonical Docs
  screenshots workflow/acceptance remains required by the repository process.

## Rollback

Remove the `fit` projection/editor option and always call the existing content
frame path. Existing cards without the option are already on that path; cards
with `fit: house` become ordinary content-framed cards when read by the rolled
back frontend. No House Plan config/layout data, migration or cleanup is needed.

## Release artifacts

- `docs/CHANGELOG.md` and `docs/CHANGELOG.ru.md`: opt-in tight house frame with
  a link to #373;
- `docs/USER-GUIDE.md` and `docs/USER-GUIDE.ru.md`: YAML/table/default,
  auxiliary crop and `title: ""` interaction;
- `docs/ARCHITECTURE.md` and `docs/CANVAS.md`: static-only structural frame and
  its relation to the canonical content frame;
- targeted `demo/smoke_space_card.mjs` result with numeric and semantic visual
  evidence for standard/tight, narrow/wide and light/dark;
- full existing golden verify to prove no default-path visual regressions; a
  new baseline is added only if targeted semantic evidence cannot make AC2/AC3
  unambiguous, and may be accepted only from the reviewed complete Linux
  artifact;
- canonical Docs screenshots artifact accepted with
  `npm run docs:accept -- --reviewed --from=<artifact>` because `src/**` changes;
- no backend, migration or security artifact; initial bundle budget and the
  static-card performance profile remain mandatory before beta.

## Assumptions accepted provisionally; reviewer may change freely

- the public literals are `fit: content | house`; names of internal helpers and
  exact file placement are technical choices;
- `content` is explicit current semantics rather than a newly invented mode;
- “house geometry” means the complete structural list in contract item 5, not
  room polygons alone, because room-only bounds would cut thick outer walls and
  opening leaves;
- objects deliberately excluded from bounds remain in DOM/SVG and may be
  clipped; they are not hidden or deleted;
- `house` falls back to `content` when no structure exists rather than framing
  an arbitrary stored square or rendering an empty card;
- a conservative analytic opening envelope is acceptable if it is tight to the
  maximum rendered symbol and state-independent; DOM `getBBox()` is forbidden;
- exact synthetic fixture names and sub-pixel tolerances belong to the test
  implementation, provided a one-pixel crop causes a deterministic failure.
