/** #1451: solid Flat markers inside a translucent shell with a floor shadow. */
import { css } from 'lit';

export const isoLabMarkersStyles = css`
  /* Keep the name centred on its saved anchor. Its metrics and Area action
     share the same scene plane; the invisible touch floor stays screen-sized. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .roomlabel {
    transform: translate(-50%, -50%) var(--hp-iso-marker-plane);
    transform-origin: 50% 50%;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .roomlabel::before {
    transform: translate(-50%, -50%) var(--hp-iso-marker-hit-plane);
  }
  /* The mask and label share the camera layer during live pan and zoom.
     Names, Area links and the metrics below them all cross the same edge. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-plane {
    position: absolute; inset: 0; pointer-events: none; z-index: -3;
    mask-image: var(--hp-room-wall-mask, url(#hp-room-wall-mask));
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-room-label-plane[data-hp-label-bounded] > .roomlabel {
    left: var(--hp-label-left) !important;
    top: var(--hp-label-top) !important;
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
    --hp-iso-side: color-mix(in srgb, var(--device-face-bg, var(--oplock-core-bg)) 90%, #000);
    --hp-iso-ground-shadow:
      calc(var(--hp-iso-edge-x) * 3.2) calc(var(--hp-iso-edge-y) * 3.2)
        calc(var(--hp-iso-d) * .27) calc(var(--hp-iso-d) * -.12) rgb(28 32 38 / 26%),
      calc(var(--hp-iso-edge-x) * 3.2) calc(var(--hp-iso-edge-y) * 3.2)
        calc(var(--hp-iso-d) * .52) calc(var(--hp-iso-d) * -.04) rgb(28 32 38 / 14%);
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev::before,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock::before {
    transform: translate(-50%, -50%) var(--hp-iso-marker-hit-plane);
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev .device-shell.text-shell:not(.with-values) {
    left: 50%; transform: translateX(-50%);
  }
  /* The 0.24 D body straddles the saved anchor. A solid top and one continuous
     side convey thickness without a gradient or a second disc underneath. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .device-core,
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
  /* The native contact renderer paints the envelope of the entire body.
     Hide only the old flat ring, not its canonical measurement or hit area. */
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .dev[data-hp="device"][data-hp-iso-body-outline] .device-shell-frame {
    opacity: 0;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock-shell {
    border-color: transparent; z-index: 2;
  }
  /* Let the rear glass sit behind the face and the near side veil its edge.
     The native contact contours extend slightly above the core's top face. */
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
    position: absolute; inset: 0; z-index: -1;
    pointer-events: none; contain: layout style;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow * {
    pointer-events: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow::before { display: none; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .device-core,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .value-badge,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .oplock-core {
    translate: none;
    background: transparent; color: transparent;
    box-shadow: var(--hp-iso-ground-shadow);
    filter: none;
  }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .oplock-shell { border-color: transparent; translate: none; }
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .valtext,
  .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadow .value-badge-content {
    visibility: hidden;
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
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .iso-tile-shadows { display: none; }
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .device-core,
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .oplock-core { box-shadow: none; background-image: none; translate: none; }
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-front,
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-back { fill: none; }
    .stage.projection-iso.mode-view[data-hp-iso-floor-markers] .glass-rim { stroke: CanvasText; }
  }
`;
