/** One explicit save -> load operation; an invalidated UI never starts a late scan. */
export class ZigbeeTopologyLoadGate {
  pending = false;
  private epoch = 0;

  invalidate(): void { this.epoch++; }

  async run(options: {
    current(): boolean;
    prepare?: () => Promise<boolean>;
    load(current: () => boolean): Promise<void>;
    changed(): void;
  }): Promise<void> {
    if (this.pending || !options.current()) return;
    const epoch = this.epoch;
    const current = () => epoch === this.epoch && options.current();
    this.pending = true;
    options.changed();
    try {
      if (options.prepare && !await options.prepare().catch(() => false)) return;
      if (current()) await options.load(current);
    } finally {
      this.pending = false;
      options.changed();
    }
  }
}
