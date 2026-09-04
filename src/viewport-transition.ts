import { easeTransitionProgress } from './mode-transition';

export interface CameraViewBox { x: number; y: number; w: number; h: number }

export interface CameraState {
  zoom: number;
  viewBox: CameraViewBox;
}

export type CameraTransitionReason = 'button' | 'wheel' | 'fit' | 'home' | 'double-tap' | 'room';
export type CameraTransitionPhase = 'running' | 'settling';

export interface CameraTransitionState {
  token: number;
  phase: CameraTransitionPhase;
  from: CameraState;
  to: CameraState;
  presented: CameraState;
  startedAt: number;
  duration: number;
  reason: CameraTransitionReason;
}

export interface CameraTransitionHooks {
  frame: (state: CameraTransitionState) => void;
  settled: (state: CameraTransitionState) => void;
}

export interface CameraTransitionClock {
  now: () => number;
  requestFrame: (callback: FrameRequestCallback) => number | null;
  cancelFrame: (handle: number) => void;
}

const browserClock: CameraTransitionClock = {
  now: () => typeof performance !== 'undefined' ? performance.now() : Date.now(),
  requestFrame: (callback) => typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback) : null,
  cancelFrame: (handle) => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  },
};

const finite = (value: number): boolean => Number.isFinite(value);

export function validCameraState(state: CameraState | null | undefined): state is CameraState {
  return !!state && finite(state.zoom) && state.zoom > 0
    && finite(state.viewBox.x) && finite(state.viewBox.y)
    && finite(state.viewBox.w) && state.viewBox.w > 0
    && finite(state.viewBox.h) && state.viewBox.h > 0;
}

export function cloneCameraState(state: CameraState): CameraState {
  return { zoom: state.zoom, viewBox: { ...state.viewBox } };
}

export function sameCameraState(a: CameraState, b: CameraState): boolean {
  return Math.abs(a.zoom - b.zoom) < 1e-9
    && Math.abs(a.viewBox.x - b.viewBox.x) < 1e-6
    && Math.abs(a.viewBox.y - b.viewBox.y) < 1e-6
    && Math.abs(a.viewBox.w - b.viewBox.w) < 1e-6
    && Math.abs(a.viewBox.h - b.viewBox.h) < 1e-6;
}

const lerp = (a: number, b: number, progress: number): number => a + (b - a) * progress;
const logLerp = (a: number, b: number, progress: number): number =>
  Math.exp(lerp(Math.log(a), Math.log(b), progress));

export function interpolateCameraState(
  from: CameraState,
  to: CameraState,
  progress: number,
): CameraState {
  if (!validCameraState(from)) return cloneCameraState(to);
  if (!validCameraState(to)) return cloneCameraState(from);
  const p = easeTransitionProgress(progress);
  if (p <= 0) return cloneCameraState(from);
  if (p >= 1) return cloneCameraState(to);
  const fromCenterX = from.viewBox.x + from.viewBox.w / 2;
  const fromCenterY = from.viewBox.y + from.viewBox.h / 2;
  const toCenterX = to.viewBox.x + to.viewBox.w / 2;
  const toCenterY = to.viewBox.y + to.viewBox.h / 2;
  const w = logLerp(from.viewBox.w, to.viewBox.w, p);
  const h = logLerp(from.viewBox.h, to.viewBox.h, p);
  const centerX = lerp(fromCenterX, toCenterX, p);
  const centerY = lerp(fromCenterY, toCenterY, p);
  return {
    zoom: logLerp(from.zoom, to.zoom, p),
    viewBox: { x: centerX - w / 2, y: centerY - h / 2, w, h },
  };
}

/** Build an unclamped target which leaves the presented world point under the anchor. */
export function cameraTargetAtAnchor(
  from: CameraState,
  targetZoom: number,
  fit: CameraViewBox,
  stageWidth: number,
  stageHeight: number,
  anchorX: number,
  anchorY: number,
): CameraState | null {
  if (!validCameraState(from) || !validCameraState({ zoom: targetZoom, viewBox: fit })
      || !finite(stageWidth) || stageWidth <= 0 || !finite(stageHeight) || stageHeight <= 0
      || !finite(anchorX) || !finite(anchorY)) return null;
  const xRatio = anchorX / stageWidth;
  const yRatio = anchorY / stageHeight;
  const worldX = from.viewBox.x + xRatio * from.viewBox.w;
  const worldY = from.viewBox.y + yRatio * from.viewBox.h;
  const w = fit.w / targetZoom;
  const h = fit.h / targetZoom;
  return {
    zoom: targetZoom,
    viewBox: { x: worldX - xRatio * w, y: worldY - yRatio * h, w, h },
  };
}

/** One token/RAF owner for camera-only transitions inside a settled UI mode. */
export class CameraTransitionController {
  private _token = 0;
  private _raf: number | null = null;
  private _state: CameraTransitionState | null = null;

  public constructor(
    private readonly _hooks: CameraTransitionHooks,
    private readonly _clock: CameraTransitionClock = browserClock,
  ) {}

  public get state(): CameraTransitionState | null { return this._state; }
  public get active(): boolean { return this._state?.phase === 'running'; }
  public get presented(): CameraState | null { return this._state?.presented || null; }
  public get target(): CameraState | null { return this._state?.to || null; }

  public start(
    fromInput: CameraState,
    toInput: CameraState,
    reason: CameraTransitionReason,
    duration: number,
  ): number {
    this.cancel(false);
    const token = ++this._token;
    const from = cloneCameraState(fromInput);
    const to = cloneCameraState(toInput);
    const canAnimate = duration > 0 && validCameraState(from) && validCameraState(to);
    const now = this._clock.now();
    const state: CameraTransitionState = {
      token,
      phase: canAnimate ? 'running' : 'settling',
      from,
      to,
      presented: canAnimate ? cloneCameraState(from) : cloneCameraState(to),
      startedAt: now,
      duration: canAnimate ? duration : 0,
      reason,
    };
    this._state = state;
    this._hooks.frame(state);
    if (!canAnimate) {
      this._settle(token);
      return token;
    }
    const tick = (time: number): void => {
      const current = this._state;
      if (!current || current.token !== token) return;
      const raw = Math.max(0, Math.min(1, (time - current.startedAt) / current.duration));
      current.presented = raw >= 1
        ? cloneCameraState(current.to)
        : interpolateCameraState(current.from, current.to, raw);
      current.phase = raw >= 1 ? 'settling' : 'running';
      this._hooks.frame(current);
      if (raw >= 1) {
        this._raf = null;
        this._settle(token);
        return;
      }
      this._raf = this._clock.requestFrame(tick);
      if (this._raf === null) this._settle(token);
    };
    this._raf = this._clock.requestFrame(tick);
    if (this._raf === null) {
      state.phase = 'settling';
      state.presented = cloneCameraState(to);
      this._hooks.frame(state);
      this._settle(token);
    }
    return token;
  }

  public cancel(commitTarget = true): void {
    if (this._raf !== null) this._clock.cancelFrame(this._raf);
    this._raf = null;
    const state = this._state;
    this._state = null;
    this._token++;
    if (!state || !commitTarget) return;
    state.phase = 'settling';
    state.presented = cloneCameraState(state.to);
    this._hooks.frame(state);
    this._hooks.settled(state);
  }

  public dispose(): void { this.cancel(false); }

  private _settle(token: number): void {
    const state = this._state;
    if (!state || state.token !== token) return;
    state.phase = 'settling';
    state.presented = cloneCameraState(state.to);
    this._hooks.settled(state);
    if (this._state?.token === token) this._state = null;
  }
}
