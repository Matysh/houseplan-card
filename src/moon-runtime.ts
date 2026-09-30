/**
 * The lazy moon chunk (#661, C7): astronomy, the designer's art, the element
 * template and the moon's own 30 s ticker. `moon-gate.ts` imports it only
 * while the moon is switched on, the background follows the sun and it is not
 * daytime; until then the initial View graph carries none of this.
 *
 * One element inside `.hp-day-cycle-env`, after the four phase layers: above
 * the gradients and the sun glow, below the plan paper and everything else
 * (owner decision 7). Its styles travel with it, so the View card, kiosk and
 * `houseplan-space-card` get the same moon without growing their own CSS.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { MOON_ART } from './moon-art.generated';
import {
  MOON_SHARP_FROM, moonFingerprint, moonPhasePath, moonView, type MoonView,
} from './moon';
import type { DayCyclePhase } from './sun';

export const MOON_RUNTIME_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

/** The card that shows the moon: the View card or `houseplan-space-card`. */
export interface MoonHost {
  readonly isConnected: boolean;
  readonly updateComplete: Promise<unknown>;
  readonly hass?: { config?: unknown };
  requestUpdate(): void;
}

/** C3: the environment ticker period; the moon rises at most 0.25°/min. */
export const MOON_TICK_MS = 30_000;

/**
 * C6: box `min(200px, 25cqmin)` measured on the scene (the environment is the
 * size container), 5 % inset, never moved by pan or zoom, never hit-tested.
 * C4: opacity only, 2 s on the background curve; reduced motion — instant.
 * C8: no CSS filter and no will-change on the element.
 */
const MOON_CSS = '.hp-day-cycle-env{container-type:size}'
  + '.hp-moon{--hp-moon-box:min(200px,25cqmin);position:absolute;'
  + 'left:calc(var(--hp-moon-box)*.05);top:calc(var(--hp-moon-box)*.05);'
  + 'width:var(--hp-moon-box);height:var(--hp-moon-box);opacity:0;pointer-events:none;'
  + 'transition:opacity 2000ms cubic-bezier(.22,.61,.36,1)}' // RAY_FADE_MS, pinned by the test
  + '.hp-moon.on{opacity:1}'
  + '@media (prefers-reduced-motion:reduce){.hp-moon{transition:none}}';

interface MoonWatch {
  settings: unknown;
  phase: DayCyclePhase;
  /** Fingerprint of what is on screen (or was last asked for). */
  key: string;
  /** Set by every render that includes the moon; cleared when a tick asks for one. */
  seen: boolean;
  timer: ReturnType<typeof setInterval>;
}

const watches = new WeakMap<MoonHost, MoonWatch>();

function forget(host: MoonHost, watch: MoonWatch): void {
  clearInterval(watch.timer);
  if (watches.get(host) === watch) watches.delete(host);
}

/**
 * C3: between renders only the clock moves the moon. Every 30 s the tick
 * recomputes it from the last rendered inputs; an equal fingerprint costs no
 * render. A host that re-rendered without a moon (switched off, editor mode,
 * static background) or left the page drops its ticker; a hidden page skips.
 */
export function moonTick(host: MoonHost, now: Date = new Date()): void {
  const watch = watches.get(host);
  if (!watch) return;
  if (!host.isConnected) { forget(host, watch); return; }
  if (globalThis.document?.visibilityState === 'hidden') return;
  const key = moonFingerprint(moonView(watch.settings, watch.phase, host.hass?.config, now));
  if (key === watch.key) return;
  watch.key = key;
  watch.seen = false;
  host.requestUpdate();
  void host.updateComplete.then(() => { if (!watch.seen) forget(host, watch); });
}

function remember(host: MoonHost, settings: unknown, phase: DayCyclePhase, view: MoonView): void {
  const key = moonFingerprint(view);
  const watch = watches.get(host);
  if (watch) {
    Object.assign(watch, { settings, phase, key, seen: true });
    return;
  }
  watches.set(host, {
    settings, phase, key, seen: true,
    timer: setInterval(() => moonTick(host), MOON_TICK_MS),
  });
}

/**
 * The element stays in the environment while the moon is switched on, at
 * opacity 0 when hidden, so rising, setting, the new-moon threshold and the
 * day phase all fade (C4). A freshly created element takes its final state at
 * once: the first appearance after a page or chunk load is not animated.
 */
export function renderMoon(
  host: MoonHost, settings: unknown, phase: DayCyclePhase, now: Date = new Date(),
): TemplateResult {
  const view = moonView(settings, phase, host.hass?.config, now);
  remember(host, settings, phase, view);
  return html`<style>${MOON_CSS}</style><svg class="hp-moon${view.visible ? ' on' : ''}"
      viewBox="0 0 512 512" aria-hidden="true" focusable="false"
      data-moon-k=${view.k.toFixed(2)} data-moon-visible=${view.visible ? 'true' : 'false'}>
    <defs>
      <g id="hp-moon-art">${MOON_ART}</g>
      <filter id="hp-moon-soft" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="5"></feGaussianBlur>
      </filter>
      <mask id="hp-moon-phase" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
        <path d=${moonPhasePath(view.k)} fill="#fff"
          filter=${view.k >= MOON_SHARP_FROM ? nothing : 'url(#hp-moon-soft)'}></path>
      </mask>
    </defs>
    <use href="#hp-moon-art" opacity="0.08"></use>
    <use href="#hp-moon-art" mask="url(#hp-moon-phase)"></use>
  </svg>`;
}
