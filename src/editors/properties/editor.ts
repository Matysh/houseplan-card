import { waitForPriorConfigWrite } from '../../prior-config-write';
import { html, nothing, type TemplateResult } from 'lit';
import { dialogPresence } from '../../dialog-presence';
import { langOf } from '../../i18n';
import { cmToField, setWallThickness, thicknessCmAt } from '../../wall-thickness';
import { GRID_PITCH, GRID_STEP_N, NORM_W } from '../../canvas-constants';
import { supersedeDeferredWrite } from '../../config-adoption';
import { devicePlacement, deviceVisualFields, applyDeviceVisualFields, type DeviceVisualState } from '../../device-position-history';
import type { DeviceEditorHistoryState } from '../../device-position-history';
import type { CommandPosition, NamedCommand } from '../../command-stack';
import { normalizeHexColor } from '../../color-picker';
import type { HpColorOpacity, ColorHexDraft } from '../../hp-color-opacity';
import { contentFingerprint } from '../../visual-continuity';
import { buildOpeningDimensionContext, type OpeningDimension } from '../../opening-dimensions';
import { ensureFormKitStyles } from '../form-kit';
import { sourcePicker } from '../form-kit';
import { liveText, liveTextToken } from '../../logic';
import { decorStyleOf } from '../decor/geometry';
import { decorSelectionMembers } from '../decor/selection';
import type { DecorGroupStylePatch } from '../decor/group-edit';
import { parseGroupColor } from './group-color-draft';
import { PropertiesFieldController, PropertiesCommandLane, parsePropertiesNumber, propertiesIdentityKey, samePropertiesValue,
  type PropertiesIdentity, type PropertiesCommit, type PropertiesParse, type PropertiesDraft } from './controller';
import { propertiesCatalog, resolvePropertiesTarget, type PropertiesTarget, type PropertiesSpace } from './catalog';
import { propertiesIcon, renderPropertiesSurface, type PropertiesField, type PropertiesSurface } from './surface';
import { propertiesT, type PropertiesString } from './strings';
import { canonicalPropertiesAngle } from './transforms';
import { openingPropertiesCore, selectOpeningReference, refreshOpeningReference, propertiesOpeningSides } from './physical';
import { patchPropertiesTarget, propertiesColor } from './patch';
import { renderPropertiesSelection } from './selection';
import { PropertiesSectionMotion } from './section-motion';
import { parsePropertiesColor, propertiesColorDraft } from './color-draft';
import type { DecorShape, DecorStyle } from '../decor/types';
import type { DecorSelectionPress } from '../decor/group-press';
import type { SpaceGeometryState } from '../../geometry-history-state';
import { DecorGroupTextBoxes } from '../decor/group-selection';
import type { DevItem, Marker, ServerConfig } from '../../types';
import type { HouseplanEditorRuntime } from '../../houseplan-editor-runtime';

const bindingOf = (device: DevItem): string => device.marker?.binding ?? (device.bindingKind === 'virtual' ? 'virtual' : `${device.bindingKind}:${device.bindingRef}`);
const ok: PropertiesCommit = { ok: true };
const failure = (key: PropertiesString): PropertiesCommit => ({ ok: false, error: { key } });

/** Card-local selection/drafts. All durable mutations still cross the existing writers. */
export class PropertiesEditor {
  readonly lane = new PropertiesCommandLane();
  readonly fields: PropertiesFieldController;
  private laneAuthority: object | null = null;
  private selected: PropertiesIdentity | null = null;
  private selectionContext: { authority: object; adoption: number } | null = null;
  private groupTarget: { identity: PropertiesIdentity; items: readonly DecorShape[]; target: PropertiesTarget | null } | null = null;
  private readonly groupText = new DecorGroupTextBoxes();
  private decorPreview: { draft: PropertiesDraft | null; raw: string; identity: PropertiesIdentity | null;
    decor: readonly DecorShape[]; error?: string; pending: boolean; value: PropertiesDraft | null;
    patch: DecorGroupStylePatch | null; ids: ReadonlySet<string> } | null = null;
  private frozenReference: OpeningDimension | null = null;
  private referenceAttempted = false;
  private dimensionCache: { key: string; value: ReturnType<typeof buildOpeningDimensionContext> } | null = null;
  private observer: ResizeObserver | null = null;
  private observed: Element | null = null;
  private readonly pointerGuard = (event: Event): void => {
    if (!this.wide || this.host._editorSecondaryDialogBlocked) return;
    const path = event.composedPath() as Element[];
    if (!path.some(node=>node?.classList?.contains('stage'))) return;
    const node = path.some(item=>item?.matches?.('.hp-node-handle'));
    const handle = node || path.some(item=>item?.matches?.('.dthandle,.bdhandle,.rotate-handle,[data-led-handle],.roomlabel,.rlhandle'));
    const drawing = this.host._mode === 'plan' && this.host._tool !== 'select'
      || this.host._mode === 'decor' && this.host._decorTool !== 'select';
    if (this.fields.draft && (handle || drawing)) {
      event.preventDefault(); event.stopImmediatePropagation();
      void this.fields.finishThen(() => { if (node) this.setSelection(null); });
    } else if (node) this.setSelection(null);
  };
  private width = 0;
  private planHover: { clientX: number; clientY: number } | null = null;
  private suspendedColor: {draft: NonNullable<PropertiesFieldController['draft']>; value: ColorHexDraft} | null = null;
  private handoff: object | null = null;
  private ratioLocked = true;
  private ratio: number | null = null;
  private readonly sectionMotion = new PropertiesSectionMotion();
  private motionEpoch = 0;
  private textCaret = { start: 0, end: 0 };
  private variable: { identity: string; authority: object; original: string; start: number; end: number;
    entity: string; attribute: string; filter: string; open: boolean } | null = null;
  constructor(private readonly runtime: HouseplanEditorRuntime) {
    this.fields = new PropertiesFieldController({
      identity: () => this.identity,
      authority: () => this.allowed ? this.commandAuthority() : null,
      read: (identity, field) => {
        const value = this.field(identity, field)?.value;
        if (propertiesColor(value)) return { ...value, color: normalizeHexColor(value.color)! };
        return (field === 'size' || field === 'opacity') && typeof value === 'number' ? value / 100 : value;
      },
      parse: (field, raw) => this.parse(field, raw),
      commit: (identity, field, value, before, current) => this.commit(identity, field, value, before, current),
      changed: () => this.host.requestUpdate(), focus: field => this.focus(field),
      beforeFinish: field => {
        const control = [...this.host.renderRoot.querySelectorAll<HTMLElement>('[data-property]')].find(node=>node.dataset.property===field);
        const picker = control?.querySelector<HpColorOpacity>('hp-color-opacity');
        return picker && !picker.prepareCompletion() ? {key:picker.invalidOpacity ? 'invalid_number' : 'invalid_color'} : null;
      },
    }, this.lane);
  }
  private get host() { return this.runtime.host; }
  private commandAuthority(): object {
    const authority = this.host._configWriteContext.claim();
    if (authority !== this.laneAuthority) { this.lane.retire(); this.laneAuthority = authority; this.handoff = null; }
    return authority;
  }
  command<T>(run: () => Promise<T>): Promise<T> { this.commandAuthority(); return this.lane.run(run); }
  private get handingOff(): boolean { this.commandAuthority(); return !!this.handoff; }
  /** A dirty/pending field consumes the press; its asynchronous completion never replays a drag. */
  beforeDecorGroupPress(): boolean {
    if (this.host._saveConfigDebounced.pending()) this.host._saveConfigDebounced.flush();
    return this.beforeIntent(() => {}, false, true);
  }
  /** The existing command lane publishes one history step only after the whole move is accepted. */
  finishDecorGroupMove(before: SpaceGeometryState | null, press: DecorSelectionPress, current: () => boolean): void {
    const host = this.host, owner = this.identity;
    if (!before || !owner || !current() || !host._serverCfg || press.ids.length < 2) return;
    const previous = structuredClone(host._serverCfg);
    const space = previous.spaces.find(item => item.id === before.spaceId);
    if (!space) return;
    if (before.decor === undefined) delete space.decor; else space.decor = structuredClone(before.decor);
    let candidate: ServerConfig;
    try { candidate = this.runtime._prepareConfigCandidate(structuredClone(host._serverCfg)); }
    catch {
      host._adoption.stageLocalConfig(previous); host._cfgEpoch++;
      host._showToast(this.t('geometry_error'), 'geometry_error'); host.requestUpdate(); return;
    }
    this.commandAuthority();
    const receipt = {};
    this.handoff = receipt;
    // Register the already visible preview before any await. The normal adoption
    // owner can then roll it back even when the preceding queue entry rejects.
    const attempt = this.runtime._stageOptimisticConfig(previous, candidate);
    const restoreDeferred = supersedeDeferredWrite(host._saveConfigDebounced);
    const owned = () => this.allowed && current() && this.selected === owner && !!this.target(owner);
    void this.command(async () => {
      try {
        await host._writeChain;
        if (!owned() || contentFingerprint(host._serverCfg) !== attempt.attemptedFingerprint)
          throw Object.assign(new Error('group context retired'), { code: 'context-changed' });
        await this.runtime._saveConfigNow(attempt, () => owned()
          && contentFingerprint(host._serverCfg) === attempt.attemptedFingerprint);
        if (owned()) this.runtime._recordGeometry(this.t('group_move_history'), before);
      } catch (error) {
        if (host._configWriteContext.owns(press.authority) && host._adoption.adoptionEpoch === press.adoption)
          restoreDeferred(host._rollbackOptimistic(attempt));
        if (owned()) {
          const key = (error as { code?: string })?.code === 'conflict' ? 'external_change' : 'save_error';
          host._showToast(this.t(key), key);
        }
      }
    }).finally(() => { if (this.handoff === receipt) this.handoff = null; host.requestUpdate(); });
  }
  private get allowed(): boolean {
    const host = this.host;
    return host.isConnected && host._canEdit && !host._kiosk && host._norm && host._loadOk
      && host._mode !== 'view' && !!host._serverCfg && !!host._configWriteGuard()();
  }
  get wide(): boolean { return this.allowed && this.width >= 960; }
  get identity(): PropertiesIdentity | null {
    const value = this.selected;
    if (value?.editor === 'decor' && this.selectionContext
      && (this.selectionContext.adoption !== this.host._adoption.adoptionEpoch
        || !this.host._configWriteContext.current(this.selectionContext.authority, this.host.hass))) return null;
    return value && this.allowed && value.spaceId === this.host._space && value.editor === this.host._mode
      && this.target(value) ? value : null;
  }
  /** Canonical volatile IDs. `_decorSel` is only the compatible singleton projection. */
  get decorSelectionIds(): readonly string[] {
    const identity = this.identity;
    if (identity?.editor !== 'decor' || identity.kind === 'backdrop') return [];
    return identity.objectIds ?? [identity.objectId];
  }
  get decorSelectionCount(): number { return this.decorSelectionIds.length; }
  selectDecorIds(ids: readonly string[]): boolean {
    if (this.handingOff || !this.allowed || this.host._mode !== 'decor') return false;
    const members = decorSelectionMembers(this.host._decorList, ids);
    if (!members) return false;
    const ordered = members.map(item => item.id);
    const identity: PropertiesIdentity | null = members.length ? {
      spaceId: this.host._space, editor: 'decor', kind: members.length > 1 ? 'decor-group' : members[0].kind,
      objectId: members.length > 1 ? 'selection' : members[0].id,
      ...(members.length > 1 ? { objectIds: Object.freeze(ordered) } : {}),
    } : null;
    if (propertiesIdentityKey(identity) === propertiesIdentityKey(this.identity)) return !this.fields.draft;
    if (this.fields.draft) { void this.fields.finishThen(() => this.setSelection(identity)); return false; }
    this.setSelection(identity); return true;
  }
  retireSelection(): void { this.handoff = null; this.setSelection(null); }
  get selectedTextId(): string | null {
    const target = this.wide && this.identity ? this.target() : null;
    return target?.kind === 'decor' && target.value.kind === 'text' ? target.value.id : null;
  }
  private target(identity = this.selected): PropertiesTarget | null {
    const space = this.host._curSpaceCfg as PropertiesSpace | undefined;
    if (identity?.kind === 'decor-group' && space) {
      const items = space.decor ?? [];
      if (this.groupTarget?.identity !== identity || this.groupTarget.items !== items) this.groupTarget = {
        identity, items, target: resolvePropertiesTarget(identity, space, this.host._devices, this.host._markers),
      };
      return this.groupTarget.target;
    }
    return identity && space ? resolvePropertiesTarget(identity, space, this.host._devices, this.host._markers) : null;
  }
  t = (key: PropertiesString, vars?: Record<string, string | number>): string =>
    propertiesT(langOf(this.host.hass, this.host._config?.language), key, vars);

  /** One observer on the owning card, not its shrinking canvas; no threshold feedback. */
  observe(): void {
    const card = this.host.renderRoot.querySelector('ha-card');
    if (!card || card === this.observed) return;
    this.observer?.disconnect(); this.observed?.removeEventListener('pointerdown', this.pointerGuard, true);
    this.observed = card; card.addEventListener('pointerdown', this.pointerGuard, true);
    const update = () => {
      const width = card.getBoundingClientRect().width;
      const changed = (width >= 960) !== (this.width >= 960); this.width = width;
      if (changed && width < 960) {
        const hadFocus = (this.host.renderRoot as ShadowRoot).activeElement?.closest('.hp-properties');
        const draft = this.fields.draft;
        const picker = [...this.host.renderRoot.querySelectorAll<HTMLElement>('.hp-properties [data-property]')]
          .find(el=>el.dataset.property===draft?.field)?.querySelector<HpColorOpacity>('hp-color-opacity');
        const value = picker?.captureHexDraft();
        if (draft && value) this.suspendedColor = {draft,value};
        this.closeTransient();
        if (hadFocus) this.host.renderRoot.querySelector<HTMLElement>('[data-hp="editor-close"]')?.focus({preventScroll:true});
      }
      const top = this.host.renderRoot.querySelector('.head')?.getBoundingClientRect().height ?? 64;
      (card as HTMLElement).style.setProperty('--hp-properties-top', `${top}px`);
      if (changed) this.host.requestUpdate();
    };
    this.observer = new ResizeObserver(update); this.observer.observe(card);
    const head = this.host.renderRoot.querySelector('.head'); if (head) this.observer.observe(head);
    update();
  }
  dispose(): void {
    this.clearPlanHover();
    this.motionEpoch++; this.sectionMotion.dispose();
    this.observer?.disconnect(); this.observed?.removeEventListener('pointerdown', this.pointerGuard, true);
    this.observer = null; this.observed = null; this.dimensionCache = null;
    this.selected = null; this.variable = null; this.fields.invalidate(); this.groupText.clear();
    this.lane.retire(); this.laneAuthority = null; this.handoff = null;
  }
  private focus(field: string): void {
    if (!this.wide) return;
    void this.host.updateComplete.then(() => {
      const root = [...this.host.renderRoot.querySelectorAll<HTMLElement>('[data-property]')].find(el => el.dataset.property === field);
      (root?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?? root?.querySelector<HTMLElement>('input,textarea,select,button,hp-color-opacity'))?.focus({ preventScroll: true });
    });
  }
  private nativeSelection(identity: PropertiesIdentity | null): void {
    const host = this.host;
    host._physicalSel = identity?.kind === 'partition' || identity?.kind === 'column' ? { kind: identity.kind, id: identity.objectId } : null;
    host._decorSel = identity?.editor === 'decor' && identity.kind !== 'backdrop' && identity.kind !== 'decor-group' ? identity.objectId : null;
    host._selId = identity?.kind === 'device' ? identity.objectId : null;
    this.runtime.stairs.select(identity?.kind === 'stair' ? identity.objectId : null);
    if (host._ledEditor?.sel !== (identity?.kind === 'led' ? identity.objectId : null)) host._ledEditor?.select(identity?.kind === 'led' ? identity.objectId : null);
  }
  private setSelection(identity: PropertiesIdentity | null): void {
    if (propertiesIdentityKey(identity) === propertiesIdentityKey(this.selected)
      && (!identity || this.identity === this.selected)) return;
    this.runtime.keyboardNudge.retire();
    this.fields.invalidate(); this.selected = identity; this.groupTarget = null;
    this.selectionContext = identity?.editor === 'decor' ? { authority: this.host._configWriteContext.claim(), adoption: this.host._adoption.adoptionEpoch } : null;
    this.frozenReference = null; this.referenceAttempted = false;
    if (!identity && this.host._decorTool === 'backdrop') this.host._decorTool = 'select';
    this.ratioLocked = true;
    const target = this.target();
    this.ratio = target?.kind === 'decor' && target.value.kind === 'image' ? target.value.w / target.value.h : null;
    this.nativeSelection(identity); this.host.requestUpdate();
  }
  /** False consumes a dirty-field press. A delayed success selects, never replays a drag. */
  select(kind: string, objectId: string, binding?: string): boolean {
    if (this.handingOff) return false;
    if (!this.wide) return this.host._mode === 'decor' && kind !== 'backdrop' ? this.selectDecorIds([objectId]) : true;
    if (kind === 'opening') {
      const opening = (this.host._curSpaceCfg as PropertiesSpace).openings?.find(o => o.id === objectId);
      binding = JSON.stringify(opening?.host ? [opening.host.kind, opening.host.id] : null);
    }
    const identity: PropertiesIdentity = { spaceId: this.host._space, editor: this.host._mode as PropertiesIdentity['editor'], kind, objectId, ...(binding !== undefined ? { binding } : {}) };
    if (!this.target(identity)) return false;
    if (propertiesIdentityKey(identity) === propertiesIdentityKey(this.identity)) {
      if (this.fields.draft) { void this.fields.finish(); return false; }
      return true;
    }
    if (this.fields.draft) { void this.fields.finishThen(() => this.setSelection(identity)); return false; }
    this.setSelection(identity); return true;
  }
  selectDevice(device: DevItem): boolean { return this.select('device', device.id, bindingOf(device)); }
  private planHit(point: number[]): string | null {
    const space = this.host._spaceModel();
    const distance = (a: number[], b: number[]): number => {
      const dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
      const t = den ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / den)) : 0;
      return Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dy * t);
    };
    const hit = space?.wall_segments.map(wall => ({ wall, d: distance(wall.a, wall.b) }))
      .filter(({ wall, d }) => d <= wall.cm / this.host._cellCm * GRID_PITCH / 2 + this.runtime._cssPxToRender(6))
      .sort((a, b) => a.d - b.d || a.wall.id.localeCompare(b.wall.id))[0];
    return hit?.wall.id ?? null;
  }
  selectPlanPoint(point: number[]): void {
    const id = this.planHit(point);
    if (id) this.select('contour', id); else this.clear();
  }
  hoverPlan(event: { clientX: number; clientY: number }): void {
    this.planHover = { clientX: event.clientX, clientY: event.clientY };
    this.paintPlanHover();
  }
  clearPlanHover(): void {
    this.planHover = null;
    this.host.renderRoot.querySelector('.stage')?.removeAttribute('data-plan-select-hit');
  }
  private paintPlanHover(): void {
    const stage = this.host.renderRoot.querySelector<HTMLElement>('.stage');
    const hit = this.planHover && this.wide && this.host._mode === 'plan' && this.host._tool === 'select'
      && !this.host._editorSecondaryDialogBlocked && !!this.planHit(this.runtime._svgPoint(this.planHover as MouseEvent));
    stage?.toggleAttribute('data-plan-select-hit', !!hit);
  }
  backgroundClick(event: MouseEvent): void {
    if (!this.wide || this.host._suppressClick || this.host._mode !== 'devices') return;
    const path = event.composedPath() as Element[];
    if (path.some(node => node?.matches?.('.dev,[data-led-select],[data-led-handle],button,hp-dialog,.editor-secondary'))) return;
    this.clear();
  }
  /** Newly created native objects get the same selection owner as direct picking. */
  syncNative(): void {
    if ((!this.wide && this.host._mode !== 'decor') || this.fields.draft) return;
    const host = this.host;
    if (this.identity?.kind === 'decor-group' && !host._decorSel) return;
    // Decor creation retains the drawing tool and replaces its native ID even
    // while the previous Properties target remains valid. Other editors keep
    // their explicit target until their existing selection path replaces it.
    if (host._mode !== 'decor' && this.identity) return;
    if (host._mode === 'decor' && host._decorSel) {
      const shape = host._decorList.find(item => item.id === host._decorSel);
      if (shape) this.select(shape.kind, shape.id);
    } else if (host._mode === 'plan') {
      if (host._physicalSel) this.select(host._physicalSel.kind, host._physicalSel.id);
      else if (this.runtime.stairs.selected) this.select('stair', this.runtime.stairs.selected);
    } else if (host._mode === 'devices' && host._ledEditor?.sel) {
      const strip = (host._curSpaceCfg as PropertiesSpace).led_strips?.find(s => s.id === host._ledEditor!.sel);
      if (strip) this.select('led', strip.id, strip.marker ?? '');
    }
  }
  clear(): void { if (!this.handingOff) void this.fields.finishThen(() => this.setSelection(null)); }
  private closeTransient(): void {
    for (const picker of this.host.renderRoot.querySelectorAll<HpColorOpacity>('.hp-properties hp-color-opacity')) picker.closePicker();
  }
  get colorPickerOpen(): boolean {
    return [...this.host.renderRoot.querySelectorAll<HpColorOpacity>('.hp-properties hp-color-opacity')]
      .some(picker => picker.pickerOpen);
  }
  /** Modes/floors/actions and all preserved full dialogs use the same completion gate. */
  beforeIntent(action: () => void, modal = false, compactDecor = false): boolean {
    if (this.handingOff) return false;
    if (!this.wide && !compactDecor) { if (modal) this.fields.invalidate(); return true; }
    if (!this.fields.draft && !this.host._writesPending) return true;
    const authority = this.commandAuthority(), identity = this.identity, receipt = {};
    this.handoff = receipt;
    void this.fields.finishThen(async () => {
      await waitForPriorConfigWrite(this.host);
      if (this.handoff !== receipt || this.identity !== identity
        || !this.host._configWriteContext.current(authority, this.host.hass)) return;
      this.handoff = null;
      this.closeTransient();
      if (modal) this.fields.invalidate();
      action();
    }).catch(() => { if (this.handoff === receipt) this.host._showToast(this.t('save_error'), 'save_error'); })
      .finally(() => { if (this.handoff === receipt) this.handoff = null; });
    return false;
  }
  invoke(action: () => void): void { if (this.beforeIntent(action)) action(); }
  toolChanged(tool: string): void {
    if (!this.wide && this.host._mode !== 'decor') return;
    if (tool === 'backdrop') this.select('backdrop', this.host._space);
    else if (tool !== 'select') this.setSelection(null);
  }
  escape(event: KeyboardEvent): boolean {
    if ((!this.wide && !this.decorSelectionCount) || !this.identity || this.host._editorSecondaryDialogBlocked) return false;
    if (this.host._decorDraft || this.host._decorMove || this.host._dtDrag || this.runtime.backdropGesture.active) return false;
    if (event.key !== 'Escape') return false;
    event.preventDefault(); this.clear(); return true;
  }

  private dimensionContext() {
    const host = this.host, model = host._spaceModel();
    if (!model) return null;
    const key = `${host._space}|${host._cfgEpoch}`;
    if (this.dimensionCache?.key === key) return this.dimensionCache.value;
    const value = buildOpeningDimensionContext({ rooms: model.rooms, walls: host._spaceWalls,
      openCuts: host._openCuts(), partitions: model.partitions,
      roomOpenings: host._roomWallOpeningInputs(), partitionCuts: this.runtime._partitionOpeningCuts(model),
      pitch: host._wallKeyPitch, cellCm: host._cellCm, gridPitch: host._gridPitch, coordScale: NORM_W,
      epsilon: host._gridPitch * .0002 });
    this.dimensionCache = { key, value }; return value;
  }
  private reference(target: PropertiesTarget | null): OpeningDimension | null {
    if (target?.kind !== 'opening') return null;
    const space = this.host._curSpaceCfg as PropertiesSpace;
    const core = openingPropertiesCore(target.value, space.partitions ?? [], space.wall_segments ?? [], this.host._cellCm);
    const context = this.dimensionContext(); if (!core || !context) return null;
    if (!this.referenceAttempted) {
      this.referenceAttempted = true;
      this.frozenReference = selectOpeningReference(core, context);
      if (target.value.host?.kind !== 'partition' && this.frozenReference?.source === 'host-end') this.frozenReference = null;
    }
    return this.frozenReference ? refreshOpeningReference(core, context, this.frozenReference) : null;
  }
  private openingSides(target: PropertiesTarget | null): { labels: [string,string]; fallback: boolean; rooms?: string[] } {
    if (target?.kind !== 'opening') return { labels: [this.t('side_a'),this.t('side_b')], fallback: true };
    const host=this.host, space=host._curSpaceCfg as PropertiesSpace;
    const core=openingPropertiesCore(target.value,space.partitions??[],space.wall_segments??[],host._cellCm);
    const model=host._spaceModel();
    if (!core || !model) return { labels: [this.t('side_a'),this.t('side_b')], fallback: true };
    // The native door arc opens into negative local Y without flip_v, positive with it.
    let signs: [number,number] = [-1,1];
    const opening=host._openingsR.find(o=>o.id===target.value.id);
    if (target.value.type === 'gate' && opening) {
      const index=host._openingWallIndexFor(model,host._openCuts()).value;
      signs=[host._openingFace(opening,index,true).side,host._openingFace(opening,index,false).side];
    }
    const sides=propertiesOpeningSides(core,model.rooms,signs);
    return { labels: sides.map(side=>side.kind === 'room' ? this.t('into_room',{name:side.name})
      : side.kind === 'outside' ? this.t('outside') : this.t(side.side === 'A' ? 'side_a' : 'side_b')) as [string,string],
      fallback: sides.some(side=>side.kind==='fallback'),
      rooms: sides.some(side=>side.kind==='fallback') ? [] : [
        ...model.rooms.filter(room=>sides.some(side=>side.kind==='room' && side.name===room.name)).map(room=>room.name),
        ...(sides.some(side=>side.kind==='outside') ? [this.t('outside')] : [])] };
  }
  private model(identity = this.identity): PropertiesSurface {
    const target = this.target(identity), host = this.host;
    const openingSides = this.openingSides(target);
    return propertiesCatalog(target, {
      space: host._curSpaceCfg as PropertiesSpace, cellCm: host._cellCm, t: this.t,
      position: d => { const raw=host._livePos(d),p=host._deviceContacts?.position(d.id,raw)??raw; return { x: p.x / NORM_W, y: p.y / NORM_W }; },
      textBox: shape => host._dtBox?.id === shape.id ? { w: host._dtBox.w / NORM_W, h: host._dtBox.h / NORM_W } : { w: 0, h: 0 },
      fontCm: shape => host._decorTextSizeCm(shape), imageName: id => host._decorAssets.get(id)?.name ?? '',
      textName: shape => {
        if (shape.kind !== 'text') return '';
        const entity = /\{([a-z_]+\.[\w]+)(?::[^}]*)?\}/i.exec(shape.text)?.[1];
        return entity ? host.hass.states?.[entity]?.attributes?.friendly_name || this.t('text') : shape.text.split('\n')[0];
      },
      openingReference: this.reference(target), openingSides: openingSides.labels, openingRooms: openingSides.rooms, ratioLocked: this.ratioLocked,
      stairFallback: { color: host._decorStyle.color, opacity: host._decorStyle.opacity, fillColor: host._decorStyle.color, fillOpacity: 0 },
    });
  }
  private field(identity: PropertiesIdentity, key: string): PropertiesField | undefined {
    if (!this.target(identity)) return undefined;
    return this.model(identity).groups.flatMap(group => group.fields).find(field => field.key === key);
  }
  private parse(key: string, raw: string): PropertiesParse {
    const identity = this.identity, field = identity && this.field(identity, key);
    if (!field || field.mode) return { ok: false, error: { key: 'geometry_error' } };
    if (field.control === 'color') return parsePropertiesColor(raw);
    if (field.control === 'group-color') return parseGroupColor(raw, key === 'fill' ? 'fill' : 'stroke');
    if (field.control === 'text') return raw.trim() && raw.length <= 200
      ? { ok: true, value: raw.replace(/\r\n?/g, '\n') } : { ok: false, error: { key: 'text_limit' } };
    if (field.control === 'toggle' || key === 'flip_v' && field.control === 'choices') return raw === 'true' || raw === 'false'
      ? { ok: true, value: raw === 'true' } : { ok: false, error: { key: 'geometry_error' } };
    if (field.control === 'select' || field.control === 'choices') return field.options?.some(o => o.value === raw)
      ? { ok: true, value: raw } : { ok: false, error: { key: 'geometry_error' } };
    const imperial = field.unit === 'cm' && this.host._imperial;
    const result = parsePropertiesNumber(raw, { min: field.min === undefined ? undefined : field.min / (imperial ? 2.54 : 1),
      max: field.max === undefined ? undefined : field.max / (imperial ? 2.54 : 1), unit: field.unit === 'cm' ? this.t(imperial ? 'inch' : 'cm') : field.unit,
      convert: input => imperial ? input * 2.54 : input });
    if (!result.ok) return result;
    const value = result.value as number;
    if (key === 'angle') {
      const target = this.target();
      if (target?.kind === 'column') return { ok: true, value: ((value % 90) + 90) % 90 };
      if (target?.kind !== 'device') return { ok: true, value: canonicalPropertiesAngle(value) };
    }
    // The descriptor uses percentages; the storage pair uses fractions.
    return key === 'size' || key === 'opacity' ? { ok: true, value: value / 100 } : result;
  }
  private edit(field: PropertiesField, raw: string, finish = false): void {
    if (!this.wide || this.variable || this.host._editorSecondaryDialogBlocked || field.mode) return;
    if (field.key === 'ratio') {
      if (!this.fields.draft) {
        this.ratioLocked = raw === 'true'; const target = this.target();
        this.ratio = target?.kind === 'decor' && target.value.kind === 'image' && this.ratioLocked ? target.value.w / target.value.h : null;
        this.host.requestUpdate();
      }
      return;
    }
    if (this.fields.edit(field.key, raw)) {
      const draft = this.fields.draft;
      if ((field.control === 'color' || field.control === 'group-color') && draft && draft.error?.key !== 'external_change') {
        const result = this.parse(field.key, raw); draft.error = result.ok ? null : result.error;
      }
      if (finish) void this.fields.finish();
    }
  }

  /** A field preview paints only its owned object; it never mutates configuration. */
  previewDecorStyle(shape: DecorShape | null | undefined, style: DecorStyle): DecorStyle {
    const current = this.fields.draft, identity = this.identity, decor = this.host._decorList;
    let cache = this.decorPreview;
    if (!cache || cache.draft !== current || cache.raw !== (current?.raw ?? '') || cache.identity !== identity
      || cache.decor !== decor || cache.error !== current?.error?.key || cache.pending !== !!current?.pending) {
      const value = this.fields.previewDraft;
      const parsed = value?.identity.kind === 'decor-group'
        ? parseGroupColor(value.raw, value.field === 'fill' ? 'fill' : 'stroke') : null;
      this.decorPreview = cache = { draft: current, raw: current?.raw ?? '', identity, decor,
        error: current?.error?.key, pending: !!current?.pending, value,
        patch: parsed?.ok ? parsed.value as DecorGroupStylePatch : null,
        ids: new Set(value?.identity.objectIds ?? []) };
    }
    const draft = cache.value;
    if (shape && draft?.identity.kind === 'decor-group' && cache.ids.has(shape.id)) {
      const patch = cache.patch;
      if (!patch) return style;
      return patch.channel === 'fill' ? { ...style,
        ...(patch.color === undefined ? {} : { fillColor: patch.color }), ...(patch.opacity === undefined ? {} : { fillOpacity: patch.opacity }) }
        : { ...style, ...(patch.color === undefined ? {} : { color: patch.color }), ...(patch.opacity === undefined ? {} : { opacity: patch.opacity }) };
    }
    if (!shape || draft?.identity.editor !== 'decor' || draft.identity.objectId !== shape.id) return style;
    const color = propertiesColorDraft(draft.raw);
    if (!color?.inline) return style;
    return draft.field === 'stroke' ? { ...style, color: color.value.color, opacity: color.value.opacity }
      : draft.field === 'fill' ? { ...style, fillColor: color.value.color, fillOpacity: color.value.opacity,
        fill: color.value.noFill !== true } : style;
  }

  private async commit(identity: PropertiesIdentity, field: string, value: unknown, _before: unknown, current: () => boolean): Promise<PropertiesCommit> {
    const host = this.host;
    if (host._saveConfigDebounced.pending()) host._saveConfigDebounced.flush();
    try { await waitForPriorConfigWrite(host); } catch { return failure('save_error'); }
    if (!current() || !this.allowed) return failure('external_change');
    const target = this.target(identity);
    if (!target || this.field(identity, field)?.mode) return failure('external_change');
    if (target.kind === 'device') return this.commitDevice(identity, target.value, target.marker, field, value, current);
    const previous: ServerConfig = structuredClone(host._serverCfg!);
    const previousStyle = { ...host._decorStyle };
    const snapshot = this.runtime._geometrySnapshot(identity.spaceId);
    const space = host._curSpaceCfg as PropertiesSpace;
    const physical = ['partition', 'contour', 'column', 'opening'].includes(target.kind);
    let candidate: ServerConfig, name: string;
    // No asynchronous work here: a rejected preparer must not leave its local
    // candidate (or a newly picked default style) visible without a writer.
    try {
    if (target.kind === 'contour') {
      if (field !== 'cm' || typeof value !== 'number' || value < 0 || value > 100
        || value === 0 && space.openings?.some(o => o.host?.kind === 'wall' && o.host.id === target.value.id)) return failure('geometry_error');
      const a = target.value.a.map(n => n * NORM_W), b = target.value.b.map(n => n * NORM_W);
      const walls = setWallThickness(host._curSpaceCfg.walls, a, b, value || null, host._wallKeyPitch, NORM_W);
      // Remove only the selected restored zero carrier from normalization cuts.
      const openCuts = host._openCuts().filter(cut => !value || !([a,b].every(p => {
        const dx = cut[2] - cut[0], dy = cut[3] - cut[1], length = Math.hypot(dx,dy);
        return length > 0 && Math.abs((p[0]-cut[0])*dy-(p[1]-cut[1])*dx)/length < GRID_PITCH*.02;
      })));
      const normalized = host._normalizeWalls(walls, openCuts);
      if (normalized.length) host._curSpaceCfg.walls = normalized; else delete host._curSpaceCfg.walls;
      for (const segment of space.wall_segments ?? []) segment.cm = thicknessCmAt(normalized, segment.a, segment.b, GRID_STEP_N, 1);
    } else if (!patchPropertiesTarget(space, target, field, value, { cellCm: host._cellCm,
      ratio: this.ratioLocked ? this.ratio : null, openingReference: this.reference(target) })) return failure('geometry_error');
    if (contentFingerprint(previous) === contentFingerprint(host._serverCfg)) return ok;
    name = this.t(target.kind === 'decor-group' ? 'group_style_history' : 'history', { name: this.model(identity).title });
    const authored = target.kind === 'partition' && /^[ab][01]$/.test(field)
      ? [(space.partitions?.find(w => w.id === target.value.id) ?? target.value)[field[0] as 'a' | 'b']] : [];
    if (physical && !this.runtime._commitPhysicalGeometry(name, snapshot, authored, false)) return failure('geometry_error');
    if (target.kind === 'decor' && target.value.kind !== 'image' && ['stroke', 'fill', 'width_cm'].includes(field)) {
      const changed = this.target(identity);
      if (changed?.kind === 'decor') this.runtime._updateDecorStyle(decorStyleOf(changed.value, host._cellCm, GRID_PITCH, host._decorStyle), true);
    }
    candidate = this.runtime._prepareConfigCandidate(host._serverCfg!);
    } catch {
      host._adoption.stageLocalConfig(previous); host._decorStyle = previousStyle;
      host._cfgEpoch++; host.requestUpdate(); return failure('geometry_error');
    }
    const attempt = this.runtime._stageOptimisticConfig(previous, candidate);
    const restoreDeferred = supersedeDeferredWrite(host._saveConfigDebounced);
    const authority = host._configWriteContext.claim();
    try {
      await this.runtime._saveConfigNow(attempt, () => this.allowed && !!this.target(identity)
        && host._configWriteContext.current(authority, host.hass) && contentFingerprint(host._serverCfg) === attempt.attemptedFingerprint);
      if (!host._configWriteContext.current(authority, host.hass) || !this.allowed || !this.target(identity)) return failure('external_change');
      this.runtime._recordGeometry(name, snapshot);
      host._cfgEpoch++; host.requestUpdate(); return ok;
    } catch (error) {
      if (host._configWriteContext.current(authority, host.hass)) {
        const rolledBack = host._rollbackOptimistic(attempt);
        if (rolledBack) host._decorStyle = previousStyle;
        restoreDeferred(rolledBack);
      }
      host.requestUpdate(); return failure((error as {code?:string})?.code === 'conflict' ? 'external_change' : 'save_error');
    }
  }

  private async commitDevice(identity: PropertiesIdentity, device: DevItem, marker: Marker | undefined, field: string, value: unknown,
    current: () => boolean): Promise<PropertiesCommit> {
    const host = this.host;
    if (!current() || device.bindingStatus?.kind === 'ha_disabled' || typeof value !== 'number') return failure('external_change');
    const authority = host._configWriteContext.claim();
    const owned = () => this.allowed && host._configWriteContext.current(authority, host.hass) && !!this.target(identity);
    const name = this.t('history', { name: device.name });
    if (field === 'x' || field === 'y') {
      const before = devicePlacement(host._layout, device.id), raw = host._livePos(device);
      const position=host._deviceContacts?.position(device.id,raw)??raw;
      const after = { x: position.x / NORM_W, y: position.y / NORM_W, s: device.space,
        [field]: value / (host._cellCm * 240) };
      host._devicePositionBusy = true;
      try {
        await host._persistDevicePlacement(device.id, after);
        if (!owned()) return failure('external_change');
        host._devicePositionHistory.push({ name, before: { deviceId: device.id, spaceId: device.space, placement: before },
          after: { deviceId: device.id, spaceId: device.space, placement: after } }); return ok;
      } catch { if (owned()) host._previewDevicePlacement(device.id, before); return failure('save_error'); }
      finally { if (host._configWriteContext.owns(authority)) { host._devicePositionBusy = false; host.requestUpdate(); } }
    }
    if (field !== 'size' && field !== 'angle') return failure('geometry_error');
    const previous: ServerConfig = structuredClone(host._serverCfg!);
    const candidate: ServerConfig = structuredClone(previous);
    const source = candidate.markers.find(m => m.id === device.id) ?? { id: device.id, binding: bindingOf(device) };
    const changed = { ...source, [field]: value };
    candidate.markers = candidate.markers.some(m => m.id === device.id)
      ? candidate.markers.map(m => m.id === device.id ? changed : m) : [...candidate.markers, changed];
    const state = (m: Marker): DeviceVisualState => ({ kind: 'visual', deviceId: device.id, spaceId: device.space,
      binding: bindingOf(device), fields: deviceVisualFields(m, [field]) });
    const before = state(marker ?? source), after = state(changed);
    const attempt = this.runtime._stageOptimisticConfig(previous, this.runtime._prepareConfigCandidate(candidate));
    const restoreDeferred = supersedeDeferredWrite(host._saveConfigDebounced);
    try {
      await this.runtime._saveConfigNow(attempt, () => owned() && contentFingerprint(host._serverCfg) === attempt.attemptedFingerprint);
      if (!owned()) return failure('external_change');
      host._devicePositionHistory.push({ name, before, after }); return ok;
    } catch (error) { if (owned()) restoreDeferred(host._rollbackOptimistic(attempt));
      return failure((error as {code?:string})?.code === 'conflict' ? 'external_change' : 'save_error'); }
  }

  /** The history cursor is restored on a conflict; unrelated marker keys are not history state. */
  async restoreVisual(direction: 'undo' | 'redo', command: NamedCommand<DeviceEditorHistoryState>,
    position: CommandPosition<DeviceEditorHistoryState> | null): Promise<void> {
    if (!('kind' in command.before) || !('kind' in command.after) || command.before.kind !== 'visual' || command.after.kind !== 'visual') return;
    const host = this.host, target = direction === 'undo' ? command.before : command.after;
    const from = direction === 'undo' ? command.after : command.before;
    const restoreCursor = () => { if (position) host._devicePositionHistory.restorePosition(command, position); };
    const device = host._devices.find(d => d.id === target.deviceId && d.space === target.spaceId);
    const marker = host._markers.find(m => m.id === target.deviceId && !m.removed);
    const expected = marker && deviceVisualFields(marker, from.fields.map(field => field.key));
    if (!device || !marker || bindingOf(device) !== target.binding || marker.binding !== target.binding
      || device.bindingStatus?.kind === 'ha_disabled' || !samePropertiesValue(expected, from.fields)) {
      restoreCursor(); host._showToast(this.t('external_change'), 'external_change'); return;
    }
    const authority = host._configWriteContext.claim(), previous = host._serverCfg!;
    const candidate: ServerConfig = structuredClone(previous);
    candidate.markers = candidate.markers.map(m => m.id === target.deviceId ? applyDeviceVisualFields(m, target.fields) : m);
    const attempt = this.runtime._stageOptimisticConfig(previous, this.runtime._prepareConfigCandidate(candidate));
    const restoreDeferred = supersedeDeferredWrite(host._saveConfigDebounced);
    host._devicePositionBusy = true;
    try {
      await this.runtime._saveConfigNow(attempt, () => this.allowed && host._configWriteContext.current(authority, host.hass)
        && host._devices.some(d=>d.id===target.deviceId && d.space===target.spaceId && bindingOf(d)===target.binding)
        && contentFingerprint(host._serverCfg) === attempt.attemptedFingerprint);
      if (!host._configWriteContext.current(authority, host.hass)) return;
      if (host._space !== target.spaceId) { host._commitSpace(target.spaceId); host._restoreZoom(); }
      host._showToast(host._t(direction === 'undo' ? 'history.undone' : 'history.redone', { name: command.name }), direction === 'undo' ? 'history.undone' : 'history.redone');
    } catch {
      if (host._configWriteContext.current(authority, host.hass)) {
        restoreDeferred(host._rollbackOptimistic(attempt)); restoreCursor(); host._showToast(this.t('save_error'), 'save_error');
      }
    } finally { if (host._configWriteContext.owns(authority)) { host._devicePositionBusy = false; host.requestUpdate(); } }
  }

  render(): TemplateResult | typeof nothing {
    this.observe();
    const motionEpoch = ++this.motionEpoch;
    void this.host.updateComplete.then(() => {
      this.paintPlanHover();
      if (motionEpoch === this.motionEpoch) this.sectionMotion.update(this.wide
        ? this.host.renderRoot.querySelector<HTMLElement>('.hp-properties') : null);
    });
    const owner = this.identity;
    if (this.selected && !owner) this.setSelection(null);
    this.fields.sync();
    if (!this.wide) return nothing;
    ensureFormKitStyles(this.host);
    const model = this.model(owner);
    const authority = this.host._configWriteContext.claim();
    const current = () => this.wide && !this.variable && !this.host._editorSecondaryDialogBlocked
      && this.host._configWriteContext.current(authority, this.host.hass)
      && propertiesIdentityKey(this.identity) === propertiesIdentityKey(owner);
    const view = renderPropertiesSurface(model, {
      t: this.t, imperial: this.host._imperial, dark: this.host.hass?.themes?.darkMode,
      inlineColors: this.target(owner)?.kind === 'decor' || this.target(owner)?.kind === 'decor-group',
      decorShortcuts: this.host._mode === 'decor', controller: this.fields, pickerLabels: this.host._colorPickerLabels,
      action: key => { if (current()) void this.fields.finishThen(() => this.action(key)); },
      edit: (field, raw, finish) => { if (current()) this.edit(field, raw, finish); },
      number: (field, value) => field.unit === 'cm' ? cmToField(value, this.host._imperial) : String(Number(value.toFixed(4))),
      textSelection: input => { this.textCaret = { start: input.selectionStart, end: input.selectionEnd }; },
      insertVariable: () => { if (current()) this.openVariable(); },
      enterField: key => {
        if (!current() || !this.fields.draft || this.fields.draft.field === key) return;
        const previous = this.fields.draft.field;
        this.focus(previous);
        void this.fields.finishThen(() => this.focus(key));
      },
      mayFinish: current,
      attachColor: (key,picker) => {
        const suspended=this.suspendedColor;
        if (suspended?.draft===this.fields.draft && suspended.draft.field===key) {
          picker.resumeHexDraft(suspended.value); this.suspendedColor=null;
        } else if (suspended?.draft!==this.fields.draft) this.suspendedColor=null;
      },
    }, this.host._editorSecondaryDialogBlocked || !!this.variable || this.host._devicePositionBusy);
    return html`${view}${dialogPresence(this.renderVariable())}`;
  }
  selection(): TemplateResult | typeof nothing {
    if ((!this.wide && this.decorSelectionCount < 2) || !this.identity) return nothing;
    let target = this.target();
    const drag = this.runtime.physicalGesture.drag;
    if (target?.kind === 'partition' && drag?.kind === 'partition' && drag.id === target.value.id && drag.moved) {
      const { value } = target;
      target = { ...target, value: { ...value, a: value.a.map((n,i)=>n+drag.delta[i]/NORM_W), b: value.b.map((n,i)=>n+drag.delta[i]/NORM_W) } };
    }
    if (target?.kind === 'column' && drag?.kind === 'column' && drag.id === target.value.id && drag.moved)
      target = { ...target, value: { ...target.value, center: target.value.center.map((n,i)=>n+drag.delta[i]/NORM_W) } };
    const reference = this.reference(target);
    return renderPropertiesSelection(target, { unitPerPx: this.runtime._cssPxToRender(1), cellCm: this.host._cellCm,
      textBox: this.host._dtBox?.id === this.selectedTextId ? this.host._dtBox : null, reference,
      decorGroup: { text: shape => this.groupText.get(shape) },
    });
  }
  /** Called by the existing measureHouseplanDecorText hook after the ordinary decor DOM settles. */
  measureGroupText(root: ParentNode): void {
    const target = this.identity && this.target();
    if (this.groupText.measure(target?.kind === 'decor-group' ? target.value : [], root)) this.host.requestUpdate();
  }
  private async action(key: string): Promise<void> {
    const target = this.target(); if (!target) return;
    if (target.kind === 'decor' && (key === 'decor-front' || key === 'decor-back')) {
      this.runtime.decorOrder.command(target.value.id, key === 'decor-front' ? 'front' : 'back'); return;
    }
    if (key === 'settings') {
      const device = target.kind === 'device' ? target.value : target.kind === 'led' ? target.device : undefined;
      if (device) this.runtime._openMarkerDialog(device); return;
    }
    if (key === 'reset' && target.kind === 'backdrop') { this.runtime.backdropGesture.resetTransform(); return; }
    if (key === 'display_device' && target.kind === 'led' && target.device) {
      await this.host._ledEditor?.setActive(target.value.id, false);
      const device = this.host._devices.find(d => d.id === target.device!.id); if (device) this.selectDevice(device); return;
    }
    if (key === 'copy' && (target.kind === 'device' || target.kind === 'led')) {
      const device = target.kind === 'device' ? target.value : target.device;
      if (device) await this.runtime.deviceCopy.copyDevice(device); return;
    }
    if (key === 'replace' && target.kind === 'decor' && target.value.kind === 'image') {
      this.runtime._openDecorProperties(target.value); await this.host.updateComplete;
      this.host.renderRoot.querySelector<HTMLInputElement>('.imageupload input')?.click(); return;
    }
    if (key !== 'delete') return;
    if (target.kind === 'device') {
      const { deletePlanDevice } = await import('../../marker-deletion');
      await deletePlanDevice(this.runtime, target.value.id, bindingOf(target.value));
    } else if (target.kind === 'partition' || target.kind === 'column') await this.runtime._deletePhysicalSelection();
    else if (target.kind === 'decor') this.runtime._deleteDecor(target.value.id);
    else if (target.kind === 'stair') this.runtime.stairs.deleteSelected();
    else if (target.kind === 'opening') {
      const opening = this.host._openingsR.find(o => o.id === target.value.id);
      if (opening) { this.runtime._editOpening(opening); this.runtime._deleteOpening(); }
    }
  }
  private openVariable(): void {
    const target = this.target(), identity = this.identity;
    if (!this.wide || !identity || target?.kind !== 'decor' || target.value.kind !== 'text' || this.variable) return;
    const input = this.host.renderRoot.querySelector<HTMLTextAreaElement>('.hp-prop-text');
    if (input) this.textCaret = { start: input.selectionStart, end: input.selectionEnd };
    const original = this.fields.draft?.field === 'text' ? this.fields.draft.raw : target.value.text;
    if (!this.fields.draft && !this.fields.edit('text', original)) return;
    if (this.fields.draft?.field !== 'text' || this.fields.draft.pending) return;
    this.variable = { identity: propertiesIdentityKey(identity), authority: this.host._configWriteContext.claim(), original,
      start: Math.min(this.textCaret.start, original.length), end: Math.min(this.textCaret.end, original.length),
      entity: '', attribute: '', filter: '', open: false };
    this.host.requestUpdate();
  }
  private closeVariable(caret = this.variable?.start ?? 0, end = this.variable?.end ?? caret): void {
    this.variable = null; this.host.requestUpdate();
    void this.host.updateComplete.then(() => {
      const input = this.host.renderRoot.querySelector<HTMLTextAreaElement>('.hp-prop-text');
      if (input && this.wide) { input.focus({ preventScroll: true }); input.setSelectionRange(caret, end); }
    });
  }
  private renderVariable(): TemplateResult | typeof nothing {
    const dialog = this.variable;
    if (!dialog) return nothing;
    if (!this.allowed || propertiesIdentityKey(this.identity) !== dialog.identity
      || !this.host._configWriteContext.current(dialog.authority, this.host.hass)) { this.variable = null; return nothing; }
    const states = this.host.hass?.states ?? {};
    const current = states[dialog.entity];
    const token = liveTextToken(dialog.entity, dialog.attribute || null);
    const text = dialog.original.slice(0, dialog.start) + token + dialog.original.slice(dialog.end);
    const valid = !!token && !!current && text.trim().length > 0 && text.length <= 200;
    const candidates = Object.entries(states).map(([value, state]) => {
      const attributes = (state as { attributes?: { friendly_name?: string } }).attributes;
      return { value, label: attributes?.friendly_name || value, sub: value };
    }).filter(row => `${row.label} ${row.value}`.toLocaleLowerCase().includes(dialog.filter.toLocaleLowerCase())).slice(0, 100);
    const attributes = Object.keys(current?.attributes ?? {}).filter(key => {
      const value = current.attributes[key]; return value !== null && typeof value !== 'object' || Array.isArray(value);
    }).sort();
    const preview = liveText(text, null, this.host._renderPlanHass, id => this.host._planEntityAvailable(id));
    const error = this.fields.draft?.error;
    return html`<hp-dialog class="hp-properties-variable" data-kind="properties-variable" properties-shell wide
      .hass=${this.host.hass} .title=${this.t('insert_variable')} @hp-close=${() => this.closeVariable()}>
      <div class="hp-prop-variable-body hpf-form">
        <div class="hp-prop-variable-label">${this.t('entity')}</div>
        ${sourcePicker({ fieldId: 'properties-variable-entity', open: dialog.open, current: current ? { label: current.attributes?.friendly_name || dialog.entity, sub: dialog.entity } : null,
          leading: propertiesIcon(current?.attributes?.device_class === 'temperature' || dialog.entity.includes('temperature') ? 'temperature' : 'settings'),
          placeholder: this.t('entity'), ariaLabel: this.t('entity'), filter: dialog.filter, filterPlaceholder: this.t('variable_search'),
          candidates, selected: dialog.entity, emptyText: this.t('none'),
          onToggle: () => { dialog.open = !dialog.open; this.host.requestUpdate(); },
          onFilter: value => { dialog.filter = value; this.host.requestUpdate(); },
          onPick: value => { dialog.entity = value; dialog.attribute = ''; dialog.open = false; this.host.requestUpdate(); },
        })}
        <label class="hp-prop-variable-label" for="hp-prop-variable-value">${this.t('value')}</label>
        <hp-settings-select><select data-hp="field" data-field="hp-prop-variable-value" id="hp-prop-variable-value" class="hpf-select" .value=${dialog.attribute}
          @change=${(e: Event) => { dialog.attribute = (e.target as HTMLSelectElement).value; this.host.requestUpdate(); }}>
          <option value="" ?selected=${!dialog.attribute}>${this.t('state')}</option>${attributes.map(key => html`<option value=${key} ?selected=${dialog.attribute===key}>${key}</option>`)}
        </select></hp-settings-select>
        <div class="hp-prop-preview"><div>${this.t('preview')}</div><strong>${preview}</strong></div>
        ${text.length > 200 ? html`<p role="alert" class="hp-prop-error">${this.t('text_limit')}</p>` : nothing}
        ${error ? html`<p role="alert" class="hp-prop-error">${this.t(error.key as PropertiesString, error.values)}</p>` : nothing}
      </div>
      <div class="hp-prop-variable-footer" slot="footer"><button data-hp="dialog-cancel" type="button" @click=${() => this.closeVariable()}>${this.t('cancel')}</button>
        <button data-hp="dialog-confirm" type="button" class="insert" ?disabled=${!valid || !!this.fields.draft?.pending || !!error}
          @click=${async () => {
            if (this.variable !== dialog || !valid) return;
            this.fields.edit('text', text);
            if (await this.fields.finish() && this.variable === dialog) this.closeVariable(dialog.start + token.length, dialog.start + token.length);
          }}>${propertiesIcon('plus')}${this.t('insert')}</button></div>
    </hp-dialog>`;
  }
}
