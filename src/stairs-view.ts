import { nothing, svg, type TemplateResult } from 'lit';
import {
  cachedStairRenderGeometry, stairList, stairStyleVars, type Stair,
} from './stairs';
import { stairTargetState } from './stairs-editor-model';
import type { SpaceModel } from './types';

export interface StairViewHostPort {
  _mode: 'view' | 'plan' | 'devices' | 'decor';
  _curSpaceCfg: unknown;
  _model: SpaceModel[];
  _space: string;
  _hasFixedFloor: boolean;
  _suppressClick: boolean;
  _cellCm: number;
  _decorStyle: { color: string; opacity: number };
  _tabClick(spaceId: string): void;
  _t(key: 'markup.stairs' | 'stairs.tooltip_navigate', vars?: Record<string, string | number>): string;
  /** The card's pointer tooltip: shown only for a hover-capable pointer. */
  _showTip(event: PointerEvent, title: string, meta: string): void;
  _clearPointerHover(): void;
}

type ViewPress = { pid: number; startedAt: number };

/** Eager, read-only stair surface. All editing stays in the lazy editor graph. */
export class StairViewRuntime {
  private press: ViewPress | null = null;
  private suppressClick = false;

  public constructor(private readonly owner: StairViewHostPort) {}

  private get stairs(): Stair[] {
    return stairList((this.owner._curSpaceCfg as { stairs?: unknown } | null)?.stairs);
  }

  public pointerDown(event: PointerEvent): void {
    this.suppressClick = false;
    if (event.pointerType === 'touch') {
      this.press = { pid: event.pointerId, startedAt: performance.now() };
    }
  }

  public pointerUp(event: PointerEvent): void {
    const press = this.press;
    if (!press || press.pid !== event.pointerId) return;
    this.press = null;
    if (performance.now() - press.startedAt >= 600) this.suppressClick = true;
  }

  public pointerCancel(event: PointerEvent): void {
    if (this.press?.pid !== event.pointerId) return;
    this.press = null;
    this.suppressClick = true;
  }

  public clearGesture(): void {
    this.press = null;
    this.suppressClick = false;
  }

  public renderLayer(): TemplateResult {
    const spaceIds = new Set(this.owner._model.map((item) => item.id));
    const interactive = this.owner._mode === 'view';
    const items = this.stairs.map((stair) => {
      const geometry = cachedStairRenderGeometry(stair, this.owner._cellCm);
      const outline = geometry.outline.map((point) => point.join(',')).join(' ');
      const targetState = stairTargetState(
        stair, this.owner._space, spaceIds, this.owner._hasFixedFloor,
      );
      const active = interactive && targetState === 'active';
      // #676 К8: the tooltip has exactly the link's condition — `active` — so a
      // missing, self, deleted or fixed-floor target never announces a floor.
      const targetTitle = active
        ? this.owner._model.find((item) => item.id === stair.target_space_id)?.title ?? ''
        : '';
      const tip = (event: PointerEvent): void => {
        if (!active) return;
        this.owner._showTip(event, this.owner._t('stairs.tooltip_navigate', { title: targetTitle }), '');
      };
      const navigate = (event: Event): void => {
        event.stopPropagation();
        if (event.type === 'keydown') this.suppressClick = false;
        if (!active || this.owner._suppressClick || this.suppressClick
            || !stair.target_space_id) return;
        this.owner._tabClick(stair.target_space_id);
      };
      return svg`<g class="hp-stair ${active ? 'navigable' : ''} ${interactive ? 'input-enabled' : ''}"
        data-hp="stair" data-id=${stair.id} data-kind=${stair.kind}
        data-target-state=${targetState}
        style=${stairStyleVars(stair, this.owner._decorStyle)}
        role=${active ? 'link' : 'img'} tabindex=${active ? '0' : nothing}
        aria-label=${this.owner._t('markup.stairs')}
        @click=${navigate}
        @pointerenter=${tip}
        @pointermove=${tip}
        @pointerleave=${() => { if (active) this.owner._clearPointerHover(); }}
        @keydown=${(event: KeyboardEvent) => {
          if (active && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            navigate(event);
          }
        }}>
        <polygon class="hp-stair-outline" points=${outline}></polygon>
        <polygon class="hp-stair-hit" points=${outline}
          @pointerdown=${(event: PointerEvent) => this.pointerDown(event)}></polygon>
        ${geometry.trapezoid.map((line) => svg`<line class="hp-stair-trapezoid"
          x1=${line.a[0]} y1=${line.a[1]} x2=${line.b[0]} y2=${line.b[1]}></line>`)}
        ${geometry.treads.map((line) => svg`<line class="hp-stair-tread"
          x1=${line.a[0]} y1=${line.a[1]} x2=${line.b[0]} y2=${line.b[1]}></line>`)}
        <path class="hp-stair-arrow" d=${geometry.arrowPath}></path>
      </g>`;
    });
    return svg`<g class="hp-stairs-layer">${items}</g>` as unknown as TemplateResult;
  }
}
