import type { ConfigReloadContext } from './config-reload-authority';
import { sameReloadContext } from './config-reload-authority';

/** One ephemeral transport owner per card, never a cache or a writer (#824). */
export class CardReadLifecycle {
  private context: ConfigReloadContext | null = null;
  private active: object | null = null;
  private current: object | null = null;
  private deferred = false;

  get pending(): boolean { return this.deferred; }
  get busy(): boolean { return this.active !== null; }

  /** A missing initial HA authority can bind once; replacing a known one cannot. */
  observe(context: ConfigReloadContext): boolean {
    if (!this.context) { this.context = { ...context }; return false; }
    if (sameReloadContext(this.context, context)) return false;
    this.invalidate();
    this.context = { ...context };
    return true;
  }

  defer(): void { this.deferred = true; }

  /** Repeated starts in one generation coalesce, not queue another read. */
  begin(context: ConfigReloadContext): object | null {
    this.observe(context);
    if (this.active) return null;
    this.deferred = false;
    this.current = this.active = {};
    return this.active;
  }

  isCurrent(claim: object): boolean { return this.current === claim; }

  finish(claim: object): boolean {
    if (this.active !== claim) return false;
    this.active = null;
    return true;
  }

  invalidate(): void {
    this.context = null;
    this.current = this.active = null;
    this.deferred = false;
  }
}
