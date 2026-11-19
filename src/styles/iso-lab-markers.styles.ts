/** #1451: solid Flat markers inside a translucent shell with a floor shadow. */
import { css } from 'lit';

export const isoLabMarkersStyles = css`
  .iso-led-plane, .iso-led-shadow-plane {
    position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;
  }
  .iso-led-plane { z-index: 1; }
  .iso-floor-shadow-plane {
    position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
    pointer-events: none; z-index: -4;
  }
  /* Keep the name centred on its saved anchor. Its metrics and Area action
     share the same scene plane; the invisible touch floor stays screen-sized. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .roomlabel {
    transform: translate(-50%, -50%) var(--hp-iso-room-plane);
    transform-origin: 50% 50%;
    --hp-iso-edge-unit-x: var(--hp-iso-room-edge-x);
    --hp-iso-edge-unit-y: var(--hp-iso-room-edge-y);
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .roomlabel::before {
    transform: translate(-50%, -50%) var(--hp-iso-room-hit-plane);
  }
  /* The mask and label share the camera layer during live pan and zoom.
     Names, Area links and the metrics below them all cross the same edge. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-plane {
    position: absolute; inset: 0; pointer-events: none; z-index: 0;
  }
  /* One shallow extrusion, about one bold glyph stroke thick. The inverse
     camera vector keeps its sides vertical at every quarter turn. Eight
     sharp slices form a solid edge, without the old blurred text shadow. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .roomlabel .rlname,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .roomlabel .rlmetrics,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .lqi,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-battery-icon {
    --hp-glyph-depth: .15em;
    --hp-glyph-x: calc(var(--hp-glyph-depth) * var(--hp-iso-edge-unit-x) / .22);
    --hp-glyph-y: calc(var(--hp-glyph-depth) * var(--hp-iso-edge-unit-y) / .22);
    --hp-glyph-side: #808080;
    text-shadow: none;
    filter:
      drop-shadow(calc(var(--hp-glyph-x) * .125) calc(var(--hp-glyph-y) * .125) 0 var(--hp-glyph-side))
      drop-shadow(calc(var(--hp-glyph-x) * .125) calc(var(--hp-glyph-y) * .125) 0 var(--hp-glyph-side))
      drop-shadow(calc(var(--hp-glyph-x) * .25) calc(var(--hp-glyph-y) * .25) 0 var(--hp-glyph-side))
      drop-shadow(calc(var(--hp-glyph-x) * .5) calc(var(--hp-glyph-y) * .5) 0 var(--hp-glyph-side));
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .lqi,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-battery-icon {
    --hp-glyph-side: color-mix(in srgb, currentColor 65%, #30343a);
    --hp-iso-edge-unit-x: var(--hp-iso-room-edge-x);
    --hp-iso-edge-unit-y: var(--hp-iso-room-edge-y);
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-battery-icon {
    --hp-glyph-depth: calc(var(--battery-frame) * .15);
  }
  /* Read glyphs in the same two orientations as room labels. Rotate only
     their contents: bodies, contact frames and badge anchors stay in place.
     Independent rotate also preserves a device icon's configured angle. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-core > ha-icon,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-core > .valtext,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .value-badge-content,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-battery-icon,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock-core > ha-icon {
    rotate: var(--hp-iso-content-turn);
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .lqi {
    /* Keep the centring translation outside the glyph's local rotation. */
    transform: translateX(-50%) rotate(var(--hp-iso-content-turn));
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-furniture-foreground {
    position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
    pointer-events: none; z-index: -2;
  }
  :host([data-pointer-hover]) .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-plane:hover,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-plane:focus-within {
    mask-image: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock {
    margin: 0;
    transform: translate(-50%, -50%) var(--hp-iso-marker-plane);
    transform-origin: 50% 50%;
    --hp-iso-d: var(--dev-size, var(--oplock-core-size));
    --hp-iso-edge-x: calc(var(--hp-iso-d) * var(--hp-iso-edge-unit-x));
    --hp-iso-edge-y: calc(var(--hp-iso-d) * var(--hp-iso-edge-unit-y));
    --hp-iso-rim-x: calc(var(--hp-iso-edge-x) * 1.090909091);
    --hp-iso-rim-y: calc(var(--hp-iso-edge-y) * 1.090909091);
    --hp-iso-side: #808080;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev::before,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock::before {
    transform: translate(-50%, -50%) var(--hp-iso-marker-hit-plane);
  }
  /* Preserve the Flat face's local anchor: the shared contact contour uses
     those same metrics. Separately centring a text pill offsets its glass. */
  /* The 0.24 D body straddles the saved anchor. A solid top and one continuous
     side convey thickness without a gradient or a second disc underneath. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .device-core,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .value-badge,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock-core {
    translate: calc(var(--hp-iso-rim-x) * -.5) calc(var(--hp-iso-rim-y) * -.5);
    background-image: none;
    box-shadow:
      var(--device-core-inset-shadow, var(--oplock-core-shadow, 0 0 0 transparent)),
      0 0 0 var(--device-ring-width, 0px) var(--device-ring-color, transparent),
      calc(var(--hp-iso-rim-x) * .1) calc(var(--hp-iso-rim-y) * .1) 0 var(--hp-iso-side),
      calc(var(--hp-iso-rim-x) * .2) calc(var(--hp-iso-rim-y) * .2) 0 var(--hp-iso-side),
      calc(var(--hp-iso-rim-x) * .3) calc(var(--hp-iso-rim-y) * .3) 0 var(--hp-iso-side),
      calc(var(--hp-iso-rim-x) * .4) calc(var(--hp-iso-rim-y) * .4) 0 var(--hp-iso-side),
      calc(var(--hp-iso-rim-x) * .5) calc(var(--hp-iso-rim-y) * .5) 0 var(--hp-iso-side),
      calc(var(--hp-iso-rim-x) * .6) calc(var(--hp-iso-rim-y) * .6) 0 var(--hp-iso-side),
      calc(var(--hp-iso-rim-x) * .7) calc(var(--hp-iso-rim-y) * .7) 0 var(--hp-iso-side),
      calc(var(--hp-iso-rim-x) * .8) calc(var(--hp-iso-rim-y) * .8) 0 var(--hp-iso-side),
      calc(var(--hp-iso-rim-x) * .9) calc(var(--hp-iso-rim-y) * .9) 0 var(--hp-iso-side),
      var(--hp-iso-rim-x) var(--hp-iso-rim-y) 0 var(--hp-iso-side);
    filter: none;
  }
  /* UI Lab: the root is the device's top plane, aligned with the wall cut. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-core,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .value-badge,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock-core {
    translate: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock {
    --hp-iso-d: var(--oplock-core-size);
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .value-badge {
    --hp-iso-side: #808080;
  }
  /* The native contact renderer paints the envelope of the entire body.
     Hide only the old flat ring, not its canonical measurement or hit area. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev[data-hp="device"][data-hp-iso-body-outline] .device-shell-frame {
    opacity: 0;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock-shell {
    border-color: transparent; z-index: 2;
  }
  /* The upper glass rim shares the cap's plane; the near side veils its edge. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .device-contact-ink { z-index: auto; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-marker-glass {
    position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible;
    fill: none; stroke: none;
    pointer-events: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-marker-glass * { pointer-events: none; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-marker-glass.rear { z-index: 0; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-marker-glass.front { z-index: 3; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-back { fill: rgb(239 249 253 / 12%); }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-front { fill: rgb(245 251 255 / 30%); }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-rim {
    fill: none; stroke-width: var(--device-shell-border-width, var(--oplock-stroke-width));
    stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-rim.upper {
    stroke: color-mix(in srgb, var(--device-shell-stroke, var(--oplock-shell-stroke)) 52%, rgb(255 255 255 / 65%));
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-rim.lower {
    stroke: color-mix(in srgb, var(--device-shell-stroke, var(--oplock-shell-stroke)) 28%, transparent);
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-marker-glass.virtual .glass-rim {
    stroke: color-mix(in srgb, var(--device-shell-stroke) 50%, rgb(90 112 126 / 72%));
    stroke-width: calc(var(--device-shell-border-width) * 1.3);
    stroke-linecap: butt;
  }
  /* Flat's near-surface shadows otherwise double up with the new floor shadow,
     especially at wall contacts. Keep their outlines, remove only the shadow. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .device-shell-frame,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock-shell { box-shadow: none; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .device-contact-contour { filter: none; }
  /* Reuse the shared inert layer so shadows never cover another icon in a stack. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadows {
    position: absolute; inset: 0; z-index: -4;
    pointer-events: none; contain: layout style;
    /* The enclosing SVG group owns the structural mask, including overflow. */
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow * {
    pointer-events: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow::before { display: none; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow { box-shadow: none; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .device-core,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .value-badge,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .oplock-core {
    position: relative;
    translate: none;
    background: transparent; color: transparent;
    box-shadow: none;
    filter: none;
  }
  /* A box-shadow clips out its source box. Raised bodies need a complete
     silhouette on the floor, including the area under their old position. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow :is(.device-core, .value-badge, .oplock-core)::before,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow :is(.device-core, .value-badge, .oplock-core)::after {
    content: ''; position: absolute; border-radius: inherit;
    translate: none;
    pointer-events: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow :is(.device-core, .value-badge, .oplock-core)::before {
    inset: calc(var(--hp-iso-d) * .12);
    background: rgb(28 32 38 / 26%);
    filter: blur(calc(var(--hp-iso-d) * .135));
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow :is(.device-core, .value-badge, .oplock-core)::after {
    inset: calc(var(--hp-iso-d) * .04);
    background: rgb(28 32 38 / 14%);
    filter: blur(calc(var(--hp-iso-d) * .26));
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .oplock-shell { border-color: transparent; translate: none; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .valtext,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .value-badge-content {
    visibility: hidden;
  }
  /* Names and their metrics cast the same floor-only, vertically aligned
     shadow as devices. Reuse the label geometry, without its solid edges. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-shadow {
    filter: blur(.16em);
    pointer-events: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-shadow *,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-shadow :is(.rlname, .rlmetrics) {
    filter: none; text-shadow: none; pointer-events: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-shadow::before {
    display: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] [data-hp-iso-occluded] {
    opacity: .3;
  }
  :host([data-pointer-hover]) .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev:not(.unavail)[data-hp-device-hover],
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev:not(.unavail):focus-visible,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock:focus-visible {
    opacity: 1;
    z-index: 5;
  }
  @media (forced-colors: active) {
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .roomlabel .rlname,
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .roomlabel .rlmetrics,
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .lqi,
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-battery-icon { filter: none; }
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadows { display: none; }
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .device-core,
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .value-badge,
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock-core { box-shadow: none; background-image: none; translate: none; }
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-front,
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-back { fill: none; }
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-rim { stroke: CanvasText; }
  }
`;
