/**
 * #850: the incremental render-device snapshot, owned by the lazy live runtime.
 *
 * A capture used to resolve two presentations for every device and deep-copy
 * every projected row, although an ordinary HA tick changes one state row.
 * This window keeps the previous capture and reuses what provably did not
 * change. Two keys hold every non-state input of a capture by identity; the
 * lists are open towards rebuilding, never towards reuse:
 *
 * - the source key — both registry projections, the roster, layout, config
 *   epoch (every in-place config edit bumps it; DevItems hold live marker
 *   records), the stored config with its settings and markers, the plan
 *   model, the summary and vacuum-fit rows. A change forgets everything: the
 *   clone memo, the previous projections and every presentation;
 * - the presentation key — every top-level HA member except `states` (locale,
 *   themes, formatters, config…), the card config, manual lights, the plan
 *   light graph, reduced motion and each activity runtime with its live window
 *   at this moment. A change rebuilds every presentation; unchanged rows,
 *   DevItems and the roster keep their clones, lent to a new clone memo
 *   (`lend`) so the weak table does not collect every rebuilt presentation.
 *
 * With both keys equal only state rows changed. Each device's presentations
 * resolve against projections whose `states` record every row read (a get, an
 * `in` test, a descriptor, or — failing open — an iteration, which marks the
 * device as reading everything); a device is rebuilt when one of its recorded
 * rows changed identity (HA replaces a row on any state or attribute change),
 * the others keep their presentation object. Cloning shares one memo per
 * window, so an unchanged row, DevItem, roster or presentation keeps its frozen
 * clone, and the registry projections are taken from the previous snapshot.
 *
 * The result equals a complete rebuild (the differential oracle in
 * test/render-snapshot-incremental.test.mjs). `reset()` forgets everything:
 * disconnect, and any capture that did not finish.
 */
import { presentationSnapshotKey, type RenderDeviceSnapshot } from './render-device-snapshot';
import type { RenderSnapshotHost, RenderSnapshotReuse, RenderSnapshotWindow } from './render-snapshot-capture';
import type { ResolvedDevicePresentation } from './device-presentation';

/** A recorded iteration of the states map: the device depends on every row. */
const EVERY_ROW = '\u0000*';
const ACTIVITY_WINDOW_MS = 3300;

const same = (a: readonly unknown[] | null, b: readonly unknown[]): boolean =>
  !!a && a.length === b.length && a.every((value, index) => value === b[index]);

export class RenderSnapshotReuseWindow implements RenderSnapshotReuse {
  /**
   * Exact work counters for the performance witness (#850 AC1): captures that
   * started from nothing (`full`), that kept the rows but rebuilt every
   * presentation (`refreshed`), that rebuilt only the devices whose rows
   * changed (`incremental`), and presentations resolved.
   */
  public readonly stats = { full: 0, refreshed: 0, incremental: 0, presentations: 0 };
  private sources: unknown[] | null = null;
  private inputs: unknown[] | null = null;
  private previous: RenderDeviceSnapshot | null = null;
  private memo = new WeakMap<object, unknown>();
  /** Raw HA row of every recorded key at the last capture. */
  private rows = new Map<string, unknown>();
  /** Recorded rows of each device's two presentations. */
  private deps = new Map<string, Set<string>>();
  private built = new Map<string, ResolvedDevicePresentation>();
  /** Rows changed since the last capture; null while every presentation is rebuilt. */
  private changed: Set<string> | null = null;
  private fresh = new Set<string>();
  private reading: Set<string> | null = null;
  private raw: Readonly<Record<string, unknown>> = {};
  private open = false;

  public begin(host: RenderSnapshotHost, lightSources: unknown): RenderSnapshotWindow {
    if (this.open) this.reset();
    this.open = true;
    this.fresh.clear();
    const hass = host._planHass, registry = host._fullRegistryHass;
    const now = Date.now();
    const sources: unknown[] = [
      hass?.entities, hass?.devices, registry?.entities, registry?.devices, host._devices, host._layout,
      host._cfgEpoch, host._serverCfg, host._serverCfg?.settings, host._model, host._vacFit?.source,
      [...host._summary?.entityIds() || []].join('\n'),
    ];
    const inputs: unknown[] = [host._config, host._virtualLights, lightSources, host._reducedMotion];
    for (const name of Object.keys(host.hass || {}).sort()) if (name !== 'states') inputs.push(name, host.hass[name]);
    for (const [id, runtime] of host._activityRt) {
      const expires = runtime.expiresAt || runtime.flashTs + ACTIVITY_WINDOW_MS;
      inputs.push(id, runtime.gen, runtime.flashTs, runtime.flashKind, runtime.expiresAt, runtime.sources,
        runtime.alarmActive, !!(runtime.flashTs && runtime.flashKind && expires > now));
    }
    const kept = !!this.previous && same(this.sources, sources);
    const reusable = kept && same(this.inputs, inputs);
    this.sources = sources;
    this.inputs = inputs;
    if (!kept) {
      this.previous = null;
      this.memo = new WeakMap();
    } else if (!reusable) {
      this.memo = this.lend(host);
    }
    // The raw HA rows: the active projection holds the same row objects or,
    // for a registry-disabled entity (a source-key change), none.
    const raw = this.raw = registry?.states || hass?.states || {};
    this.stats[reusable ? 'incremental' : kept ? 'refreshed' : 'full']++;
    if (reusable) {
      this.changed = new Set([...this.rows].filter(([id, row]) => raw[id] !== row).map(([id]) => id));
    } else {
      this.changed = null;
      this.deps.clear();
      this.built.clear();
    }
    return {
      hass: this.track(hass), registry: this.track(registry), memo: this.memo,
      previous: kept ? this.previous : null,
    };
  }

  public present(
    id: string, showLqi: boolean, build: () => ResolvedDevicePresentation,
  ): ResolvedDevicePresentation {
    const key = presentationSnapshotKey(id, showLqi);
    const deps = this.deps.get(id);
    const kept = this.built.get(key);
    if (!this.fresh.has(id) && this.changed && deps && kept
        && !deps.has(EVERY_ROW) && ![...deps].some((row) => this.changed!.has(row))) return kept;
    if (!this.fresh.has(id)) {
      this.fresh.add(id);
      this.deps.set(id, new Set());
    }
    this.reading = this.deps.get(id)!;
    this.stats.presentations++;
    try {
      const presentation = build();
      this.built.set(key, presentation);
      return presentation;
    } finally { this.reading = null; }
  }

  public end(snapshot: RenderDeviceSnapshot): void {
    this.open = false;
    this.changed = null;
    this.previous = snapshot;
    this.rows.clear();
    for (const deps of this.deps.values()) for (const id of deps) this.rows.set(id, this.raw[id]);
  }

  public reset(): void {
    this.open = false;
    this.sources = null;
    this.inputs = null;
    this.previous = null;
    this.memo = new WeakMap();
    this.rows.clear();
    this.deps.clear();
    this.built.clear();
    this.changed = null;
    this.reading = null;
    this.raw = {};
  }

  /**
   * A capture that rebuilds every presentation starts a new clone memo: the
   * old one would keep collecting every rebuilt presentation's objects (a
   * large weak table the garbage collector walks on every tick of a light).
   * The sources are unchanged, so the previous clones of the roster and its
   * DevItems, of every state row HA did not replace (camera rows are rewritten
   * copies, never lent) and of the registry device rows stay valid and are lent.
   */
  private lend(host: RenderSnapshotHost): WeakMap<object, unknown> {
    const memo = new WeakMap<object, unknown>();
    const previous = this.previous!;
    const pair = (source: unknown, clone: unknown): void => {
      if (source && typeof source === 'object' && clone) memo.set(source, clone);
    };
    pair(host._devices, previous.devices);
    host._devices.forEach((device, index) => pair(device, previous.devices[index]));
    for (const [id, row] of Object.entries(previous.hass.states)) if (!id.startsWith('camera.')) pair(this.raw[id], row);
    for (const [id, row] of Object.entries(previous.hass.devices)) pair(host._planHass?.devices?.[id], row);
    return memo;
  }

  /** The projection with a `states` map that records what the current device reads. */
  private track<T extends { states?: Record<string, unknown> } | null | undefined>(hass: T): T {
    if (!hass) return hass;
    const record = (name: string | symbol): void => {
      if (typeof name === 'string') this.reading?.add(name);
    };
    const states = new Proxy(hass.states || {}, {
      get: (target, name) => { record(name); return Reflect.get(target, name); },
      has: (target, name) => { record(name); return Reflect.has(target, name); },
      getOwnPropertyDescriptor: (target, name) => { record(name); return Reflect.getOwnPropertyDescriptor(target, name); },
      ownKeys: (target) => { this.reading?.add(EVERY_ROW); return Reflect.ownKeys(target); },
    });
    return { ...hass, states };
  }
}
