export type HpConfirmKind = 'destructive' | 'warning';

export interface HpConfirmRequest {
  key: string;
  kind: HpConfirmKind;
  title: string;
  message: string;
  objectName?: string;
  confirmLabel: string;
  cancelLabel: string;
  icon?: string;
}

export interface HpConfirmState {
  token: number;
  request: Readonly<HpConfirmRequest>;
}

export interface HpConfirmDecision {
  token: number;
  accepted: boolean;
}

type ActiveConfirmation = HpConfirmState & {
  resolve: (accepted: boolean) => void;
};

/**
 * One replace-not-queue controller for dangerous actions.
 *
 * Queuing would let a request outlive the dialog/space that produced it. A
 * newer request therefore safely cancels the older promise. The token, rather
 * than the caller-provided diagnostic key, owns resolution so stale DOM events
 * cannot accept a replacement request.
 */
export class HpConfirmController {
  private _sequence = 0;
  private _active: ActiveConfirmation | null = null;

  public constructor(private readonly _changed: (state: HpConfirmState | null) => void) {}

  public get state(): HpConfirmState | null {
    if (!this._active) return null;
    return { token: this._active.token, request: this._active.request };
  }

  public confirm(request: HpConfirmRequest): Promise<boolean> {
    this.cancel();
    const state: HpConfirmState = {
      token: ++this._sequence,
      request: Object.freeze({ ...request }),
    };
    return new Promise<boolean>((resolve) => {
      this._active = { ...state, resolve };
      this._changed(state);
    });
  }

  public resolve(token: number, accepted: boolean): boolean {
    const active = this._active;
    if (!active || active.token !== token) return false;
    this._active = null;
    this._changed(null);
    active.resolve(accepted);
    return true;
  }

  public cancel(): boolean {
    const active = this._active;
    if (!active) return false;
    return this.resolve(active.token, false);
  }
}
