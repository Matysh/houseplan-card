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
 *   epoch, the stored config with its settings and markers, the plan model,
 *   the summary and vacuum-fit rows, and the content of the roster and the
 *   stored settings: DevItems hold the live marker records, which an edit may
 *   change in place without a new epoch. A change forgets everything: the
 *   clone memo, the previous projections and every presentation;
 * - the presentation key — every top-level HA member except `states` (locale,
 *   themes, formatters, config…), the card config and its content, manual
 *   lights, the light graph's topology, reduced motion and each activity runtime
 *   with its live window at this moment. A change rebuilds every presentation; unchanged rows,
 *   DevItems and the roster keep their clones, lent to a new clone memo
 *   (`lend`) so the weak table does not collect every rebuilt presentation.
 *
 * With both keys equal only state rows changed. Each device's presentations
 * resolve against projections whose `states` record every row read (a get, an
 * `in` test, a descriptor, or — failing open — an iteration, which marks the
 * device as reading everything); a device is rebuilt when one of its recorded
 * rows changed identity (HA replaces a row on any state or attribute change),
 * the others keep their presentation object. #895 additionally records the
 * exact resolved light keys consumed by each face: passive sources' `on` is
 * computed before row tracking and must never be inferred from stateEids.
 * Ambiguous/missing graph proof takes the complete presentation path.
 * Cloning shares one memo per
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
import { PresentationLightFrame } from './presentation-light-frame';
import type { DevItem } from './types';
import { directSignalReadings } from './device-signal-runtime';
import { openingEntityReferences } from './logic';
import type { RoomCfg } from './types';
import { deviceBatteryModeOf } from './device-battery-settings';
import { ledStripsByMarker } from './led-strip-gate';

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
  private lightDeps = new Map<string, Set<string>>();
  private lightFrame: PresentationLightFrame | null = null;
  private changedLights = new Set<string>();
  private built = new Map<string, ResolvedDevicePresentation>();
  /** Rows changed since the last capture; null while every presentation is rebuilt. */
  private changed: Set<string> | null = null;
  private fresh = new Set<string>();
  private reading: Set<string> | null = null;
  private raw: Readonly<Record<string, unknown>> = {};
  private open = false;
  private deviceKeys = new Map<string, string>();
  private changedDevices = new Set<string>();

  public begin(host: RenderSnapshotHost, lightSources: unknown, devices: readonly DevItem[] = host._devices): RenderSnapshotWindow {
    if (this.open) this.reset();
    this.open = true;
    this.fresh.clear();
    const frame = lightSources instanceof PresentationLightFrame ? lightSources : null;
    const hass = host._planHass, registry = host._fullRegistryHass;
    const now = Date.now();
    const spaces = host._serverCfg?.spaces ?? host._model;
    const consumerDemand = host._snapshotConsumerDemand?.();
    const batteryModes = new Map(spaces.map(space => [space.id, deviceBatteryModeOf(host._settings,
      'settings' in space ? space.settings : undefined)]));
    const ledMarkers = new Map(spaces.map(space => [space.id, ledStripsByMarker(space)]));
    const deviceKeys = new Map(devices.map(device => [device.id, JSON.stringify([device,
      batteryModes.get(device.space) ?? deviceBatteryModeOf(host._settings), ledMarkers.get(device.space)?.has(device.id),
      host._alerts?.issuesForDevice(device.id)])]));
    this.changedDevices = new Set([...deviceKeys].filter(([id, key]) => this.deviceKeys.get(id) !== key).map(([id]) => id));
    const rosterChanged = this.changedDevices.size > 0 || deviceKeys.size !== this.deviceKeys.size;
    this.deviceKeys = deviceKeys;
    const sources: unknown[] = [
      host._space, host._mode, host._showAll,
      host.hass?.connection, host.hass?.user,
      hass?.entities, hass?.devices, registry?.entities, registry?.devices, host._vacFit?.source,
      [...host._summary?.entityIds() || []].join('\n'),
      // The card's own records keep their identity through an edit in place
      // (a marker's `vacuum.trail_mode` with no epoch, the stored settings); a
      // complete capture read them anew, so their content is a source too
      // (fail-open, ТЗ п.2). The card config's content is a presentation input.
      JSON.stringify(spaces.filter(space => host._space === undefined || space.id === host._space).map(space => [space.id,
          consumerDemand || space.rooms?.map((room: RoomCfg) => [room.area, room.settings?.temp_source,
            room.settings?.hum_source, room.settings?.co2_source]),
          'openings' in space ? space.openings?.map(openingEntityReferences) : undefined,
          consumerDemand?.decor !== false && 'decor' in space ? space.decor?.map((shape: { id?:string; kind?:string; text?:unknown; entity?:unknown }) =>
            shape.kind === 'text' ? [shape.id, shape.text, shape.entity] : null) : undefined])),
    ];
    // Config ACKs advance virtual-light authority even when every lamp keeps
    // its state. Faces consume only off membership; keep revision/ownership
    // checks in the authoritative snapshot and the outer capture boundary.
    const virtualDisplayKey = JSON.stringify([...host._virtualLights.off].sort());
    const inputs: unknown[] = [host._config, JSON.stringify(host._config), virtualDisplayKey, frame?.topology,
      host._reducedMotion, host._showHidden === true, directSignalReadings(hass)];
    for (const name of Object.keys(host.hass || {}).sort()) if (name !== 'states') inputs.push(name, host.hass[name]);
    for (const [id, runtime] of host._activityRt) {
      const expires = runtime.expiresAt || runtime.flashTs + ACTIVITY_WINDOW_MS;
      inputs.push(id, runtime.gen, runtime.flashTs, runtime.flashKind, runtime.expiresAt, runtime.sources,
        runtime.alarmActive, !!(runtime.flashTs && runtime.flashKind && expires > now));
    }
    const kept = !!this.previous && same(this.sources, sources);
    const reusable = kept && frame?.topology != null && this.lightFrame?.topology != null
      && same(this.inputs, inputs);
    this.changedLights.clear();
    if (reusable) {
      for (const [key, state] of frame.states) {
        if (this.lightFrame!.states.get(key) !== state) this.changedLights.add(key);
      }
    }
    this.lightFrame = frame;
    this.sources = sources;
    this.inputs = inputs;
    if (!kept) {
      this.previous = null;
      this.memo = new WeakMap();
    } else if (!reusable || rosterChanged) {
      this.memo = this.lend(host, devices);
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
      this.lightDeps.clear();
      this.built.clear();
    }
    return {
      hass: this.track(hass), registry: this.track(registry), memo: this.memo,
      previous: kept && !rosterChanged ? this.previous : null,
    };
  }

  public present(
    id: string, showLqi: boolean, build: () => ResolvedDevicePresentation,
  ): ResolvedDevicePresentation {
    const key = presentationSnapshotKey(id, showLqi);
    const deps = this.deps.get(id);
    const lightDeps = this.lightDeps.get(id);
    const kept = this.built.get(key);
    if (!this.fresh.has(id) && !this.changedDevices.has(id) && this.changed && deps && lightDeps && kept
        && !deps.has(EVERY_ROW) && ![...deps].some((row) => this.changed!.has(row))
        && ![...lightDeps].some((source) => this.changedLights.has(source))) return kept;
    if (!this.fresh.has(id)) {
      this.fresh.add(id);
      this.deps.set(id, new Set());
      this.lightDeps.set(id, new Set());
    }
    this.reading = this.deps.get(id)!;
    this.stats.presentations++;
    try {
      const presentation = this.lightFrame
        ? this.lightFrame.observe(this.lightDeps.get(id)!, build) : build();
      this.built.set(key, presentation);
      return presentation;
    } finally { this.reading = null; }
  }

  public end(snapshot: RenderDeviceSnapshot): void {
    this.open = false;
    this.changed = null;
    this.previous = snapshot;
    const live = new Set(snapshot.devices.map(device => device.id));
    for (const id of this.deps.keys()) if (!live.has(id)) {
      this.deps.delete(id); this.lightDeps.delete(id);
      this.built.delete(presentationSnapshotKey(id, false));
      this.built.delete(presentationSnapshotKey(id, true));
    }
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
    this.lightDeps.clear();
    this.lightFrame = null;
    this.changedLights.clear();
    this.built.clear();
    this.changed = null;
    this.reading = null;
    this.raw = {};
    this.deviceKeys.clear(); this.changedDevices.clear();
  }

  /**
   * A capture that rebuilds every presentation starts a new clone memo: the
   * old one would keep collecting every rebuilt presentation's objects (a
   * large weak table the garbage collector walks on every tick of a light).
   * The sources are unchanged, so the previous clones of the roster and its
   * DevItems, of every state row HA did not replace (camera rows are rewritten
   * copies, never lent) and of the registry device rows stay valid and are lent.
   */
  private lend(host: RenderSnapshotHost, devices: readonly DevItem[]): WeakMap<object, unknown> {
    const memo = new WeakMap<object, unknown>();
    const previous = this.previous!;
    const pair = (source: unknown, clone: unknown): void => {
      if (source && typeof source === 'object' && clone) memo.set(source, clone);
    };
    const prior = new Map(previous.devices.map(device => [device.id, device]));
    if (!this.changedDevices.size && devices.length === previous.devices.length
      && devices.every((device, index) => device.id === previous.devices[index].id)) pair(devices, previous.devices);
    for (const device of devices) if (!this.changedDevices.has(device.id)) {
      pair(device, prior.get(device.id));
      for (const showLqi of [false, true]) {
        const key = presentationSnapshotKey(device.id, showLqi);
        pair(this.built.get(key), previous.presentations.get(key));
      }
    }
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
