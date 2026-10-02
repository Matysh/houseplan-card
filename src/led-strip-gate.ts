/**
 * The LED strips' only foothold in the initial View graph (#780, ТЗ §13.1):
 * which markers a space shows as a strip, the anchor that replaces their icon
 * position, and one page-wide load of the lazy `led-strip-runtime` chunk.
 * Geometry, light and hit-testing live in the chunk.
 *
 * A strip is represented when it is active and bound; the card additionally
 * checks the marker is a live device of that space. `active: false` shapes,
 * unbound strips and an empty array never ask for the chunk. A failed load is
 * fail-dark for the strips only and is retried on the next explicit entry
 * (another space or the LED tool) — never in a loop; a chunk of another build
 * is never installed.
 */
import { ENTRY_BUILD_FINGERPRINT } from './editor-runtime-loader';
import type { LedStripModel, SpaceModel } from './types';

type LedRuntime = typeof import('./led-strip-runtime');
type LedEditorModule = typeof import('./led-strip-editor');

/** One page-wide lazy chunk; `failed` is the entry that failed last, '' = a foreign build. */
interface Slot<M> { module: M | null; loading: Promise<unknown> | null; failed?: string }

const runtimeSlot: Slot<LedRuntime> = { module: null, loading: null };
const editorSlot: Slot<LedEditorModule> = { module: null, loading: null };

function lazy<M>(
  slot: Slot<M>, entry: string, ready: () => void,
  first: () => Promise<M>, retry: string, fingerprint: (module: M) => string,
): M | null {
  if (!slot.module && !slot.loading && slot.failed !== entry && slot.failed !== '') {
    slot.loading = (slot.failed === undefined ? first()
      : import(/* @vite-ignore */ new URL(`${retry}?${Date.now()}`, import.meta.url).href) as Promise<M>
    ).then((module) => {
      if (fingerprint(module) === ENTRY_BUILD_FINGERPRINT) slot.module = module;
      else slot.failed = '';
    }, () => { slot.failed = entry; }).finally(() => { slot.loading = null; });
  }
  if (!slot.module) void slot.loading?.then(() => slot.module && ready());
  return slot.module;
}

/** Active, bound strips of a space by marker id. No geometry. */
export function ledStripsByMarker(space: SpaceModel | null | undefined): Map<string, LedStripModel> {
  const out = new Map<string, LedStripModel>();
  for (const strip of space?.led_strips || []) {
    if (strip?.active !== false && strip.marker && strip.points?.length > 1) out.set(strip.marker, strip);
  }
  return out;
}

/** The point at half the polyline length (ТЗ §5), in render units (`scale` = NORM_W). */
export function ledAnchor(points: readonly number[][], scale: number): { x: number; y: number } {
  const step = (i: number) => Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  let left = 0;
  for (let i = 1; i < points.length; i++) left += step(i) / 2;
  let i = 1;
  while (i < points.length - 1 && step(i) < left) left -= step(i++);
  const t = Math.min(1, left / (step(i) || 1));
  const a = points[i - 1], b = points[i] || a;
  return { x: (a[0] + (b[0] - a[0]) * t) * scale, y: (a[1] + (b[1] - a[1]) * t) * scale };
}

/**
 * The runtime when it is here; otherwise one page-wide load and `ready` when
 * it lands. `entry` names the explicit entry (space id or the LED tool).
 */
export function ledRuntime(entry: string, ready: () => void): LedRuntime | null {
  return lazy(runtimeSlot, entry, ready, () => import('./led-strip-runtime'),
    '__HOUSEPLAN_LED_RETRY_ASSET__', (module) => module.LED_RUNTIME_FINGERPRINT);
}

/** The Devices-editor LED tool chunk (ТЗ §13.1): only on an explicit entry. */
export function ledEditorModule(entry: string, ready: () => void): LedEditorModule | null {
  return lazy(editorSlot, entry, ready, () => import('./led-strip-editor'),
    '__HOUSEPLAN_LED_EDITOR_RETRY_ASSET__', (module) => module.LED_EDITOR_FINGERPRINT);
}
