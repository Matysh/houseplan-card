/** Connection-scoped live radar subscription with fail-closed expiry (#485). */
import {
  normalizeRadarFrame, radarFrameAccepts, radarFrameLeaseMs, type RadarLiveFrame,
} from './radar-model';

export interface RadarLiveHost {
  hass?: { connection?: RadarLiveConnection };
  isConnected: boolean;
  requestUpdate(): void;
}

interface RadarLiveConnection {
  subscribeMessage?: (
    callback: (event: unknown) => void,
    message: Record<string, unknown>,
  ) => Promise<unknown>;
}

export class RadarLiveController {
  readonly frames = new Map<string, RadarLiveFrame>();
  private unsubscribe?: () => void;
  private connection: RadarLiveConnection | null = null;
  private space = '';
  private generation = 0;
  private expiryTimer = 0;
  private readonly deadlines = new Map<string, number>();

  constructor(private readonly host: RadarLiveHost) {}

  sync(space: string, enabled: boolean): void {
    const connection = this.host.hass?.connection;
    if (!enabled || !connection || !this.host.isConnected) {
      this.stop();
      return;
    }
    if (this.unsubscribe && this.connection === connection && this.space === space) return;
    this.stop();
    this.connection = connection;
    this.space = space;
    const generation = ++this.generation;
    const subscribe = connection.subscribeMessage?.bind(connection);
    if (typeof subscribe !== 'function') return;
    void Promise.resolve(subscribe((event: unknown) => {
      if (generation !== this.generation || !this.host.isConnected) return;
      const frame = normalizeRadarFrame(event);
      if (!frame) return;
      const previous = this.frames.get(frame.marker_id);
      if (!radarFrameAccepts(previous, frame)) return;
      const lease = radarFrameLeaseMs(frame);
      if (frame.health === 'restricted' || frame.health === 'disabled' || lease === 0) {
        this.frames.delete(frame.marker_id);
        this.deadlines.delete(frame.marker_id);
      } else {
        this.frames.set(frame.marker_id, frame);
        if (lease == null) this.deadlines.delete(frame.marker_id);
        else this.deadlines.set(frame.marker_id, this.monotonicNow() + lease);
      }
      this.armExpiry();
      this.host.requestUpdate();
    }, { type: 'houseplan/radar/subscribe', space_id: space })).then((unsubscribe: unknown) => {
      if (generation !== this.generation || !this.host.isConnected) {
        if (typeof unsubscribe === 'function') unsubscribe();
        return;
      }
      if (typeof unsubscribe === 'function') this.unsubscribe = unsubscribe as () => void;
    }).catch(() => {
      if (generation === this.generation) this.stop();
    });
  }

  stop(): void {
    this.generation++;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.connection = null;
    this.space = '';
    clearTimeout(this.expiryTimer);
    this.expiryTimer = 0;
    if (this.frames.size) {
      this.frames.clear();
      if (this.host.isConnected) this.host.requestUpdate();
    }
    this.deadlines.clear();
  }

  private armExpiry(): void {
    clearTimeout(this.expiryTimer);
    const now = this.monotonicNow();
    const deadlines = [...this.deadlines.values()].filter((deadline) => deadline > now);
    if (!deadlines.length) return;
    const delay = Math.max(20, Math.min(...deadlines) - now + 10);
    this.expiryTimer = window.setTimeout(() => {
      this.expiryTimer = 0;
      let changed = false;
      const current = this.monotonicNow();
      for (const [id, deadline] of this.deadlines) {
        if (deadline > current) continue;
        this.deadlines.delete(id);
        this.frames.delete(id);
        changed = true;
      }
      this.armExpiry();
      if (changed && this.host.isConnected) this.host.requestUpdate();
    }, delay);
  }

  private monotonicNow(): number {
    return globalThis.performance?.now?.() ?? Date.now();
  }
}
