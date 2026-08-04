/** Styles of the House Plan card (extracted from the component). */
import { css } from 'lit';

export const cardStyles = css`
    :host {
      --hp-bg: var(--card-background-color, #16212e);
      --hp-line: var(--divider-color, #2b3d4f);
      --hp-txt: var(--primary-text-color, #e6edf3);
      --hp-muted: var(--secondary-text-color, #8aa0b3);
      --hp-accent: var(--primary-color, #3ea6ff);
      --hp-on: #ffd45c;
      --hp-open: #ff9f43;
      /* design tokens (UI chrome only). The icon/plan scale math stays on
         --icon-size/--dev-size cqw units and never uses these. */
      /* spacing scale, fact-based; stray 3/5/7/9/13/14px values are unified
         onto the nearest step (max +-2px, the whole point of the pass) */
      --sp-1: 2px;
      --sp-2: 4px;
      --sp-3: 6px;
      --sp-4: 8px;
      --sp-5: 12px;
      --sp-6: 16px;
      /* px radii of dialogs/buttons/plates (the 22% badge radius is scale math) */
      --rad-s: 6px;
      --rad-m: 8px;
      --rad-l: 12px;
      /* font tiers: fine print+labels / body+buttons / title */
      --fs-s: 12px;
      --fs-m: 13px;
      --fs-l: 15px;
      /* elevation: badge / floating panel (menu, tip, toast) / dialog */
      --shadow-1: 0 1px 3px rgba(0, 0, 0, 0.45);
      --shadow-2: 0 6px 22px rgba(0, 0, 0, 0.45);
      --shadow-3: 0 8px 30px rgba(0, 0, 0, 0.5);
    }
    ha-card {
      overflow: visible; /* overflow:hidden breaks position:sticky on the header */
    }
    .empty {
      padding: 40px 24px;
      color: var(--hp-txt);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-4);
    }
    .empty .big {
      --mdc-icon-size: 56px;
      color: var(--hp-accent);
      opacity: 0.7;
    }
    .empty .muted {
      color: var(--hp-muted);
      font-size: var(--fs-m);
      margin: 0;
    }
    .empty .btn {
      margin-top: var(--sp-4);
    }
    .hdr {
      position: sticky;
      top: var(--header-height, 56px);
      z-index: 20;
      background: var(--card-background-color, var(--hp-bg));
      border-radius: var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px var(--sp-5);
      border-bottom: 1px solid var(--hp-line);
      flex-wrap: wrap;
    }
    .title {
      font-size: var(--fs-l);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      white-space: nowrap;
    }
    .title ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 18px;
    }
    .tabs {
      display: flex;
      gap: var(--sp-2);
      background: rgba(127, 127, 127, 0.12);
      padding: var(--sp-2);
      border-radius: var(--rad-l);
      flex-wrap: wrap;
    }
    @media (max-width: 620px) {
      .head { gap: var(--sp-3); padding: var(--sp-4) 10px; }
      .head .count { display: none; }
      .head .title { font-size: var(--fs-m); }
    }
    .tab {
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      display: inline-flex;
      align-items: center;
      padding: var(--sp-3) var(--sp-5);
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      font-weight: 600;
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
    }
    .tab:hover {
      color: var(--hp-txt);
    }
    .tab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .count {
      font-size: var(--fs-s);
      color: var(--hp-muted);
    }
    .spacer {
      flex: 1;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      padding: var(--sp-3) 10px;
      border-radius: var(--rad-m);
      cursor: pointer;
      transition: 0.15s;
      font-family: inherit;
      font-size: var(--fs-m);
    }
    .btn ha-icon {
      --mdc-icon-size: 17px;
    }
    .btn:hover {
      border-color: var(--hp-accent);
    }
    .btn.on {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      border-color: var(--hp-accent);
    }
    .btn.ghost {
      border: none;
    }
    .btn[disabled] {
      opacity: 0.5;
      pointer-events: none;
    }
    .stage.noplan {
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
    }
    /* Sun on the plan (docs/SUN.md): the stage breathes with the day over tens
       of seconds; the plan itself dims at most ~10%. Reduced motion = static. */
    .stage.daynight {
      transition: background-color 45s linear;
    }
    .stage.daynight .zoomwrap {
      transition: filter 45s linear;
    }
    .stage.daynight.hpsettle {
      transition: height 0.25s ease, background-color 45s linear;
    }
    /* Catch-up frame (docs/SUN.md): the sky is out of date because the card
       was not painting — show the truth at once, the glide comes back on the
       very next frame. */
    .stage.daynight.skysnap,
    .stage.daynight.skysnap .zoomwrap,
    .stage.daynight.skysnap.hpsettle {
      transition: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .stage.daynight,
      .stage.daynight .zoomwrap,
      .stage.daynight.hpsettle {
        transition: none;
      }
    }
    .sunlayer {
      pointer-events: none;
    }
    /* the compass dial in the general settings (docs/SUN.md) */
    .sunrow {
      display: flex;
      align-items: center;
      gap: var(--sp-5);
      margin: var(--sp-3) 0;
    }
    .suncol {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      min-width: 0;
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
    .bootveil {
      position: absolute;
      inset: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--hp-bg, #16212e);
      opacity: 1;
      transition: opacity 0.15s ease;
      pointer-events: none;
    }
    .bootveil.off {
      opacity: 0;
    }
    .bootveil .boothouse {
      position: static; /* .stage svg pins itself to inset:0 — not this one */
      width: 56px;
      height: 56px;
      fill: var(--hp-accent);
      opacity: 0.85;
      animation: hp-boot-pulse 1.3s ease-in-out infinite;
    }
    @keyframes hp-boot-pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.94); }
      50% { opacity: 0.9; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .bootveil .boothouse {
        animation: none;
        opacity: 0.7;
      }
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
    /* docs/CANVAS.md §4.1: objects an order of magnitude away from the plan
       do not decide the opening view — one quiet chip says so and offers to
       take them in. Never a modal (owner). */
    .farhint {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: var(--sp-4);
      z-index: 12;
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      max-width: calc(100% - var(--sp-8));
      background: var(--card-background-color, var(--hp-bg));
      opacity: 0.94;
      color: var(--hp-txt);
      border: 1px solid var(--divider-color, #33404d);
      border-radius: var(--rad-m);
      padding: var(--sp-1) var(--sp-3);
      font-size: var(--fs-s);
    }
    .farhint ha-icon {
      --mdc-icon-size: 18px;
      color: var(--hp-warn, #e2a03f);
      flex: none;
    }
    .farhint span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    .stage svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
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
    .stage.noplan .hp-paper {
      fill: #ffffff;
    }
    /* White day (owner 2026-08-03): at high sun the daynight sky is #ffffff —
       the same white as a drawn plan's paper. A whisper of a drop shadow on
       the paper GROUP keeps the sheet's contour readable on the white sky
       (user units on the 1000-unit canvas ≈ a few screen px). Invisible at
       night against the dark sky; 'static' mode never gets it. */
    .stage.daynight .hp-paperg {
      filter: drop-shadow(0 2px 8px rgba(10, 16, 26, 0.28));
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
      stroke-width: 2;
    }
    .room.overlay:not(.styled):hover {
      fill: #9aa0a6;
      fill-opacity: 0.22;
      stroke: var(--hp-muted);
    }
    .room.yard {
      fill: rgba(75, 140, 90, 0.14);
      stroke: #4b8c5a;
      stroke-width: 2;
    }
    .room.yard:not(.styled):hover {
      fill: rgba(75, 140, 90, 0.24);
      stroke: #6fbf86;
    }
    .room.styled {
      stroke: var(--room-stroke, transparent);
      stroke-opacity: var(--room-stroke-op, 0);
      stroke-width: 2.5;
      fill: var(--room-fill, transparent);
      fill-opacity: var(--room-fill-op, 0);
    }
    /* hover: darken the current fill instead of recoloring; grey when unfilled */
    .room.styled.filled:hover {
      filter: brightness(0.78);
      stroke-opacity: 1;
    }
    .room.styled:not(.filled):hover {
      fill: #9aa0a6;
      fill-opacity: 0.22;
      stroke-opacity: 1;
    }
    /* doors & windows */
    .op-leaf {
      transition: transform 0.6s ease;
    }
    .op-arc {
      stroke-width: 1.5;
      transition: stroke-dashoffset 0.6s ease;
    }
    /* hover affordance: a rounded outline hugging the wall strip + a grab cursor */
    .op-outline {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      opacity: 0;
      transition: opacity 0.15s;
      pointer-events: none;
    }
    .stage.markup g.opening:hover .op-outline {
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
    /* HP-1550-04: in the resize tool the wall handles own the hit test — the
       transparent .op-hit of a door at the midpoint of a wall used to sit ON
       TOP of the handle and made that wall ungrabbable for both rooms.
       Openings are not editable in this tool (they ride along with the wall),
       so their hit area goes fully inert; every other Plan tool is untouched. */
    .stage.markup.tool-resize .op-hit {
      pointer-events: none;
      cursor: default;
    }
    .oplock {
      pointer-events: none; /* inert while editing; clickable in View (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      width: calc(var(--icon-size, 2.5cqw) * 0.62);
      height: calc(var(--icon-size, 2.5cqw) * 0.62);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      z-index: 1;
    }
    .stage.mode-view .oplock {
      pointer-events: auto;
      cursor: pointer;
    }
    .oplock ha-icon {
      --mdc-icon-size: calc(var(--icon-size, 2.5cqw) * 0.4);
      display: flex;
      line-height: 0;
    }
    .oplock.locked { color: #66d17a; border-color: #66d17a; }
    .oplock.unlocked { color: var(--hp-open); border-color: var(--hp-open); }
    .oplock.unknown { color: var(--hp-muted); }
    .btn.lockact {
      width: 100%;
      justify-content: center;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-top: var(--sp-4);
    }
    .btn.lockact.warn {
      color: var(--error-color, #d33);
      border-color: var(--error-color, #d33);
    }
    .oprow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) 0;
    }
    .oprow b { margin-left: auto; }
    .oprow.ok b { color: #66d17a; }
    .oprow.warn b { color: var(--hp-open); }
    @media (prefers-reduced-motion: reduce) {
      .op-leaf, .op-arc { transition: none; }
    }
    /* presence ripples: opted into per device, drawn around the anchor point */
    .dev.noicon {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
    }
    .dev ha-icon {
      position: relative;
      z-index: 1;
    }
    .ripple {
      position: absolute;
      left: 50%;
      top: 50%;
      width: calc(var(--dev-size) * var(--ripple-scale, 3));
      height: calc(var(--dev-size) * var(--ripple-scale, 3));
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    }
    .ripple i {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--ripple-color, var(--hp-accent));
      opacity: 0;
    }
    .ripple.active i {
      animation: hp-ripple 2.4s ease-out infinite;
    }
    .ripple.active i:nth-child(2) { animation-delay: 0.8s; }
    .ripple.active i:nth-child(3) { animation-delay: 1.6s; }
    /* idle: a faint dot keeps the spot marked without pulling the eye */
    .ripple:not(.active) i:nth-child(n + 2) { display: none; }
    .ripple:not(.active) i {
      inset: calc(50% - 0.15 * var(--dev-size));
      opacity: 0.3;
      animation: none;
    }
    @keyframes hp-ripple {
      0% { transform: scale(0.18); opacity: 0.7; }
      70% { opacity: 0.22; }
      100% { transform: scale(1); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ripple.active i { animation: none; opacity: 0.3; }
      .ripple.active i:nth-child(n + 2) { display: none; }
    }
    .roomlabel {
      pointer-events: none; /* draggable only in plan mode (rule below) */
      position: absolute;
      transform: translate(-50%, -50%);
      font-size: calc(var(--icon-size, 2.5cqw) * 0.5 * var(--rl-scale, 1) * var(--rl-font, 1) * var(--rl-space, 1));
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
    /* Switching spaces by swipe or on the kiosk carousel: the plan flies out
       the way the finger went and the next one arrives from the other side. */
    @keyframes hp-slide-left {
      0%   { transform: translateX(22%); opacity: 0; }
      100% { transform: translateX(0);   opacity: 1; }
    }
    @keyframes hp-slide-right {
      0%   { transform: translateX(-22%); opacity: 0; }
      100% { transform: translateX(0);    opacity: 1; }
    }
    .zoomwrap.slide-left  { animation: hp-slide-left 0.26s cubic-bezier(0.22, 0.61, 0.36, 1); }
    .zoomwrap.slide-right { animation: hp-slide-right 0.26s cubic-bezier(0.22, 0.61, 0.36, 1); }
    @media (prefers-reduced-motion: reduce) {
      .zoomwrap.slide-left, .zoomwrap.slide-right { animation: none; }
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
    .rlgearbtn:hover { opacity: 1; filter: brightness(1.18); }
    .rlgearbtn ha-icon { --mdc-icon-size: calc(var(--gear-h) * 0.55); display: inline-flex; }
    .rlgear {
      --mdc-icon-size: 0.9em;
      display: inline-flex;
      margin-right: 0.2em;
      opacity: 0.6;
      cursor: pointer;
      pointer-events: auto;
    }
    .rlgear:hover { opacity: 1; }
    .rlgo {
      --mdc-icon-size: 0.85em;
      display: inline-flex;
      opacity: 0.55;
    }
    .stage.mode-view .rlgo {
      pointer-events: auto;
      cursor: pointer;
    }
    .stage.mode-view .rlgo:hover { opacity: 1; }
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
    .bindharow {
      display: flex;
      align-items: center;
      gap: var(--sp-5);
      flex-wrap: wrap;
    }
    .bindharow .entcheck { opacity: 0.9; }
    .dropbtn {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      width: 100%;
      text-align: left;
      border: 1px solid var(--hp-muted);
      border-radius: var(--rad-m);
      background: transparent;
      color: var(--hp-txt);
      padding: var(--sp-4) 10px;
      cursor: pointer;
      font-family: inherit;
      font-size: var(--fs-m);
      margin-top: var(--sp-3);
    }
    .dropbtn .ref { color: var(--hp-muted); font-size: var(--fs-s); margin-left: auto; }
    .dropbtn ha-icon { --mdc-icon-size: 18px; margin-left: var(--sp-2); }
    .dropbtn.open { border-color: var(--hp-accent); }
    .droppanel {
      border: 1px solid var(--hp-accent);
      border-top: none;
      border-radius: 0 0 var(--rad-m) var(--rad-m);
      padding: var(--sp-3);
      margin-top: -4px;
    }
    .ctrlchips { display: flex; flex-wrap: wrap; gap: var(--sp-3); margin: var(--sp-2) 0; }
    .ctrlchip {
      display: inline-flex; align-items: center; gap: var(--sp-2);
      background: var(--hp-accent); color: var(--text-primary-color, #fff);
      border-radius: var(--rad-l); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-s);
    }
    .ctrlchip ha-icon { --mdc-icon-size: 14px; cursor: pointer; }
    .ctrllist { display: flex; flex-direction: column; gap: var(--sp-1); margin-top: var(--sp-2); }
    .ctrlopt {
      display: flex; align-items: center; gap: var(--sp-4); text-align: left;
      border: 0; background: transparent; color: var(--hp-txt);
      padding: var(--sp-3) var(--sp-4); border-radius: var(--rad-s); cursor: pointer; font-family: inherit; font-size: var(--fs-m);
    }
    .ctrlopt:hover { background: var(--secondary-background-color, rgba(128,128,128,0.15)); }
    .ctrlopt .sub { color: var(--hp-muted); font-size: var(--fs-s); margin-left: auto; }
    .ctrlopt ha-icon { --mdc-icon-size: 16px; }
    .ctrlstates { display: flex; flex-direction: column; gap: var(--sp-2); }
    .ctrlstate { display: inline-flex; align-items: center; gap: var(--sp-3); color: var(--hp-muted); }
    .ctrlstate.on { color: var(--hp-txt); }
    .ctrlstate ha-icon { --mdc-icon-size: 15px; }
    .cardpreview {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
      margin: var(--sp-4) 0 var(--sp-1);
      padding: 10px;
      border: 1px dashed var(--hp-muted);
      border-radius: var(--rad-m);
    }
    .cardpreview .cpname { font-weight: 700; letter-spacing: 0.04em; }
    .cardpreview .cpmeta {
      display: inline-flex;
      align-items: center;
      gap: 0.3em;
      font-weight: 600;
      opacity: 0.85;
    }
    .cardpreview .cpmeta ha-icon { --mdc-icon-size: 1.05em; }
    .iconauto {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-size: var(--fs-s);
      margin: var(--sp-2) 0 0;
    }
    .iconauto ha-icon { --mdc-icon-size: 18px; }
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
    .stage.markup .roomlabel:hover .rlhandle { display: block; }
    .stage.markup .roomlabel { pointer-events: auto; }
    .roomlabel:active { cursor: grabbing; }
    .measurelayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .alignline {
      stroke: var(--hp-accent);
      stroke-width: 1.2;
      stroke-dasharray: 4 4;
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
    .hdr.kioskhide { display: none; }
    .kioskdots {
      position: absolute;
      left: 50%;
      bottom: var(--sp-5);
      transform: translateX(-50%);
      display: flex;
      gap: var(--sp-4);
      z-index: 5;
      pointer-events: none;
    }
    .kdot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--hp-muted);
      opacity: 0.55;
    }
    .kdot.on { background: var(--hp-accent); opacity: 1; }
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
    /* decor (background) layer */
    .decorlayer .dshape { pointer-events: none; }
    .stage.mode-decor .decorlayer .dshape {
      pointer-events: visiblePainted;
      cursor: pointer;
    }
    .stage.mode-decor.dtool-select .decorlayer .dshape { cursor: move; }
    .decorlayer .dsel {
      filter: drop-shadow(0 0 3px var(--hp-accent));
    }
    .decorlayer .ddraft {
      opacity: 0.75;
      stroke-dasharray: 6 5;
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
    .stage.mode-decor.dtool-line, .stage.mode-decor.dtool-rect,
    .stage.mode-decor.dtool-ellipse, .stage.mode-decor.dtool-text {
      cursor: crosshair;
    }
    .stage.mode-decor .room, .stage.mode-decor .devlayer { pointer-events: none; }
    .stage.mode-decor .oplock { pointer-events: none; }
    /* decor mode: everything but the decor itself fades back */
    .stage.mode-decor .room,
    .stage.mode-decor .devlayer,
    .stage.mode-decor .opening,
    .stage.mode-decor .rlabel {
      opacity: 0.35;
    }
    .decorbar .dcolor {
      width: 30px; height: 26px; padding: 0; border: none; background: none; cursor: pointer;
    }
    .decorbar .dwidth {
      font-family: inherit; font-size: var(--fs-s); border-radius: var(--rad-s);
      background: var(--hp-bg2, transparent); color: var(--hp-txt); border: 1px solid var(--hp-muted);
      padding: var(--sp-2) var(--sp-3);
    }
    .decorbar .dfill {
      display: inline-flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-s); cursor: pointer;
    }
    .opghost {
      stroke: var(--hp-open, #ff9800);
      stroke-width: 5;
      stroke-linecap: round;
      stroke-dasharray: 7 6;
      opacity: 0.85;
      pointer-events: none;
    }
    .opghost-dot {
      fill: var(--hp-open, #ff9800);
      opacity: 0.85;
      pointer-events: none;
    }
    .rlabel {
      fill: var(--hp-muted);
      font-size: 15px;
      font-weight: 600;
      pointer-events: none;
      text-anchor: middle;
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
    /* open-wall tool: default until a shared wall is under the cursor */
    .stage.markup.tool-openwall { cursor: default; }
    .stage.markup.tool-openwall.wallhot { cursor: pointer; }
    .openwall {
      stroke: var(--ow-stroke, var(--hp-muted));
      stroke-width: 2.5;
      stroke-dasharray: 7 7;
      stroke-linecap: butt;
      pointer-events: none;
      opacity: 0.9;
    }
    /* rooms with open stretches: the polygon's own stroke is fully off
       (hover included) — the trimmed .room-outline path draws the walls */
    .room.noedge {
      stroke-opacity: 0 !important;
    }
    /* rooms with open boundaries draw their walls as separate M..L subpaths,
       so a corner between two of them is two stroke ENDS meeting: round caps
       fill it in the same way a round join fills a closed contour's corner
       (owner 2026-08-04 — no teeth anywhere on a room border). */
    .room-outline {
      fill: none;
      stroke-width: 2.5;
      stroke-linejoin: round;
      stroke-linecap: round;
      pointer-events: none;
    }
    /* Plan editor: trimmed outlines use the markup blue */
    .room-outline.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      stroke-opacity: 1;
    }
    .openwalls.hot .openwall {
      stroke: #ffc14d;
      opacity: 1;
    }
    .openwall-preview {
      stroke: #ffc14d;
      stroke-width: 5;
      stroke-dasharray: 7 7;
      stroke-linecap: round;
      pointer-events: none;
      opacity: 0.95;
    }
    /* an already-open boundary under the cursor: the click will CLOSE it */
    .openwall-preview.willclose {
      stroke: #f25a4a;
      stroke-dasharray: none;
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
    .modes {
      display: inline-flex;
      gap: var(--sp-1);
      background: rgba(127, 127, 127, 0.12);
      border-radius: var(--rad-l);
      padding: var(--sp-2);
    }
    .modetab {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      border: 0;
      background: transparent;
      color: var(--hp-muted);
      padding: var(--sp-3) 10px; /* 10px h-padding kept: +2px would wrap the header modes row */
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .modetab ha-icon { --mdc-icon-size: 15px; }
    .modetab .closex {
      --mdc-icon-size: 13px;
      display: inline-flex;
      align-items: center;
      margin-left: 2px;
      opacity: 0.75;
      cursor: pointer;
      border-radius: var(--rad-s);
    }
    .modetab .closex:hover { opacity: 1; }
    .editbar .barclose {
      padding: var(--sp-2) var(--sp-3);
      margin-left: var(--sp-3);
    }
    .modetab.active {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    @media (max-width: 720px) {
      .modetab .ml { display: none; }
    }
    .room.outlined {
      stroke: rgba(62, 166, 255, 0.55);
      fill: rgba(62, 166, 255, 0.06);
    }
    /* AFTER .outlined: same specificity — source order decides (gotcha x4) */
    .room.picked {
      stroke: #ffc14d;
      stroke-width: 3;
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
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .pathline {
      stroke: #ffc14d;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .preview {
      stroke: #ffc14d;
      stroke-width: 2;
      stroke-dasharray: 6 5;
      opacity: 0.7;
    }
    .vertex {
      fill: #ffc14d;
      stroke: #4a2800;
      stroke-width: 1;
    }
    .vertex.first {
      fill: #4bd28f;
      stroke: #04121f;
    }
    .areasel,
    .namein {
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
      font-family: inherit;
    }
    .namein {
      width: 130px;
    }
    .dev.valonly {
      /* all satellite metrics from --dev-size, not --icon-size: the per-device
         size multiplier must scale the value plate with its marker — same bug
         class as the v1.51.3 glyph fix (pinned to base size, the multiplier
         grew nothing). */
      width: auto;
      min-width: var(--dev-size, var(--icon-size, 2.5cqw));
      padding: 0 calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.16);
    }
    .dev.valonly .valtext {
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.45);
      font-weight: 700;
      white-space: nowrap;
    }
    /* RGB lights: the bulb takes the light's actual color */
    /* v1.52.0: the RGB tint of the icon/border is gone — a lamp's colour
       lives ONLY in its glow spot (owner's rule). The ripple-color fallback
       keeps using the light colour; that is set inline via --ripple-color. */
    /* Owner's rule (2026-08-01, вариант «б»): «движение = разовая вспышка
       в момент обнаружения; cool-down не пульсирует; присутствие =
       статичное кольцо пока обитаемо». The yellow FILL stays reserved for
       «включено» — both sense states keep the neutral badge. Both rings
       are declared BEFORE .dev.alarm on purpose: equal specificity on the
       shared ::after means the later alarm rule wins if a device ever
       carries both — red beats yellow. */
    /* MOTION tripped: a short ONE-SHOT flash — three beats of the yellow
       ring (3 × 1.1s), then silence, even while the entity still reports
       'on' (that tail is the sensor's cool-down, not motion). The
       iteration count is FINITE, and the card itself drops the class
       ~3.3s after the off→on transition (_senseTick/_stateClass in
       houseplan-card.ts); base opacity 0 keeps the ring invisible should
       the class outlive the animation by a frame. */
    .dev.senseflash::after {
      content: '';
      position: absolute;
      inset: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.35);
      border: 2px solid var(--hp-on);
      border-radius: 50%;
      opacity: 0;
      animation: hp-sense 1.1s ease-in-out 3;
      pointer-events: none;
    }
    /* HP-1543-02: a rapid off→on retrip must RESTART the flash. The card
       flips the .sf2 marker on every trip (_senseTick generation parity);
       hp-sense-b duplicates hp-sense exactly — switching the animation-name
       is what makes the browser abandon the old timeline and start a fresh
       one on the same pseudo-element (a same-name animation never restarts
       while the class stays on). */
    .dev.senseflash.sf2::after { animation-name: hp-sense-b; }
    /* OCCUPANCY/PRESENCE while 'on': a calm STATIC ring, no animation —
       «комната обитаема» is a state, not an event, so it must not blink.
       Brightness matches the reduced-motion variant of the flash. */
    .dev.sensehold::after {
      content: '';
      position: absolute;
      inset: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.35);
      border: 2px solid var(--hp-on);
      border-radius: 50%;
      opacity: 0.4;
      pointer-events: none;
    }
    /* COVER ON THE MOVE (owner 2026-08-03): «не жёлтая подложка, а лёгкая
       пульсация вокруг значка в стиле шайбы пылесоса». Same yellow as the
       sense rings, the vacuum puck's 2.2s period, and a moderate opacity so
       two curtains travelling at once never turn into a strobe. The plate
       itself stays neutral — yellow means «включено», nothing else. */
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
    @keyframes hp-sunfade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes hp-sunfade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      /* no fade at all: the rays are simply there or simply gone */
      .sunlayer, .sunlayer.out { animation: none; }
      .sunlayer.out { opacity: 0; }
    }
    .dev.covermove::after {
      content: '';
      position: absolute;
      inset: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.35);
      border: 2px solid var(--hp-on);
      border-radius: 50%;
      opacity: 0.45;
      animation: hp-covermove 2.2s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes hp-covermove {
      0% { transform: scale(0.92); opacity: 0.16; }
      50% { transform: scale(1.12); opacity: 0.5; }
      100% { transform: scale(0.92); opacity: 0.16; }
    }
    @keyframes hp-sense {
      0% { transform: scale(0.9); opacity: 0.5; }
      60% { transform: scale(1.12); opacity: 0.12; }
      100% { transform: scale(1.12); opacity: 0; }
    }
    /* identical twin of hp-sense — exists ONLY as the alternate animation
       identity for the retrip restart (HP-1543-02), keep the two in sync */
    @keyframes hp-sense-b {
      0% { transform: scale(0.9); opacity: 0.5; }
      60% { transform: scale(1.12); opacity: 0.12; }
      100% { transform: scale(1.12); opacity: 0; }
    }
    /* alarms pulse red over everything */
    .dev.alarm::after {
      content: '';
      position: absolute;
      inset: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.35);
      border: 3px solid #f25a4a;
      border-radius: 50%;
      animation: hp-alarm 1s ease-out infinite;
      pointer-events: none;
    }
    @keyframes hp-alarm {
      0% { transform: scale(0.7); opacity: 1; }
      100% { transform: scale(1.25); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .dev.alarm::after { animation: none; opacity: 0.9; }
      /* the motion flash becomes a static ring for the same ~3.3s class
         window — consistent with alarm's treatment; sensehold is static
         by design already */
      .dev.senseflash::after,
      .dev.senseflash.sf2::after { animation: none; opacity: 0.4; } /* HP-1543-02: retrip re-arms the window, ring stays static */
      /* a travelling cover keeps a STATIC ring — the movement is still shown,
         it just stops breathing */
      .dev.covermove::after { animation: none; opacity: 0.4; }
    }
    .dev .newdot {
      position: absolute;
      top: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.12);
      right: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * -0.12);
      width: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.34);
      height: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.34);
      border-radius: 50%;
      background: #f0301f;
      border: 2px solid var(--card-background-color, var(--hp-bg));
      pointer-events: none;
      z-index: 2;
    }
    .devlayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .dev {
      position: absolute;
      /* per-device multiplier on top of the card-wide icon size */
      --dev-size: calc(var(--icon-size, 2.5cqw) * var(--dev-scale, 1));
      /* центр квадрата (включая рамку 1px) точно на точке привязки: -(size/2 + border) */
      width: var(--dev-size);
      height: var(--dev-size);
      margin: calc(var(--dev-size) / -2 - 1px) 0 0 calc(var(--dev-size) / -2 - 1px);
      border-radius: 22%;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--hp-txt);
      cursor: pointer;
      pointer-events: auto;
      transition: background 0.15s, border-color 0.15s, opacity 0.2s;
      box-shadow: var(--shadow-1);
      z-index: 2;
    }
    .dev ha-icon {
      /* from --dev-size, NOT --icon-size: the per-device size multiplier must
         scale the GLYPH with its badge. Pinned to the base size, "make this
         icon bigger" grew an empty box around a default-size glyph (user
         report via the owner, 2026-07-29). */
      --mdc-icon-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.62);
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .stage.mode-devices .dev { cursor: grab; }
    .stage.mode-devices .dev:active { cursor: grabbing; }
    .dev:hover {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      z-index: 5;
    }
    .dev.on {
      background: var(--hp-on);
      border-color: var(--hp-on);
      color: #503c00;
      box-shadow: 0 0 8px rgba(255, 212, 92, 0.7);
    }
    .dev.open {
      background: var(--hp-open);
      border-color: var(--hp-open);
      color: #4a2800;
    }
    .dev.unavail {
      opacity: 0.35;
    }
    .dev.virtual {
      border-style: dashed;
    }
    /* "hide from plan" flag, shown only in the device editor with the
       "show hidden devices" toggle on (docs/FILTERING.md). BLUE, so a hidden
       device cannot be mistaken for an unavailable one (translucent dark) —
       and no live-state paint at all: a ghost is configuration, not status
       (owner's request). */
    .dev.ghost {
      opacity: 0.6;
      border-style: dashed;
      border-color: var(--hp-accent);
      background: rgba(62, 166, 255, 0.22); /* fallback for old WebViews */
      background: color-mix(in srgb, var(--hp-accent) 30%, var(--card-background-color, #1c2530));
      color: var(--hp-accent);
      box-shadow: none;
    }
    .dev.sel {
      border-color: #ffc14d;
      box-shadow: 0 0 0 3px rgba(255, 193, 77, 0.35);
    }

    .dev .tval {
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.1);
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid var(--hp-accent);
      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.18);
      padding: 0 calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.14);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.45);
      font-weight: 700;
      line-height: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.68);
      color: var(--hp-txt);
      white-space: nowrap;
      pointer-events: none;
    }
.dev .hval {
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.1);
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid #4fc3f7;
      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.18);
      padding: 0 calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.14);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.45);
      font-weight: 700;
      line-height: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.68);
      color: var(--hp-txt);
      white-space: nowrap;
      pointer-events: none;
    }
    .dev .lqi {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.05);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.38);
      font-weight: 700;
      line-height: 1;
      text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.9);
      white-space: nowrap;
      pointer-events: none;
    }
    .editbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: var(--sp-4) var(--sp-5);
      border-bottom: 1px solid var(--hp-line);
      font-size: var(--fs-m);
      flex-wrap: wrap;
    }
    .tab .tabedit {
      --mdc-icon-size: 13px;
      display: inline-flex;
      align-items: center;
      margin-left: var(--sp-3);
      opacity: 0.4;
    }
    .tab:hover .tabedit {
      opacity: 0.9;
    }
    .tab.tabadd {
      padding: var(--sp-3) var(--sp-4);
    }
    .tab.tabadd ha-icon {
      --mdc-icon-size: 15px;
    }
    .srcrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      font-size: var(--fs-m);
      cursor: pointer;
      padding: var(--sp-1) 0;
    }
    .dispsection {
      margin-top: var(--sp-5) !important;
      padding-top: var(--sp-4);
      border-top: 1px solid var(--hp-line);
      font-weight: 600;
      color: var(--hp-txt) !important;
    }
    .colorrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .colorrow input[type='color'] {
      width: 42px;
      height: 28px;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      background: transparent;
      padding: 1px;
      cursor: pointer;
    }
    .colorrow input[type='range'] { flex: 1; }
    .colorrow .tempin { width: 70px; flex: none; }
    .temprange {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      margin-left: auto;
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    /* beat the generic .dialog .body .namein { width:100% } rule */
    .dialog .body .temprange .tempin { width: 56px; flex: none; padding: var(--sp-2) var(--sp-3); }
    .dialog .body .colorrow .tempin { width: 72px; flex: none; }
    .srcrow { flex-wrap: nowrap; }
    /* native HA controls (rendered only when the HA frontend defines them;
       old HA and the smoke env keep the plain inputs). ha-switch is taller
       than a checkbox - cap its footprint so .srcrow keeps its rhythm. */
    .srcrow ha-switch { flex: none; }
    .colorrow ha-slider { flex: 1; min-width: 0; }
    .srcrow > span:first-of-type { white-space: nowrap; }
    .colorrow .opl { color: var(--hp-muted); font-size: var(--fs-s); }
    .colorrow .opv { font-size: var(--fs-s); min-width: 34px; text-align: right; }
    .planrow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    /* the "already uploaded" picker: a plan is never deleted for being
       unreferenced, so it has to be findable again */
    .savedplans {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      max-height: 240px;
      overflow: auto;
      margin: var(--sp-3) 0 var(--sp-1);
      padding: var(--sp-3);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      background: var(--hp-bg2, rgba(255, 255, 255, 0.03));
    }
    .savedplan {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .savedplan.cur { outline: 1px solid var(--hp-accent); border-radius: var(--rad-s); }
    .savedplan img {
      width: 56px;
      height: 40px;
      object-fit: contain;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      background: #fff;
      flex: none;
    }
    .savedmeta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .savedmeta b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .savedmeta .muted { font-size: var(--fs-s); }
    .savedplan .btn.danger ha-icon { color: #f25a4a; }
    .savedplan .btn[disabled] { opacity: 0.4; pointer-events: none; }
    .planprev {
      max-width: 120px;
      max-height: 70px;
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      background: #fff;
    }
    .planname {
      font-size: var(--fs-m);
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .planname.muted {
      color: var(--hp-muted);
    }
    .filebtn {
      cursor: pointer;
    }
    .btn.danger {
      border-color: #b3402a;
      color: #ff7a5c;
    }
    .dialog .row .spacer {
      flex: 1;
    }
    .dialog.wide {
      width: min(500px, 94vw);
    }
    .dialog .body {
      max-height: 66vh;
      overflow-y: auto;
    }
    .descin {
      width: 100%;
      box-sizing: border-box;
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
      font-family: inherit;
      resize: vertical;
      /* flex column of the dialog body squeezes textareas — keep a usable height */
      min-height: 92px;
      flex-shrink: 0;
      line-height: 1.35;
    }
    .bindsel {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-m);
      padding: var(--sp-4);
    }
    .bindsel .opt {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      border: 1px solid var(--hp-line);
      background: transparent;
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      cursor: pointer;
      font-size: var(--fs-m);
      font-family: inherit;
    }
    .bindsel .opt.on {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      border-color: var(--hp-accent);
    }
    .curbind {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      font-size: var(--fs-m);
      color: var(--hp-txt);
      flex-wrap: wrap;
    }
    .curbind .ref {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    /* live vacuum: a round puck, no badge plate, soft pulse (docs/VACUUM.md) */
    .vacpuck {
      position: absolute;
      /* the base badge, but round and 20% smaller — the owner's wording:
         «иконка похожа на иконку базы, только круглая и чуть меньше» */
      --puck-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.8);
      width: var(--puck-size);
      height: var(--puck-size);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      background: var(--hp-bg);
      border: 1px solid var(--hp-line);
      box-shadow: var(--shadow-1);
      color: var(--hp-txt);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 6;
      /* glide between sparse position updates; .jump disables it so the robot
         never appears to drive through walls after a data gap */
      transition: left 1.2s linear, top 1.2s linear;
      animation: vacpulse 2.2s ease-out infinite;
    }
    .vacpuck.jump { transition: none; }
    .vacpuck.stale { opacity: 0.45; animation: none; }
    .vacpuck ha-icon {
      --mdc-icon-size: calc(var(--puck-size) * 0.68);
      color: var(--hp-txt);
      /* same centering recipe as .dev ha-icon: without flex + line-height 0
         the glyph sits on its text baseline and appears to float around the
         circle (owner report 2026-07-31) */
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      width: var(--mdc-icon-size);
      height: var(--mdc-icon-size);
    }
    @keyframes vacpulse {
      0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--hp-accent) 45%, transparent); }
      70% { box-shadow: 0 0 0 12px transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    @media (prefers-reduced-motion: reduce) {
      .vacpuck { animation: none; }
    }
    .vactrail {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
      overflow: visible;
    }
    .vactrail polyline {
      fill: none;
      stroke-linejoin: round;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    /* dark halo + light core: neutral, and one of the two always contrasts
       with whatever fill is underneath */
    .vactrail g.prev { opacity: 0.4; }
    .vactrail .case {
      stroke: rgba(0, 0, 0, 0.4);
      stroke-width: 2.25;
    }
    .vactrail .core {
      stroke: rgba(255, 255, 255, 0.82);
      stroke-width: 0.9;
    }
    .vacbox .vacbtns { display: flex; gap: var(--sp-4); margin: var(--sp-3) 0; flex-wrap: wrap; }
    .vacfit {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 12;
      overflow: visible;
      touch-action: none;
      cursor: grab;
      /* the devlayer is pointer-events: none and every child opts back in —
         without this line real clicks flew straight through the overlay
         (owner: «уголки не кликабельны»; synthetic smoke events bypass
         hit-testing, which is why they lied) */
      pointer-events: auto;
    }
    .vacfit:active { cursor: grabbing; }
    .vacfit polygon {
      fill: color-mix(in srgb, var(--hp-accent) 16%, transparent);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      stroke-dasharray: 6 4;
    }
    .vacfit text {
      fill: var(--hp-accent);
      font-size: 26px;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
      user-select: none;
    }
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
    .rszhandle:hover + .rszicon .rszink { stroke-width: 3; }
    /* corner (scale-frame) handles keep the classic filled circle */
    .rszcorner {
      fill: var(--hp-bg);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      cursor: nwse-resize;
    }
    .rszcorner:hover { fill: var(--hp-accent); }
    .rszcorner:active { cursor: nwse-resize; }
    .rszframe {
      fill: none;
      stroke: var(--hp-accent);
      stroke-width: 1.5;
      stroke-dasharray: 6 5;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    /* the decor draft badge rides the MIDDLE of the shape, so it is centred
       horizontally and lifted clear of the line instead of trailing the
       cursor the way a wall badge does (owner 2026-08-04) */
    .measurelabel.dmeasure {
      transform: translate(-50%, -160%);
    }
    .measurelabel.rszarea {
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.6);
    }
    .vacfitdot { fill: var(--hp-accent); pointer-events: none; }
    .vacfithandle {
      fill: var(--hp-bg);
      stroke: var(--hp-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      cursor: nwse-resize;
    }
    .vaccalbar {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      display: flex;
      gap: var(--sp-5);
      align-items: center;
      background: var(--hp-bg);
      color: var(--hp-txt);
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-l);
      padding: 10px var(--sp-5);
      z-index: 60;
      box-shadow: var(--shadow-2);
    }
    .candlist {
      max-height: 160px;
      overflow-y: auto;
      border-top: 1px solid var(--hp-line);
      /* A scrollable box is a flex item that HAPPILY collapses: inside the
         dialog body (a flex column) this list rendered its rows into a 1px
         sliver — the DOM had 26 candidates and the user saw nothing. In the
         binding dropdown it sits inside .droppanel (block context) and never
         showed the bug. Field report, 2026-07-30. */
      flex: 0 0 auto;
      min-height: 2.6em;
    }
    .cand {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-4);
      cursor: pointer;
      border-radius: var(--rad-s);
      font-size: var(--fs-m);
    }
    .cand:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .cand.sel {
      background: var(--hp-accent);
      color: var(--text-primary-color, #fff);
    }
    .cand .cs {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      white-space: nowrap;
    }
    .cand.sel .cs {
      color: var(--text-primary-color, #fff);
      opacity: 0.85;
    }
    .cand.muted {
      color: var(--hp-muted);
      cursor: default;
    }
    .pdfedit {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-3);
      align-items: center;
    }
    .pdftag {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: var(--sp-2) var(--sp-3);
      font-size: var(--fs-s);
    }
    .pdftag a {
      color: var(--hp-txt);
      text-decoration: none;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pdftag .x {
      --mdc-icon-size: 15px;
      cursor: pointer;
      color: var(--hp-muted);
    }
    .pdftag .x:hover {
      color: #ff7a5c;
    }
    .entlist {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      margin-bottom: 10px;
    }
    .entrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-4);
      border-radius: var(--rad-m);
      background: var(--secondary-background-color, rgba(128, 128, 128, 0.12));
    }
    .entrow ha-icon { --mdc-icon-size: 20px; color: var(--hp-muted); }
    .entrow.on ha-icon { color: var(--hp-accent); }
    .entrow .en { flex: 1; font-size: var(--fs-m); }
    .entrow .ev { font-size: var(--fs-m); color: var(--hp-muted); }
    .entbtn {
      min-width: 74px;
      min-height: 32px;
      padding: var(--sp-2) var(--sp-5);
      border: 1px solid var(--hp-muted);
      border-radius: 999px;
      background: transparent;
      color: var(--hp-txt);
      font: inherit;
      font-size: var(--fs-m);
      cursor: pointer;
    }
    .entbtn.on {
      background: var(--hp-accent);
      border-color: var(--hp-accent);
      color: var(--text-primary-color, #fff);
      font-weight: 600;
    }
    .inforow {
      display: flex;
      gap: 10px;
      font-size: var(--fs-m);
      margin: var(--sp-2) 0;
    }
    .inforow .k {
      color: var(--hp-muted);
      min-width: 84px;
    }
    .inforow a {
      color: var(--hp-accent);
      word-break: break-all;
    }
    .infodesc {
      font-size: var(--fs-m);
      white-space: pre-wrap;
      margin-top: var(--sp-3);
    }
    .infodesc.muted {
      color: var(--hp-muted);
    }
    .pdflist {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .pdf {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-2);
      color: var(--hp-accent);
      text-decoration: none;
    }
    ha-icon-picker {
      display: block;
    }
    .floorrow {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      padding: var(--sp-3) var(--sp-2);
      font-size: var(--fs-m);
      cursor: pointer;
    }
    .floorrow .floorlvl {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      border: 1px solid var(--hp-line);
      border-radius: var(--rad-s);
      padding: 0 var(--sp-3);
    }
    .importprog {
      margin-left: auto;
      color: var(--hp-muted);
      font-size: var(--fs-s);
      font-weight: 400;
    }
    .rhint {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-bottom: var(--sp-3);
    }
    .rtest {
      display: flex;
      align-items: center;
      gap: var(--sp-4);
      margin-bottom: var(--sp-4);
    }
    .rtest .namein { flex: 1; }
    .rtest ha-icon { color: var(--hp-accent); }
    .rtesticon { font-size: var(--fs-s); color: var(--hp-muted); }
    .rrow {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin: var(--sp-1) 0;
    }
    .rrow .rpat { flex: 2; }
    .rrow .ricon { flex: 1.4; }
    .rrow .rpat.bad { border-color: #ff7a5c; }
    .rrow .rprev { --mdc-icon-size: 18px; color: var(--hp-txt); min-width: 18px; }
    .rrow .ract {
      --mdc-icon-size: 16px;
      color: var(--hp-muted);
      cursor: pointer;
    }
    .rrow .ract:hover { color: var(--hp-txt); }
    .rrow .ract.del:hover { color: #ff7a5c; }

    .gsrow .gsl {
      min-width: 150px;
      font-size: var(--fs-m);
      color: var(--hp-muted);
    }
    .aboutver {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin: var(--sp-2) 0 var(--sp-3);
    }
    .aboutlink {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      width: fit-content;
      color: var(--hp-accent);
      text-decoration: none;
      font-size: var(--fs-m);
      padding: var(--sp-1) 0;
    }
    .aboutlink:hover { text-decoration: underline; }
    .aboutlink ha-icon { --mdc-icon-size: 18px; line-height: 1; }
    .dialogwrap {
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 90;
    }
    .dialog {
      background: var(--card-background-color, var(--hp-bg));
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-l);
      box-shadow: var(--shadow-3);
      width: min(360px, 92vw);
      overflow: hidden;
    }
    .dialog .hd {
      padding: var(--sp-5) var(--sp-6);
      font-weight: 600;
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .dialog .hd ha-icon {
      color: var(--hp-accent);
    }
    .dialog .body {
      padding: var(--sp-5) var(--sp-6);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .dialog .body label {
      font-size: var(--fs-s);
      color: var(--hp-muted);
      margin-top: var(--sp-3);
    }
    .dialog .body .namein,
    .dialog .body .areasel {
      width: 100%;
      box-sizing: border-box;
    }
    .dialog .row {
      display: flex;
      justify-content: flex-end;
      gap: var(--sp-4);
      padding: var(--sp-5) var(--sp-6);
      border-top: 1px solid var(--hp-line);
    }
    .editbar .warn {
      color: #ffc14d;
    }
    .editbar .sname {
      font-weight: 600;
    }
    .editbar input {
      width: 74px;
      background: transparent;
      border: 1px solid var(--hp-line);
      color: var(--hp-txt);
      border-radius: var(--rad-s);
      padding: var(--sp-3) var(--sp-4);
      font-size: var(--fs-m);
    }
    .editbar label,
    .editbar .hint {
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    .menuwrap {
      position: fixed;
      inset: 0;
      z-index: 80;
    }
    .menu {
      position: fixed;
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      border-radius: var(--rad-l);
      box-shadow: var(--shadow-2);
      min-width: 210px;
      max-width: 300px;
      overflow: hidden;
      transform: translate(0, 8px);
    }
    .menu .hd {
      padding: var(--sp-4) var(--sp-5);
      font-weight: 600;
      font-size: var(--fs-m);
      border-bottom: 1px solid var(--hp-line);
      display: flex;
      align-items: center;
      gap: var(--sp-3);
    }
    .menu .hd ha-icon,
    .menu .it.all ha-icon {
      color: var(--hp-accent);
      --mdc-icon-size: 16px;
    }
    .menu .it {
      padding: var(--sp-4) var(--sp-5);
      font-size: var(--fs-m);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--sp-4);
    }
    .menu .it ha-icon {
      --mdc-icon-size: 16px;
      color: var(--hp-muted);
    }
    .menu .it:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .menu .it.all {
      color: var(--hp-accent);
      font-weight: 600;
    }
    .tip {
      position: fixed;
      pointer-events: none;
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      color: var(--hp-txt);
      padding: var(--sp-3) 10px;
      border-radius: var(--rad-m);
      font-size: var(--fs-m);
      box-shadow: var(--shadow-2);
      z-index: 99;
      max-width: 260px;
    }
    .tip .m {
      color: var(--hp-muted);
      font-size: var(--fs-s);
      display: block;
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translateX(-50%);
      background: var(--hp-bg);
      border: 1px solid var(--hp-accent);
      color: var(--hp-txt);
      padding: var(--sp-4) var(--sp-6);
      border-radius: var(--rad-l);
      font-size: var(--fs-m);
      box-shadow: var(--shadow-2);
      z-index: 120;
      max-width: 90vw;
    }
  `;
