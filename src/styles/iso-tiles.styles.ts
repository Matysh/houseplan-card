/** #649 п.1: raised-tile markers in the 2.5D View (numbers: src/iso-tiles.ts). */
import { css, unsafeCSS, type CSSResultGroup } from 'lit';
import { isoTileGeometryCss, isoTileStateCss } from '../iso-tiles';

// The build's css minifier accepts no interpolation: the generated tables
// (one numeric source, src/iso-tiles.ts) are separate CSSResults.
const isoTilesStatic = css`
  /* Marker 12 % larger than Flat; collision uses the same factor (iso-scene-render). */
  .stage.projection-iso.mode-view .dev {
    --dev-size: calc(var(--device-base-size, 2.25cqw) * var(--dev-scale, 1) * 1.12);
    --iso-frame: transparent;
  }
  .stage.projection-iso.mode-view .oplock {
    --oplock-size: calc(var(--icon-size, 2.5cqw) * 0.62 * 1.12);
    --iso-frame: transparent;
  }
  /* No ring in 2.5D (virtual markers included, #649 Q1). */
  .stage.projection-iso.mode-view .dev .device-shell-frame {
    border-color: transparent;
    box-shadow: none;
  }
  .stage.projection-iso.mode-view .oplock .oplock-shell {
    border-color: transparent;
    box-shadow: none;
  }
  /* The whole marker floats: tile, badges, edge, frame and satellites. */
  .stage.projection-iso.mode-view .dev:not(.iso-tile-shadow) > *,
  .stage.projection-iso.mode-view .oplock:not(.iso-tile-shadow) > .oplock-shell {
    translate: 0 calc(var(--iso-lift) * -1);
  }
  .stage.projection-iso.mode-view .dev .device-core {
    border-radius: var(--iso-radius);
    background: var(--iso-body);
    color: var(--iso-fg);
    box-shadow: 0 var(--iso-depth) 0 var(--iso-edge);
  }
  .stage.projection-iso.mode-view .dev .value-badge {
    border-radius: var(--iso-badge-radius);
    box-shadow: 0 var(--iso-depth) 0 var(--iso-badge-edge);
  }
  .stage.projection-iso.mode-view .oplock .oplock-core {
    border-radius: var(--iso-radius);
    background: var(--iso-body);
    color: var(--iso-fg);
    box-shadow: 0 var(--iso-depth) 0 var(--iso-edge);
    position: relative;
  }
  /* Hover / focus / selected frame hugs the tile and its edge (lab .marker-halo--tile). */
  .stage.projection-iso.mode-view .dev:not(.iso-tile-shadow) .device-core::after {
    content: '';
    position: absolute;
    box-sizing: border-box;
    left: calc(var(--iso-frame-out) * -1);
    right: calc(var(--iso-frame-out) * -1);
    top: calc(var(--iso-frame-out) * -1);
    bottom: calc((var(--iso-frame-out) + var(--iso-depth)) * -1);
    border-radius: calc(var(--iso-radius) + var(--iso-frame-out));
    border: var(--iso-frame-w) solid var(--iso-frame);
    pointer-events: none;
  }
  :host([data-pointer-hover]) .stage.projection-iso.mode-view .dev:not(.unavail)[data-hp-device-hover]:not(.sel):not(:focus-visible) {
    --iso-frame: #0C82F0;
  }
  .stage.projection-iso.mode-view .dev.sel:not(:focus-visible) { --iso-frame: #F0A00C; }
  .stage.projection-iso.mode-view .dev:focus-visible { --iso-frame: #0C82F0; }
  :host([data-pointer-hover]) .stage.projection-iso.mode-view .dev.alarm[data-hp-device-hover]:not(.sel):not(:focus-visible),
  .stage.projection-iso.mode-view .dev.alarm.sel,
  .stage.projection-iso.mode-view .dev.alarm:focus-visible { --iso-frame: #F0410C; }
  /* One shadow layer under every marker and lock: .devlayer is a stacking
     context, so a negative z-index paints the layer below every marker there
     although it follows them in DOM order. */
  .stage.projection-iso.mode-view .iso-tile-shadows {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: -1;
    /* This absolute layer has no layout influence outside itself. Isolating
       style/layout keeps a 200-marker shadow tree out of the rest of the
       stage's toggle recalculation without clipping the deliberately
       overflowing blur at individual marker bounds. */
    contain: layout style;
  }
  /* The twin's root already has exactly the core/lock box. Paint its shadow
     there instead of creating two hidden descendants for every marker. Badge
     twins retain only the flex spacer and their extra value boxes. */
  .stage.projection-iso.mode-view .iso-tile-shadow {
    pointer-events: none;
    contain: layout style;
    border-radius: var(--iso-radius);
    box-shadow: var(--iso-sh-dx) calc(var(--iso-sh-dy) + var(--iso-depth)) var(--iso-sh-blur)
      calc(var(--iso-shadow-inset) * -1) rgb(28 32 28 / var(--iso-sh-a));
  }
  .stage.projection-iso.mode-view .iso-tile-shadow::before { display: none; }
  .stage.projection-iso.mode-view .iso-tile-shadow > :not(.device-shell):not(.oplock-shell),
  .stage.projection-iso.mode-view .iso-tile-shadow .device-shell-frame,
  .stage.projection-iso.mode-view .iso-tile-shadow ha-icon { visibility: hidden; }
  .stage.projection-iso.mode-view .iso-tile-shadow .device-core,
  .stage.projection-iso.mode-view .iso-tile-shadow .oplock-core {
    background: transparent;
    color: transparent;
    box-shadow: none;
  }
  .stage.projection-iso.mode-view .iso-tile-shadow .value-badge {
    background: transparent;
    color: transparent;
    box-shadow: var(--iso-sh-dx) calc(var(--iso-sh-dy) + var(--iso-depth)) var(--iso-sh-blur)
      calc(var(--iso-shadow-inset) * -1) rgb(28 32 28 / var(--iso-sh-a-white));
  }
  /* forced colours or no filter: no edge and no shadow; size and frames stay. */
  @media (forced-colors: active) {
    .stage.projection-iso.mode-view .iso-tile-shadows { display: none; }
    .stage.projection-iso.mode-view .dev .device-core,
    .stage.projection-iso.mode-view .dev .value-badge,
    .stage.projection-iso.mode-view .oplock .oplock-core { box-shadow: none; }
  }
  @supports not (filter: blur(1px)) {
    .stage.projection-iso.mode-view .iso-tile-shadows { display: none; }
    .stage.projection-iso.mode-view .dev .device-core,
    .stage.projection-iso.mode-view .dev .value-badge,
    .stage.projection-iso.mode-view .oplock .oplock-core { box-shadow: none; }
  }
`;

export const isoTilesStyles: CSSResultGroup = [
  unsafeCSS(isoTileGeometryCss()), unsafeCSS(isoTileStateCss()), isoTilesStatic,
];
