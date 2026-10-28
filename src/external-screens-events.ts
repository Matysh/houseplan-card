/** One config-subscription transport; the existing owner retains lifecycle authority. */
type Remove = () => void;
interface ConfigConnection {
  subscribeEvents(callback: (event: unknown) => void, event: string): Promise<Remove>;
  subscribeMessage?: (callback: (event: unknown) => void, message: object) => Promise<Remove>;
}
export async function subscribeExternalScreenConfig(
  connection: ConfigConnection, ownTransport: boolean, baseRev: number,
  callback: (data: unknown) => void,
): Promise<Remove> {
  if (!ownTransport) return connection.subscribeEvents(event => {
    callback(event && typeof event === 'object' ? (event as {data?: unknown}).data : undefined);
  }, 'houseplan_config_updated');
  if (typeof connection.subscribeMessage !== 'function') throw new Error('Houseplan profile stream unavailable');
  let ended = false, remove: Remove | undefined;
  const close = () => { if (ended) return; ended = true; remove?.(); };
  const unsubscribe = await connection.subscribeMessage(data => {
    if (ended) return;
    if (data && typeof data === 'object' && (data as {kind?: unknown}).kind === 'closed') {
      close(); callback(data); return;
    }
    callback(data);
  }, {type: 'houseplan/external_screens/subscribe', base_rev: baseRev});
  remove = unsubscribe;
  if (ended) unsubscribe();
  return close;
}

interface StreamRecoveryPort {
  retire(): void;
  refresh(afterApplied: () => void): void;
  canResume(): boolean;
  resume(): void;
}
/** Closed auth is terminal on ordinary ticks; only real ready/connection changes reset it. */
export class ExternalConfigStreamRecovery {
  private epoch = 0;
  private stopped = false;
  get blocked(): boolean { return this.stopped; }
  reset(): void { this.epoch++; this.stopped = false; }
  closed(reason: unknown, port: StreamRecoveryPort): void {
    if (this.stopped) return;
    this.stopped = true;
    const epoch = ++this.epoch;
    port.retire();
    if (reason !== 'runtime_changed') return;
    port.refresh(() => {
      if (epoch !== this.epoch || !this.stopped || !port.canResume()) return;
      this.stopped = false;
      port.resume();
    });
  }
}
