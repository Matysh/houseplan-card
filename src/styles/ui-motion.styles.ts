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
`.cssText + `:host {
  --hpf-paint-duration:${controlMotion.paint.duration}ms; --hpf-paint-easing:${controlMotion.paint.easing};
  --hpf-appear-duration:${controlMotion.appear.duration}ms; --hpf-appear-easing:${controlMotion.appear.easing};
  --hpf-leave-duration:${controlMotion.leave.duration}ms; --hpf-leave-easing:${controlMotion.leave.easing};
  --hpf-disclosure-duration:${controlMotion.disclosure.duration}ms; --hpf-disclosure-easing:${controlMotion.disclosure.easing};
  --hpf-spin-duration:${controlMotion.spin.duration}ms; --hpf-spin-easing:${controlMotion.spin.easing};
  --hpf-pulse-duration:${controlMotion.pulse.duration}ms; --hpf-pulse-easing:${controlMotion.pulse.easing};
}`
  + controlReducedMotionCss('.hpf-motion, .hpf-motion::before, .hpf-motion::after'));
