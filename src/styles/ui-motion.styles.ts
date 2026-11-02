import { css, unsafeCSS } from 'lit';
import { controlMotion } from '../ui-motion';

/** The same reduced-motion policy in independently owned component roots. */
export function controlReducedMotionCss(selector: string): string {
  return `@media (prefers-reduced-motion: reduce) {
    ${selector} { animation: none !important; transition: none !important; }
  }`;
}

/** Shared identities are defined once, adopted in each owning ShadowRoot. */
export const controlMotionStyles = unsafeCSS(css`
  @keyframes hp-ui-appear {
    from { opacity: 0; translate: 0 -10px; }
    to { opacity: 1; translate: 0 0; }
  }
  @keyframes hp-ui-leave {
    from { opacity: 1; }
    to { opacity: 0; }
  }
  @keyframes hp-ui-spin { to { rotate: 360deg; } }
  @keyframes hp-ui-pulse {
    0%, 100% { opacity: var(--hpf-loading-low, .3); }
    50% { opacity: var(--hpf-loading-high, .9); }
  }
  @keyframes hp-ui-arrival {
    0%, 100% { opacity: 0; }
    30%, 55% { opacity: 1; }
  }
  /* Shared transient contour feedback; geometry belongs to its SVG consumer. */
  .hpf-arrival-highlight {
    fill: var(--hp-accent, var(--primary-color));
    fill-opacity: .22;
    stroke: var(--hp-accent, var(--primary-color));
    stroke-width: 3px;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
    animation: hp-ui-arrival var(--hpf-arrival-cycle-duration) var(--hpf-arrival-easing) var(--hpf-arrival-iterations) both;
  }
  @media (prefers-reduced-motion: reduce) {
    .hpf-arrival-highlight { animation: none; opacity: 1; }
  }
  /* Reversible, opacity-only presentation for pointer-transparent hidden UI. */
  .hpf-fade {
    opacity: 0; visibility: hidden; pointer-events: none;
    transition: opacity var(--hpf-leave-duration) var(--hpf-leave-easing), visibility 0s linear var(--hpf-leave-duration);
  }
  .hpf-fade.is-visible {
    opacity: 1; visibility: visible; pointer-events: auto;
    transition: opacity var(--hpf-appear-duration) var(--hpf-appear-easing), visibility 0s;
  }
`.cssText + `:host {
  --hpf-paint-duration:${controlMotion.paint.duration}ms; --hpf-paint-easing:${controlMotion.paint.easing};
  --hpf-appear-duration:${controlMotion.appear.duration}ms; --hpf-appear-easing:${controlMotion.appear.easing};
  --hpf-leave-duration:${controlMotion.leave.duration}ms; --hpf-leave-easing:${controlMotion.leave.easing};
  --hpf-disclosure-duration:${controlMotion.disclosure.duration}ms; --hpf-disclosure-easing:${controlMotion.disclosure.easing};
  --hpf-spin-duration:${controlMotion.spin.duration}ms; --hpf-spin-easing:${controlMotion.spin.easing};
  --hpf-pulse-duration:${controlMotion.pulse.duration}ms; --hpf-pulse-easing:${controlMotion.pulse.easing};
  --hpf-arrival-cycle-duration:${controlMotion.arrival.duration / controlMotion.arrival.iterations}ms;
  --hpf-arrival-iterations:${controlMotion.arrival.iterations}; --hpf-arrival-easing:${controlMotion.arrival.easing};
}`
  + controlReducedMotionCss('.hpf-motion, .hpf-motion::before, .hpf-motion::after, .hpf-fade'));
