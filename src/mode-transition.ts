export type HouseplanMode = 'view' | 'plan' | 'devices' | 'decor';
export type ModeTransitionPhase = 'idle' | 'preparing' | 'running' | 'settling';

export interface ModeViewBox { x: number; y: number; w: number; h: number }

export interface ViewportPresentation {
  centerX: number;
  centerY: number;
  pixelsPerUnit: number;
  viewBox: ModeViewBox;
}

export interface ModeVisualState {
  presentedMode: HouseplanMode;
  editorChromeHeight: number;
  stageWidth: number;
  stageHeight: number;
  viewport: ViewportPresentation;
  stageColor: string;
  paperColor: string;
  sceneBrightness: number;
  /** Presentation-only fade used by the backdrop editor; never source alpha. */
  architectureOpacity: number;
  /** The imported backdrop has a separate editor de-emphasis contract. */
  backdropOpacity: number;
  viewWeight: number;
  editorWeight: number;
  toolbarContentOpacity: number;
}

export interface ModeTransitionState {
  token: number;
  phase: ModeTransitionPhase;
  from: ModeVisualState;
  to: ModeVisualState;
  presented: ModeVisualState;
  startedAt: number;
  duration: number;
  targetMode: HouseplanMode;
}

export interface ModeTransitionHooks {
  frame: (state: ModeTransitionState) => void;
  settled: (state: ModeTransitionState) => void;
}

export interface ModeTransitionClock {
  now: () => number;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (handle: number) => void;
}

const browserClock: ModeTransitionClock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

const cubicCoordinate = (t: number, p1: number, p2: number): number => {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
};

const ease = (p: number): number => {
  // Exact CSS cubic-bezier(0.2, 0.7, 0.2, 1): animation progress is the
  // curve's x coordinate, so solve x(t) and then evaluate y(t). A bounded
  // bisection is deterministic, monotonic and negligible beside one render.
  const x = clamp01(p);
  if (x === 0 || x === 1) return x;
  let low = 0, high = 1, t = x;
  for (let i = 0; i < 12; i++) {
    t = (low + high) / 2;
    if (cubicCoordinate(t, 0.2, 0.2) < x) low = t;
    else high = t;
  }
  return cubicCoordinate(t, 0.7, 1);
};

export function viewportFromViewBox(
  viewBox: ModeViewBox,
  stageWidth: number,
): ViewportPresentation {
  return {
    centerX: viewBox.x + viewBox.w / 2,
    centerY: viewBox.y + viewBox.h / 2,
    pixelsPerUnit: stageWidth > 0 && viewBox.w > 0 ? stageWidth / viewBox.w : 1,
    viewBox: { ...viewBox },
  };
}

export function viewBoxFromViewport(
  viewport: Pick<ViewportPresentation, 'centerX' | 'centerY' | 'pixelsPerUnit'>,
  stageWidth: number,
  stageHeight: number,
): ModeViewBox {
  const pixelsPerUnit = Math.max(1e-9, viewport.pixelsPerUnit);
  const w = Math.max(1e-9, stageWidth / pixelsPerUnit);
  const h = Math.max(1e-9, stageHeight / pixelsPerUnit);
  return { x: viewport.centerX - w / 2, y: viewport.centerY - h / 2, w, h };
}

function parseColor(value: string): [number, number, number, number] | null {
  const text = value.trim();
  const rgb = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(text);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] == null ? 1 : Number(rgb[4])];
  const hex = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text)?.[1];
  if (!hex) return null;
  return [
    parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16), hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
  ];
}

export function interpolateColor(from: string, to: string, progress: number): string {
  const a = parseColor(from), b = parseColor(to);
  if (!a || !b) return progress < 0.5 ? from : to;
  const p = clamp01(progress);
  return `rgba(${Math.round(lerp(a[0], b[0], p))}, ${Math.round(lerp(a[1], b[1], p))}, ${Math.round(lerp(a[2], b[2], p))}, ${lerp(a[3], b[3], p).toFixed(3)})`;
}

export function interpolateModeVisualState(
  from: ModeVisualState,
  to: ModeVisualState,
  progress: number,
): ModeVisualState {
  const p = ease(progress);
  const stageWidth = lerp(from.stageWidth, to.stageWidth, p);
  const stageHeight = lerp(from.stageHeight, to.stageHeight, p);
  // Screen scale interpolates logarithmically, so zoom speed is perceptually
  // even and independent of either endpoint's content-frame definition.
  const fromPpu = Math.max(1e-9, from.viewport.pixelsPerUnit);
  const toPpu = Math.max(1e-9, to.viewport.pixelsPerUnit);
  const camera = {
    centerX: lerp(from.viewport.centerX, to.viewport.centerX, p),
    centerY: lerp(from.viewport.centerY, to.viewport.centerY, p),
    pixelsPerUnit: Math.exp(lerp(Math.log(fromPpu), Math.log(toPpu), p)),
  };
  return {
    presentedMode: p < 0.5 ? from.presentedMode : to.presentedMode,
    editorChromeHeight: lerp(from.editorChromeHeight, to.editorChromeHeight, p),
    stageWidth,
    stageHeight,
    viewport: { ...camera, viewBox: viewBoxFromViewport(camera, stageWidth, stageHeight) },
    stageColor: interpolateColor(from.stageColor, to.stageColor, p),
    paperColor: interpolateColor(from.paperColor, to.paperColor, p),
    sceneBrightness: lerp(from.sceneBrightness, to.sceneBrightness, p),
    architectureOpacity: lerp(from.architectureOpacity, to.architectureOpacity, p),
    backdropOpacity: lerp(from.backdropOpacity, to.backdropOpacity, p),
    viewWeight: lerp(from.viewWeight, to.viewWeight, p),
    editorWeight: lerp(from.editorWeight, to.editorWeight, p),
    toolbarContentOpacity: lerp(from.toolbarContentOpacity, to.toolbarContentOpacity, p),
  };
}

/** Single RAF/token owner for all View/editor transition coordinates. */
export class ModeTransitionController {
  private _token = 0;
  private _raf = 0;
  private _state: ModeTransitionState | null = null;

  public constructor(
    private readonly _hooks: ModeTransitionHooks,
    private readonly _clock: ModeTransitionClock = browserClock,
  ) {}

  public get state(): ModeTransitionState | null { return this._state; }
  public get active(): boolean { return this._state?.phase === 'running' || this._state?.phase === 'preparing'; }
  public get presented(): ModeVisualState | null { return this._state?.presented || null; }

  public start(
    from: ModeVisualState,
    to: ModeVisualState,
    targetMode: HouseplanMode,
    duration = 220,
  ): number {
    this.cancel(false);
    const token = ++this._token;
    const now = this._clock.now();
    this._state = {
      token, phase: duration <= 0 ? 'settling' : 'running', from, to,
      presented: duration <= 0 ? to : from,
      startedAt: now, duration: Math.max(0, duration), targetMode,
    };
    if (duration <= 0) {
      this._hooks.frame(this._state);
      this._hooks.settled(this._state);
      this._state = null;
      return token;
    }
    this._hooks.frame(this._state);
    const tick = (time: number): void => {
      const current = this._state;
      if (!current || current.token !== token) return;
      const raw = clamp01((time - current.startedAt) / current.duration);
      current.presented = raw >= 1 ? current.to
        : interpolateModeVisualState(current.from, current.to, raw);
      current.phase = raw >= 1 ? 'settling' : 'running';
      this._hooks.frame(current);
      if (raw < 1) {
        this._raf = this._clock.requestFrame(tick);
        return;
      }
      this._raf = 0;
      this._hooks.settled(current);
      if (this._state?.token === token) this._state = null;
    };
    this._raf = this._clock.requestFrame(tick);
    return token;
  }

  public cancel(commitTarget = true): void {
    if (this._raf) this._clock.cancelFrame(this._raf);
    this._raf = 0;
    const state = this._state;
    this._state = null;
    this._token++;
    if (state && commitTarget) {
      state.phase = 'settling';
      state.presented = state.to;
      this._hooks.frame(state);
      this._hooks.settled(state);
    }
  }

  public dispose(): void { this.cancel(false); }
}
