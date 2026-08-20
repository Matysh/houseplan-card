/** Instance-local pointer modality and CSS-hover gate. */

export type PointerModality = 'unknown' | 'mouse' | 'touch' | 'pen';

export const POINTER_HOVER_QUERY = '(any-hover: hover) and (any-pointer: fine)';

type PointerLike = {
  pointerType?: string;
  sourceCapabilities?: { firesTouchEvents?: boolean } | null;
};

export function pointerModalityOf(pointerType: unknown): PointerModality | null {
  if (pointerType === 'mouse' || pointerType === 'touch' || pointerType === 'pen') {
    return pointerType;
  }
  return null;
}

/** Compatibility input derived from touch must never re-enable mouse hover. */
export function nextPointerModality(
  current: PointerModality,
  event: PointerLike,
): PointerModality {
  const next = pointerModalityOf(event.pointerType);
  if (!next) return current;
  if (next === 'mouse' && event.sourceCapabilities?.firesTouchEvents) return current;
  return next;
}

export function pointerHoverAllowed(modality: PointerModality, hoverCapable: boolean): boolean {
  return modality === 'mouse' && hoverCapable;
}

type HoverHost = Pick<Element, 'toggleAttribute'>;

/**
 * Keeps one card instance's input authority out of Lit render state. Pointer
 * move may be frequent; the host attribute changes only when the gate changes.
 */
export class PointerModalityController {
  private _modality: PointerModality = 'unknown';
  private _gate = false;
  private _media: MediaQueryList | null = null;
  private _connected = false;

  constructor(
    private readonly _host: HoverHost,
    private readonly _onGateChange: (enabled: boolean) => void = () => undefined,
  ) {}

  get modality(): PointerModality {
    return this._modality;
  }

  get hoverEnabled(): boolean {
    return this._gate;
  }

  connect(win: Window | null | undefined = globalThis.window): void {
    if (this._connected) return;
    this._connected = true;
    this._modality = 'unknown';
    this._media = typeof win?.matchMedia === 'function'
      ? win.matchMedia(POINTER_HOVER_QUERY)
      : null;
    this._media?.addEventListener?.('change', this._onMediaChange);
    this._setGate(false);
  }

  disconnect(): void {
    this._media?.removeEventListener?.('change', this._onMediaChange);
    this._media = null;
    this._connected = false;
    this._modality = 'unknown';
    this._setGate(false);
  }

  note(event: PointerLike): PointerModality {
    this._modality = nextPointerModality(this._modality, event);
    this._syncGate();
    return this._modality;
  }

  /** Disable stale CSS hover until the next real pointer event revalidates it. */
  suspend(): void {
    this._setGate(false);
  }

  private readonly _onMediaChange = (): void => this._syncGate();

  private _syncGate(): void {
    this._setGate(pointerHoverAllowed(this._modality, !!this._media?.matches));
  }

  private _setGate(enabled: boolean): void {
    if (this._gate === enabled) return;
    this._gate = enabled;
    this._host.toggleAttribute('data-pointer-hover', enabled);
    this._onGateChange(enabled);
  }
}
