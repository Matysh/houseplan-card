/** Instance-local ownership, never exported or persisted with a backup (#875). */
export class BackupImportIntent {
  private epoch = 0;
  private active = false;
  public loading = false;
  private restoreFocus?: () => void;

  public begin(restoreFocus?: () => void): number {
    this.active = true;
    this.loading = true;
    this.restoreFocus = restoreFocus;
    return ++this.epoch;
  }

  public owns(epoch: number): boolean { return this.active && this.epoch === epoch; }
  public opened(epoch: number): void { if (this.owns(epoch)) this.loading = false; }

  public cancel(focus = true): void {
    const restore = this.restoreFocus;
    this.active = false;
    this.loading = false;
    this.restoreFocus = undefined;
    this.epoch++;
    if (focus) restore?.();
  }
}

/** Empty installs have no normalized/active space: ACL must not depend on one. */
export function backupImportAllowed(access: {
  connected: boolean; loaded: boolean; server: boolean; writer: boolean; kiosk: boolean;
}): boolean {
  return access.connected && access.loaded && access.server && access.writer && !access.kiosk;
}
