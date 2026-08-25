/** Styles of the House Plan card — being split by surface (#266). */
import { css } from 'lit';
import type { CSSResultGroup } from 'lit';
import { planStyles } from './styles/plan.styles';
import { devicesStyles } from './styles/devices.styles';
import { chromeStyles } from './styles/chrome.styles';
import { dialogsStyles } from './styles/dialogs.styles';

export { planStyles, devicesStyles, chromeStyles, dialogsStyles };

const inlineStyles = css`
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
    @keyframes fixedfloor-spin {
      to { transform: rotate(360deg); }
    }
    :host([data-pointer-hover]) .tab:hover {
      color: var(--hp-txt);
    }
    .spacer {
      flex: 1;
    }
    :host([data-pointer-hover]) .btn:hover {
      border-color: var(--hp-accent);
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
      position: static; /* the main .zoomwrap SVG is pinned to inset:0 — not this icon */
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
      .recoveryoverlay {
        transition: none;
      }
      .stage.hpsettle {
        transition: none;
      }
    }
    :host([data-pointer-hover]) .stage.mode-view .room.overlay:not(.styled):hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    :host([data-pointer-hover]) .stage.mode-view .room.yard:not(.styled):hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    /* The explicit late room-hover layer owns the wash and halo. Keeping CSS
       filters off room paths prevents Chromium from recompositing the sibling
       screen-blended Glow layer for one bright frame on every hover. */
    :host([data-pointer-hover]) .stage.mode-view .room.styled:hover {
      stroke: var(--hp-accent);
      stroke-opacity: 1;
    }
    :host([data-pointer-hover]) .stage.markup g.opening:hover .op-outline {
      opacity: 0.9;
    }
    @keyframes hp-pulse-short {
      0% { transform: scale(1); opacity: 0.55; }
      70% { opacity: 0.22; }
      100% { transform: scale(var(--ripple-scale, 1.5)); opacity: 0; }
    }
    /* Alternate identity: a rapid retrigger restarts the browser timeline. */
    @keyframes hp-pulse-short-b {
      0% { transform: scale(1); opacity: 0.55; }
      70% { opacity: 0.22; }
      100% { transform: scale(var(--ripple-scale, 1.5)); opacity: 0; }
    }
    @keyframes hp-pulse-continuous {
      0% { transform: scale(1); opacity: 0.55; }
      65% { opacity: 0.18; }
      100% { transform: scale(var(--ripple-scale, 1.5)); opacity: 0; }
    }
    @keyframes hp-pulse-alarm {
      0% { transform: scale(1); opacity: 0.72; }
      100% { transform: scale(1.5); opacity: 0; }
    }
    /* Space changes keep their direction, but travel only a few percent: the
       motion explains what changed without making the whole plan fly around. */
    @keyframes hp-slide-left {
      0%   { transform: translateX(4%); opacity: 0.72; }
      100% { transform: translateX(0);   opacity: 1; }
    }
    @keyframes hp-slide-right {
      0%   { transform: translateX(-4%); opacity: 0.72; }
      100% { transform: translateX(0);    opacity: 1; }
    }
    :host([data-pointer-hover]) .rlgearbtn:hover { opacity: 1; filter: brightness(1.18); }
    :host([data-pointer-hover]) .rlgear:hover { opacity: 1; }
    :host([data-pointer-hover]) .stage.mode-view .rlgo:hover { opacity: 1; }
    :host([data-pointer-hover]) .ctrlopt:hover {
      background: var(--secondary-background-color, rgba(128,128,128,0.15));
    }
    :host([data-pointer-hover]) .stage.markup .roomlabel:hover .rlhandle { display: block; }
    :host([data-pointer-hover]) .bdframe .bdhandle:hover + .bdknob {
      fill: #fff;
      stroke: var(--hp-accent);
    }
    :host([data-pointer-hover]) .dtframe .dthandle:hover + .dtknob {
      fill: #fff;
      stroke: var(--hp-accent);
    }
    :host([data-pointer-hover]) .modetab .closex:hover { opacity: 1; }
    @keyframes hp-sunfade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes hp-sunfade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    /* Interaction wins ordinary state colours. Alarm keeps priority through
       the more-specific rule below. Unavailable has no visual hover. */
    :host([data-pointer-hover]) .dev:not(.unavail):hover {
      --device-face-bg: #0C82F0;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: var(--device-shell-base-stroke);
    }
    :host([data-pointer-hover]) .dev.theme-light:not(.unavail):hover { --device-face-fg: #fff; }
    :host([data-pointer-hover]) .dev.theme-dark:not(.unavail):hover { --device-face-fg: #252525; }
    :host([data-pointer-hover]) .dev:hover,
    .dev:focus-visible { z-index: 5; }
    /* Alert stays above focus, selection, hover and ordinary semantic paint. */
    .dev.alarm,
    :host([data-pointer-hover]) .dev.alarm:hover,
    .dev.alarm:focus-visible {
      --device-face-bg: #F0410C;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #F0410C;
    }
    :host([data-pointer-hover]) .tab:hover .tabedit {
      opacity: 0.9;
    }
    :host([data-pointer-hover]) .rszhandle:hover + .rszicon .rszink { stroke-width: 3; }
    :host([data-pointer-hover]) .rszhandle.disabled:hover + .rszicon .rszink { stroke-width: 2; }
    :host([data-pointer-hover]) .furnitem:hover { background: rgba(127, 127, 127, 0.18); }
    :host([data-pointer-hover]) .cand:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    :host([data-pointer-hover]) .pdftag .x:hover {
      color: #ff7a5c;
    }
    .sr-only {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }
    :host([data-pointer-hover]) .rrow .ract:hover { color: var(--hp-txt); }
    :host([data-pointer-hover]) .rrow .ract.del:hover { color: #ff7a5c; }
    :host([data-pointer-hover]) .aboutlink:hover { text-decoration: underline; }
    :host([data-pointer-hover]) .menu .it:hover {
      background: rgba(127, 127, 127, 0.15);
    }
    .toast {
      position: fixed;
      pointer-events: none;
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

export const cardStyles: CSSResultGroup = [
  inlineStyles, planStyles, devicesStyles, chromeStyles, dialogsStyles,
];
