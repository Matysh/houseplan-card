/**
 * Event-owned click suppression for touch gestures.
 *
 * Browsers may emit a compatibility `click` an arbitrary time after the final
 * touch pointerup. A timeout cannot tell that stale click from a deliberate
 * tap; a new pointerdown can. Keep the completed multi-touch sequence blocked
 * until a genuinely new pointer sequence starts.
 */
export class TouchGestureClickGuard {
  private readonly _activeTouchPointers = new Set<number>();
  private _sequenceMultitouch = false;
  private _postGestureClickBlocked = false;

  get sequenceMultitouch(): boolean {
    return this._sequenceMultitouch;
  }

  get clickBlocked(): boolean {
    return this._sequenceMultitouch || this._postGestureClickBlocked;
  }

  pointerDown(pointerId: number, pointerType: string): void {
    // No touch contact from the previous sequence remains: this pointerdown is
    // positive evidence of a new deliberate input sequence. It may therefore
    // re-arm touch, mouse and hybrid-device clicks immediately.
    if (this._activeTouchPointers.size === 0) this._postGestureClickBlocked = false;
    if (pointerType !== 'touch') return;

    this._activeTouchPointers.add(pointerId);
    if (this._activeTouchPointers.size >= 2) {
      this._sequenceMultitouch = true;
      this._postGestureClickBlocked = true;
    }
  }

  /** Returns whether the pointer belonged to an already multi-touch sequence. */
  pointerTerminal(pointerId: number, pointerType: string): boolean {
    if (pointerType !== 'touch') return false;
    const wasMultitouch = this._sequenceMultitouch;
    this._activeTouchPointers.delete(pointerId);
    if (this._activeTouchPointers.size === 0) this._sequenceMultitouch = false;
    return wasMultitouch;
  }

  reset(): void {
    this._activeTouchPointers.clear();
    this._sequenceMultitouch = false;
    this._postGestureClickBlocked = false;
  }
}
