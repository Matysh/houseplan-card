/** Retire only an unfinished device drag, not an accepted/pending write (#893). */
export class DeviceDragRetirement {
  private readonly retired = new Set<number>();
  private tailBlocked = false;

  retire(pointerId: number): void {
    this.retired.delete(pointerId);
    this.retired.add(pointerId);
    this.tailBlocked = true;
    // Same bounded journal as DevicePointerOwnerLatch. A new down with a reused
    // id is the browser's proof that its old contact has ended.
    while (this.retired.size > 16) this.retired.delete(this.retired.values().next().value!);
  }

  begin(pointerId: number): void {
    this.retired.delete(pointerId);
    this.tailBlocked = false;
  }

  key(key: string): void {
    if (key === 'Enter' || key === ' ') this.tailBlocked = false;
  }

  blocksClick(event: { pointerId?: number }): boolean {
    return this.tailBlocked || typeof event.pointerId === 'number' && this.retired.has(event.pointerId);
  }
}
