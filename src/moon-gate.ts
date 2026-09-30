/**
 * The moon's only foothold in the initial View graph (#661, C7): whether the
 * lazy `moon-runtime` chunk is wanted, and one load per page for every card on
 * it. It is wanted when the moon is switched on on a View surface and it is
 * not daytime — with any background (#718 K1): over "Follow the Sun" the moon
 * lives in the environment, over a static one in its own sky layer — and when
 * General settings open, for the status line (#718 K6). Everything else —
 * astronomy, art, element, layer, its 30 s ticker, the status — lives in the
 * chunk.
 *
 * The contract of the other lazy runtimes, in the fewest bytes (the initial
 * graph sits at its budget): a chunk from another build is never installed and
 * never asked for again; a failed load leaves no moon and is retried at most
 * every 30 s, on the next request, from the content-hashed URL with a fresh
 * query so the browser's cached failure is not replayed.
 */
import { nothing, type TemplateResult } from 'lit';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import { dayCycleFingerprint, resolveDayCycle, type DayCycleState } from './sun';

type MoonRuntime = typeof import('./moon-runtime');
export type MoonHost = import('./moon-runtime').MoonHost;

const MOON_RETRY_ASSET = '__HOUSEPLAN_MOON_RETRY_ASSET__';
let runtime: MoonRuntime | null = null;
/** The load in flight: every caller meanwhile waits for the same one. */
let loading: Promise<void> | null = null;
/** Earliest next attempt; 0 before the first, Infinity after a foreign build. */
let nextAttempt = 0;

const moonOn = (settings: unknown): boolean => (settings as { moon?: unknown } | null | undefined)?.moon === true;

/**
 * `use` gets the chunk: at once when it is here, else when the page-wide load
 * brings it. A failure, a load still barred by the 30 s retry or a chunk of
 * another build never call it.
 */
export function withMoon(use: (moon: MoonRuntime) => void): void {
  if (runtime) { use(runtime); return; }
  if (!loading && Date.now() >= nextAttempt) {
    const retry = nextAttempt > 0;
    nextAttempt = Date.now() + 30_000;
    loading = (retry
      ? import(/* @vite-ignore */ new URL(`${MOON_RETRY_ASSET}?${nextAttempt}`, import.meta.url).href) as Promise<MoonRuntime>
      : import('./moon-runtime')
    ).then((module) => {
      loading = null;
      if (module.MOON_RUNTIME_FINGERPRINT === ENTRY_BUILD_FINGERPRINT) runtime = module;
      else nextAttempt = Infinity;
    }, () => { loading = null; });
  }
  void loading?.then(() => { if (runtime) use(runtime); });
}

/**
 * #718 K1/K5: the phase the moon uses where no environment is drawn — a static
 * background (global or the space's own), the moon switched on, a View
 * surface (`viewWeight` of #101 above 0). Anything else computes nothing.
 */
export function moonSkyState(
  settings: unknown, daynight: boolean, viewWeight: number, hass: unknown, now: Date | number = new Date(),
): DayCycleState | null {
  return !daynight && viewWeight > 0 && moonOn(settings) ? resolveDayCycle(hass, now) : null;
}

/**
 * #718 K5: what the 30 s clock ticker compares — the whole environment (its
 * sun moves every minute), but only the phase of the moon's sky, so a static
 * background re-renders at 08:00 and 18:00, not every minute.
 */
export function dayCycleClock(
  env: DayCycleState | null, sky: DayCycleState | null,
): [DayCycleState | null, string] {
  return [env ?? sky, env ? dayCycleFingerprint(env) : sky ? sky.phase : ''];
}

/**
 * The moon element. `state` is the day-cycle sample (null: no moon);
 * `settings` the global settings, where only an explicit `moon: true` counts
 * (C1). Without `sky` the element goes into `renderDayCycleEnvironment`; with
 * it (the View weight) it comes in its own layer for a static background.
 * Nothing until the chunk is here; the card that asked re-renders when it
 * arrives.
 */
export function moonLayer(
  host: MoonHost | undefined, settings: unknown, state: DayCycleState | null, sky?: number,
): TemplateResult | typeof nothing {
  if (!host || !state || !moonOn(settings)) return nothing;
  if (!runtime && state.phase !== 'day') withMoon(() => host.requestUpdate());
  if (!runtime) return nothing;
  return sky === undefined
    ? runtime.renderMoon(host, settings, state.phase)
    : runtime.renderMoonSky(host, settings, state.phase, sky);
}
