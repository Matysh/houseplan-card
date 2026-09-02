/** The plan scene: stage, walls, axes, snap, decor, iso and resize ink (#266, split from styles.ts). */
import { css } from 'lit';

export const planStyles = css`
    .fixedfloor-loading {
      animation: fixedfloor-spin 1.1s linear infinite;
    }
    .fixedfloor-error p {
      max-width: 42rem;
      margin: 0;
      overflow-wrap: anywhere;
    }
    @media (prefers-reduced-motion: reduce) {
      .fixedfloor-loading { animation: none; }
    }
    .stage.noplan {
      background: #ffffff;
    }
    /* Editors always keep the white drawing sheet — even when a backdrop
       image is loaded. Without this, a picture plan painted the theme card
       colour under the grid (owner 2026-08-05). View keeps the historical
       theme / .noplan split. */
    .stage.mode-plan,
    .stage.mode-devices,
    .stage.mode-decor {
      background: #ffffff;
    }
    .stage {
      position: relative;
      width: 100%;
      container-type: inline-size;
      overflow: hidden;
      touch-action: none; /* custom pinch/pan gestures */
      background: var(--ha-card-background, var(--card-background-color, #111));
    }
    .zoomwrap {
      position: absolute;
      inset: 0;
      z-index: 1;
    }
    .stage.mode-transition,
    .stage.mode-transition .zoomwrap {
      transition: none !important;
    }
    .stage.mode-transition .hp-view-only-layer,
    .stage.mode-transition .hp-editor-only-layer {
      pointer-events: none;
      will-change: opacity;
    }
    .stage.mode-transition .hp-paper {
      fill: var(--hp-mode-paper) !important;
    }
    /* Four-phase environment (#146): constant layers cross-fade because CSS
       gradients themselves are not reliably interpolated. Everything stays
       behind the plan; the plan tree is never dimmed, tinted or faded. */
    .hp-day-cycle-env {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
      isolation: isolate;
    }
    .hp-day-cycle-bg {
      position: absolute;
      inset: 0;
      opacity: 0;
      overflow: hidden;
      transition: opacity 1100ms cubic-bezier(.22, .61, .36, 1);
    }
    .hp-day-cycle-bg.active { opacity: 1; }
    .hp-day-cycle-sun {
      position: absolute;
      left: var(--hp-day-cycle-sun-x);
      top: var(--hp-day-cycle-sun-y);
      width: clamp(140px, 25cqw, 250px);
      height: clamp(140px, 25cqw, 250px);
      transform: translate(-50%, -50%);
      border-radius: 50%;
      filter: blur(10px);
      opacity: var(--hp-day-cycle-sun-opacity);
      transition:
        left 1100ms cubic-bezier(.22, .61, .36, 1),
        top 1100ms cubic-bezier(.22, .61, .36, 1),
        opacity 1100ms cubic-bezier(.22, .61, .36, 1);
    }
    .stage.mode-transition .hp-day-cycle-env { transition: none; }
    .stage.daycycle .hp-paperg,
    .hp-static-stage.daycycle .hp-paperg {
      filter:
        drop-shadow(0 0 1px var(--hp-day-cycle-outline-near))
        drop-shadow(0 0 5px var(--hp-day-cycle-outline-mid))
        drop-shadow(0 0 10px var(--hp-day-cycle-outline-far));
      transition: filter 1100ms cubic-bezier(.22, .61, .36, 1);
    }
    @media (prefers-reduced-motion: reduce) {
      .hp-day-cycle-bg,
      .hp-day-cycle-sun,
      .stage.daycycle .hp-paperg,
      .hp-static-stage.daycycle .hp-paperg {
        transition: none;
      }
    }
    .sunlayer {
      pointer-events: none;
    }
    .compass {
      width: 120px;
      height: 120px;
      flex: none;
      touch-action: none;
      cursor: grab;
      user-select: none;
    }
    .compass:active {
      cursor: grabbing;
    }
    .compass .cring {
      fill: rgba(255, 255, 255, 0.04);
      stroke: var(--divider-color, #444);
      stroke-width: 2;
    }
    .compass .ctick {
      stroke: var(--secondary-text-color, #9aa4ad);
      stroke-width: 2;
    }
    .compass .ctick.minor {
      stroke-width: 1;
      opacity: 0.6;
    }
    .compass .cneedle line {
      stroke: var(--primary-color, #3ea6ff);
      stroke-width: 2.5;
      stroke-linecap: round;
    }
    .compass .cneedle path {
      fill: var(--primary-color, #3ea6ff);
    }
    .compass .cneedle text {
      fill: var(--text-primary-color, #fff);
      font-size: 11px;
      font-weight: 700;
    }
    .compass .cdeg {
      fill: var(--secondary-text-color, #9aa4ad);
      font-size: 13px;
    }
    .compass.unset .cneedle {
      opacity: 0.35;
    }
    /* HP-1552: first-open boot veil — the plan hides until the stage height settles */
    .stage.hpboot .zoomwrap,
    .stage.hpboot .zoombadge {
      visibility: hidden;
    }
    /* AUD-1552-02: post-veil grace — HA chrome landing after the cap moves
       the stage height smoothly; the viewport ResizeObserver refits the plan
       along the transition, so a late panel glides instead of jumping. */
    .stage.hpsettle {
      transition: height 0.25s ease;
    }
    @media (prefers-reduced-motion: reduce) {
      .stage.hpsettle {
        transition: none;
      }
    }
    .zoomctl {
      display: inline-flex;
      gap: var(--sp-1);
      background: rgba(127, 127, 127, 0.12);
      border-radius: var(--rad-m);
      padding: var(--sp-1);
    }
    .zoomctl .zb {
      border: none;
      padding: var(--sp-3) var(--sp-4);
    }
    .zoomctl .zb[disabled] {
      opacity: 0.4;
      pointer-events: none;
    }
    .projection-toggle {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
      padding: var(--sp-3);
    }
    .header-action {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
      padding: var(--sp-3);
    }
    /* docs/CANVAS.md §5: the plane has no edges, so you can pan until nothing
       is on screen. One pointer home, one click back. */
    .homearrow {
      position: absolute;
      z-index: 12;
      transform: translate(-50%, -50%);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      background: var(--card-background-color, var(--hp-bg));
      color: var(--hp-accent);
      border: 1px solid var(--hp-accent);
      opacity: 0.9;
      padding: 0;
    }
    .homearrow ha-icon {
      --mdc-icon-size: 22px;
      line-height: 1;
    }
    .zoombadge {
      position: absolute;
      z-index: 12;
      left: var(--sp-4);
      bottom: var(--sp-4);
      background: var(--card-background-color, var(--hp-bg));
      opacity: 0.92;
      color: var(--hp-txt);
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-m);
      padding: var(--sp-1) var(--sp-4);
      font-size: var(--fs-s);
      font-weight: 600;
      pointer-events: none;
    }
    /* Only the plan canvas owns the whole zoom wrapper. Context trays now live
       inside .stage as well, and may contain small SVG previews (furniture in
       particular); the old descendant-wide stage-SVG selector stretched every
       preview over the tray and stacked them into one blocking artefact. The
       vacuum trail/fit overlays have their own explicit geometry below. */
    .zoomwrap > svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    .plan-svg { z-index: 1; }
    .iso-underlay-svg { z-index: 0; overflow: visible; }
    .iso-shadows-svg { z-index: 3; overflow: visible; }
    .iso-walls-svg {
      z-index: 4;
      overflow: visible;
    }
    .iso-underlay-svg,
    .iso-shadows-svg,
    .iso-walls-svg,
    .iso-underlay,
    .iso-shadows,
    .iso-walls,
    .iso-openings {
      pointer-events: none;
    }
    .iso-side-hi { stop-color: #b9bdbe; }
    .iso-side-lo { stop-color: #969c9f; }
    .iso-top-hi { stop-color: #fafaf7; }
    .iso-top-lo { stop-color: #e2e4e2; }
    .iso-wall-side {
      fill: url(#hp-iso-wall-side) #a8acae;
      stroke: #92989b;
      stroke-width: 0.7;
      vector-effect: non-scaling-stroke;
    }
    .iso-wall-top {
      fill: url(#hp-iso-wall-top) #f3f3f1;
      stroke: #d7d9d8;
      stroke-width: 0.8;
      vector-effect: non-scaling-stroke;
    }
    .iso-floor-side {
      fill: #858b8d;
      stroke: #71787b;
      stroke-width: 0.7;
      vector-effect: non-scaling-stroke;
    }
    .iso-opening-panel {
      fill: #d7d9d7;
      fill-opacity: 0.96;
      stroke: #7f878b;
      stroke-width: 0.9;
      vector-effect: non-scaling-stroke;
    }
    .iso-opening-panel.iso-window {
      fill: #dfeff4;
      fill-opacity: 0.72;
      stroke: #8aa7b1;
    }
    .iso-ambient-shadow {
      fill: rgba(15, 21, 25, 0.22);
      filter: url(#hp-iso-ambient-shadow);
    }
    .iso-contact-shadow {
      fill: none;
      stroke: rgba(22, 28, 31, 0.25);
      stroke-width: 3;
      filter: url(#hp-iso-contact-shadow);
      vector-effect: non-scaling-stroke;
    }
    .iso-leaf-shadow {
      fill: none;
      stroke: rgba(18, 23, 27, 0.24);
      stroke-width: 4;
      filter: url(#hp-iso-leaf-shadow);
      vector-effect: non-scaling-stroke;
    }
    @media (prefers-color-scheme: dark) {
      .iso-side-hi { stop-color: #4c555a; }
      .iso-side-lo { stop-color: #343c40; }
      .iso-top-hi { stop-color: #687176; }
      .iso-top-lo { stop-color: #50585d; }
      .iso-wall-side { stroke: #30373b; }
      .iso-wall-top { stroke: #7b858a; }
      .iso-floor-side { fill: #2d3438; stroke: #20272a; }
      .iso-opening-panel { fill: #626b70; stroke: #899399; }
      .iso-opening-panel.iso-window { fill: #75919b; stroke: #abc6ce; }
      .iso-ambient-shadow { fill: rgba(0, 0, 0, 0.34); }
      .iso-contact-shadow, .iso-leaf-shadow { stroke: rgba(0, 0, 0, 0.38); }
    }
    @media (forced-colors: active) {
      .iso-wall-side, .iso-wall-top, .iso-floor-side, .iso-opening-panel {
        fill: Canvas;
        stroke: CanvasText;
        forced-color-adjust: auto;
      }
      .iso-ambient-shadow, .iso-contact-shadow, .iso-leaf-shadow { display: none; }
    }
    @supports not (filter: blur(1px)) {
      .iso-ambient-shadow, .iso-contact-shadow, .iso-leaf-shadow { display: none; }
    }
    /* Opaque plan paper (owner 2026-08-03): the scene bg_color / daynight sky
       shows ONLY around the plan, never through it. The colour is the
       pre-bg_color canvas — the theme card background under an image plan,
       plain white for a hand-drawn one (.stage.noplan). On drawn plans the
       paper is per-room shapes following the room contours — fill only,
       never a stroke, so the paper cannot poke past a wall. Night dimming
       comes from the .zoomwrap brightness filter, never from alpha
       (docs/SUN.md). */
    .hp-paper {
      fill: var(--ha-card-background, var(--card-background-color, #111));
      stroke: none;
    }
    .stage.noplan .hp-paper,
    .stage.mode-plan .hp-paper,
    .stage.mode-devices .hp-paper,
    .stage.mode-decor .hp-paper {
      fill: #ffffff;
    }
    /* Owner 2026-08-04: «углы границ комнат всё ещё с зубцами». A miter join
       on a 30-45° corner shoots a spike far past the wall (and flips to an
       ugly bevel once past the miter limit) — the same defect the decor lines
       had before they got round caps. Every room border, in EVERY renderer
       that reuses these styles (plan view, plan editor, static space-card),
       joins its walls with a ROUND join instead: the corner reads as the
       stroke's own radius, never as a tooth. The linecap matters only for the
       open outlines below, but it costs nothing to state it here. */
    .room {
      transition: 0.12s;
      cursor: default; /* v1.40.1: rooms are not clickable — the label's link icon is */
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .room.overlay {
      fill: transparent;
      stroke: transparent;
      stroke-width: calc(2px * var(--hp-cell-visual-scale, 1));
    }
    :host([data-pointer-hover]) .stage.mode-view .room.overlay:not(.styled):hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    .room.yard {
      fill: rgba(75, 140, 90, 0.14);
      stroke: #4b8c5a;
      stroke-width: calc(2px * var(--hp-cell-visual-scale, 1));
    }
    :host([data-pointer-hover]) .stage.mode-view .room.yard:not(.styled):hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    .room.styled {
      stroke: var(--room-stroke, transparent);
      stroke-opacity: var(--room-stroke-op, 0);
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      fill: var(--room-fill, transparent);
      fill-opacity: var(--room-fill-op, 0);
    }
    .glow-base-layer,
    .glow-base-tunnels,
    .glow-pools-frame,
    .glow-pools,
    .glow-spot {
      pointer-events: none;
    }
    /* The parent isolates all source spots from the room data fill, Glow base,
       paper and backdrop. A spot is one circle clipped to the floor its lamp
       can see, so the whole spot screen-blends as a single primitive — there is
       no mask left to be dropped on a promoted layer. Per-stop alpha already
       contains the shared 0.7 ceiling; the spot opacity below only animates
       between 0 and 1 and is never another persistent alpha ceiling. */
    .glow-pools-frame,
    .glow-pools,
    .glow-spot {
      isolation: isolate;
    }
    .glow-pools.blend-screen .glow-spot {
      mix-blend-mode: screen;
    }
    .glow-spot {
      opacity: 1;
      transition: opacity 500ms ease;
    }
    .glow-spot.is-entering,
    .glow-spot.is-leaving {
      opacity: 0;
    }
    @media (prefers-reduced-motion: reduce) {
      .glow-spot {
        transition: none;
      }
    }
    /* The explicit late room-hover layer owns the wash and halo. Keeping CSS
       filters off room paths prevents Chromium from recompositing the sibling
       screen-blended Glow layer for one bright frame on every hover. */
    :host([data-pointer-hover]) .stage.mode-view .room.styled:hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    /* doors, windows & gates */
    .op-leaf {
      transition: transform 0.6s ease;
    }
    .op-arc {
      stroke-width: calc(1.5px * var(--hp-cell-visual-scale, 1));
      transition: stroke-dashoffset 0.6s ease;
    }
    /* hover affordance: a rounded outline hugging the wall strip + a grab cursor */
    .op-outline {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: calc(1.5px * var(--hp-cell-visual-scale, 1));
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }
    :host([data-pointer-hover]) .stage.markup g.opening:hover .op-outline {
      opacity: 0.9;
    }
    /* openings are pure status graphics outside Plan mode: no cursor, no hover,
       no hit target — View must not interact with them at all */
    .op-hit {
      fill: transparent;
      pointer-events: none;
      cursor: default;
    }
    .stage.markup .op-hit {
      pointer-events: auto;
      cursor: grab;
      touch-action: none; /* drags, not scrolls, on touch */
    }
    .stage.markup .op-hit:active {
      cursor: grabbing;
    }
    .stage.markup .opening.orphan {
      pointer-events: auto;
      cursor: pointer;
      color: var(--error-color, #db4437);
    }
    .stage.markup .opening.orphan circle {
      fill: var(--hp-bg);
      stroke: currentColor;
      stroke-width: calc(2px * var(--hp-cell-visual-scale, 1));
    }
    .stage.markup .opening.orphan text {
      fill: currentColor;
      font-weight: 800;
      font-size: calc(12px * var(--hp-cell-visual-scale, 1));
      pointer-events: none;
    }
    /* HP-1550-04: in the resize tool the wall handles own the hit test — the
       transparent .op-hit of a door at the midpoint of a wall used to sit ON
       TOP of the handle and made that wall ungrabbable for both rooms.
       Openings are not editable in this tool (they ride along with the wall),
       so their hit area goes fully inert; every other Plan tool is untouched. */
    .stage.markup.tool-resize .op-hit {
      pointer-events: none;
      cursor: default;
    }
    .stage.mode-view .oplock {
      pointer-events: auto;
      cursor: pointer;
    }
    @media (prefers-reduced-motion: reduce) {
      .op-leaf, .op-arc { transition: none; }
    }
    .roomlabel {
      pointer-events: none; /* draggable only in plan mode (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      font-size: calc(var(--rl-icon-size, var(--icon-size, 2.5cqw)) * 0.5 * var(--rl-scale, 1) * var(--rl-font, 1) * var(--rl-space, 1));
      font-weight: 700;
      letter-spacing: 0.04em;
      white-space: nowrap;
      cursor: grab;
      user-select: none;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15em;
      text-align: center;
    }
    .rlname {
      display: inline-flex;
      align-items: center;
      gap: 0.25em;
      font-size: calc(1em * var(--rl-name, 1));
    }
    .zoomwrap.slide-left  { animation: hp-slide-left 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    .zoomwrap.slide-right { animation: hp-slide-right 0.18s cubic-bezier(0.2, 0.7, 0.2, 1); }
    @media (prefers-reduced-motion: reduce) {
      .zoomwrap.slide-left,
      .zoomwrap.slide-right { animation: none; }
    }
    /* The name is the anchor: the label box is centred on the room point, so
       anything that takes part in its layout SHIFTS THE NAME. The gear button
       and the metrics hang below as absolutes — the name renders in exactly
       the same place in view mode and in the plan editor (owner's request),
       and the button sits at the very bottom of the card. */
    /* Standalone, centred on the room, sized from the device icon: icon-size
       already rescales with the view, so the button zooms WITH the plan
       instead of keeping a constant screen size (owner's spec). */
    .rlgearbtn {
      --gear-h: calc(var(--icon-size, 2.5cqw) * 0.77); /* owner: half the previous size */
      position: absolute;
      /* dead-centred on the room, both axes (owner's spec) */
      transform: translate(-50%, -50%);
      display: inline-flex;
      align-items: center;
      gap: 0.35em;
      height: var(--gear-h);
      padding: 0 calc(var(--gear-h) * 0.38);
      border: 0;
      border-radius: 999px;
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      font: inherit;
      font-size: calc(var(--gear-h) * 0.42);
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      cursor: pointer;
      pointer-events: auto;
      opacity: 0.92;
      box-shadow: var(--shadow-1);
      z-index: 2;
    }
    .rlgearbtn { transition: opacity 0.15s, filter 0.15s; }
    :host([data-pointer-hover]) .rlgearbtn:hover { opacity: 1; filter: brightness(1.18); }
    .rlgearbtn ha-icon { --mdc-icon-size: calc(var(--gear-h) * 0.55); display: inline-flex; }
    .rlgear {
      --mdc-icon-size: 0.9em;
      display: inline-flex;
      margin-right: 0.2em;
      opacity: 0.6;
      cursor: pointer;
      pointer-events: auto;
    }
    :host([data-pointer-hover]) .rlgear:hover { opacity: 1; }
    .rlgo {
      --mdc-icon-size: 0.85em;
      display: inline-flex;
      opacity: 0.55;
    }
    .stage.mode-view .rlgo {
      pointer-events: auto;
      cursor: pointer;
    }
    :host([data-pointer-hover]) .stage.mode-view .rlgo:hover { opacity: 1; }
    .roomlabel .rlmetrics {
      position: absolute; /* below the name, outside the centring math */
      top: calc(100% + 0.15em);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 0.55em;
      font-size: calc(0.75em * var(--rl-meta, 1)); /* feedback: 0.62 was unreadable on a tablet */
      font-weight: 600;
      letter-spacing: 0.02em;
      opacity: 0.9;
    }
    .roomlabel .rlm {
      display: inline-flex;
      align-items: center;
      gap: 0.12em;
    }
    .roomlabel .rlm ha-icon {
      --mdc-icon-size: 1.05em;
      display: inline-flex;
    }
    .roomlabel .rlm.lit { opacity: 1; }
    .rlhandle {
      display: none;
      position: absolute;
      width: 9px;
      height: 9px;
      border-radius: 2px;
      background: var(--hp-accent);
      border: 1px solid var(--card-background-color, #fff);
      z-index: 2;
    }
    .rlhandle.tl { left: -6px; top: -6px; cursor: nwse-resize; }
    .rlhandle.br { right: -6px; bottom: -6px; cursor: nwse-resize; }
    .rlhandle.tr { right: -6px; top: -6px; cursor: nesw-resize; }
    .rlhandle.bl { left: -6px; bottom: -6px; cursor: nesw-resize; }
    :host([data-pointer-hover]) .stage.markup .roomlabel:hover .rlhandle { display: block; }
    .stage.markup .roomlabel { pointer-events: auto; }
    .roomlabel:active { cursor: grabbing; }
    .measurelayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .alignline {
      stroke: var(--hp-accent);
      stroke-width: calc(1.2px * var(--hp-cell-visual-scale, 1));
      stroke-dasharray:
        calc(4px * var(--hp-cell-visual-scale, 1))
        calc(4px * var(--hp-cell-visual-scale, 1));
      pointer-events: none;
      opacity: 0.9;
    }
    .aligndot {
      fill: var(--hp-accent);
      pointer-events: none;
    }
    .measurelabel.on45 {
      color: #4bd28f;
      border-color: #4bd28f;
    }
    .measurelabel {
      position: absolute;
      transform: translate(12px, -150%);
      font-size: var(--fs-s);
      font-weight: 600;
      padding: 1px var(--sp-3);
      border-radius: var(--rad-s);
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      z-index: 3;
    }
    .measurelabel.opdimension {
      transform: translate(
        calc(-50% + var(--op-label-shift-x, 0px)),
        calc(-50% + var(--op-label-shift-y, -12px))
      );
      border: 1px solid var(--hp-open, #ff9800);
    }
    /* decor (background) layer */
    .decorlayer .dshape { pointer-events: none; }
    .stage.mode-decor .decorlayer .dshape {
      pointer-events: visiblePainted;
      cursor: pointer;
    }
    .stage.mode-decor.dtool-select .decorlayer .dshape { cursor: move; }
    /* …but a DRAWING tool owns the canvas: existing shapes stop being targets
       entirely, so a new line can start exactly on the end of an old one
       instead of grabbing it (owner, 2026-08-04). Same for the picture tool —
       a shape lying over the plan must not block the picture's own drag.
       Only select (move) and erase (delete) keep the shapes clickable. */
    .stage.mode-decor.dtool-line .decorlayer .dshape,
    .stage.mode-decor.dtool-rect .decorlayer .dshape,
    .stage.mode-decor.dtool-ellipse .decorlayer .dshape,
    .stage.mode-decor.dtool-text .decorlayer .dshape,
    .stage.mode-decor.dtool-furniture .decorlayer .dshape,
    .stage.mode-decor.dtool-image .decorlayer .dshape,
    .stage.mode-decor.dtool-backdrop .decorlayer .dshape { pointer-events: none; }
    /* the furniture tool is a stamp: the press must reach the stage even when
       it lands on a sofa that is already there (docs/FURNITURE.md §4) */
    .stage.mode-decor.dtool-furniture,
    .stage.mode-decor.dtool-image { cursor: copy; }
    .stage.mode-decor.dtool-select .decorlayer .dimage,
    .stage.mode-decor.dtool-erase .decorlayer .dimage,
    .stage.mode-decor.dtool-select .decorlayer .dimage-missing,
    .stage.mode-decor.dtool-erase .decorlayer .dimage-missing {
      pointer-events: bounding-box;
    }
    .decorlayer .dimage-missing rect {
      fill: rgba(127, 127, 127, 0.12);
      stroke: var(--hp-accent);
      stroke-dasharray: 8 5;
      vector-effect: non-scaling-stroke;
    }
    .decorlayer .dimage-missing path {
      fill: none;
      stroke: var(--hp-accent);
      vector-effect: non-scaling-stroke;
    }
    .decorlayer .decor-image-placement-preview { opacity: 0.65; }
    /* ONE exception (owner, 2026-08-04): under the TEXT tool an existing LABEL
       is a target again — pressing it opens its editor instead of starting a
       new label on top of the old one. Only labels: a line or a rectangle
       under the text tool stays inert, so the press reaches the stage and a
       new label is created there. */
    .stage.mode-decor.dtool-text .decorlayer .dshape.dtext,
    .stage.mode-decor.dtool-select .decorlayer .dshape.dtext,
    .stage.mode-decor.dtool-erase .decorlayer .dshape.dtext {
      /* A label is one logical decor object. SVG's visiblePainted would hit
         only the ink of individual glyphs, so spaces, counters and the area
         inside its selection glow behaved like empty canvas. */
      pointer-events: visiblePainted;
      pointer-events: bounding-box;
    }
    .stage.mode-decor.dtool-text .decorlayer .dshape.dtext {
      cursor: text;
    }
    /* Erasing a hairline must not require pixel-perfect aim. The duplicate
       geometry is invisible and exists only while Erase is active. A
       non-scaling stroke keeps the target comfortably wide at every zoom. */
    .decorlayer .derasehit {
      fill: none;
      stroke: transparent;
      stroke-width: 16px;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .stage.mode-decor.dtool-erase .decorlayer .derasehit {
      pointer-events: stroke;
    }
    /* A dashed line must remain selectable across its gaps. This proxy also
       makes the only entry to line-style properties — double click in Select —
       practical for hairlines at every zoom. */
    .decorlayer .dselecthit {
      fill: none;
      stroke: transparent;
      stroke-width: 16px;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .stage.mode-decor.dtool-select .decorlayer .dselecthit {
      pointer-events: stroke;
      cursor: move;
    }
    /* #383: furniture keeps a path-shaped target. Its per-object physical
       width is supplied by the renderer; no empty bounding-box area is hit. */
    .stage.mode-decor .decorlayer .dshape.dfurniturehit {
      fill: none;
      stroke: transparent;
      pointer-events: none;
    }
    .stage.mode-decor.dtool-select .decorlayer .dshape.dfurniturehit {
      pointer-events: stroke;
      cursor: move;
    }
    .decorlayer .dsel {
      filter: drop-shadow(0 0 3px var(--hp-accent));
    }
    .decorlayer .ddraft {
      stroke-dasharray:
        calc(6px * var(--hp-cell-visual-scale, 1))
        calc(5px * var(--hp-cell-visual-scale, 1));
      pointer-events: none;
    }
    .decorlayer .furniture-placement-preview {
      opacity: 0.55;
      pointer-events: none;
    }
    .decorlayer text {
      font-weight: 600;
      user-select: none;
      dominant-baseline: middle;
      text-anchor: middle;
    }
    .stage.mode-decor {
      outline: 2px solid #26a69a;
      outline-offset: -2px;
    }
    /* backdrop transform frame (docs/BACKDROP.md §2). Editor chrome: the
       outline never takes a pointer, the four corner handles do — and they are
       finger-sized (r = 2 % of the visible view), because this is dragged on a
       tablet as often as with a mouse. */
    .bdframe .bdbox {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 2;
      stroke-dasharray: 10 7;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      opacity: 0.9;
    }
    /* the HIT circle: invisible, finger-sized, the only thing that takes a
       pointer. The visible bead is .bdknob, a quarter of its radius — the same
       visual/hit split .dthandle + .dtknob and .rszhandle + .rszicon use. */
    .bdframe .bdhandle {
      fill: transparent;
      stroke: none;
      pointer-events: all;
      touch-action: none;
    }
    .bdframe .bdknob {
      fill: var(--hp-accent);
      stroke: #fff;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    :host([data-pointer-hover]) .bdframe .bdhandle:hover + .bdknob {
      fill: #fff;
      stroke: var(--hp-accent);
    }
    .bdframe .bd-nwse { cursor: nwse-resize; }
    .bdframe .bd-nesw { cursor: nesw-resize; }
    /* the picture itself is the drag target for a move (grab, then grabbing) */
    .stage.mode-decor.bdgrab { cursor: grab; }
    .stage.mode-decor.bdgrabbing,
    .stage.mode-decor.bdgrabbing .bdframe .bdhandle { cursor: grabbing; }
    .measurelabel.bdmeasure {
      transform: translate(-50%, -50%);
      border: 1px solid var(--hp-accent);
    }
    /* the selected decor object's frame — same chrome rules as the backdrop's:
       the outline never takes a pointer, the handles always do, and they are
       finger-sized because this is dragged on a tablet too */
    .dtframe .dtbox {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      stroke-dasharray: 7 5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      opacity: 0.85;
    }
    .dtframe .dtstem,
    .bdframe .dtstem {
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      opacity: 0.85;
    }
    /* the HIT circle: invisible, finger-sized, the only thing that takes a
       pointer. The visible bead is .dtknob, a quarter of its radius — the
       same visual/hit split .rszhandle + .rszicon use. */
    .dtframe .dthandle {
      fill: transparent;
      stroke: none;
      pointer-events: all;
      touch-action: none;
    }
    .dtframe .dtknob {
      fill: var(--hp-accent);
      stroke: #fff;
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    :host([data-pointer-hover]) .dtframe .dthandle:hover + .dtknob {
      fill: #fff;
      stroke: var(--hp-accent);
    }
    .dtframe .dt-nwse { cursor: nwse-resize; }
    .dtframe .dt-nesw { cursor: nesw-resize; }
    .dtframe .dtrot { cursor: grab; }
    .dtframe .dt-ew { cursor: ew-resize; }
    .dtframe .dt-ns { cursor: ns-resize; }
    .dtfurnitureframe .dtrot {
      cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M18.4 7.2A8 8 0 1 0 20 12' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='m15.5 3.8 3.2 3.5-4.6.8' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, grab;
    }
    .dtfurnitureframe .dtrot:active { cursor: grabbing; }
    .dtframe .dtendpoint { cursor: crosshair; }
    .bdframe .dtrot { cursor: grab; }
    .dtarea {
      resize: vertical;
      min-height: 3.4em;
      font: inherit;
      line-height: 1.35;
    }
    .stage.mode-decor.dtool-line, .stage.mode-decor.dtool-rect,
    .stage.mode-decor.dtool-ellipse, .stage.mode-decor.dtool-text {
      cursor: crosshair;
    }
    .stage.mode-decor.dtool-erase,
    .stage.mode-decor.dtool-erase .decorlayer .dshape {
      cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg transform='rotate(-45 12 12)'%3E%3Crect x='7' y='2' width='10' height='18' rx='2' fill='%23fff' stroke='%23111' stroke-width='1.5'/%3E%3Cpath d='M7 13h10v5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z' fill='%23ff9f43' stroke='%23111' stroke-width='1.5'/%3E%3C/g%3E%3C/svg%3E") 5 22, pointer;
    }
    .stage.mode-decor .room { pointer-events: none; }
    /* Devices are landmarks in Background, never editing targets. The marker
       package deliberately re-enables pointer events on the core, its 44 px
       pseudo hit area and the visible capsule for View/Devices. A none on
       devlayer alone therefore does not make its HTML descendants inert.
       Scope the boundary to the whole subtree (including the pseudo element)
       so a Background tool receives the exact point below every visible part. */
    .stage.mode-decor .devlayer,
    .stage.mode-decor .devlayer *,
    .stage.mode-decor .dev::before {
      pointer-events: none;
    }
    /* Backdrop-editor de-emphasis is a shared mode-transition coordinate.
       It multiplies whole presentation groups and never changes Glow source
       alpha, additive blending, or the underlying resolved state. */
    .stage .room,
    .stage .devlayer,
    .stage .opening,
    .stage .room-outline,
    .stage .wallbodies,
    .stage .opening-tunnels,
    .stage .glow-base-layer,
    .stage .glow-pools-frame,
    .stage .zero-walls {
      opacity: var(--hp-mode-architecture-opacity, 1);
    }
    .opening-preview {
      opacity: 0.5;
      pointer-events: none;
    }
    .opening-preview[data-kind="passage"] {
      opacity: 1;
    }
    .passage-preview-cut {
      fill: var(--wall-fill, #ffffff);
      fill-opacity: 0.35;
      stroke: none;
      pointer-events: none;
    }
    .passage-preview-boundary {
      stroke: var(--hp-open, #ff9800);
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      pointer-events: none;
    }
    .opening-preview .op-leaf,
    .opening-preview .op-arc {
      transition: none;
    }
    .opening-preview-dot {
      fill: var(--hp-open, #ff9800);
      pointer-events: none;
    }
    .opening-dimensions,
    .opening-dimension {
      pointer-events: none;
    }
    .opening-dimension-line,
    .opening-dimension-tick {
      fill: none;
      stroke: var(--hp-open, #ff9800);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .opening-dimension-tick {
      stroke-width: 2;
    }
    .stage.edit .room {
      pointer-events: none;
    }
    .stage.markup {
      cursor: crosshair;
    }
    /* room-picking stages: merge (both clicks) and split before a room is chosen */
    .stage.markup.tool-merge,
    .stage.markup.tool-split.pickstage,
    .stage.markup.tool-delroom {
      cursor: pointer;
    }
    .stage.markup.tool-wallthick { cursor: default; }
    .stage.markup.tool-wallthick.wallhot { cursor: pointer; }
    /* Solid wall colour sits under the hatch (owner: both, not either/or). */
    .wallbody-fill {
      fill: var(--wall-fill, #ffffff);
      fill-opacity: var(--wall-fill-op, 1);
      fill-rule: evenodd;
      stroke: none;
      pointer-events: none;
    }
    .wallbody {
      fill: url(#hp-wall-hatch);
      fill-rule: evenodd;
      stroke: var(--room-stroke, var(--hp-muted));
      stroke-width: calc(0.6px * var(--hp-cell-visual-scale, 1));
      pointer-events: none;
    }
    /* Thin-on-screen: hatch collapses into noise — fill alone, stroke from fill path's sibling. */
    .wallbody.solid {
      fill: none;
    }
    .wallthick-hover {
      fill: var(--accent-color, #03a9f4);
      fill-opacity: 0.38;
      stroke: var(--accent-color, #03a9f4);
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    .wallthick-hover.isopen {
      fill: var(--error-color, #f44336);
      stroke: var(--error-color, #f44336);
    }
    .zero-wall {
      stroke: var(--zero-wall-stroke, var(--hp-muted));
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      stroke-dasharray:
        calc(7px * var(--hp-cell-visual-scale, 1))
        calc(7px * var(--hp-cell-visual-scale, 1));
      stroke-linecap: butt;
      pointer-events: none;
      opacity: 0.9;
    }
    .zero-walls.solid .zero-wall {
      stroke-dasharray: none;
    }
    /* Rooms with zero/thick stretches: the polygon's own stroke is fully off.
       The trimmed .room-outline draws normal walls; View hover gets its own
       top overlay after the wall bodies. */
    .room.noedge {
      stroke-opacity: 0 !important;
    }
    /* rooms with open boundaries draw their walls as separate M..L subpaths,
       so a corner between two of them is two stroke ENDS meeting: round caps
       fill it in the same way a round join fills a closed contour's corner
       (owner 2026-08-04 — no teeth anywhere on a room border). */
    .room-outline {
      fill: none;
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    /* Plan editor: trimmed outlines use the markup blue */
    .room-outline.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      stroke-opacity: 1;
    }
    /* The wash is rendered directly above the resolved room fill but below
       tunnels, Glow, sun and walls. Black at 22% reproduces the old
       brightness(.78) contract without filtering/promoting an SVG ancestor or
       changing the room's hue. The halo/outline are rendered again late, above
       the wall bodies. */
    .room-hover-fill {
      fill: #000;
      fill-opacity: 0.22;
      pointer-events: none;
    }
    .room-hover-halo {
      fill: none;
      stroke: var(--hp-accent);
      stroke-opacity: 0.28;
      stroke-width: calc(8px * var(--hp-cell-visual-scale, 1));
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    .room-hover-outline {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: calc(3px * var(--hp-cell-visual-scale, 1));
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    .stage.markup .room {
      pointer-events: none;
    }
    .stage.markup .devlayer .dev {
      display: none; /* in plan mode the icons do not get in the way; labels stay */
    }
    /* mode frames: the edit modes are visible at a glance */
    .stage.mode-plan {
      outline: 2px solid #ffc14d;
      outline-offset: -2px;
    }
    .stage.mode-devices {
      outline: 2px solid var(--hp-accent);
      outline-offset: -2px;
    }
    .room.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      fill: rgba(62, 166, 255, 0.06);
    }
    /* AFTER .outlined: same specificity — source order decides (gotcha x4) */
    .room.picked {
      stroke: #ffc14d;
      stroke-width: calc(3px * var(--hp-cell-visual-scale, 1));
      fill: rgba(255, 193, 77, 0.25);
    }
    /* Owner 2026-08-04: the grid is a HINT, not content — at full strength the
       dots argued with the plan on white paper. Both levels are muted, the
       hierarchy is kept (major still denser than fine). */
    .griddot {
      fill: var(--hp-accent);
      opacity: 0.35;
      stroke: rgba(0, 0, 0, 0.35);
      stroke-width: 0.4;
    }
    /* docs/CANVAS.md §7: every coarse node (5x/10x the live step) keeps a
       bigger, more opaque dot, so zoomed far out the grid still reads as a
       grid instead of a grey wash. */
    .griddot.major {
      opacity: 0.5;
      stroke-width: 0;
    }
    /* the contour being drawn in the Plan editor: each wall is its own <line>,
       so the round cap IS the corner (matches the finished .room border) */
    .seg {
      stroke: var(--hp-accent);
      stroke-width: calc(2.5px * var(--hp-cell-visual-scale, 1));
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pathline {
      stroke: #ffc14d;
      stroke-width: calc(3px * var(--hp-cell-visual-scale, 1));
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .preview {
      stroke: #ffc14d;
      stroke-width: calc(2px * var(--hp-cell-visual-scale, 1));
      stroke-dasharray:
        calc(6px * var(--hp-cell-visual-scale, 1))
        calc(5px * var(--hp-cell-visual-scale, 1));
      opacity: 0.7;
    }
    .active-axis {
      stroke: #ffc14d;
      stroke-width: 2;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .active-vertex {
      fill: #ffc14d;
      stroke: #171006;
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .wall-repair-preview {
      stroke: #d93025;
      stroke-width: 4;
      stroke-linecap: round;
      stroke-dasharray: 5 4;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .drawwall-preview-fill {
      fill: var(--wall-fill, #ffffff);
      fill-opacity: calc(var(--wall-fill-op, 1) * 0.55);
      fill-rule: evenodd;
      stroke: none;
      pointer-events: none;
    }
    .drawwall-preview {
      fill: url(#hp-wall-hatch);
      fill-opacity: 0.55;
      fill-rule: evenodd;
      stroke: var(--accent-color, #03a9f4);
      stroke-width: calc(0.5px * var(--hp-cell-visual-scale, 1));
      stroke-opacity: 0.7;
      pointer-events: none;
    }
    .drawwall-zero-preview {
      fill: none;
      stroke: var(--accent-color, #03a9f4);
      stroke-width: calc(3px * var(--hp-cell-visual-scale, 1));
      stroke-linecap: butt;
      stroke-linejoin: round;
      opacity: 0.72;
      pointer-events: none;
    }
    .drawwall-zero-preview.dashed {
      stroke-dasharray:
        calc(7px * var(--hp-cell-visual-scale, 1))
        calc(7px * var(--hp-cell-visual-scale, 1));
    }
    .vertex {
      fill: #ffc14d;
      stroke: #4a2800;
      stroke-width: calc(1px * var(--hp-cell-visual-scale, 1));
    }
    .vertex.first {
      fill: #4bd28f;
      stroke: #04121f;
    }
    .plan-snap-overlay,
    .plan-snap-overlay *,
    .hidden-wall-diagnostic,
    .hidden-wall-diagnostic * {
      pointer-events: none;
    }
    .plan-snap-line,
    .hidden-wall-line {
      fill: none;
      stroke: color-mix(in srgb, var(--hp-accent) 82%, white 18%);
      /* Explicit non-scaling-stroke in the SVG keeps this one screen pixel. */
      stroke-width: 1;
      stroke-linecap: round;
      opacity: 0.92;
    }
    .plan-snap-node,
    .hidden-wall-node {
      fill: var(--ha-card-background, var(--card-background-color, #fff));
      stroke: color-mix(in srgb, var(--hp-accent) 88%, #07131c 12%);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    .plan-snap-node.active {
      fill: #ffc14d;
      stroke: #171006;
      stroke-width: 2;
    }
    .plan-snap-node.active.dynamic {
      fill: #4bd28f;
      stroke: #04121f;
    }
    .plan-snap-node.conflict {
      fill: #fff;
      stroke: #d93025;
      stroke-width: 3;
    }
    @media (prefers-color-scheme: dark) {
      .plan-snap-line {
        stroke: color-mix(in srgb, var(--hp-accent) 72%, white 28%);
      }
      .hidden-wall-line {
        stroke: color-mix(in srgb, var(--hp-accent) 72%, white 28%);
      }
      .plan-snap-node,
      .hidden-wall-node {
        fill: #17242c;
        stroke: #9bdcf5;
      }
      .plan-snap-node.active {
        fill: #ffc14d;
        stroke: #fff4d6;
      }
      .plan-snap-node.active.dynamic {
        fill: #4bd28f;
        stroke: #eafff4;
      }
    }
    @media (forced-colors: active) {
      .plan-snap-line,
      .hidden-wall-line {
        stroke: CanvasText;
        opacity: 1;
        forced-color-adjust: auto;
      }
      .plan-snap-node,
      .hidden-wall-node {
        fill: Canvas;
        stroke: CanvasText;
        forced-color-adjust: auto;
      }
      .plan-snap-node.active,
      .plan-snap-node.active.dynamic {
        fill: Highlight;
        stroke: HighlightText;
        forced-color-adjust: auto;
      }
    }
    /* RGB lights: the bulb takes the light's actual color */
    /* v1.52.0: the RGB tint of the icon/border is gone — a lamp's colour
       lives ONLY in its glow spot (owner's rule). The ripple-color fallback
       keeps using the light colour; that is set inline via --ripple-color. */
    /* Sun wedges (docs/SUN.md). The layer is present ONLY above the 3°
       threshold; crossing it fades the whole layer in or out over EXACTLY
       2 s (owner 2026-08-03 — RAY_FADE_MS in src/sun.ts must match). The
       geometry is untouched: this is a plain opacity animation on the group,
       so overlapping wedges keep their own blending while it plays. */
    .sunlayer {
      animation: hp-sunfade-in 2s linear both;
    }
    .sunlayer.out {
      animation: hp-sunfade-out 2s linear both;
    }
    @media (prefers-reduced-motion: reduce) {
      /* no fade at all: the rays are simply there or simply gone */
      .sunlayer, .sunlayer.out { animation: none; }
      .sunlayer.out { opacity: 0; }
    }
    .devlayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 6;
    }
    .stage.mode-devices .dev { cursor: grab; }
    .stage.mode-devices .dev:active { cursor: grabbing; }
    .physical-hit {
      fill: transparent;
      stroke: transparent;
      pointer-events: none;
      cursor: grab;
    }
    .stage.tool-select .physical-hit { pointer-events: all; }
    .physical-hit:active { cursor: grabbing; }
    line.physical-hit { cursor: pointer; }
    .physical-hit.selected {
      fill: rgba(255, 193, 77, 0.24);
      stroke: transparent;
    }
    line.physical-hit.selected {
      stroke: transparent;
    }
    .physical-drag {
      fill: rgba(255, 193, 77, 0.38);
      stroke: #ffc14d;
      stroke-width: 2.5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .physical-chrome { pointer-events: none; }
    .physical-chrome .frame,
    .physical-chrome .stem {
      fill: none;
      stroke: #ffc14d;
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }
    .physical-chrome .frame { fill: rgba(255, 193, 77, 0.22); }
    .physical-chrome polyline.frame { fill: none; }
    .physical-chrome .move-dot {
      fill: #ffc14d;
      stroke: #24262d;
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }
    .physical-chrome .rotate-handle {
      fill: #24262d;
      stroke: #ffc14d;
      stroke-width: 2.5;
      vector-effect: non-scaling-stroke;
      pointer-events: all;
      cursor: crosshair;
    }
    .drawwall.invalid input { border-color: var(--error-color, #db4437); }
    .drawwall .rangehint { margin-inline-start: 4px; font-size: 0.78em; opacity: 0.72; }
    .drawwall.invalid .rangehint { color: var(--error-color, #db4437); opacity: 1; }
    .stage.markup.tool-partition,
    .stage.markup.tool-column { cursor: crosshair; }
    /* room resize tool (docs/RESIZE.md) */
    /* wall handle: invisible finger-sized hit circle (HP-1550-04 hit priority
       kept), the visible glyph lives in the sibling .rszicon */
    .rszhandle {
      fill: transparent;
      stroke: none;
      pointer-events: all;
      cursor: grab;
      touch-action: none;
    }
    .rszhandle:active { cursor: grabbing; }
    .rszhandle.disabled,
    .rszhandle.disabled:active {
      cursor: not-allowed;
    }
    /* wall-with-arrows glyph: accent ink over a bg halo, readable on any plan */
    .rszicon { pointer-events: none; }
    .rszicon path {
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
    .rszhalo { stroke: var(--hp-bg); stroke-width: 6; }
    .rszink { stroke: var(--hp-accent); stroke-width: 2; }
    :host([data-pointer-hover]) .rszhandle:hover + .rszicon .rszink { stroke-width: 3; }
    .rszicon.disabled { opacity: 0.38; }
    :host([data-pointer-hover]) .rszhandle.disabled:hover + .rszicon .rszink { stroke-width: 2; }
    .rszmeasurelayer,
    .rszmeasurelayer * { pointer-events: none; }
    .rszmeasurehalo,
    .rszmeasureink,
    .rszleader {
      fill: none;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    .rszmeasurehalo {
      stroke: var(--hp-bg);
      stroke-width: 7px;
      opacity: 0.9;
    }
    .rszmeasureink {
      stroke: var(--hp-accent);
      stroke-width: 3px;
    }
    .rszleader {
      stroke: var(--hp-accent);
      stroke-width: 2px;
      opacity: 0.95;
    }
    /* the decor draft badge rides the MIDDLE of the shape, so it is centred
       horizontally and lifted clear of the line instead of trailing the
       cursor the way a wall badge does (owner 2026-08-04) */
    .measurelabel.dmeasure {
      transform: translate(-50%, -160%);
    }
    .measurelabel.rszarea {
      transform: translate(
        calc(-50% + var(--rsz-label-x, 0px)),
        calc(-50% + var(--rsz-label-y, 0px))
      );
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid var(--hp-accent);
    }
    /* width and depth of a piece of furniture while its corner is dragged —
       centred on the edge they measure (docs/FURNITURE.md §6) */
    .measurelabel.furnmeasure {
      transform: translate(-50%, -50%);
      border: 1px solid var(--hp-accent);
    }
    .alignmsg { margin: 0 0 8px; font-size: 13px; line-height: 1.45; }
`;
