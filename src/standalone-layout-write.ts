import { canonicalizePosition } from './coordinate-canonicalization';
import type { DeviceLayoutEntry } from './device-position-history';
import type { HouseplanCommand, Unsubscribe } from './plan-host';

type Position = Pick<DeviceLayoutEntry, 'x' | 'y' | 's' | 'k'>;
type Result = 'pending' | 'accepted' | 'rejected' | 'unknown';
export type StandaloneSaveEntry = Readonly<{
  kind: 'room_label'; roomId: string; spaceId: string; status: Result; code?: string;
}>;
export type StandaloneSaveState = Readonly<{
  pending: boolean; unresolved: boolean; entries: readonly StandaloneSaveEntry[];
}>;

export function roomLabelFields(position: DeviceLayoutEntry | null | undefined): Position | null {
  if (!position) return null;
  const { x, y, s, k } = position;
  return canonicalizePosition({ x, y, ...(s !== undefined ? { s } : {}), ...(k !== undefined ? { k } : {}) });
}
const same = (a: Position | null, b: Position | null) =>
  a === b || !!a && !!b && a.x === b.x && a.y === b.y && a.s === b.s && a.k === b.k;

export type StandaloneLayoutWritePorts = {
  guard(): () => boolean;
  begin(): () => void;
  base(key: string): DeviceLayoutEntry | undefined;
  send(command: HouseplanCommand): Promise<unknown>;
  accept(key: string, position: Position, rev: number): void;
  recover(key: string): Promise<boolean>;
  reportFailure(error: unknown): void;
};
type Slot = {
  entry: StandaloneSaveEntry;
  before: Position | null; desired: Position;
  current: () => boolean; release: () => void;
  sent: boolean; flush: boolean; recovering: boolean; blocked: boolean;
};

export class StandaloneLayoutWrite {
  private readonly slots = new Map<string, Slot>();
  private readonly gestures = new Map<string, object>();
  private readonly listeners = new Set<(state: StandaloneSaveState) => void>();
  private interrupted = false;

  constructor(private readonly ports: StandaloneLayoutWritePorts) {}

  getSaveState(): StandaloneSaveState {
    const entries = Object.freeze([...this.slots.values()].map(slot => slot.entry));
    return Object.freeze({
      entries, pending: entries.some(e => e.status === 'pending'),
      unresolved: this.interrupted || entries.some(e => e.status === 'rejected' || e.status === 'unknown'),
    });
  }
  subscribeSaveState(receive: (state: StandaloneSaveState) => void): Unsubscribe {
    this.listeners.add(receive);
    this.notify(receive, this.getSaveState());
    return () => { this.listeners.delete(receive); };
  }
  private notify(receive: (state: StandaloneSaveState) => void, state: StandaloneSaveState): void {
    // Observers do not participate in mutation success.
    try { receive(state); } catch { /* Embedder callback failure cannot interrupt the editor. */ }
  }
  private publish(): void {
    const state = this.getSaveState();
    for (const receive of [...this.listeners]) this.notify(receive, state);
  }

  canStage(key: string): boolean {
    const slot = this.slots.get(key);
    return !slot?.blocked && !slot?.recovering;
  }
  beginGesture(key: string): object | null {
    if (!this.canStage(key)) return null;
    const claim = {};
    this.gestures.set(key, claim);
    return claim;
  }
  endGesture(key: string, claim: object): void {
    if (this.gestures.get(key) === claim) this.gestures.delete(key);
  }
  pendingKeys(): string[] {
    return [...this.slots].filter(([, slot]) => slot.entry.status === 'pending').map(([key]) => key);
  }

  stage(key: string, next: DeviceLayoutEntry, claim: object): boolean {
    const slot = this.slots.get(key);
    if (this.gestures.get(key) !== claim || !this.canStage(key) || !next.s) return false;
    const desired = roomLabelFields(next)!;
    if (slot?.entry.status === 'pending') {
      if (same(desired, slot.desired)) return false;
      slot.desired = desired;
      slot.flush = false; // A newer draft still owns its debounce.
      return true;
    }
    const before = roomLabelFields(this.ports.base(key));
    if (same(before, desired)) return false;
    const operation: Slot = {
      entry: Object.freeze({ kind: 'room_label', roomId: key.slice(3), spaceId: next.s, status: 'pending' }),
      before, desired, current: this.ports.guard(), release: this.ports.begin(),
      sent: false, flush: false, recovering: false, blocked: false,
    };
    this.slots.set(key, operation);
    this.publish();
    return this.slots.get(key) === operation;
  }

  flush(key: string): void {
    const slot = this.slots.get(key);
    if (!slot || slot.entry.status !== 'pending') return;
    slot.flush = true;
    if (!slot.sent) void this.drain(key, slot);
  }

  retire(): void {
    this.gestures.clear();
    if (!this.slots.size) return;
    this.interrupted ||= [...this.slots.values()].some(slot => slot.entry.status !== 'accepted');
    const old = [...this.slots.values()];
    this.slots.clear();
    for (const slot of old) slot.release();
    this.publish();
  }

  private end(slot: Slot, status: Result, code?: string): void {
    slot.entry = Object.freeze({ ...slot.entry, status, ...(code ? { code } : {}) });
    this.publish();
  }

  private async drain(key: string, slot: Slot): Promise<void> {
    const attached = () => this.slots.get(key) === slot;
    const { roomId, spaceId } = slot.entry;
    slot.sent = true;
    let dispatched = false;
    try {
      while (slot.flush && attached()) {
        dispatched = false;
        if (!slot.current()) throw Object.assign(new Error('Write authority changed'), { code: 'context-changed' });
        const position = slot.desired;
        slot.flush = false;
        const command = { type: 'houseplan/layout/set', room_label: {
          room_id: roomId, space_id: spaceId, before: slot.before, position,
        } } as const;
        dispatched = true;
        const response = await this.ports.send(command) as {
          ok?: unknown; rev?: unknown; room_label?: { room_id?: unknown; space_id?: unknown; position?: Position };
        } | null;
        if (!attached()) return;
        if (!slot.current()) throw Object.assign(new Error('Write authority changed'), { code: 'context-changed' });
        const receipt = response?.room_label;
        if (response?.ok !== true || !Number.isSafeInteger(response.rev) || Number(response.rev) < 0 ||
          receipt?.room_id !== roomId || receipt.space_id !== spaceId ||
          !receipt.position || !same(receipt.position, position))
          throw Object.assign(new Error('Unverified room label acknowledgement'), { code: 'unverified_ack' });
        slot.before = position;
        this.ports.accept(key, position, Number(response.rev));
        if (same(slot.desired, position)) {
          slot.release();
          this.end(slot, 'accepted');
          return;
        }
      }
    } catch (error) {
      if (!attached()) return;
      const code = (error as { code?: unknown } | null)?.code;
      const rejection = !dispatched || ['conflict', 'unauthorized', 'not_ready', 'invalid_format', 'too_large'].includes(String(code));
      slot.recovering = true;
      slot.flush = false;
      // The mouse may still be held after the recovery read completes. A
      // continued pointermove is not a new intention to overwrite the server.
      this.gestures.delete(key);
      this.end(slot, rejection ? 'rejected' : 'unknown', typeof code === 'string' ? code : 'transport');
      try {
        if (attached() && slot.current()) this.ports.reportFailure(error);
        slot.blocked = !attached() || !slot.current() || !await this.ports.recover(key);
      } catch {
        slot.blocked = true;
      } finally {
        slot.recovering = false;
        slot.release();
      }
    } finally {
      slot.sent = false;
    }
  }
}
