import { nothing, svg, type TemplateResult } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { controlMotion } from './ui-motion';
import {
  cachedStairMarkup, cachedStairRenderGeometry, stairList, stairStyleVars, type Stair,
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
  _gridPitch: number;
  _decorStyle: { color: string; opacity: number };
  _tabClick(spaceId: string): void;
  _t(key: 'markup.stairs' | 'stairs.tooltip_navigate', vars?: Record<string, string | number>): string;
  /** The card's pointer tooltip: shown only for a hover-capable pointer. */
  _showTip(event: PointerEvent, title: string, meta: string): void;
  _clearPointerHover(): void;
  requestUpdate(): unknown;
}

type ViewPress = { pid: number; startedAt: number };
interface ArrivalClock {
  setTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}
const arrivalClock: ArrivalClock = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: timer => clearTimeout(timer),
};

/** Eager, read-only stair surface. All editing stays in the lazy editor graph. */
export class StairViewRuntime {
  private press: ViewPress | null = null;
  private suppressClick = false;
  private arrival: { from: string; space: string; token: number; rendered: boolean;
    timer: ReturnType<typeof setTimeout> | null } | null = null;
  private arrivalToken = 0;

  public constructor(private readonly owner: StairViewHostPort, private readonly clock: ArrivalClock = arrivalClock) {}

  public clearArrival(): void {
    const arrival = this.arrival;
    if (!arrival) return;
    this.arrival = null;
    if (arrival.timer !== null) this.clock.clearTimeout(arrival.timer);
    this.owner.requestUpdate();
  }

  public disconnect(): void { this.clearGesture(); this.clearArrival(); }

  /** Start the lifetime after Lit has committed the incoming stair layer. */
  public updated(): void {
    const arrival = this.arrival;
    if (!arrival) return;
    if (this.owner._mode !== 'view' || this.owner._space !== arrival.space) { this.clearArrival(); return; }
    if (arrival.rendered && arrival.timer === null) arrival.timer = this.clock.setTimeout(() => {
      if (this.arrival === arrival) this.clearArrival();
    }, controlMotion.arrival.duration);
  }

  private arrive(from: string, space: string): void {
    this.clearArrival();
    if (!this.stairs.some(stair => stair.target_space_id === from)) return;
    this.arrival = { from, space, token: ++this.arrivalToken, rendered: false, timer: null };
    this.owner.requestUpdate();
  }

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
    // #694: the card's `_model` getter fingerprints the whole config on every
    // read; read it once per layer, not once more per navigable stair.
    const model = this.owner._model;
    const spaceIds = new Set(model.map((item) => item.id));
    const interactive = this.owner._mode === 'view';
    const renderedSpace = this.owner._space;
    const arrival = interactive && this.arrival?.space === renderedSpace ? this.arrival : null;
    const items = this.stairs.map((stair) => {
      const geometry = cachedStairRenderGeometry(stair, this.owner._cellCm);
      const markup = cachedStairMarkup(geometry);
      const targetState = stairTargetState(
        stair, this.owner._space, spaceIds, this.owner._hasFixedFloor,
      );
      const active = interactive && targetState === 'active';
      // #676 К8: the tooltip has exactly the link's condition — `active` — so a
      // missing, self, deleted or fixed-floor target never announces a floor.
      const targetTitle = active
        ? model.find((item) => item.id === stair.target_space_id)?.title ?? ''
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
        // Recheck current ownership; a retained old DOM callback is not a link
        // on a different floor or under a newly fixed/deleted target.
        if (this.owner._mode !== 'view' || this.owner._space !== renderedSpace) return;
        const current = this.stairs.find(item => item.id === stair.id);
        if (!current || stairTargetState(current, renderedSpace,
          new Set(this.owner._model.map(item => item.id)), this.owner._hasFixedFloor) !== 'active') return;
        const target = current.target_space_id!;
        this.owner._tabClick(target);
        if (this.owner._mode === 'view' && this.owner._space === target && target !== renderedSpace) this.arrive(renderedSpace, target);
      };
      const highlight = arrival && stair.target_space_id === arrival.from;
      if (highlight) arrival.rendered = true;
      return svg`<g class="hp-stair hp-stair-view ${active ? 'navigable' : ''} ${interactive ? 'input-enabled' : ''}"
        data-hp="stair" data-id=${stair.id} data-kind=${stair.kind}
        data-target-state=${targetState}
        style=${stairStyleVars(
          stair, this.owner._cellCm, this.owner._gridPitch, this.owner._decorStyle,
        )}
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
        <polygon class="hp-stair-outline" points=${markup.outline}></polygon>
        <polygon class="hp-stair-hit" points=${markup.outline}
          @pointerdown=${(event: PointerEvent) => this.pointerDown(event)}></polygon>
        ${geometry.trapezoid.map((line) => svg`<line class="hp-stair-trapezoid"
          x1=${line.a[0]} y1=${line.a[1]} x2=${line.b[0]} y2=${line.b[1]}></line>`)}
        ${markup.treads ? svg`<path class="hp-stair-tread" d=${markup.treads}></path>` : nothing}
        <path class="hp-stair-arrow" d=${geometry.arrowPath}></path>
        ${highlight ? keyed(arrival.token, svg`<polygon class="hpf-arrival-highlight hpf-motion"
          data-hp="stair-arrival" points=${markup.outline} aria-hidden="true"></polygon>`) : nothing}
      </g>`;
    });
    return svg`<g class="hp-stairs-layer">${items}</g>` as unknown as TemplateResult;
  }
}
