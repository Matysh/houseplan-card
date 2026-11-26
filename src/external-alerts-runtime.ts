import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { ResolvedDeviceIssue } from './device-issues';
import { alertT } from './i18n/alerts';
import type { Lang } from './i18n';
import type { DevItem } from './types';

interface Signal {
  id: string;
  level: 'attention' | 'alarm';
  changed_at: string;
  message: string | null;
  sourceName?: string;
  ownerBinding: string;
}

interface Connection {
  subscribeMessage?(listener: (frame: unknown) => void, message: { type: string },
    options: { resubscribe: boolean }): Promise<Release>;
  addEventListener?(name: string, listener: () => void): void;
  removeEventListener?(name: string, listener: () => void): void;
  connected?: boolean;
}
type Release = () => void | Promise<void>;

async function dispose(release?: Release): Promise<void> {
  try { await release?.(); } catch { /* HA can disconnect before receiving unsubscribe. */ }
}

function signalProjection(frame: unknown): Map<string, Signal[]> | undefined {
  if (!frame || typeof frame !== 'object' || !('signals' in frame) || !Array.isArray(frame.signals)) return;
  const byMarker = new Map<string, Signal[]>();
  for (const row of frame.signals) {
    if (!row || typeof row.id !== 'string' || !Array.isArray(row.owners)
      || (row.level !== 'attention' && row.level !== 'alarm')
      || (row.message !== null && typeof row.message !== 'string')
      || typeof row.changed_at !== 'string' || !Number.isFinite(Date.parse(row.changed_at))) continue;
    for (const owner of row.owners) {
      if (!owner || typeof owner.id !== 'string' || typeof owner.binding !== 'string') continue;
      const signal = { id: row.id, level: row.level, changed_at: row.changed_at,
        message: row.message, ownerBinding: owner.binding,
        sourceName: typeof row.source_name === 'string' ? row.source_name : undefined };
      const previous = byMarker.get(owner.id);
      if (previous) previous.push(signal);
      else byMarker.set(owner.id, [signal]);
    }
  }
  return byMarker;
}

export class ExternalAlertsRuntime implements ReactiveController {
  private active = false;
  private connection?: Connection;
  private userId?: string;
  private generation = 0;
  private retry?: ReturnType<typeof setTimeout>;
  private unsubscribe?: Release;
  private byMarker = new Map<string, Signal[]>();
  private dateFormat?: { lang: Lang; timeZone?: string; value: Intl.DateTimeFormat };

  constructor(host: ReactiveControllerHost,
    private readonly hass: () => { connection?: Connection; user?: { id?: string };
      config?: { time_zone?: string } } | undefined,
    private readonly lang: () => Lang,
    private readonly changed: () => void,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.active = true;
    this.hostUpdate();
  }

  hostUpdate(): void {
    if (!this.active) return;
    const source = this.hass();
    const connection = source?.connection;
    const userId = source?.user?.id;
    if (connection === this.connection && userId === this.userId) return;
    this.release();
    this.connection = connection;
    this.userId = userId;
    connection?.addEventListener?.('ready', this.start);
    connection?.addEventListener?.('disconnected', this.stop);
    if (connection?.connected !== false) this.start();
  }

  hostDisconnected(): void {
    this.active = false;
    this.release();
  }

  issues(device: DevItem): ResolvedDeviceIssue[] {
    const signals = this.byMarker.get(device.id);
    if (device.virtual || device.marker?.removed || !signals?.length) return [];
    const binding = device.marker?.binding || `${device.bindingKind}:${device.bindingRef}`;
    const lang = this.lang();
    const timeZone = this.hass()?.config?.time_zone;
    if (this.dateFormat?.lang !== lang || this.dateFormat.timeZone !== timeZone) {
      this.dateFormat = { lang, timeZone, value: new Intl.DateTimeFormat(lang, {
        dateStyle: 'short', timeStyle: 'short', timeZone,
      }) };
    }
    const format = this.dateFormat.value;
    return signals.filter(row => row.ownerBinding === binding).map(row => ({
      eid: '',
      name: row.sourceName || alertT(lang, 'external'),
      state: '',
      stateText: format.format(new Date(row.changed_at)),
      deviceClass: '',
      integrationDomain: null,
      severity: row.level,
      reason: 'external',
      explanation: row.message ?? undefined,
      cause: { type: 'external', id: `ha-alert:${row.id}`, level: row.level },
      groupTitle: alertT(lang, row.level),
    }));
  }

  private readonly stop = () => {
    this.generation++;
    clearTimeout(this.retry);
    this.retry = undefined;
    void dispose(this.unsubscribe);
    this.unsubscribe = undefined;
    if (this.byMarker.size) {
      this.byMarker.clear();
      this.changed();
    }
  };

  private readonly start = () => {
    const connection = this.connection;
    if (!connection?.subscribeMessage) return;
    this.stop();
    const generation = this.generation;
    const current = () => this.active && this.connection === connection && generation === this.generation;
    const subscribe = async (delay: number) => {
      this.retry = undefined;
      if (!current() || connection.connected === false) return;
      try {
        const unsubscribe = await connection.subscribeMessage!(frame => {
          if (!current()) return;
          const next = signalProjection(frame);
          if (!next || (!next.size && !this.byMarker.size)) return;
          this.byMarker = next;
          this.changed();
        }, { type: 'houseplan/external_alerts/subscribe' }, { resubscribe: false });
        if (current()) this.unsubscribe = unsubscribe;
        else void dispose(unsubscribe);
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (current() && (code === 'unknown_command' || code === 'not_ready')) {
          this.retry = setTimeout(() => void subscribe(Math.min(delay * 2, 30_000)), delay);
        }
      }
    };
    void subscribe(1_000);
  };

  private release(): void {
    this.connection?.removeEventListener?.('ready', this.start);
    this.connection?.removeEventListener?.('disconnected', this.stop);
    this.stop();
    this.connection = undefined;
    this.userId = undefined;
  }
}
