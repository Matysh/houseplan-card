/** Device markers, shells, pulses and vacuum presentation (#266, split from styles.ts). */
import { css } from 'lit';

export const devicesStyles = css`
    /* Unified device activity: alarm, short event and continuous state all
       share this one renderer. No static rings are allowed. */
    .dev ha-icon {
      position: relative;
      z-index: 1;
    }
    .device-pulse {
      position: absolute;
      left: 50%;
      top: 50%;
      width: var(--dev-size);
      height: var(--dev-size);
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 0;
    }
    .device-pulse i {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--ripple-color, var(--hp-accent));
      opacity: 0;
    }
    /* A witnessed edge: exactly three waves over the 3.3 s runtime window. */
    .device-pulse.short i {
      animation: hp-pulse-short 1.1s cubic-bezier(.22,.61,.36,1) 1 forwards;
    }
    .device-pulse.short i:nth-child(2) { animation-delay: 1.1s; }
    .device-pulse.short i:nth-child(3) { animation-delay: 2.2s; }
    .device-pulse.short.gen2 i { animation-name: hp-pulse-short-b; }
    .device-pulse.continuous i:nth-child(n + 2),
    .device-pulse.alarm i:nth-child(n + 3) { display: none; }
    .device-pulse.continuous i:first-child {
      animation: hp-pulse-continuous 3.6s cubic-bezier(.45,.05,.55,.95) infinite;
    }
    .device-pulse.alarm i {
      border-width: 3px;
      border-color: #F0410C;
      animation: hp-pulse-alarm 2.4s cubic-bezier(.22,.61,.36,1) infinite;
    }
    .device-pulse.alarm i:nth-child(2) { animation-delay: 1.2s; }
    .activity-dot {
      position: absolute;
      right: 8%;
      bottom: 8%;
      width: 18%;
      height: 18%;
      min-width: 4px;
      min-height: 4px;
      border-radius: 50%;
      background: var(--ripple-color, var(--hp-accent));
      border: 1px solid color-mix(in srgb, var(--hp-bg) 82%, transparent);
      pointer-events: none;
      z-index: 3;
    }
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
    .dev.valonly {
      /* Saved coordinates remain the centre of a Text shell. The shell may
         expand, while the invisible anchor stays one core diameter wide. */
      width: var(--dev-size, var(--icon-size, 2.5cqw));
    }
    .dev.valonly .device-core {
      width: max-content;
      min-width: var(--dev-size, var(--icon-size, 2.5cqw));
      padding-inline: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.16);
      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) / 2);
    }
    .dev .valtext {
      overflow: visible;
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * var(--value-font-scale, .45));
      font-weight: 600;
      white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      .device-pulse { display: none; }
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
    .dev {
      position: absolute;
      /* The surface resolves compatibility icon_size units once. The shared
         face receives an effective base and only applies the per-device size. */
      --dev-size: calc(var(--device-base-size, 2.25cqw) * var(--dev-scale, 1));
      /* 101.5/80 is the package shell/core ratio, including its stroke. */
      --device-shell-size: calc(var(--dev-size) * 1.26875);
      --device-shell-inset: calc(var(--dev-size) * 0.134375);
      --device-shell-stroke-ratio: 0.01875;
      --device-shell-border-width: max(1px, calc(var(--dev-size) * var(--device-shell-stroke-ratio)));
      --device-core-bg: var(--card-background-color, #fff);
      --device-core-fg: var(--primary-text-color, #252525);
      --device-core-bg: light-dark(#fff, #252525);
      --device-core-fg: light-dark(#252525, #fff);
      --device-face-bg: var(--device-core-bg);
      --device-face-fg: var(--device-core-fg);
      --device-shell-base-stroke: light-dark(#BCBCBC, rgb(37 37 37 / 75%));
      --device-shell-stroke: var(--device-shell-base-stroke);
      --device-shell-shadow:
        0 calc(var(--dev-size) * .025) calc(var(--dev-size) * .05) rgb(37 40 45 / 12%),
        0 calc(var(--dev-size) * .1) calc(var(--dev-size) * .175)
          calc(var(--dev-size) * -.025) rgb(37 40 45 / 18%);
      --device-core-inset-shadow: 0 0 0 0 transparent;
      --device-ring-color: transparent;
      --device-ring-width: 0px;
      /* The saved point is the exact centre of the icon core. */
      width: var(--dev-size);
      height: var(--dev-size);
      margin: calc(var(--dev-size) / -2) 0 0 calc(var(--dev-size) / -2);
      border: 0;
      background: transparent;
      display: block;
      color: var(--device-core-fg);
      cursor: pointer;
      pointer-events: auto;
      transition: opacity 0.2s;
      box-shadow: none;
      outline: none;
      z-index: 2;
    }
    .dev.theme-light {
      --device-core-bg: #fff;
      --device-core-fg: #000;
      --device-shell-base-stroke: #BCBCBC;
      --device-shell-stroke: var(--device-shell-base-stroke);
      --device-shell-shadow:
        0 calc(var(--dev-size) * .025) calc(var(--dev-size) * .05) rgb(37 40 45 / 12%),
        0 calc(var(--dev-size) * .1) calc(var(--dev-size) * .175)
          calc(var(--dev-size) * -.025) rgb(37 40 45 / 18%);
      --device-core-inset-shadow: 0 0 0 0 transparent;
    }
    .dev.theme-dark {
      --device-core-bg: #252525;
      --device-core-fg: #fff;
      --device-shell-base-stroke: rgb(37 37 37 / 75%);
      --device-shell-stroke: var(--device-shell-base-stroke);
      --device-shell-shadow:
        0 calc(var(--dev-size) * .025) calc(var(--dev-size) * .0375) rgb(37 40 45 / 12%),
        0 calc(var(--dev-size) * .1) calc(var(--dev-size) * .175)
          calc(var(--dev-size) * -.025) rgb(37 40 45 / 18%);
      --device-core-inset-shadow:
        inset 0 calc(var(--dev-size) * 0.0125) calc(var(--dev-size) * 0.0125) rgb(255 255 255 / 70%);
    }
    .dev::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: max(44px, var(--device-shell-size));
      height: max(44px, var(--device-shell-size));
      transform: translate(-50%, -50%);
      border-radius: 50%;
      pointer-events: auto;
      z-index: 3;
    }
    .device-shell {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: calc(var(--dev-size) * 0.1);
      padding: 0;
      min-width: var(--dev-size);
      min-height: var(--dev-size);
      border: 0;
      background: transparent;
      box-shadow: none;
      transition: opacity .2s;
      pointer-events: none;
    }
    .device-shell-frame {
      position: absolute;
      z-index: 0;
      box-sizing: border-box;
      inset: calc(var(--device-shell-inset) / -1);
      border: var(--device-shell-border-width) solid var(--device-shell-stroke);
      /* A saturating radius is resolved from the final border box. Using a
         second fractional length here lets border-box and radius quantise on
         different sides of a device pixel at some zoom/DPR combinations. */
      border-radius: 9999px;
      background: transparent;
      box-shadow: var(--device-shell-shadow);
      transition: border-color .15s, box-shadow .15s, opacity .2s;
      pointer-events: auto;
      /* Normative production fallback: never add a per-marker backdrop blur. */
      backdrop-filter: none;
    }
    .device-shell:not(.with-values) {
      left: 0;
      top: 0;
    }
    .device-shell:not(.with-values):not(.text-shell) .device-shell-frame {
      border-radius: 50%;
    }
    .device-shell.with-values.pos-right {
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }
    .device-shell.with-values.pos-left {
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      flex-direction: row-reverse;
    }
    .device-shell.with-values.pos-bottom {
      left: 50%;
      top: 0;
      transform: translateX(-50%);
      flex-direction: column;
    }
    .device-shell.with-values.pos-top {
      left: 50%;
      bottom: 0;
      transform: translateX(-50%);
      flex-direction: column-reverse;
    }
    .device-core {
      position: relative;
      z-index: 1;
      box-sizing: border-box;
      flex: 0 0 auto;
      width: var(--dev-size);
      height: var(--dev-size);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--device-face-bg);
      color: var(--device-face-fg);
      box-shadow:
        var(--device-core-inset-shadow),
        0 0 0 var(--device-ring-width) var(--device-ring-color);
      line-height: 0;
      transition: background .15s, color .15s, box-shadow .15s, opacity .2s;
      pointer-events: none;
    }
    .device-sections {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: calc(var(--dev-size) * .08);
      min-width: 0;
      pointer-events: none;
    }
    .device-shell.pos-top .device-sections,
    .device-shell.pos-bottom .device-sections {
      flex-direction: row;
    }
    .dev ha-icon {
      /* from --dev-size, NOT --icon-size: the per-device size multiplier must
         scale the GLYPH with its badge. Pinned to the base size, "make this
         icon bigger" grew an empty box around a default-size glyph (user
         report via the owner, 2026-07-29). */
      --mdc-icon-size: calc(var(--dev-size, var(--device-base-size, 2.25cqw)) * 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .dev.on {
      --device-face-bg: #F0A00C;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #F0A00C;
    }
    .dev.theme-light.on { --device-face-fg: #fff; }
    .dev.theme-dark.on {
      --device-face-fg: #252525;
      --device-shell-stroke-ratio: .0375;
    }
    .dev.open {
      --device-face-bg: var(--hp-open);
      --device-face-fg: light-dark(#fff, #252525);
    }
    .dev.theme-light.open { --device-face-fg: #fff; }
    .dev.theme-dark.open { --device-face-fg: #252525; }
    .dev.lock-locked {
      --device-face-bg: #66D17A;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #66D17A;
    }
    .dev.theme-light.lock-locked { --device-face-fg: #fff; }
    .dev.theme-dark.lock-locked {
      --device-face-fg: #252525;
      --device-shell-stroke-ratio: .025;
    }
    .dev.lock-unlocked {
      --device-face-bg: #F0410C;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #F0410C;
    }
    .dev.theme-light.lock-unlocked { --device-face-fg: #fff; }
    .dev.theme-dark.lock-unlocked {
      --device-face-fg: #252525;
      --device-shell-stroke-ratio: .025;
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
    .dev.unavail {
      opacity: 0.35;
      --device-face-bg: #B5BAC1;
      --device-shell-stroke: var(--device-shell-base-stroke);
    }
    .dev.virtual .device-shell-frame {
      border-style: dashed;
    }
    /* "hide from plan" flag, shown only in the device editor with the
       "show hidden devices" toggle on (docs/FILTERING.md). BLUE, so a hidden
       device cannot be mistaken for an unavailable one (translucent dark) —
       and no live-state paint at all: a ghost is configuration, not status
       (owner's request). */
    .dev.ghost {
      opacity: 0.6;
      color: var(--hp-accent);
    }
    .dev.ghost .device-shell-frame {
      border-style: dashed;
      border-color: var(--hp-accent);
      box-shadow: none;
    }
    .dev.ghost .device-core {
      background: rgba(62, 166, 255, 0.22); /* fallback for old WebViews */
      background: color-mix(in srgb, var(--hp-accent) 30%, var(--card-background-color, #1c2530));
      color: var(--hp-accent);
    }
    /* HA-disabled is not a user hide: neutral grey + a power-off badge keeps
       the two ghosts distinguishable without relying on colour alone. */
    .dev.ghost.ha-disabled {
      opacity: 0.62;
      color: var(--secondary-text-color, #9aa0aa);
    }
    .dev.ghost.ha-disabled .device-shell-frame {
      border-color: var(--secondary-text-color, #9aa0aa);
    }
    .dev.ghost.ha-disabled .device-core {
      background: rgba(120, 124, 134, 0.2);
      background: color-mix(in srgb, var(--secondary-text-color, #9aa0aa) 24%, var(--card-background-color, #1c2530));
      color: var(--secondary-text-color, #9aa0aa);
    }
    .dev .habadge {
      position: absolute;
      right: -18%;
      bottom: -18%;
      display: grid;
      place-items: center;
      width: 46%;
      height: 46%;
      min-width: 12px;
      min-height: 12px;
      border-radius: 50%;
      background: var(--card-background-color, #242832);
      border: 1px solid currentColor;
    }
    .dev .habadge ha-icon { width: 72%; height: 72%; }
    .dev.sel {
      --device-ring-color: #F0A00C;
      --device-ring-width: calc(var(--dev-size) * 0.0375);
    }
    .dev:focus-visible {
      --device-ring-color: #0C82F0;
      --device-ring-width: calc(var(--dev-size) * 0.0375);
    }
    .dev:not(.on):not(.open):not(.alarm):not(.lock-locked):not(.lock-unlocked):not(.unavail):focus-visible {
      --device-face-fg: #0C82F0;
    }
    /* Alert stays above focus, selection, hover and ordinary semantic paint. */
    .dev.alarm,
    :host([data-pointer-hover]) .dev.alarm:hover,
    .dev.alarm:focus-visible {
      --device-face-bg: #F0410C;
      --device-face-fg: light-dark(#fff, #252525);
      --device-shell-stroke: #F0410C;
    }
    .dev.theme-light.alarm { --device-face-fg: #fff; }
    .dev.theme-dark.alarm {
      --device-face-fg: #252525;
      --device-shell-stroke-ratio: .025;
    }
    .dev .value-badge {
      position: relative;
      z-index: 2;
      box-sizing: border-box;
      width: max-content;
      min-width: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * .7875);
      height: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * .7875);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      background: var(--device-core-bg);
      border: 0;
      border-radius: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.39375);
      padding: 0 calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.14);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * var(--value-font-scale, .45));
      font-weight: 600;
      line-height: 1;
      color: var(--device-core-fg);
      white-space: nowrap;
      pointer-events: none;
    }
    .dev .value-badge.unavailable,
    .dev .value-badge.missing { opacity: 0.66; }
    .dev .lqi {
      position: absolute;
      top: calc(50% + var(--device-shell-size) / 2 + var(--dev-size) * .05);
      left: 50%;
      transform: translateX(-50%);
      margin-top: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.05);
      font-size: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.38);
      font-weight: 600;
      line-height: 1;
      text-shadow: 0 0 3px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.9);
      white-space: nowrap;
      pointer-events: none;
    }
    .dev .lqi.below-value-badge {
      margin-top: calc(var(--dev-size, var(--icon-size, 2.5cqw)) * 0.8875);
    }
    .temprange {
      display: inline-flex;
      align-items: center;
      gap: var(--sp-3);
      margin-left: auto;
      color: var(--hp-muted);
      font-size: var(--fs-s);
    }
    /* #162: the dock says the moving robot is drawn nowhere. Amber is not the
       only signal — the alert glyph carries the same meaning without colour,
       and the accessible name carries the exact reason. */
    .vacwarn {
      position: absolute;
      top: -12%;
      right: -12%;
      width: calc(var(--device-base-size, 2.25cqw) * 0.42);
      height: calc(var(--device-base-size, 2.25cqw) * 0.42);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: light-dark(#fff, #252525);
      border: 1px solid #E5A100;
      color: #E5A100;
      z-index: 7;
      pointer-events: none;
    }
    .vacwarn ha-icon {
      --mdc-icon-size: calc(var(--device-base-size, 2.25cqw) * 0.32);
      color: inherit;
    }
    /* live vacuum: a round puck, no badge plate, soft pulse (docs/VACUUM.md) */
    .vacpuck {
      position: absolute;
      /* the base badge, but round and 20% smaller — the owner's wording:
         «иконка похожа на иконку базы, только круглая и чуть меньше» */
      --puck-size: calc(var(--device-base-size, 2.25cqw) * 0.8);
      width: var(--puck-size);
      height: var(--puck-size);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      --vac-core-bg: light-dark(#fff, #252525);
      --vac-core-fg: light-dark(#252525, #fff);
      background: var(--vac-core-bg);
      border: 1px solid #BCBCBC;
      box-shadow:
        0 1px 2px rgb(37 40 45 / 12%),
        0 4px 8px -1.07px rgb(37 40 45 / 18%);
      color: var(--vac-core-fg);
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
    .vacpuck.theme-light { --vac-core-bg: #fff; --vac-core-fg: #252525; }
    .vacpuck.theme-dark { --vac-core-bg: #252525; --vac-core-fg: #fff; }
    .vacpuck.jump { transition: none; }
    .vacpuck.stale { opacity: 0.45; animation: none; }
    .vacpuck ha-icon {
      --mdc-icon-size: calc(var(--puck-size) * 0.68);
      color: var(--vac-core-fg);
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
    .vactrail polyline,
    .vactrail path {
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
    .devicepreview-empty {
      min-height: 82px;
      margin: 4px 0 14px;
      padding: var(--sp-4);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sp-3);
      border: 1px dashed var(--hp-line);
      border-radius: var(--rad-m);
      color: var(--hp-muted);
      text-align: center;
    }
`;
