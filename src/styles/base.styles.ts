/** Host, variables, resets and cross-surface rules (#266, split from styles.ts). */
import { css } from 'lit';
import {toastStyles} from './toast.styles';
import { controlMotionStyles } from './ui-motion.styles';
import { noticeStyles } from './notice.styles';
import { iconActionStyles } from './icon-action.styles';
import { navigationStyles } from './navigation.styles';
import { readingKitStyles } from './reading-kit.styles';

export const baseStyles = [readingKitStyles, navigationStyles, iconActionStyles, noticeStyles, toastStyles, controlMotionStyles, css`
    .hp-dialog-return-focus:focus-visible { outline:none!important; }
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
    :host(houseplan-card) {
      display: block;
      position: relative;
    }
    :host([panel-host]),
    :host([layout="grid"]) {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    :host([panel-host]) ha-card,
    :host([layout="grid"]) ha-card {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      --ha-card-border-radius: 0;
      --ha-card-box-shadow: none;
    }
    :host([panel-host]) .hdr {
      position: relative;
      top: auto;
      flex: 0 0 auto;
      border-radius: 0;
    }
    :host([layout="grid"]) .hdr {
      flex: 0 0 auto;
    }
    :host([panel-host]) .stage,
    :host([panel-host]) .empty,
    :host([layout="grid"]) .stage,
    :host([layout="grid"]) .empty {
      flex: 1 1 auto;
      min-height: 0;
    }
    :host([panel-host]) .stage.mode-transition,
    :host([layout="grid"]) .stage.mode-transition {
      flex: 0 0 auto;
    }
    :host([panel-host]) .empty,
    :host([layout="grid"]) .empty {
      box-sizing: border-box;
      overflow: auto;
    }
    ha-card {
      overflow: visible; /* overflow:hidden breaks position:sticky on the header */
    }
    .empty-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--sp-4);
      max-width: 100%;
    }
    .empty-actions .empty-backup-upload { display: contents; }
    .empty-actions input[type='file'] { display: none; }
    .version-recovery {
      position: absolute;
      z-index: 72;
      left: max(var(--sp-5), env(safe-area-inset-left));
      right: max(var(--sp-5), env(safe-area-inset-right));
      bottom: max(var(--sp-5), env(safe-area-inset-bottom));
      width: auto;
      max-width: 430px;
      margin-left: auto;
      box-sizing: border-box;
      pointer-events: none;
    }
    .version-recovery.phase-visible {
      animation: hp-ui-appear var(--hpf-appear-duration) var(--hpf-appear-easing) both;
    }
    .version-recovery.phase-leaving {
      animation: hp-ui-leave var(--hpf-leave-duration) var(--hpf-leave-easing) both;
    }
    .version-recovery-card {
      pointer-events: auto;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--sp-5);
    }
    .phase-leaving .version-recovery-card {
      pointer-events: none;
    }
    .version-recovery-card > ha-icon {
      align-self: start;
    }
    .version-recovery-versions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2) var(--sp-5);
    }
    .version-recovery-versions span,
    .version-recovery-versions b {
      overflow-wrap: anywhere;
    }
    @media (max-width: 520px) {
      .version-recovery-card {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .version-recovery-reload {
        grid-column: 1 / -1;
        width: 100%;
      }
    }
    .spacer {
      flex: 1;
    }
    .bootveil {
      position: absolute;
      inset: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .bootveil .boothouse {
      position: static; /* the main .zoomwrap SVG is pinned to inset:0 — not this icon */
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
    @keyframes hp-sunfade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes hp-sunfade-out {
      from { opacity: 1; }
      to { opacity: 0; }
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
`];
