import { activeRegistryHass, haRegistryBuildSignature, registryStateEnabled,
  type HaRegistrySnapshot } from './ha-binding-status';

interface HassFrame {
  states?: Record<string, unknown>;
  connection?: unknown;
  user?: unknown;
}
type ActiveFrame<T> = T & {
  states: Record<string, unknown>;
  devices: HaRegistrySnapshot['devices'];
  entities: HaRegistrySnapshot['entities'];
};
const EMPTY_STATES: Record<string, unknown> = Object.freeze({});

/** Per-card immutable projections. HA lends unchanged state objects across ticks. */
export class PlanHassProjection {
  readonly counters = { processed: 0, comparisons: 0, fullBuilds: 0 };
  private invalidated = false;
  private previous?: {
    states: Record<string, unknown>; connection: unknown; user: unknown;
    sig: string; authoritative: boolean; active: ActiveFrame<HassFrame>;
  };

  /** Hidden/departed frames retain authority; their next visible consumer rebuilds once. */
  invalidate(): void { this.invalidated = true; }

  project<T extends HassFrame>(hass: T, snapshot: HaRegistrySnapshot): ActiveFrame<T> {
    hass ??= {} as T;
    const sig = haRegistryBuildSignature(hass, snapshot);
    const source = hass.states ?? EMPTY_STATES;
    const previous = this.previous;
    let active: ActiveFrame<T>;
    if (!previous || this.invalidated || previous.sig !== sig
      || previous.authoritative !== snapshot.authoritative
      || previous.connection !== hass.connection || previous.user !== hass.user) {
      active = activeRegistryHass(hass, snapshot);
      this.counters.fullBuilds++;
      this.counters.processed += Object.keys(source).length;
    } else {
      let changed: Record<string, unknown> | undefined;
      if (source !== previous.states) {
        // HA supplies a complete map, not a delta. Compare its keys cheaply,
        // applying registry/parent decisions only to changed state objects.
        for (const eid of Object.keys(source)) {
          this.counters.comparisons++;
          if (Object.prototype.hasOwnProperty.call(previous.states, eid) && source[eid] === previous.states[eid]) continue;
          changed ??= { ...previous.active.states };
          this.counters.processed++;
          if (registryStateEnabled(snapshot, eid)) changed[eid] = source[eid];
          else delete changed[eid];
        }
        for (const eid of Object.keys(previous.states)) {
          if (Object.prototype.hasOwnProperty.call(source, eid)) continue;
          changed ??= { ...previous.active.states };
          this.counters.processed++;
          delete changed[eid];
        }
      }
      active = { ...hass, devices: previous.active.devices,
        entities: previous.active.entities, states: changed ?? previous.active.states };
    }
    this.invalidated = false;
    this.previous = { states: source, connection: hass.connection, user: hass.user,
      sig, authoritative: snapshot.authoritative, active };
    return active;
  }
}
