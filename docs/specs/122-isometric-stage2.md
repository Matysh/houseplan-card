# Issue #122 — Isometric Stage 2: hidden visual polish

- **Issue:** https://github.com/Matysh/houseplan-card/issues/122
- **Predecessor:** #89, normative Stage 1 contract
  [`089-isometric-view-stage1.md`](089-isometric-view-stage1.md)
- **Owner decisions:**
  https://github.com/Matysh/houseplan-card/issues/122#issuecomment-5286229767
- **Visual references:**
  https://github.com/Matysh/houseplan-card/issues/89#issuecomment-5279077001
- **Type / priority:** feature / P2
- **Assessment:** user value 7/10; development value 6/10; complexity and
  risk 9/10
- **Revision:** first revision for independent spec review; task status is
  defined only by the issue labels
- **Related:** #124 (existing Iso ↔ Flat performance debt), #82 (camera
  animation, explicitly out of scope)

## 1. Scenario and product context

**Persona:** a home administrator who deliberately enables the hidden `iso`
Labs experiment to evaluate it on a real plan. Household members and guests do
not discover or enable Stage 2 through the product UI.

**Surface and moment:** the administrator opens ordinary View or kiosk on a
desktop, phone or wall tablet, activates the existing `iso` Labs flag and
switches the current space from Flat to the volumetric presentation.

**Before → after, without implementation terms:** today the hidden volumetric
view shows technically correct but schematic white/grey wall slabs and flat
opening symbols; after Stage 2 the same live home has restrained material
depth, vertical openings, a low outside floor edge and soft grounding shadows,
without losing any state, action or existing floor effect.

The task serves:

- **J1:** the live whole-home view becomes easier to read spatially;
- **J2:** opening, lock and alert state stays located on the same plan;
- **J3:** existing safe actions remain available at the same projected anchors.

This remains inside the owner-approved narrow exception in `docs/SCOPE.md`:
deterministic 2.5D presentation of the canonical plan, not a second model,
photorealistic renderer, free camera or interior editor. View is still the
product; the experiment being hidden does not relax the View/kiosk touch
contract.

## 2. Problem

Stage 1 established the hard parts of the renderer: one fixed orthographic
projection, canonical wall geometry, complete opening cuts, screen-facing
overlays, live floor layers, fallback, warm-remount and bounded geometry cache.
Its deliberate visual limits are now the gap:

- wall tops and sides are flat solid colours with minimal depth cues;
- the floor has no visible outside edge and the plan does not feel grounded;
- doors, windows and gates keep their old floor-plane symbols inside a
  volumetric wall gap;
- there is no ambient, contact or leaf shadow;
- owner references and the accepted pseudo-3D direction are not yet represented.

A literal copy of the references would be wrong. They omit labels, live fills,
decor, furniture, columns, Glow, sunlight and vacuum data, and they imply
concrete/wood semantics that House Plan does not store. Stage 2 must adopt the
references' language of depth while retaining the user's canonical content and
the semantic meaning of every live layer.

## 3. Accepted owner decisions

The owner accepted defaults Q0–Q6 on 13 August 2026.

1. Priority is P2; Stage 2 is valuable but hidden and does not displace public
   P1 defects.
2. Stage 2 evolves the existing `iso` flag. There is no second flag, public
   setting or rollout surface; Flat remains the initial presentation.
3. The references guide wall/opening/edge material and depth only. They do not
   replace the plan image, room fills, labels, decor/backdrop, furniture,
   Glow/spill, sun, vacuum or canonical columns, and do not add inferred
   concrete/wood/terrace materials.
4. In Iso, doors use one vertical leaf, gates use their existing pair of short
   leaves and windows use a light vertical insert. The old floor symbol is not
   duplicated while the volumetric representation is active. Existing contact,
   inversion, hinge/side, live state, lock card/badge and actions remain.
5. There is no new decorative window-light beam on the floor. Windows may have
   a local material highlight; directional window light remains the existing
   live sunlight and room light remains Glow.
6. One low outside floor edge and restrained ambient/contact/leaf shadows are
   included. There are no per-room steps or new terrace/porch entities.
7. Unsupported decorative filters may disappear without losing structural
   volume, openings, live layers or actions. Flat fallback remains reserved for
   structural projection/topology failure.

## 4. Scope

Stage 2 includes:

1. evolution of the existing hidden `iso` presentation under the same Labs
   activation and expiry contract;
2. theme-aware matte material for wall tops and visible sides, with a stable
   distinction between top, side and outline in light and dark themes;
3. one low outside floor edge for every connected exterior component of the
   canonical room footprint, with no edge at internal room boundaries;
4. a restrained ambient shadow for the complete footprint, contact shadow at
   physical walls and soft shadow for visible vertical leaves;
5. vertical Iso presentation of doors, windows and gates derived only from the
   existing opening model and live `openingAmount()` semantics;
6. exact preservation of opening gaps, jamb faces, lock markers, room fills,
   hover, Glow/spill, sunlight, plan image, decor, furniture, vacuum and all
   device/room overlays;
7. deterministic behaviour for `show_borders`, `hide_openings`, themes,
   forced colours and missing decorative-filter support;
8. fit/pan/zoom/warm-remount/fallback bounds that include structural floor and
   opening volume without clipping;
9. unit, targeted browser smoke, golden and exact-SHA performance evidence;
10. internal architecture, Iso and status documentation.

## 5. Out of scope

- public activation, settings, onboarding, announcement or documentation of
  Iso; public rollout requires a separate owner-approved issue;
- a second `iso2` flag or an A/B selector between Stage 1 and Stage 2;
- free rotation, perspective, user tilt, camera presets or #82 animation;
- new wall, floor, door or window material settings;
- inferred room types, concrete, wood, terrace, porch or floor finish;
- a constant decorative beam from each window or a second light model;
- geometric occlusion of device markers, labels, cards or popovers by walls;
- volumetric Plan/Devices/Background editors;
- volumetric `houseplan-space-card`;
- opening height/sill/frame fields, schema changes or compatibility aliases;
- 3D furniture, ceiling, roof, external-object shadows or weather lighting;
- WebGL, Three.js, CSS `preserve-3d`, raster textures or a runtime dependency;
- fixing or weakening the independent performance defect/budget in #124;
- backend, import/export, HA registry, service calls or lock security changes.

## 6. Behaviour contract

### 6.1 Labs and surface boundary

- `iso` remains the only Labs id. Query/hash/storage grammar, Flat default,
  per-space preference, kiosk preference and `-iso`/`off` rollback remain the
  Stage 1 contract.
- Stage 2 is available only while that registry entry is live. Its existing
  exclusive expiry at `1.65.0` is not extended by this issue; a `1.65.0-beta.*`
  build must fail closed unless a separate reviewed graduation decision exists.
- Editors and `houseplan-space-card` stay Flat. Entering an editor, returning
  to View, changing space and warm-remount preserve the existing logical centre
  and projection preference.
- With Labs inactive, no Stage 2 geometry, definitions, filters, capability
  work or DOM is created. Existing Flat DOM and pixels remain the reference.

### 6.2 Material language

- Walls remain low, neutral and matte. Top faces are lighter than visible side
  faces in both themes; an outline keeps adjacent faces distinguishable.
- Material uses deterministic CSS/SVG tokens. A subtle bounded gradient or
  reusable low-amplitude treatment is allowed, but no raster texture, random
  noise, glossy highlight or floor-material replacement is allowed.
- Theme or colour-scheme changes update presentation only and do not rebuild
  topology or change cache keys.
- User room/border colours retain their existing Flat/editor meaning. Stage 2
  does not reinterpret them as physical material.
- Materials do not encode HA state. All live state remains in the existing
  room/device/opening layers.

### 6.3 Canonical floor edge

The Stage 2 floor footprint is computed from the union of room floor polygons
and their derived exterior masonry. It deliberately excludes detached
partitions, columns, decor, background images and far markers from deciding the
slab perimeter.

- Each connected exterior component receives one low vertical edge below the
  current floor plane.
- Shared room edges and other internal boundaries never form a step or seam.
- Nested-room/internal holes do not create an additional decorative step.
- Two genuinely detached room components may each have an outside edge; they
  are not bridged by a bounding box.
- A space without room geometry has no inferred floor edge.
- The existing floor nodes remain the top surface. Stage 2 must not paint a new
  opaque floor over plan images, fills, Glow, sunlight or decor.

### 6.4 Shadows

There are three decorative depth cues:

1. one ambient shadow for the complete connected plan footprint;
2. a restrained contact shadow where physical masonry meets the floor;
3. a soft shadow belonging to each visible door/gate leaf.

They are presentation only:

- no shadow changes light visibility, room state, hit testing or HA action;
- shadow opacity is bounded so room fills, Glow and sunlight remain readable;
- no per-edge SVG filter is created; filter/definition count is O(1) per card,
  while geometry remains O(E + O) for wall edges and openings;
- theme, hover and an HA-only device update do not reconstruct shadow geometry;
- shadows from roofs, neighbouring wings, furniture or outdoor objects are not
  modelled;
- reduced/unsupported decoration removes the shadow rather than substituting a
  hard, misleading shape.

### 6.5 Vertical openings

All opening placement and live meaning continues to come from existing
`OpeningCfg`, `OpeningWallIndex`, wall cuts and `openingAmount()`.

**Door**

- one thin vertical leaf is hinged exactly at the owning jamb;
- closed state lies in the wall opening; open amount follows the same 0–1 path
  and opening side/hinge choices as the current floor symbol;
- no handle, hinge hardware or decorative panel is added.

**Gate**

- two equal vertical leaves meet at the opening centre when closed;
- live amount preserves the current 0–10° outward contract, including the
  static-open default when no contact exists;
- gate lock semantics remain identical to a door.

**Window**

- a closed window is a light neutral insert in the wall opening;
- open state uses the existing two-leaf/casement direction and amount rather
  than inventing a new sash type;
- the insert may have a local highlight but emits no floor beam and does not
  replace the existing sun layer.

For every type:

- leaf/panel height and thickness are fixed presentation ratios to Stage 1 wall
  height; no persisted setting is introduced;
- jamb attachment error is at most the existing geometric epsilon and the
  projected visual gap at the hinge is at most 1 CSS px;
- panels do not fill the masonry cut or bridge the full-height opening with a
  wall strip;
- panels and their shadows are `aria-hidden`/pointer-inert. Existing View
  inertness, lock badge, card and secure action boundary remain the only
  interaction contract;
- a contact-state update changes only the live leaf projection and cannot
  rebuild wall union, floor footprint or opening-wall topology.

### 6.6 Display settings

- `hide_openings: true` hides vertical panels and leaf shadows, while the wall
  cut, contact/lock references, Glow passage and sunlight behaviour remain as
  today.
- `show_borders: false` preserves the Stage 1 no-volume contract: Stage 2 wall
  material, vertical panels, floor edge and all new shadows are absent. The
  existing floor-plane opening symbol remains available under its current
  `hide_openings` rule so openings do not become invisible floating gaps.
- With borders visible, the vertical panel replaces rather than duplicates the
  old floor-plane symbol in Iso.
- Flat and every editor keep their current symbols and settings behaviour.

### 6.7 Existing live layers and actions

The following invariants are exact, not best effort:

- the same resolved rooms, sources, opening state, markers and vacuum data are
  consumed in Flat and Iso;
- room fills/hover, Glow/spill, sun, backdrop/decor/furniture, vacuum and
  screen-facing overlays retain their existing node/state/action contract;
- Stage 2 creates no new HA call, websocket request, fetch, storage write or
  network resource;
- device actions, opening cards and the lock invariant from `docs/SCOPE.md`
  remain unchanged;
- decorative shadow may modulate final pixels but may not remove, replace or
  reclassify any live effect;
- there is no second window-light, Glow or sun layer.

### 6.8 Accessibility, touch and graceful degradation

- View and kiosk remain fully supported on desktop and touch: pan, pinch,
  swipe, double-tap reset, orientation resize, space change and long-press
  kiosk settings are unchanged.
- New volume is non-interactive and cannot steal pointer, focus or assistive
  technology navigation. Existing HTML devices, room cards and lock badges
  stay screen-facing and above it.
- New geometry has no animation timeline. Live opening state may update, but
  no decorative continuous motion is introduced; `prefers-reduced-motion`
  therefore retains the Stage 1 transition contract.
- In forced-colours/high-contrast mode, structural faces and outlines remain
  distinguishable without relying only on a gradient; decorative shadows and
  material nuance may be absent.
- A detected unsupported filter/paint capability degrades to solid material
  and no decorative shadows. Geometry, vertical openings, floor edge, live
  layers and actions remain.
- Canonical supported browsers must render full Stage 2 and pass performance.
  Fallback may not be forced in the benchmark merely to make the budget green.
- A structural projection/topology exception uses the existing latched Flat
  fallback for `space|fingerprint`. Decorative-filter failure alone never
  changes the selected presentation to Flat.

## 7. Rendering and architecture contract

Stage 1 projection and canonical wall decisions remain accepted. Stage 2 may
extend their scene result, but must not create a second coordinate system or
replace `wallBodiesGeometry()`.

Required boundaries:

1. One structural Stage 2 scene is keyed by the complete geometry fingerprint:
   rooms, canonical masonry, openings and flips, wall/camera/edge height and an
   algorithm revision. HA state, theme, hover, day/night and filter capability
   are excluded.
2. Cached opening structure stores jamb/basis/topology only. Live
   `openingAmount()` is applied after the structural cache, O(O), without a
   boolean wall operation.
3. Floor-edge geometry derives from canonical room/exterior geometry, not from
   SVG DOM measurement, a background image or duplicated room inference.
4. Structural complexity remains O(E + O). A constant number of shared SVG
   gradients/filters is allowed; per-face filters and data URLs are forbidden.
5. Render order is explicit and testable:

   ```text
   stage background
   → optional ambient shadow
   → exterior floor edge
   → existing projected floor SVG and all live floor layers
   → optional contact/leaf shadows
   → canonical wall sides/top and vertical opening panels
   → existing screen-facing HTML overlays
   ```

6. If implementation uses more than one absolutely positioned SVG, they share
   the same `viewBox` snapshot and projection; no layer computes fit, pan or
   zoom independently.
7. `projectedFrame()` or its Stage 2 successor includes wall tops, opening tops
   and structural floor edge. Filter blur may overflow safely but must not
   expand logical content bounds or change zoom when decoration degrades.
8. Flat fallback is independent of the Stage 2 cache and can render even when
   Stage 2 construction throws.
9. Existing LRU cap remains eight structural scenes per card and does not grow
   on HA updates, theme changes, view toggles or filter fallback.
10. The implementation records its composition/cache/fallback decisions in a
    new `docs/adr/122-isometric-stage2-composition.md`; the historical Stage 1
    ADR is not rewritten as if it had decided Stage 2.

Likely implementation files, subject to code review:

- `src/iso-projection.ts` for Stage 2 structural bounds only if required;
- `src/iso-walls.ts` or a new pure `src/iso-scene.ts` for cached walls and floor
  edge;
- a pure `src/iso-openings.ts` (or equivalent) for live vertical-panel
  projection;
- `src/houseplan-card.ts` for orchestration and exact layer order;
- `src/styles.ts` for theme/capability/forced-colour material;
- `src/labs.ts` only for traceability metadata, without changing id/lifetime;
- unit, smoke, golden/performance harness and internal docs named in §11–§13.

## 8. Model data, compatibility and migration

No persisted model changes.

- `space.openings[]`, room/wall geometry and display settings retain their
  current schema;
- there are no door/window height, sill, material or Stage 2 fields;
- no config version, backend validation, import/export or compatibility-registry
  entry changes;
- current `houseplan_card_labs_v1` and `houseplan_card_view_v1` values remain
  readable and unchanged;
- merely rendering Stage 2 writes no config/layout and does not rewrite local
  storage beyond the existing Stage 1 Labs/preference operations;
- downgrade to Stage 1 or Flat requires no migration and loses no user data.

The `iso` registry `since: 1.62.0` and exclusive `expires: 1.65.0` values are
unchanged. The metadata issue/summary may point to #122 for current diagnostics,
provided internal docs retain the #89 predecessor link.

## 9. UX and i18n

There is no new public control or text. The existing hidden projection button,
its 44×44 target, labels “Volumetric view” / “Flat view” and per-space preference
remain unchanged.

- no new i18n keys;
- no public settings/YAML option;
- no README, user-guide or HACS promise;
- no change to editor wording or opening settings;
- no new focusable node or interaction path.

`docs/USER-GUIDE.ru.md` remains deliberately silent about hidden Iso. The
implementation must nevertheless preserve its normative contracts for View,
kiosk, openings, Glow, sunlight and lock safety.

## 10. Dependency and Definition of Ready

#124 records a reproducible failure of the existing Stage 1
`large-house-isometric-v1` view-toggle budget. Stage 2 must not absorb that bug,
hide it with decorative fallback or weaken its budget.

This specification may be reviewed while #124 is open. After a green spec
review, #122 may carry `S5-ready`, but it also receives `blocked` and may not be
claimed into `S6-in-progress` until one of these is true:

1. #124 is resolved with a green exact-SHA Full Performance comparison using at
   least seven samples and unchanged budgets; or
2. the owner records a separate explicit arbitration that #122 may start with
   the known baseline debt.

Stage 2's own implementation must then pass the same unchanged profile on its
exact SHA. A coincidentally green single local sample is not a substitute.

## 11. Acceptance criteria

- **AC1 (`unit` + `smoke` + code review):** the same `iso` Labs id exposes Stage
  2 while live; Flat remains default, expiry remains exclusive at `1.65.0`, and
  there is no second flag, public setting or config key.
- **AC2 (`unit` + existing flat smoke + existing flat golden):** with Labs
  inactive, Flat/editors/static card do not create Stage 2 geometry, filters or
  DOM and retain their existing state/action/pixel contract.
- **AC3 (`unit` + `golden`):** light and dark Iso show deterministic matte wall
  top/side/outline separation without raster textures, random output, inferred
  room material or per-face filters.
- **AC4 (`unit` + `golden`):** every connected room footprint receives one low
  outside edge; shared/internal room edges and nested holes create no steps,
  detached components are not bridged, and detached partitions/columns do not
  expand the slab.
- **AC5 (`unit` + `smoke` + `golden`):** door, window and gate vertical geometry
  matches existing jamb, side, flip and `openingAmount()` semantics for
  closed/open/no-contact/unavailable/inverted states; projected hinge gap is
  ≤1 CSS px and the masonry opening remains full-height.
- **AC6 (`smoke` + code review):** vertical panels are pointer/focus/ARIA inert;
  the existing lock badge/card and safe action result are unchanged and no new
  service or network call exists.
- **AC7 (`unit` + `smoke` + `golden`):** `hide_openings` hides panels/leaf shadows
  but not cuts/state/light; `show_borders:false` preserves the Stage 1
  no-volume scene and existing floor symbols without Stage 2 edge/shadows.
- **AC8 (`smoke` + `golden`):** room fills/hover, Glow/spill, sun,
  backdrop/decor/furniture, vacuum, markers, labels/cards and opening locks keep
  the same resolved state, source count, action outcome and layer order; no
  second window-light/Glow/sun layer appears.
- **AC9 (`unit` + `smoke`):** HA-only state changes do not rebuild wall/floor
  topology; an opening contact update changes only live leaf projection; theme,
  hover and filter fallback do not grow the structural cache.
- **AC10 (`smoke` + `golden`):** desktop View, touch View and kiosk retain
  pan/pinch/tap/long-press/swipe/orientation/space/warm-remount behaviour, use one
  projection snapshot and never expose volumetric editors.
- **AC11 (`unit` + `smoke` + code review):** unsupported decoration and forced
  colours retain solid readable structure with no decorative shadows; a
  decorative failure stays Iso, while a structural failure uses the existing
  latched Flat fallback and emits no personal data.
- **AC12 (`unit` + `smoke`):** fit/home and projection toggle include wall,
  opening and floor-edge structural bounds without clipping, preserve scalar
  zoom/logical floor centre and do not change when blur is disabled.
- **AC13 (`performance`):** after #124's precondition, exact-SHA Full Performance
  for `large-house-isometric-v1` is green with ≥7 samples and unchanged budgets;
  Flat remains inside noise, filter/definition count is bounded and
  `isoGeometry` cache cap/growth remain 8/0.
- **AC14 (`unit` + smoke + code review):** plan/backend/import/export schema,
  local-storage keys, HA actions, network traffic and i18n keys are unchanged;
  render-only use does not write config or layout.
- **AC15 (`golden` + documentation review):** reviewed Stage 2 Iso baselines show
  materials, openings, edge, shadows and live-layer parity; all Flat and
  `isometric-no-borders-dark` baselines remain unchanged; internal docs describe
  the hidden experiment without public rollout claims.
- **AC16 (`typecheck` + `unit` + `build`):** implementation-loop gates are green
  and all three generated bundle copies are byte-identical.

## 12. Automated test plan

### 12.1 Unit

1. Extend pure Iso geometry coverage with room union/exterior floor-edge cases:
   one room, shared rooms, nested room, two detached components, detached
   partition/column and empty space.
2. Prove floor-edge geometry has no segment on an internal shared boundary and
   remains stable under room order/winding changes.
3. Add pure vertical-opening fixtures for door/window/gate across amount 0/1,
   no contact, unavailable, invert and both flips. Assert exact jamb anchors,
   leaf count, wall-height bounds and stable output order.
4. Prove an HA amount change reuses the structural basis and cannot mutate or
   grow the wall/floor cache.
5. Verify structural fingerprint includes opening geometry/flips, wall/edge
   height and algorithm revision, but excludes HA state, theme, hover and
   filter capability.
6. Verify layer/capability resolution: full decoration, unsupported filter,
   forced colours, `hide_openings` and `show_borders:false`.
7. Source-contract tests assert no new config key, dependency, network call,
   public control or second light layer.

Tests must be capable of failing independently: removing one exterior edge,
moving a leaf off its jamb, including HA state in the cache key, duplicating a
floor symbol or adding an extra light layer must make the relevant test red.

### 12.2 Targeted browser smoke

Extend or add a production-bundle scenario with:

1. light and dark Stage 2 activation under existing `iso`;
2. door/window/gate with live contact and lock references, including state
   changes without topology rebuild;
3. visible borders, `hide_openings`, `show_borders:false` and return to visible
   borders;
4. room fill + two Glow sources + sunlight + decor + vacuum + room/device
   actions in the same frame;
5. Flat ↔ Iso, editor round-trip, space switch, resize/orientation and warm
   remount;
6. touch View and kiosk gestures with pointer-inert Stage 2 layers;
7. forced/unsupported-decoration mode and structural-failure Flat fallback;
8. assertions for one light model, stable cache counts and no config/layout/
   network write.

Per the implementation-loop policy, browser smoke is authored with the code but
run in the full pre-beta gate, not on every local iteration.

### 12.3 Golden

The existing matrix remains the base. Expected work:

- update reviewed Stage 2 baselines for geometry light/dark, live layers,
  touch kiosk and large warm-remount;
- keep every Flat baseline and `isometric-no-borders-dark` pixel-identical;
- add a focused light-theme and dark-theme opening/material scenario containing
  door, window, gate, floor edge and shadows;
- add a detached-footprint/internal-boundary scenario if existing geometry
  fixtures cannot prove AC4 visually;
- inspect live-effect readability rather than accepting lower contrast merely
  because the diff is expected.

Baselines are accepted only through `npm run golden:accept -- --reviewed` from a
complete reviewed Linux CI artifact with the required `Release:` and
`Baseline-Reviewed:` trailers. Stage 2's spec approval is not baseline approval.

### 12.4 Performance

Use the existing `large-house-isometric-v1` runner and unchanged budget file:

- at least seven samples on the exact candidate SHA;
- Flat baseline comparison and Iso candidate comparison;
- view toggle, first stable render, state update, space switch, pan/zoom,
  long tasks, heap, cache caps and growth;
- a DOM metric or smoke assertion bounding shared material/filter definitions
  and vertical opening count to O(1) definitions + O(O) geometry.

A local run is diagnostic only. #124's evidence and Stage 2's own exact-SHA
comparison are separate required results.

### 12.5 Backend

Backend is unchanged. No new backend test is required. Existing Linux Validate
still runs the full project gate before beta.

## 13. Documentation and release artefacts

Stage 2 remains hidden, so its implementation commits use
`User-Visible: no`. They do **not** add public changelog, README, HACS or
user-guide promises. Public documentation belongs to a separate rollout issue.

Update with the implementation:

- `docs/ISOMETRIC.md` — Stage 2 material/opening/edge/layer/fallback contract;
- `docs/ARCHITECTURE.md` — one cached structural scene and live-opening split;
- `docs/adr/122-isometric-stage2-composition.md` — accepted composition,
  caching and degradation decisions;
- `docs/STATUS.md` — current hidden Labs stage and release-cycle state;
- `AGENTS.md` only if Labs authoring/lifetime rules themselves change (not
  expected).

Visual release artefacts:

- reviewed golden set from §12.3;
- exact-SHA Validate and Full Performance evidence from §12.4;
- no public screenshot or announcement;
- no separate security report because there are no inputs, services or data
  changes; code review explicitly confirms the negative security contract.

The feature/material change must pass through a published beta before stable,
even though it remains hidden.

## 14. Risks and mitigation

| Risk | Probability / impact | Mitigation |
|---|---|---|
| Vertical panel drifts from jamb or crosses masonry | medium / high | pure opening basis, ≤1 px smoke, focused golden |
| Floor edge follows room seams or bridges detached plans | medium / high | canonical exterior union, permutation units, detached golden |
| Shadows obscure Glow/sun or alter live meaning | medium / high | bounded shared filters, combined live-layer golden, no new light model |
| Per-face filters or live topology rebuild break performance | high / high | O(1) definitions, structural/live split, unchanged exact-SHA budget |
| #124 debt is hidden by Stage 2 fallback | high / high | explicit DoR blocker and benchmark full decoration |
| `show_borders:false` leaves floating panels | medium / medium | retain Stage 1 floor symbols in the no-volume branch |
| Touch/kiosk layer steals gestures | low / high | pointer-inert geometry and targeted touch/kiosk smoke |
| Dark/forced-colour material becomes unreadable | medium / medium | outline-based distinction and solid fallback |
| Filter exception unnecessarily drops to Flat | medium / medium | separate decorative capability from structural latch |
| New cache key includes HA state and grows every tick | medium / high | basis/live split and cache-growth unit/performance assertion |
| Internal feature leaks into public docs | low / medium | internal artefact list, no changelog/user-guide/README |
| Stage 2 misses Labs expiry | medium / medium | unchanged exclusive 1.65 expiry and separate graduation decision |

## 15. Rollback

Immediate tester rollback needs no build: `?hp-labs=-iso` or
`?hp-labs=off` makes Flat effective, and warm state cannot resurrect Iso.

Code rollback reverts the Stage 2 behaviour/artefact commit while retaining the
accepted Stage 1 renderer. There is no data or schema migration to reverse.
Existing Labs and view-preference storage remain valid. If only decorative
filters fail, the supported runtime fallback removes them without disabling
structural Stage 2; if Flat itself changes or fails, beta publication is blocked.

## 16. Technical assumptions — may change without product review

1. Recommended fixed ratios are: floor edge roughly 10–16% of wall height,
   door/gate panels roughly 85–100% and window panels roughly 45–70% of wall
   height. Exact constants are selected by reviewed golden output and do not
   become user settings.
2. A new pure `iso-openings.ts`/`iso-scene.ts` split is preferred, but names and
   file boundaries may change while the structural/live-cache contract holds.
3. Gradients and shadows should use shared SVG defs/CSS variables. Exact tokens,
   blur radii and alpha may change in review within the restrained material
   contract and performance budget.
4. `show_borders:false` uses the existing floor symbols rather than floating
   vertical panels; this is the deterministic consequence of the accepted
   no-volume setting, not a new public mode.
5. The ambient shadow may be rendered in a dedicated shared-projection SVG
   beneath the existing floor SVG. The number of SVG roots is not a product
   contract; the one-snapshot/layer-order invariant is.
6. The Labs registry diagnostic may change its issue metadata from #89 to #122,
   but id, storage key, since and expiry do not change.
7. Capability detection may use CSS/forced-colour media queries or a cached
   per-Document probe. It must not classify performance from viewport width or
   coarse pointer alone.
8. #124 is a process/technical prerequisite, not Stage 2 product scope. Its fix
   may change the renderer internals this spec builds upon without reopening
   owner decisions Q0–Q6.

