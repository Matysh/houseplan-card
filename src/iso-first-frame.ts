import {
  memoIsoLightFloorRooms, type IsoLightFloorMemo, type Rgb,
} from './iso-materials';

export interface IsoPaperContext {
  readonly key: string;
  /** Identity of the theme card background that an image-backed floor shows. */
  readonly theme: string;
  readonly imagePlan: boolean;
}

interface ThemeIdentity {
  readonly darkMode?: unknown;
  readonly default_theme?: unknown;
  readonly default_dark_theme?: unknown;
  readonly theme?: unknown;
}

/**
 * All non-DOM inputs that can change the computed plan-paper colour. The floor
 * the caller passes is deliberately not one of them (#739): no space sets the
 * card background variables, so a floor switch keeps the paper of the theme
 * and mode instead of resolving it again with a second update pass.
 */
export function isoPaperContext(
  space: string, mode: string, imagePlan: boolean, themes?: ThemeIdentity,
): IsoPaperContext {
  const theme = JSON.stringify([
    mode, themes?.darkMode ?? null, themes?.default_theme ?? null,
    themes?.default_dark_theme ?? null, themes?.theme ?? null,
  ]);
  return { imagePlan, theme, key: JSON.stringify([imagePlan, theme]) };
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
  /** #739: the last resolved theme paper, kept across drawn and image floors. */
  private themePaper: { readonly theme: string; readonly rgb: Rgb } | null = null;

  public runtimeLoading(): void { this.runtimeFailed = false; }
  public runtimeReady(): void { this.runtimeFailed = false; }
  public runtimeFailure(): void { this.runtimeFailed = true; }

  public prepare(desired: 'flat' | 'iso', context: IsoPaperContext): void {
    // Only the current theme and mode are kept: any change of either — also one
    // made in Flat or in an editor — resolves the paper again on the #654 path.
    if (this.themePaper && this.themePaper.theme !== context.theme) this.themePaper = null;
    if (context.key === this.paperContext) return;
    this.paperReady = false;
    if (desired !== 'iso') return;
    if (!context.imagePlan) this.commitPaper(context.key, [255, 255, 255]);
    // #739: a known theme paper is ready before the first render of the floor:
    // no veil, no resolver, no second update pass.
    else if (this.themePaper?.theme === context.theme) this.commitPaper(context.key, this.themePaper.rgb);
  }

  /** Returns true when a committed render must consume a newly resolved paper. */
  public sync(
    desired: 'flat' | 'iso', context: IsoPaperContext, resolveThemePaper: () => Rgb,
  ): boolean {
    if (desired !== 'iso' || this.paperReady && context.key === this.paperContext) return false;
    let rgb: Rgb = [255, 255, 255];
    if (context.imagePlan) {
      rgb = resolveThemePaper();
      this.themePaper = { theme: context.theme, rgb };
    }
    this.commitPaper(context.key, rgb);
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
