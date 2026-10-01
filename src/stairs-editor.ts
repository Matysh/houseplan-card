import { html, nothing, svg, type TemplateResult } from 'lit';
import { FURN_WALL_CELLS } from './furniture-placement';
import {
  furnitureWallSurfacesFor, type FurnitureWallSurface, type FurnitureWallSurfaceSource,
} from './furniture-wall-surface';
import { strictNumber, type MarkupTool } from './card-runtime';
import type { EditorToolbarGroup } from './editor-secondary';
import type { I18nKey } from './i18n';
import { clampCanvasN, NORM_W } from './space-geometry';
import {
  draftLeadingHandle, draftStair, magnetStairMove, magnetStairResize, physicalStairSurfaces,
  resizeCursor, resizeStair, stairBox, stairFieldOf, stairHandles, stairMinN,
  stairRotateHandle, stairSizeFromField, STAIR_MAX_CM, STAIR_MIN_CM, type StairHandleSign,
} from './stairs-box';
import {
  convertStairKind, normalizeStairAngle, snapStairToStairs, stairTargetState,
} from './stairs-editor-model';
import {
  cachedStairMarkup, cachedStairRenderGeometry, MAX_STAIRS_PER_SPACE, stairList, stairStyleVars,
  stairVisualFields, stairVisualStyle, type Stair, type StairVisualStyle,
} from './stairs';
import type { SpaceModel } from './types';

type StairDialog = {
  id: string;
  kind: Stair['kind'];
  length: string;
  width: string;
  radius: string;
  angle: string;
  direction: Stair['direction'];
  targetSpaceId: string;
  color: string;
  opacity: number;
  fillColor: string;
  fillOpacity: number;
  /** Field values at open time: an untouched field keeps the stored number bit for bit (#676 К7). */
  opened: { length: string; width: string; radius: string; angle: string };
};

type StairDrag = {
  pid: number;
  id: string;
  mode: 'move' | 'resize' | 'rotate';
  handle: StairHandleSign;
  start: number[];
  original: Stair;
  before: unknown;
  moved: boolean;
  /** Wall faces are read once per gesture: each write bumps the epoch that keys their cache. */
  surfaces: readonly FurnitureWallSurface[];
};

type StairDraft = {
  pid: number;
  kind: Stair['kind'];
  id: string;
  a: number[];
  b: number[];
  stair: Stair;
  surfaces: readonly FurnitureWallSurface[];
};

/** Narrow internal seam owned by HouseplanCard. The cast at construction keeps
 * these implementation details private to the card while this module keeps the
 * stairs feature out of the already size-limited card core. */
export interface StairEditorHostPort {
  hass: unknown;
  _mode: 'view' | 'plan' | 'devices' | 'decor';
  _tool: MarkupTool;
  _curSpaceCfg: unknown;
  _cfgEpoch: number;
  _cleanFloorCache: Map<unknown, unknown>;
  _modelCache: unknown;
  _gridPitch: number;
  _cellCm: number;
  _imperial: boolean;
  _model: SpaceModel[];
  _space: string;
  _hasFixedFloor: boolean;
  _decorStyle: { color: string; opacity: number };
  _suppressClick: boolean;
  requestUpdate(): void;
  _showToast(message: string): void;
  _t(key: I18nKey, vars?: Record<string, string | number>): string;
  _geometrySnapshot(): unknown;
  _recordGeometry(name: string, before: unknown): void;
  _saveConfigDebounced(): void;
  _svgPoint(event: MouseEvent): number[];
  _tabClick(spaceId: string): void;
  _activateMarkupTool(tool: MarkupTool): void;
}

const newStairId = (): string => `stair-${crypto.randomUUID?.()
  || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;

export class StairEditorRuntime {
  private preset: Stair['kind'] = 'straight';
  private selectedId: string | null = null;
  private dialog: StairDialog | null = null;
  private drag: StairDrag | null = null;
  private draft: StairDraft | null = null;

  public constructor(private readonly owner: StairEditorHostPort) {}

  public get selected(): string | null { return this.selectedId; }
  public get dialogOpen(): boolean { return this.dialog !== null; }
  public get dragging(): boolean { return this.drag !== null || this.draft !== null; }

  public clearSelection(): void {
    this.selectedId = null;
    this.owner.requestUpdate();
  }

  public selectionKey(): string | null {
    return this.selectedId ? `selection:stair:${this.selectedId}` : null;
  }

  private get stairs(): Stair[] {
    return stairList((this.owner._curSpaceCfg as { stairs?: unknown } | null)?.stairs);
  }

  private get inputEnabled(): boolean {
    return this.owner._mode === 'plan'
      && (this.owner._tool === 'select' || this.owner._tool === 'stairs');
  }

  private get reach(): number { return this.owner._gridPitch * FURN_WALL_CELLS; }

  private get minUnits(): number { return stairMinN(this.owner._cellCm) * NORM_W; }

  private creationVisualStyle(): StairVisualStyle {
    return {
      color: this.owner._decorStyle.color,
      opacity: this.owner._decorStyle.opacity,
      fillColor: this.owner._decorStyle.color,
      fillOpacity: 0,
    };
  }

  /** Room faces from the furniture magnet plus physical bodies with an outward side (#676). */
  private surfaces(): readonly FurnitureWallSurface[] {
    const source = this.owner as unknown as FurnitureWallSurfaceSource;
    return [
      ...furnitureWallSurfacesFor(source).filter((surface) => surface.owner === 'room'),
      ...physicalStairSurfaces(source._rawPhysicalBodiesR()),
    ];
  }

  private write(stairs: Stair[]): void {
    const space = this.owner._curSpaceCfg as { stairs?: Stair[] } | null;
    if (!space) return;
    if (stairs.length) space.stairs = stairs;
    else delete space.stairs;
    this.owner._cfgEpoch++;
    this.owner._cleanFloorCache.clear();
    this.owner._modelCache = null;
    this.owner.requestUpdate();
  }

  private replace(next: Stair): void {
    this.write(this.stairs.map((item) => item.id === next.id ? next : item));
  }

  /**
   * The synthesized `click` after any gesture on the stair or its handles
   * must never reach the plan tool underneath: under «Stairs» it would place
   * another stair, under «Select» it would drop the selection (#676 К6).
   */
  private swallowNextClick(): void {
    this.owner._suppressClick = true;
    setTimeout(() => { this.owner._suppressClick = false; }, 0);
  }

  private withMoveMagnet(stair: Stair, center: readonly number[], surfaces: readonly FurnitureWallSurface[]): Stair {
    const moved = { ...stair, x: center[0] / NORM_W, y: center[1] / NORM_W } as Stair;
    const snapped = magnetStairMove(moved, surfaces, this.reach);
    const [cx, cy] = snapStairToStairs(
      snapped, [snapped.x * NORM_W, snapped.y * NORM_W], this.stairs, this.reach,
    );
    return { ...snapped, x: clampCanvasN(cx / NORM_W), y: clampCanvasN(cy / NORM_W) } as Stair;
  }

  public activatePlacement(kind: Stair['kind']): void {
    this.preset = kind;
    this.selectedId = null;
    this.owner._activateMarkupTool('stairs');
  }

  private placeStair(stair: Stair, before: unknown): void {
    this.write([...this.stairs, stair]);
    this.selectedId = stair.id;
    this.owner._recordGeometry(this.owner._t('history.stair_add'), before);
    this.owner._saveConfigDebounced();
  }

  /**
   * Drag-to-draw under the Stairs tool (#676 К1): the press starts a draft on
   * the stage, the release commits it. Returns false when the press is not a
   * placement (secondary button, second finger, no space, limit reached), so
   * the stage keeps its ordinary pan/pinch handling.
   */
  public stagePointerDown(event: PointerEvent): boolean {
    if (this.owner._mode !== 'plan' || this.owner._tool !== 'stairs') return false;
    if (this.draft) {
      // A second contact turns the gesture into navigation: the draft is gone.
      if (this.draft.pid !== event.pointerId) this.cancelDraft();
      return false;
    }
    if (this.drag || (event.pointerType === 'mouse' && event.button !== 0) || !event.isPrimary) return false;
    const space = this.owner._curSpaceCfg as { stairs?: Stair[] } | null;
    if (!space) return false;
    if (this.stairs.length >= MAX_STAIRS_PER_SPACE) {
      this.owner._showToast(this.owner._t('toast.physical_limit'));
      return false;
    }
    event.preventDefault();
    const point = this.owner._svgPoint(event as unknown as MouseEvent);
    const id = newStairId();
    this.draft = {
      pid: event.pointerId, kind: this.preset, id, a: point, b: point,
      stair: draftStair(
        this.preset, point, point, this.owner._cellCm, id, this.owner._gridPitch,
        NORM_W, this.creationVisualStyle(),
      ),
      surfaces: this.surfaces(),
    };
    this.selectedId = null;
    try { (event.currentTarget as Element).setPointerCapture(event.pointerId); }
    catch { /* synthetic event */ }
    this.owner.requestUpdate();
    return true;
  }

  private draftAt(draft: StairDraft, point: number[]): Stair {
    const drawn = draftStair(
      draft.kind, draft.a, point, this.owner._cellCm, draft.id, this.owner._gridPitch,
      NORM_W, stairVisualStyle(draft.stair, this.creationVisualStyle()),
    );
    const isClick = Math.max(Math.abs(point[0] - draft.a[0]), Math.abs(point[1] - draft.a[1])) < this.owner._gridPitch;
    if (isClick) return this.withMoveMagnet(drawn, [drawn.x * NORM_W, drawn.y * NORM_W], draft.surfaces);
    return magnetStairResize(
      drawn, draftLeadingHandle(drawn, draft.a, point), draft.surfaces, this.reach, this.minUnits,
    );
  }

  private cancelDraft(): void {
    if (!this.draft) return;
    this.draft = null;
    this.owner.requestUpdate();
  }

  /** Programmatic placement kept for the harness and tests: a click at `point`. */
  public placeAt(point: number[]): void {
    const space = this.owner._curSpaceCfg as { stairs?: Stair[] } | null;
    if (!space || this.stairs.length >= MAX_STAIRS_PER_SPACE) {
      this.owner._showToast(this.owner._t('toast.physical_limit'));
      return;
    }
    const before = this.owner._geometrySnapshot();
    const id = newStairId();
    const stair = this.withMoveMagnet(
      draftStair(
        this.preset, point, point, this.owner._cellCm, id, this.owner._gridPitch,
        NORM_W, this.creationVisualStyle(),
      ),
      [point[0], point[1]], this.surfaces(),
    );
    this.placeStair(stair, before);
  }

  private openDialog(stair: Stair): void {
    const cellCm = this.owner._cellCm;
    const imperial = this.owner._imperial;
    const fields = {
      length: stairFieldOf(stair.kind === 'straight' ? stair.length : stair.radius * 2, cellCm, imperial),
      width: stairFieldOf(stair.kind === 'straight' ? stair.width : stair.radius * 2, cellCm, imperial),
      radius: stairFieldOf(stair.kind === 'spiral' ? stair.radius : Math.max(stair.length, stair.width) / 2, cellCm, imperial),
      angle: String(stair.angle),
    };
    const visual = stairVisualStyle(stair, this.creationVisualStyle());
    this.dialog = {
      id: stair.id,
      kind: stair.kind,
      ...fields,
      direction: stair.direction,
      targetSpaceId: stair.target_space_id || '',
      ...visual,
      opened: fields,
    };
    this.owner.requestUpdate();
  }

  private updateDialog(patch: Partial<StairDialog>): void {
    if (!this.dialog) return;
    this.dialog = { ...this.dialog, ...patch };
    this.owner.requestUpdate();
  }

  private saveDialog(): void {
    const dialog = this.dialog;
    const current = this.stairs.find((item) => item.id === dialog?.id);
    if (!dialog || !current) return;
    const cellCm = this.owner._cellCm;
    const imperial = this.owner._imperial;
    const angle = dialog.angle === dialog.opened.angle ? current.angle : strictNumber(dialog.angle);
    if (angle == null) return;
    let next = convertStairKind(current, dialog.kind);
    if (next.kind === 'straight') {
      const length = stairSizeFromField(dialog.length, dialog.opened.length, next.length, cellCm, imperial);
      const width = stairSizeFromField(dialog.width, dialog.opened.width, next.width, cellCm, imperial);
      if (length == null || width == null) return;
      next = {
        ...next, length, width,
        direction: dialog.direction === 'backward' ? 'backward' : 'forward',
      };
    } else {
      const radius = stairSizeFromField(dialog.radius, dialog.opened.radius, next.radius, cellCm, imperial);
      if (radius == null) return;
      next = {
        ...next, radius,
        direction: dialog.direction === 'counterclockwise' ? 'counterclockwise' : 'clockwise',
      };
    }
    next = {
      ...next,
      angle: normalizeStairAngle(angle),
      target_space_id: dialog.targetSpaceId || null,
      ...stairVisualFields(dialog),
    } as Stair;
    this.dialog = null;
    const unchanged = JSON.stringify(next) === JSON.stringify({ ...current, target_space_id: current.target_space_id ?? null });
    if (unchanged) {
      this.owner.requestUpdate();
      return;
    }
    const before = this.owner._geometrySnapshot();
    this.replace(next);
    this.owner._recordGeometry(this.owner._t('history.stair_edit'), before);
    this.owner._saveConfigDebounced();
  }

  private delete(id: string): void {
    const before = this.owner._geometrySnapshot();
    this.write(this.stairs.filter((item) => item.id !== id));
    this.selectedId = null;
    this.dialog = null;
    this.owner._recordGeometry(this.owner._t('history.stair_delete'), before);
    this.owner._saveConfigDebounced();
  }

  public deleteSelected(): boolean {
    if (!this.selectedId) return false;
    this.delete(this.selectedId);
    return true;
  }

  private pointerDown(
    event: PointerEvent,
    stair: Stair,
    mode: 'move' | 'resize' | 'rotate',
    handle: StairHandleSign = { sx: 0, sy: 0 },
  ): void {
    if (!this.inputEnabled || this.draft) return;
    event.preventDefault();
    event.stopPropagation();
    this.selectedId = stair.id;
    this.drag = {
      pid: event.pointerId,
      id: stair.id,
      mode,
      handle,
      start: this.owner._svgPoint(event as unknown as MouseEvent),
      original: structuredClone(stair),
      before: this.owner._geometrySnapshot(),
      moved: false,
      surfaces: this.surfaces(),
    };
    try { (event.currentTarget as Element).setPointerCapture(event.pointerId); }
    catch { /* synthetic event */ }
    this.owner.requestUpdate();
  }

  public pointerMove(event: PointerEvent): boolean {
    if (this.draft?.pid === event.pointerId) {
      const point = this.owner._svgPoint(event as unknown as MouseEvent);
      this.draft.b = point;
      this.draft.stair = this.draftAt(this.draft, point);
      this.owner.requestUpdate();
      return true;
    }
    const drag = this.drag;
    if (!drag || drag.pid !== event.pointerId) return false;
    const point = this.owner._svgPoint(event as unknown as MouseEvent);
    let next: Stair = { ...drag.original };
    if (drag.mode === 'move') {
      next = this.withMoveMagnet(next, [
        drag.original.x * NORM_W + point[0] - drag.start[0],
        drag.original.y * NORM_W + point[1] - drag.start[1],
      ], drag.surfaces);
    } else if (drag.mode === 'rotate') {
      next.angle = normalizeStairAngle(
        Math.atan2(point[1] - next.y * NORM_W, point[0] - next.x * NORM_W)
          * 180 / Math.PI + 90,
      );
      if (event.shiftKey) next.angle = normalizeStairAngle(Math.round(next.angle / 45) * 45);
    } else {
      next = magnetStairResize(
        resizeStair(next, drag.handle, point, { minUnits: this.minUnits, keepAspect: event.shiftKey }),
        drag.handle, drag.surfaces, this.reach, this.minUnits,
      );
    }
    drag.moved ||= Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) > 0.5;
    this.replace(next);
    return true;
  }

  private endDrag(event: PointerEvent, cancelled: boolean): boolean {
    if (this.draft?.pid === event.pointerId) {
      const draft = this.draft;
      this.draft = null;
      this.swallowNextClick();
      if (cancelled) { this.owner.requestUpdate(); return true; }
      this.placeStair(this.draftAt(draft, draft.b), this.owner._geometrySnapshot());
      return true;
    }
    const drag = this.drag;
    if (!drag || drag.pid !== event.pointerId) return false;
    this.swallowNextClick();
    if (cancelled) {
      this.replace(drag.original);
    } else if (drag.moved) {
      const label = drag.mode === 'resize' ? 'history.stair_resize'
        : drag.mode === 'rotate' ? 'history.stair_rotate' : 'history.stair_move';
      this.owner._recordGeometry(this.owner._t(label), drag.before);
      this.owner._saveConfigDebounced();
    }
    this.drag = null;
    return true;
  }

  public pointerUp(event: PointerEvent): boolean {
    return this.endDrag(event, false);
  }

  public pointerCancel(event: PointerEvent): boolean {
    return this.endDrag(event, true);
  }

  public undoActiveDrag(): boolean {
    if (this.draft) { this.cancelDraft(); return true; }
    if (!this.drag) return false;
    const drag = this.drag;
    this.replace(drag.original);
    this.drag = null;
    return true;
  }

  public escape(): boolean {
    if (this.undoActiveDrag()) return true;
    if (!this.selectedId) return false;
    this.selectedId = null;
    this.owner.requestUpdate();
    return true;
  }

  public beforeModeChange(mode: StairEditorHostPort['_mode']): void {
    if (mode !== this.owner._mode) this.undoActiveDrag();
  }

  public afterModeChange(): void {
    if (this.owner._mode !== 'plan') this.selectedId = null;
  }

  public clearGesture(): void {
    this.drag = null;
    this.draft = null;
    this.selectedId = null;
  }

  public toolbarGroup(): EditorToolbarGroup {
    return {
      id: 'stairs',
      label: this.owner._t('markup.stairs'),
      icon: 'mdi:stairs',
      activeItemId: this.owner._tool === 'stairs' ? this.preset : undefined,
      items: [{
        id: 'straight',
        label: this.owner._t('stairs.straight'),
        icon: 'mdi:stairs',
        role: 'tool',
        invoke: () => this.activatePlacement('straight'),
      }, {
        id: 'spiral',
        label: this.owner._t('stairs.spiral'),
        icon: 'mdi:rotate-orbit',
        role: 'tool',
        invoke: () => this.activatePlacement('spiral'),
      }],
    };
  }

  private renderStair(stair: Stair, spaceIds: ReadonlySet<string>, selected: boolean, draft: boolean): TemplateResult {
    const geometry = cachedStairRenderGeometry(stair, this.owner._cellCm);
    const markup = cachedStairMarkup(geometry);
    const targetState = stairTargetState(
      stair, this.owner._space, spaceIds, this.owner._hasFixedFloor,
    );
    const inputEnabled = this.inputEnabled && !draft;
    const select = (event: Event): void => {
      if (this.owner._mode === 'plan') {
        event.stopPropagation();
        this.selectedId = stair.id;
        this.owner.requestUpdate();
      }
    };
    return svg`<g class="hp-stair ${selected ? 'selected' : ''} ${inputEnabled ? 'input-enabled' : ''} ${draft ? 'draft' : ''}"
      data-hp="stair" data-id=${stair.id} data-kind=${stair.kind}
      data-target-state=${targetState}
      style=${stairStyleVars(
        stair, this.owner._cellCm, this.owner._gridPitch, this.creationVisualStyle(),
      )}
      role="img"
      aria-label=${this.owner._t('markup.stairs')}
      @dblclick=${(event: MouseEvent) => {
        event.stopPropagation();
        if (this.owner._mode === 'plan' && !draft) this.openDialog(stair);
      }}>
      <polygon class="hp-stair-outline" points=${markup.outline}></polygon>
      <polygon class="hp-stair-hit" points=${markup.outline}
        @pointerdown=${(event: PointerEvent) => this.pointerDown(event, stair, 'move')}
        @click=${select}></polygon>
      ${geometry.trapezoid.map((line) => svg`<line class="hp-stair-trapezoid"
        x1=${line.a[0]} y1=${line.a[1]} x2=${line.b[0]} y2=${line.b[1]}></line>`)}
      ${markup.treads ? svg`<path class="hp-stair-tread" d=${markup.treads}></path>` : nothing}
      <path class="hp-stair-arrow" d=${geometry.arrowPath}></path>
    </g>` as unknown as TemplateResult;
  }

  public renderLayer(): TemplateResult {
    const spaceIds = new Set(this.owner._model.map((item) => item.id));
    const items = this.stairs.map((stair) => this.renderStair(
      stair, spaceIds, this.inputEnabled && this.selectedId === stair.id, false,
    ));
    const draft = this.draft ? this.renderStair(this.draft.stair, spaceIds, true, true) : nothing;
    return svg`<g class="hp-stairs-layer">${items}${draft}</g>` as unknown as TemplateResult;
  }

  /**
   * The selection frame (#676 К2) lives in the card's top overlay, above wall
   * bodies, with the decor frame's chrome: finger-sized invisible hit circles,
   * quarter-size visible beads, cursors by the world bearing of each handle.
   */
  public renderFrame(view: { w: number; h: number }): TemplateResult | typeof nothing {
    if (!this.inputEnabled) return nothing;
    const stair = this.draft?.stair ?? this.stairs.find((item) => item.id === this.selectedId);
    if (!stair) return nothing;
    const hr = Math.max(view.w, view.h) * 0.018;
    const kr = hr / 4;
    const stem = stairRotateHandle(stair, hr * 2.2);
    const box = stairBox(stair);
    const geometry = cachedStairRenderGeometry(stair, this.owner._cellCm);
    const stop = (event: Event): void => { event.stopPropagation(); };
    const handles = stairHandles(stair).map((handle) => svg`<circle
        class="dthandle hp-stair-resize dt-${resizeCursor(handle.normalDeg)}"
        cx=${handle.point[0]} cy=${handle.point[1]} r=${hr.toFixed(1)}
        @pointerdown=${(event: PointerEvent) => this.pointerDown(event, stair, 'resize', { sx: handle.sx, sy: handle.sy })}
        @click=${stop}></circle>
      <circle class="dtknob" cx=${handle.point[0]} cy=${handle.point[1]} r=${kr.toFixed(2)}></circle>`);
    const outline = stair.kind === 'spiral'
      ? svg`<circle class="dtbox" cx=${box.cx} cy=${box.cy} r=${box.w / 2}></circle>`
      : svg`<polygon class="dtbox" points=${geometry.outline.map((point) => point.join(',')).join(' ')}></polygon>`;
    // A draft has no handles yet: the pointer that draws it is the only gesture.
    return svg`<g class="dtframe hp-stair-frame" data-hp="stair-frame" data-id=${stair.id}>
      ${outline}
      ${this.draft ? nothing : svg`
        <line class="dtstem" x1=${stem.from[0]} y1=${stem.from[1]} x2=${stem.to[0]} y2=${stem.to[1]}></line>
        <circle class="dthandle dtrot hp-stair-rotate" cx=${stem.to[0]} cy=${stem.to[1]} r=${hr.toFixed(1)}
          @pointerdown=${(event: PointerEvent) => this.pointerDown(event, stair, 'rotate')}
          @click=${stop}></circle>
        <circle class="dtknob" cx=${stem.to[0]} cy=${stem.to[1]} r=${kr.toFixed(2)}></circle>
        ${handles}`}
    </g>` as unknown as TemplateResult;
  }

  public renderDialog(): TemplateResult | typeof nothing {
    const dialog = this.dialog;
    const current = this.stairs.find((item) => item.id === dialog?.id);
    if (!dialog || !current) return nothing;
    const targetState = stairTargetState(
      { ...current, target_space_id: dialog.targetSpaceId || null } as Stair,
      this.owner._space, new Set(this.owner._model.map((item) => item.id)),
      this.owner._hasFixedFloor,
    );
    const directionOptions: ReadonlyArray<readonly [string, I18nKey]> = dialog.kind === 'straight'
      ? [['forward', 'stairs.up'], ['backward', 'stairs.down']] as const
      : [['clockwise', 'stairs.clockwise'], ['counterclockwise', 'stairs.counterclockwise']] as const;
    const imperial = this.owner._imperial;
    const bound = (cm: number): string => String(Math.round((imperial ? cm / 2.54 : cm) * 100) / 100);
    const field = (key: 'length' | 'width' | 'radius', label: I18nKey) => html`
      <label>${this.owner._t(label)}</label>
      <div class="row"><input class="namein tempin" type="number"
        min=${bound(STAIR_MIN_CM)} max=${bound(STAIR_MAX_CM)} step="any"
        .value=${dialog[key]}
        @input=${(event: Event) => this.updateDialog({
          [key]: (event.target as HTMLInputElement).value,
        })}><span class="opl">${this.owner._t(
          imperial ? 'wallthick.unit_in' : 'wallthick.unit_cm',
        )}</span></div>`;
    return html`<hp-dialog .hass=${this.owner.hass} data-kind="stairs" wide
      .title=${this.owner._t('stairs.properties')} icon="mdi:stairs"
      @hp-close=${() => this.closeDialog()}>
      <div class="body">
        <label>${this.owner._t('stairs.type')}</label>
        <select class="areasel"
          @change=${(event: Event) => {
            const kind = (event.target as HTMLSelectElement).value as Stair['kind'];
            const converted = convertStairKind(current, kind);
            const cellCm = this.owner._cellCm;
            this.updateDialog({
              kind,
              length: stairFieldOf(converted.kind === 'straight' ? converted.length : converted.radius * 2, cellCm, imperial),
              width: stairFieldOf(converted.kind === 'straight' ? converted.width : converted.radius * 2, cellCm, imperial),
              radius: stairFieldOf(converted.kind === 'spiral' ? converted.radius : Math.max(converted.length, converted.width) / 2, cellCm, imperial),
              direction: converted.direction,
            });
          }}>
          <option value="straight" ?selected=${dialog.kind === 'straight'}>${this.owner._t('stairs.straight')}</option>
          <option value="spiral" ?selected=${dialog.kind === 'spiral'}>${this.owner._t('stairs.spiral')}</option>
        </select>
        ${dialog.kind === 'straight'
          ? html`${field('length', 'stairs.length')}${field('width', 'stairs.width')}`
          : field('radius', 'stairs.radius')}
        <hp-color-opacity .label=${this.owner._t('stairs.line_color')}
          .color=${dialog.color} .opacity=${dialog.opacity}
          .opacityLabel=${this.owner._t('space.opacity')}
          @hp-color-opacity-change=${(event: CustomEvent<{ color: string; opacity: number }>) =>
            this.updateDialog({ color: event.detail.color, opacity: event.detail.opacity })}>
        </hp-color-opacity>
        <hp-color-opacity .label=${this.owner._t('stairs.fill_color')}
          .color=${dialog.fillColor} .opacity=${dialog.fillOpacity}
          .opacityLabel=${this.owner._t('space.opacity')}
          @hp-color-opacity-change=${(event: CustomEvent<{ color: string; opacity: number }>) =>
            this.updateDialog({ fillColor: event.detail.color, fillOpacity: event.detail.opacity })}>
        </hp-color-opacity>
        <label>${this.owner._t('stairs.rotation')}</label>
        <input class="namein tempin" type="number" step="any" .value=${dialog.angle}
          @input=${(event: Event) => this.updateDialog({
            angle: (event.target as HTMLInputElement).value,
          })}>
        <label>${this.owner._t('stairs.direction')}</label>
        <div class="segmented">${directionOptions.map(([value, key]) => html`
          <button class="btn ${dialog.direction === value ? 'on' : ''}"
            @click=${() => this.updateDialog({
              direction: value as Stair['direction'],
            })}>${this.owner._t(key)}</button>`)}</div>
        <label>${this.owner._t('stairs.target')}</label>
        <select class="areasel"
          @change=${(event: Event) => this.updateDialog({
            targetSpaceId: (event.target as HTMLSelectElement).value,
          })}>
          <option value="" ?selected=${dialog.targetSpaceId === ''}>${this.owner._t('stairs.no_target')}</option>
          ${this.owner._model.filter((item) => item.id !== this.owner._space).map((item) => html`
            <option value=${item.id} ?selected=${dialog.targetSpaceId === item.id}>${item.title}</option>`)}
        </select>
        ${targetState !== 'active' ? html`<p class="hint warn">${this.owner._t(
          targetState === 'fixed' ? 'stairs.fixed_floor' : 'stairs.target_warning',
        )}</p>` : nothing}
      </div>
      <div class="row dialog-action-footer" slot="footer">
        <button class="btn danger" data-hp="dialog-confirm" @click=${() => this.delete(dialog.id)}>
          <ha-icon icon="mdi:delete-outline"></ha-icon>${this.owner._t('btn.delete')}</button>
        <span class="spacer"></span>
        <button class="btn ghost" data-hp="dialog-cancel"
          @click=${() => this.closeDialog()}>${this.owner._t('btn.cancel')}</button>
        <button class="btn on" data-hp="dialog-confirm" @click=${() => this.saveDialog()}>
          <ha-icon icon="mdi:check"></ha-icon>${this.owner._t('btn.save')}</button>
      </div>
    </hp-dialog>`;
  }

  private closeDialog(): void {
    this.dialog = null;
    this.owner.requestUpdate();
  }
}
