/**
 * Event-owned click suppression for touch gestures.
 *
 * Browsers may emit compatibility activations (`click` or `contextmenu`) an
 * arbitrary time after the final touch pointerup. A timeout cannot tell that
 * stale activation from deliberate input; a new pointerdown or keyboard event
 * can. Keep the completed multi-touch sequence blocked until such positive
 * evidence starts a new sequence.
 */
export class TouchGestureClickGuard {
  private readonly _activePointers = new Set<number>();
  private readonly _activeTouchPointers = new Set<number>();
  private readonly _interruptedOwners = new Set<number>();
  private _interruptedTail = false;
  private _sequenceMultitouch = false;
  private _postGestureClickBlocked = false;
  private _modalTailBlocked = false;
  private _modalTailPointer: number | null = null;

  get sequenceMultitouch(): boolean {
    return this._sequenceMultitouch;
  }

  get clickBlocked(): boolean {
    return this._sequenceMultitouch || this._postGestureClickBlocked || this._modalTailBlocked
      || this._interruptedTail;
  }

  hasPointer(pointerId: number): boolean { return this._activePointers.has(pointerId); }

  /** Blur/hold cancels activation, not physical contacts that can still end. */
  interrupt(pointerId?: number): void {
    this._interruptedTail = true;
    for (const owner of this._activePointers) this._interruptedOwners.add(owner);
    if (pointerId !== undefined) this._interruptedOwners.add(pointerId);
  }

  /** Hidden/pagehide/disconnect retire old contacts but retain their inert tail. */
  abandon(): void {
    this._activePointers.clear();
    this._activeTouchPointers.clear();
    this._interruptedOwners.clear();
    this._sequenceMultitouch = false;
    this._modalTailPointer = null;
    this._interruptedTail = true;
  }

  /** A modal owns the old hold's activation tail, not the next deliberate press. */
  interruptForModal(pointerId: number): void {
    this._modalTailPointer = pointerId;
    this._modalTailBlocked = true;
  }

  /**
   * Handles only activation/keyboard events; pointer lifecycle stays with the
   * card because it also owns coordinates and pinch navigation.
   */
  handleActivation(event: Event, suppressClick: boolean): boolean {
    if (event.type === 'keydown') {
      const keyboard = event as KeyboardEvent;
      const action = keyboard.key === 'Enter' || keyboard.key === ' '
        || keyboard.key === 'ContextMenu' || keyboard.key === 'F10' && keyboard.shiftKey;
      if (action && (this._interruptedTail && this._interruptedOwners.size > 0
          || this._modalTailPointer !== null)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
      if (action && this._activePointers.size === 0) this._interruptedTail = false;
      if (this._modalTailPointer === null && this._activeTouchPointers.size === 0
          && (keyboard.key === 'Enter' || keyboard.key === ' ')) this._modalTailBlocked = false;
      if (this._activeTouchPointers.size === 0
          && (keyboard.key === 'ContextMenu' || keyboard.key === 'F10' && keyboard.shiftKey)) {
        this._postGestureClickBlocked = false;
      }
      return true;
    }
    if (event.type !== 'click' && event.type !== 'contextmenu') return false;
    if (this.clickBlocked || event.type === 'click' && suppressClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    return true;
  }

  pointerDown(pointerId: number, pointerType: string): void {
    // A real new down with a reused id proves that id's old contact ended.
    this._activePointers.delete(pointerId);
    this._activeTouchPointers.delete(pointerId);
    this._interruptedOwners.delete(pointerId);
    // No touch contact from the previous sequence remains: this pointerdown is
    // positive evidence of a new deliberate input sequence. It may therefore
    // re-arm touch, mouse and hybrid-device clicks immediately.
    if (this._activeTouchPointers.size === 0
        && this._interruptedOwners.size === 0
        && (this._modalTailPointer === null || this._modalTailPointer === pointerId)) {
      this._postGestureClickBlocked = false;
      this._modalTailBlocked = false;
      this._modalTailPointer = null;
      this._interruptedTail = false;
      this._sequenceMultitouch = false;
    }
    this._activePointers.add(pointerId);
    if (pointerType !== 'touch') return;

    this._activeTouchPointers.add(pointerId);
    if (this._activeTouchPointers.size >= 2) {
      this._sequenceMultitouch = true;
      this._postGestureClickBlocked = true;
    }
  }

  /** Returns whether the pointer belonged to an already multi-touch sequence. */
  pointerTerminal(pointerId: number, pointerType: string, terminal = 'pointerup'): boolean {
    // Modal takeover releases implicit touch capture before the finger lifts.
    // Losing capture alone must not turn a second still-overlapping contact
    // into fresh intent; the actual up/cancel (or a new down with that id) does.
    const wasMultitouch = this._sequenceMultitouch;
    if (terminal === 'lostpointercapture') return wasMultitouch;
    this._activePointers.delete(pointerId);
    this._interruptedOwners.delete(pointerId);
    if (this._modalTailPointer === pointerId) {
      this._modalTailPointer = null;
    }
    if (pointerType !== 'touch') return false;
    this._activeTouchPointers.delete(pointerId);
    if (this._activeTouchPointers.size === 0) this._sequenceMultitouch = false;
    return wasMultitouch;
  }

  reset(): void {
    this._activePointers.clear();
    this._activeTouchPointers.clear();
    this._interruptedOwners.clear();
    this._interruptedTail = false;
    this._sequenceMultitouch = false;
    this._postGestureClickBlocked = false;
    this._modalTailBlocked = false;
    this._modalTailPointer = null;
  }
}
