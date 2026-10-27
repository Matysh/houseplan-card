/** Monotonic, owner-bound confirmation. No HA subscriptions, polling or writes. */
import { evaluateMarkerAlert, type MarkerThresholdAlert } from './marker-alert';

export const ALERT_CONFIRM_MS = 3000;
export type AlertRead = { permitted: false } | {
  permitted: true; value: unknown; name: string; unit?: string;
};
export interface AlertObservation {
  key: string;
  /** Marker/binding/space identity; unrelated HA/locale/render changes do not replace it. */
  identity: string;
  rule: MarkerThresholdAlert;
  /** Rechecks current authority/membership before reading the selected field. */
  read(): AlertRead;
}
export interface ConfirmedMarkerAlert {
  key: string; identity: string; rule: MarkerThresholdAlert;
  value: string | number | null; comparable: boolean; name: string; unit: string;
}
export interface AlertClock {
  now(): number;
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
}
interface Entry {
  observation: AlertObservation; signature: string; active: boolean;
  pending: boolean | null; since: number;
  value: string | number | null; comparable: boolean; name: string; unit: string;
}
const signature = (input: AlertObservation) => JSON.stringify([input.identity, input.rule]);
const browserClock: AlertClock = {
  now: () => performance.now(),
  set: (callback, delay) => globalThis.setTimeout(callback, delay),
  clear: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class ConfirmedMarkerAlerts {
  private readonly entries = new Map<string, Entry>();
  private owner: object | null = null;
  private timer: unknown = null;
  private due: number | null = null;
  private epoch = 0;
  private retired = false;

  constructor(private readonly changed: () => void, private readonly clock: AlertClock = browserClock) {}

  snapshot(): readonly ConfirmedMarkerAlert[] {
    return [...this.entries.values()].filter(entry => entry.active).map(entry => ({
      key: entry.observation.key, identity: entry.observation.identity, rule: entry.observation.rule,
      value: entry.value, comparable: entry.comparable, name: entry.name, unit: entry.unit,
    }));
  }

  update(owner: object, inputs: readonly AlertObservation[], enabled = true): void {
    if (this.retired) return;
    const before = JSON.stringify(this.snapshot());
    if (this.owner !== owner || !enabled) {
      this.cancelTimer(); this.entries.clear(); this.owner = owner;
    }
    if (enabled) {
      const retained = new Set<string>();
      for (const input of inputs) {
        retained.add(input.key);
        const key = signature(input);
        let entry = this.entries.get(input.key);
        if (!entry || entry.signature !== key) {
          entry = { observation: input, signature: key, active: false, pending: null,
            since: 0, value: null, comparable: false, name: '', unit: '' };
          this.entries.set(input.key, entry);
        } else entry.observation = input;
        this.advance(entry);
      }
      for (const key of this.entries.keys()) if (!retained.has(key)) this.entries.delete(key);
    }
    this.schedule();
    if (JSON.stringify(this.snapshot()) !== before) this.changed();
  }

  dispose(): void {
    this.retired = true; this.cancelTimer(); this.entries.clear(); this.owner = null;
  }

  private advance(entry: Entry): void {
    let read: AlertRead;
    try { read = entry.observation.read(); } catch { read = { permitted: false }; }
    if (!read.permitted) { this.entries.delete(entry.observation.key); return; }
    const result = evaluateMarkerAlert(entry.observation.rule, read.value);
    entry.comparable = result !== null;
    entry.value = result !== null && (typeof read.value === 'number' || typeof read.value === 'string') ? read.value : null;
    entry.name = read.name; entry.unit = read.unit || '';
    const target = result === true, now = this.clock.now();
    if (target === entry.active) { entry.pending = null; return; }
    if (entry.pending !== target) { entry.pending = target; entry.since = now; }
    if (now - entry.since >= ALERT_CONFIRM_MS) { entry.active = target; entry.pending = null; }
  }

  private cancelTimer(): void {
    this.epoch++;
    if (this.timer !== null) this.clock.clear(this.timer);
    this.timer = null; this.due = null;
  }

  private schedule(): void {
    let due: number | null = null;
    for (const entry of this.entries.values()) if (entry.pending !== null) {
      const deadline = entry.since + ALERT_CONFIRM_MS;
      if (due === null || deadline < due) due = deadline;
    }
    if (due === this.due) return;
    this.cancelTimer();
    if (due === null || this.retired) return;
    this.due = due;
    const epoch = this.epoch;
    this.timer = this.clock.set(() => {
      if (epoch !== this.epoch || this.retired) return;
      this.timer = null; this.due = null;
      const before = JSON.stringify(this.snapshot()), now = this.clock.now();
      for (const entry of this.entries.values()) if (entry.pending !== null && entry.since + ALERT_CONFIRM_MS <= now) this.advance(entry);
      this.schedule();
      if (JSON.stringify(this.snapshot()) !== before) this.changed();
    }, Math.max(0, due - this.clock.now()));
  }
}
