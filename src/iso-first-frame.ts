import {
  memoIsoLightFloorRooms, type IsoLightFloorMemo, type Rgb,
} from './iso-materials';

export interface IsoPaperContext {
  readonly key: string;
  readonly imagePlan: boolean;
}

interface ThemeIdentity {
  readonly darkMode?: unknown;
  readonly default_theme?: unknown;
  readonly default_dark_theme?: unknown;
  readonly theme?: unknown;
}

/** All non-DOM inputs that can change the computed plan-paper colour. */
export function isoPaperContext(
  space: string, mode: string, imagePlan: boolean, themes?: ThemeIdentity,
): IsoPaperContext {
  return {
    imagePlan,
    key: JSON.stringify([
      space, mode, imagePlan, themes?.darkMode ?? null, themes?.default_theme ?? null,
      themes?.default_dark_theme ?? null, themes?.theme ?? null,
    ]),
  };
}

/**
 * #654 cold-start barrier and memo ownership. Lifecycle callers may invalidate
 * here before render, but the theme resolver is invoked only after DOM commit.
 */
export class IsoFirstFrameState {
  private runtimeFailed = false;
  private paperRgb: Rgb = [255, 255, 255];
  private paperContext = '';
  private paperReady = false;
  private floorMemo: IsoLightFloorMemo | null = null;

  public runtimeLoading(): void { this.runtimeFailed = false; }
  public runtimeReady(): void { this.runtimeFailed = false; }
  public runtimeFailure(): void { this.runtimeFailed = true; }

  public prepare(desired: 'flat' | 'iso', context: IsoPaperContext): void {
    if (context.key === this.paperContext) return;
    this.paperReady = false;
    if (desired === 'iso' && !context.imagePlan) this.commitPaper(context.key, [255, 255, 255]);
  }

  /** Returns true when a committed render must consume a newly resolved paper. */
  public sync(
    desired: 'flat' | 'iso', context: IsoPaperContext, resolveThemePaper: () => Rgb,
  ): boolean {
    if (desired !== 'iso' || this.paperReady && context.key === this.paperContext) return false;
    this.commitPaper(context.key, context.imagePlan ? resolveThemePaper() : [255, 255, 255]);
    return true;
  }

  public pending(desired: 'flat' | 'iso', runtimeReady: boolean): boolean {
    return desired === 'iso' && !this.runtimeFailed && (!runtimeReady || !this.paperReady);
  }

  public readiness(
    desired: 'flat' | 'iso', effective: 'flat' | 'iso', runtimeReady: boolean,
  ): 'pending' | 'ready' | 'fallback' | null {
    if (this.pending(desired, runtimeReady)) return 'pending';
    if (effective === 'iso') return 'ready';
    return desired === 'iso' && this.runtimeFailed ? 'fallback' : null;
  }

  public lightFloors(
    fills: ReadonlyMap<string, { color: string; opacity: number } | null>,
  ): ReadonlySet<string> {
    this.floorMemo = memoIsoLightFloorRooms(this.floorMemo, fills, this.paperRgb);
    return this.floorMemo.rooms;
  }

  private commitPaper(key: string, rgb: Rgb): void {
    const changed = !this.paperReady || this.paperContext !== key
      || rgb.some((channel, index) => channel !== this.paperRgb[index]);
    this.paperContext = key;
    this.paperRgb = rgb;
    this.paperReady = true;
    if (changed) this.floorMemo = null;
  }
}
