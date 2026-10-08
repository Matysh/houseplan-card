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
  private readonly _activeTouchPointers = new Set<number>();
  private _sequenceMultitouch = false;
  private _postGestureClickBlocked = false;
  private _modalTailBlocked = false;
  private _modalTailPointer: number | null = null;

  get sequenceMultitouch(): boolean {
    return this._sequenceMultitouch;
  }

  get clickBlocked(): boolean {
    return this._sequenceMultitouch || this._postGestureClickBlocked || this._modalTailBlocked;
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
    // No touch contact from the previous sequence remains: this pointerdown is
    // positive evidence of a new deliberate input sequence. It may therefore
    // re-arm touch, mouse and hybrid-device clicks immediately.
    if (this._activeTouchPointers.size === 0
        && (this._modalTailPointer === null || this._modalTailPointer === pointerId)) {
      this._postGestureClickBlocked = false;
      this._modalTailBlocked = false;
      this._modalTailPointer = null;
    }
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
    if (terminal !== 'lostpointercapture' && this._modalTailPointer === pointerId) {
      this._modalTailPointer = null;
    }
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
    this._modalTailBlocked = false;
    this._modalTailPointer = null;
  }
}
