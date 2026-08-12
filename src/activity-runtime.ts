import type { PresentationActivityRuntime } from './device-presentation';
import { combineVisualSamples, edgeActivity, type EntityVisualSample } from './device-visual';

export const ACTIVITY_WINDOW_MS = 3300;
export const ACTIVITY_REPAINT_DELAY_MS = ACTIVITY_WINDOW_MS + 60;

/** Shared finite-edge history used by both plan renderers. Keeping the edge
 * ordering here prevents the full and read-only cards from assigning different
 * meaning to the same HA state sequence. */
export interface FiniteActivityRuntime extends PresentationActivityRuntime {
  last: Record<string, string>;
  timer: number;
}

export function createFiniteActivityRuntime(
  sources: string,
  samples: readonly EntityVisualSample[],
): FiniteActivityRuntime {
  return {
    sources,
    last: Object.fromEntries(samples.map((sample) => [sample.eid, sample.state])),
    flashTs: 0,
    flashKind: null,
    timer: 0,
    gen: 0,
    expiresAt: 0,
    alarmActive: combineVisualSamples(samples).status === 'alarm',
  };
}

export function resetFiniteActivityRuntime(
  runtime: FiniteActivityRuntime,
  sources: string,
  samples: readonly EntityVisualSample[],
  clearTimer: (timer: number) => void,
): void {
  clearTimer(runtime.timer);
  const fresh = createFiniteActivityRuntime(sources, samples);
  Object.assign(runtime, fresh);
}

export function stampFiniteActivity(
  runtime: FiniteActivityRuntime,
  kind: 'event' | 'transition',
  now: number,
  clearTimer: (timer: number) => void,
  scheduleRepaint: (delayMs: number) => number,
): void {
  if (runtime.flashTs && now - runtime.flashTs < ACTIVITY_WINDOW_MS
      && runtime.flashKind === 'event' && kind === 'transition') return;
  runtime.flashTs = now;
  runtime.expiresAt = now + ACTIVITY_WINDOW_MS;
  runtime.flashKind = kind;
  runtime.gen++;
  clearTimer(runtime.timer);
  runtime.timer = scheduleRepaint(ACTIVITY_REPAINT_DELAY_MS);
}

/** Advance one already-baselined runtime. Alarm and an integration-provided
 * travelling state own the timeline; recovery only establishes a baseline. */
export function advanceFiniteActivity(
  runtime: FiniteActivityRuntime,
  samples: readonly EntityVisualSample[],
  clearTimer: (timer: number) => void,
): 'event' | 'transition' | null {
  if (runtime.flashKind === 'transition'
      && samples.some((sample) => sample.activity === 'transition')) {
    clearTimer(runtime.timer);
    runtime.flashTs = 0;
    runtime.flashKind = null;
    runtime.expiresAt = 0;
  }

  const alarm = combineVisualSamples(samples).status === 'alarm';
  if (alarm) {
    if (!runtime.alarmActive) {
      clearTimer(runtime.timer);
      runtime.flashTs = 0;
      runtime.flashKind = null;
      runtime.expiresAt = 0;
    }
    for (const sample of samples) runtime.last[sample.eid] = sample.state;
    runtime.alarmActive = true;
    return null;
  }
  if (runtime.alarmActive) {
    for (const sample of samples) runtime.last[sample.eid] = sample.state;
    runtime.alarmActive = false;
    return null;
  }

  let edge: 'event' | 'transition' | null = null;
  for (const sample of samples) {
    const found = edgeActivity(runtime.last[sample.eid], sample);
    if (found === 'event' || (!edge && found)) edge = found;
    runtime.last[sample.eid] = sample.state;
  }
  return edge;
}
