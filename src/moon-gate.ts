/**
 * The moon's only foothold in the initial View graph (#661, C7): whether the
 * lazy `moon-runtime` chunk is wanted, and one load per page for every card on
 * it. It is wanted when the moon is switched on, the environment exists (the
 * effective background follows the sun, on a View surface) and it is not
 * daytime. Everything else — astronomy, art, element, its 30 s ticker — lives
 * in the chunk.
 *
 * The contract of the other lazy runtimes, in the fewest bytes (the initial
 * graph sits at its budget): a chunk from another build is never installed and
 * never asked for again; a failed load leaves no moon and is retried at most
 * every 30 s, on the next render, from the content-hashed URL with a fresh
 * query so the browser's cached failure is not replayed.
 */
import { nothing, type TemplateResult } from 'lit';
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import type { DayCycleState } from './sun';

type MoonRuntime = typeof import('./moon-runtime');
export type MoonHost = import('./moon-runtime').MoonHost;

const MOON_RETRY_ASSET = '__HOUSEPLAN_MOON_RETRY_ASSET__';
let runtime: MoonRuntime | null = null;
/** Earliest next attempt; 0 before the first, Infinity after a foreign build. */
let nextAttempt = 0;

/**
 * The moon element for `renderDayCycleEnvironment`. `state` is the
 * environment (null: no environment, so no moon); `settings` the global
 * settings, where only an explicit `moon: true` counts (C1). Nothing until the
 * chunk is here; the card that asked re-renders when it arrives.
 */
export function moonLayer(
  host: MoonHost | undefined, settings: unknown, state: DayCycleState | null,
): TemplateResult | typeof nothing {
  if (!host || !state || (settings as { moon?: unknown } | null | undefined)?.moon !== true) return nothing;
  if (!runtime && state.phase !== 'day' && Date.now() >= nextAttempt) {
    const retry = nextAttempt > 0;
    nextAttempt = Date.now() + 30_000;
    (retry
      ? import(/* @vite-ignore */ new URL(`${MOON_RETRY_ASSET}?${nextAttempt}`, import.meta.url).href) as Promise<MoonRuntime>
      : import('./moon-runtime')
    ).then((module) => {
      if (module.MOON_RUNTIME_FINGERPRINT !== ENTRY_BUILD_FINGERPRINT) { nextAttempt = Infinity; return; }
      runtime = module;
      host.requestUpdate();
    }, () => undefined);
  }
  return runtime?.renderMoon(host, settings, state.phase) ?? nothing;
}
