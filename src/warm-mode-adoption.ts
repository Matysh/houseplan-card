/**
 * The tail of a warm editor restore (docs/WARM-REMOUNT.md §2, §3).
 *
 * A same-route re-mount brings back the editor in one of two ways: at once,
 * when the new instance may already edit (`_requestMode(..., adopt=true)`),
 * or later, when the editor waited in `_pendingNavMode` for `hass` or for the
 * server's `can_write` (`_resumePendingNavMode`). Both end the same way: the
 * draft the dead instance left in the slot is revived exactly once, and the
 * adopted camera is not refitted by the editor chrome that lands with the
 * mode (#756).
 */
import type { HouseplanMode } from './mode-transition';

type ViewRect = { x: number; y: number; w: number; h: number };

export interface WarmModeHost {
  readonly updateComplete: Promise<unknown>;
  readonly _mode: HouseplanMode;
  readonly _warmVp: { view: ViewRect | null } | null;
  readonly _warmRevivePending: boolean;
  _view: ViewRect | null;
  _editorModeRequest: number;
  _holdWarmRefit(request: number): void;
  _releaseWarmRefit(request: number): void;
  _warmReviveDialog(settle?: boolean): void;
  _liveVp(): void;
  requestUpdate(): void;
}

/** The mode is committed under a held refit: revive the waiting draft once,
 *  then release the refit two frames after the restored mode has rendered. */
export function finishWarmModeAdoption(host: WarmModeHost, request: number): void {
  if (host._warmRevivePending) host._warmReviveDialog();
  host.requestUpdate();
  void host.updateComplete.then(() => requestAnimationFrame(() => requestAnimationFrame(
    () => host._releaseWarmRefit(request),
  )));
}

const sameView = (a: ViewRect | null, b: ViewRect | null | undefined): boolean => !!a && !!b
  && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/**
 * Commit a pending warm mode through `commit` (`_setMode`, the transition
 * authority — smoke_nav_persist), then settle the waiting draft revival.
 *
 * Entering the editor this way ends the passive boot grace and refits the
 * camera to the header measured BEFORE the editor chrome rendered. While the
 * pending window still shows the adopted memo camera, that camera is put
 * back and held exactly as an immediate adoption holds it. A camera that has
 * already moved on (a View refit, the user's own pan, another space) is left
 * to the ordinary refit. A mode that did not commit eats the draft (§3 p. 4).
 */
export function resumeWarmMode(host: WarmModeHost, mode: HouseplanMode, commit: () => void): void {
  const view = host._view;
  const kept = sameView(view, host._warmVp?.view);
  commit();
  if (!host._warmRevivePending) return;
  if (host._mode !== mode || !kept) { host._warmReviveDialog(true); return; }
  const request = ++host._editorModeRequest;
  host._holdWarmRefit(request);
  host._view = view; host._liveVp();
  finishWarmModeAdoption(host, request);
}
