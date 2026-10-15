/** #895: a capture-local index of the canonical, already resolved light graph.
 * State reads made by the light resolver precede presentation row tracking.
 * In particular a passive marker has no stateEids: its `on` comes from its
 * incoming drivers. Record the consumed source key as well as HA row reads.
 * No registry, authority or graph is retained outside the owning capture.
 */
import type { ResolvedLightSource } from './devices';
import type { DevItem } from './types';

type Source = ResolvedLightSource<DevItem>;
type MarkerState = { ref: string; on: boolean; name: string };

/** Exact work counters: indexes, marker-state projections. Not timings. */
export const presentationLightWork = [0, 0];

export class PresentationLightFrame {
  readonly topology: string | null;
  readonly states = new Map<string, boolean>();
  private owners = new Map<string, Source[]>();
  private keys = new Map<string, Source[]>();
  private order = new Map<Source, number>();
  private choices: readonly MarkerState[] | null = null;
  private reading: Set<string> | null = null;

  constructor(readonly sources: readonly Source[]) {
    presentationLightWork[0]++;
    let valid = true;
    const topology: unknown[][] = [];
    for (const source of sources) {
      this.order.set(source, this.order.size);
      if (typeof source.key !== 'string' || typeof source.device?.id !== 'string'
          || typeof source.on !== 'boolean' || !Array.isArray(source.stateEids)
          || !Array.isArray(source.serviceEids) || this.keys.has(source.key)) valid = false;
      this.keys.set(source.key, [...this.keys.get(source.key) || [], source]);
      if (source.via !== 'controls') {
        this.owners.set(source.device.id, [...this.owners.get(source.device.id) || [], source]);
      }
      this.states.set(source.key, source.on);
      topology.push([source.key, source.eid, source.stateEids, source.serviceEids,
        source.device.id, source.device.name, source.via, source.castsGlow, source.passive]);
    }
    // An unproved/ambiguous projection can still render canonically, but is
    // never evidence that an unrelated presentation is safe to retain.
    this.topology = valid ? JSON.stringify(topology) : null;
  }

  owned(id: string): readonly Source[] {
    const sources = this.owners.get(id) || [];
    for (const source of sources) this.reading?.add(source.key);
    return sources;
  }

  linked(refs: ReadonlySet<string>): readonly Source[] {
    const result: Source[] = [];
    for (const key of refs) {
      this.reading?.add(key); // Record absence too: a later valid source matters.
      result.push(...this.keys.get(key) || []);
    }
    // Canonical projection iterates graph order, NOT saved controls order.
    // The first source can own colour/signature, so indexing must preserve it.
    return result.sort((a, b) => this.order.get(a)! - this.order.get(b)!);
  }

  markerStates(refs: readonly string[]): readonly MarkerState[] {
    for (const ref of refs) this.reading?.add(ref);
    if (!this.choices) {
      presentationLightWork[1]++;
      this.choices = this.sources.filter((source) => source.key.startsWith('marker:'))
        .map((source) => ({ ref: source.key, on: source.on, name: source.device.name }));
    }
    return this.choices;
  }

  observe<T>(reads: Set<string>, build: () => T): T {
    const previous = this.reading;
    this.reading = reads;
    try { return build(); } finally { this.reading = previous; }
  }
}
