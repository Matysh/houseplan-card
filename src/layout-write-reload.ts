import type { GatedAdoptionResult } from './config-adoption';

/** #902: an overlapping own point-write invalidates a complete read, not its history. */
export class LayoutWriteReload {
  private owner = {};
  private epoch = {};
  private active = new Set<object>();
  private idle = Promise.resolve();
  private release = (): void => {};

  constructor(private readonly authority: (pendingOnly: boolean) => () => boolean) {}

  /** Terminal UI bookkeeping may outlive a temporary HA gap, never a retired owner. */
  guard(pendingOnly = false): () => boolean {
    const owner = this.owner, authorityCurrent = this.authority(pendingOnly);
    return () => owner === this.owner && authorityCurrent();
  }

  begin(): () => void {
    const token = {};
    if (!this.active.size) this.idle = new Promise(resolve => { this.release = resolve; });
    this.active.add(token);
    this.epoch = {};
    return () => {
      if (this.active.delete(token) && !this.active.size) this.release();
    };
  }

  retire(): void {
    this.owner = {};
    this.epoch = {};
    this.active.clear();
    this.release();
  }

  private current(stamp: object | null): boolean {
    // A pending start uses null; every later write/retire replaces the epoch.
    return stamp === this.epoch;
  }

  /**
   * One normal pair and at most one post-settlement retry. No optimistic body is
   * promoted into accepted cache. A further real write asks the caller to re-arm
   * once after this read finishes; no timer, polling or permanent receipt exists.
   */
  async reconcile<T>(
    read: () => Promise<T>,
    adopt: (pair: T, isCurrent: () => boolean) => Promise<GatedAdoptionResult>,
    isCurrent: () => boolean,
  ): Promise<GatedAdoptionResult | { status: 'layout-raced' }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!isCurrent()) return { status: 'superseded' };
      const stamp = this.active.size ? null : this.epoch;
      const pair = await read();
      if (!isCurrent()) return { status: 'superseded' };
      if (this.current(stamp)) {
        const result = await adopt(pair, () => isCurrent() && this.current(stamp));
        if (result.status !== 'superseded' || !isCurrent() || this.current(stamp)) return result;
      }
      await this.idle;
      if (!isCurrent()) return { status: 'superseded' };
    }
    return { status: 'layout-raced' };
  }
}
