import { html, nothing, type TemplateResult } from 'lit';
import { langOf, type I18nKey } from './i18n';
import type {
  ServerConfig, SummaryPanelConfig, SummaryPanelSource, SummaryPanelSystemKey,
  SummaryPanelValue,
} from './types';
import {
  SUMMARY_PANEL_LEGACY_SCALE_KEY,
  type SummaryDraftProblem, type SummaryPanelLocalPreferences,
  cloneSummaryPanel, confirmedSummaryPanelWriteRecovery, defaultSummaryPanel, effectiveSummaryVisible,
  moveSummaryItem, normalizeSummaryDraft, parseSummaryLocal,
  normalizeSummaryScale, resolveSummaryLayout, sameSummaryPanel,
  summaryLocalKey, summaryPanelEntityIds, summaryPanelOf, validateSummaryDraft, visibleSummaryBlocks,
} from './summary-panel';
import { SUMMARY_PANEL_API_VERSION } from './summary-panel-api';
import { contentFingerprint } from './visual-continuity';
import { enqueueSerializedWrite } from './serialized-write-queue';
import { canonicalizeConfigGeometry } from './coordinate-canonicalization';
import type { SummaryPanelEditorRenderer } from './summary-panel-editor';
import { summaryPanelCss } from './summary-panel-style';
import { summaryPanelText } from './summary-panel-i18n';
import type { SummaryPanelHost } from './summary-panel-host';
import { stableSummaryPlacementSlot } from './summary-panel-identity';
import {
  refreshSummaryEntityIndex, type SummaryEntityIndex,
} from './summary-panel-picker';

const isSummarySystemKey = (value: string): value is SummaryPanelSystemKey =>
  value === 'device_count' || value === 'total_area' || value === 'datetime';

export type SummaryPanelDialogState = {
  draft: SummaryPanelConfig;
  base: SummaryPanelConfig;
  baseRevision: number;
  localShow: boolean;
  baseLocalShow: boolean;
  localOnly: boolean;
  localOnlyHint: 'summary.local_only' | 'summary.backend_required' | 'summary.unsupported_schema';
  busy: boolean;
  attempted: boolean;
  entityFilter: string;
  activeSource: { blockId: string; valueId: string } | null;
  error: string;
  conflict: boolean;
};

type SummaryLayoutState = {
  width: number;
  height: number;
  minimumHeight: number;
  controlTop: number;
};

/**
 * Eager, small View runtime for #437. The much larger settings form is loaded
 * only after an explicit press on the gear, keeping the ordinary plan path
 * out of the editor chunk.
 *
 * The host is deliberately structural. HousePlanCard owns integration state;
 * this controller owns only summary-panel local/UI state and asks the host to
 * repaint after mutations.
 */
export class LoadedSummaryPanelRuntime {
  private readonly host: SummaryPanelHost;
  private dialog: SummaryPanelDialogState | null = null;
  private local: SummaryPanelLocalPreferences = {
    version: 1, show: false, icon_scale: 1, font_scale: 1,
  };
  private storageKey: string | null = null;
  private stage: SummaryLayoutState = {
    width: 0, height: 0, minimumHeight: 162, controlTop: 0,
  };
  private clock = new Date();
  private clockTimer = 0;
  private deviceMemo: {
    cfgEpoch: number; layoutRev: number; registryRev: number; value: number | null;
  } | null = null;
  private areaMemo: { cfgEpoch: number; value: number | null } | null = null;
  private storageUnavailable = false;
  private clockContext = '';
  private editorRenderer: SummaryPanelEditorRenderer | null = null;
  private editorLoad: Promise<SummaryPanelEditorRenderer> | null = null;
  private metricsModule: typeof import('./summary-panel-metrics') | null = null;
  private metricsLoad: Promise<typeof import('./summary-panel-metrics')> | null = null;
  private styleSheet: CSSStyleSheet | null = null;
  private entityIndex: SummaryEntityIndex | null = null;
  private lifecycleGeneration = 0;
  private lifecycleIdentity = '';
  private connected = false;

  public constructor(host: unknown) { this.host = host as SummaryPanelHost; }

  public get dialogOpen(): boolean { return !!this.dialog; }

  /** Entity rows that can affect any supported saved summary-panel frame. */
  public entityIds(): readonly string[] { return summaryPanelEntityIds(this.config().config); }

  public connect(): void {
    this.ensureStyle();
    this.connected = true;
    this.syncLifecycle();
    this.loadLocal();
  }

  public disconnect(): void {
    this.connected = false;
    this.resetLifecycle();
  }

  /** A real HA route departure is stronger than a responsive remount. */
  public leaveRoute(): void { this.resetLifecycle(); }

  /** Re-apply the per-card authority instead of the legacy kiosk seed. */
  public applyLocalScaleForCurrentIdentity(): boolean {
    const key = this.preferenceKey();
    if (!key) return false;
    if (key !== this.storageKey) this.loadLocal();
    if (key !== this.storageKey) return false;
    this.host._kioskScale = { icon: this.local.icon_scale, font: this.local.font_scale };
    return true;
  }

  public visibility(kind: 'hidden' | 'visible' | 'pageshow'): void {
    if (kind === 'hidden') {
      if (this.clockTimer) clearTimeout(this.clockTimer);
      this.clockTimer = 0;
      return;
    }
    this.clock = new Date();
    this.syncClock();
    this.host.requestUpdate();
  }

  public updated(): void {
    this.syncLifecycle();
    this.syncNativeNarrow();
    this.loadLocal();
    this.measureLayout();
    this.syncClock();
  }

  /** Reset an identity-changing draft before the host renders the new context. */
  public willUpdate(): void { this.syncLifecycle(); }

  /** Wake a filtered HA render only when an open picker composition changed. */
  public observeHassComposition(): boolean {
    this.syncLifecycle();
    if (!this.dialog || this.dialog.localOnly) return false;
    const previous = this.entityIndex;
    this.refreshEntityIndex();
    return this.entityIndex !== previous;
  }

  public resized(): void { this.measureLayout(); }

  public closeDialogIfIdle(): boolean {
    if (!this.dialog || this.dialog.busy) return false;
    this.dialog = null;
    this.host.requestUpdate();
    return true;
  }

  public blocksOtherDialogs(): boolean { return !!this.dialog; }

  public saveScale(patch: Partial<{ icon: number; font: number }>): void {
    this.saveLocal({
      icon_scale: patch.icon ?? this.local.icon_scale,
      font_scale: patch.font ?? this.local.font_scale,
    });
  }

  public renderMeasure(): TemplateResult | typeof nothing {
    const title = this.config().config?.title;
    if (!title || this.host._mode !== 'view') return nothing;
    return html`<div class="summary-measure" aria-hidden="true" inert>
      <h2>${title}</h2><section><h3>${this.t('summary.measure_block')}</h3>
      <div class="summary-value"><span>${this.t('summary.measure_label')}</span>
        <strong>${this.t('summary.unavailable')}</strong></div></section>
    </div><div class="summary-safe-probe" aria-hidden="true" inert></div>`;
  }

  public renderPanel(): TemplateResult | typeof nothing {
    const resolved = this.config();
    const config = resolved.config;
    if (!config) return nothing;
    const layout = this.layout();
    const visible = effectiveSummaryVisible({
      view: this.host._mode === 'view', localShow: this.local.show,
      showOnMobile: config.show_on_mobile, narrow: this.host.narrow, fits: layout.fits,
    });
    if (!visible) return nothing;
    this.ensureMetrics();
    const blocks = visibleSummaryBlocks(config, this.host._space);
    const stop = (event: Event) => event.stopPropagation();
    return html`<aside class="summary-overlay ${layout.side}" aria-label=${config.title}
        style="--summary-height-cap:${Math.floor(layout.heightCap)}px;--summary-width-cap:${Math.floor(layout.availableWidth)}px;--summary-top:${layout.top}px;--summary-bottom:${layout.bottom}px"
        @click=${stop} @dblclick=${stop} @pointerdown=${stop} @pointerup=${stop}
        @pointermove=${stop} @wheel=${stop}>
      <h2>${config.title}</h2>
      <div class="summary-scroll">
        ${blocks.length ? blocks.map((block) => html`<section class="summary-block">
          <h3>${block.title}</h3>
          ${block.values.length ? block.values.map((value) => html`<div class="summary-value">
            <span>${value.label}</span><strong>${this.value(value)}</strong>
          </div>`) : html`<div class="summary-empty">${this.t('summary.empty_block')}</div>`}
        </section>`) : html`<div class="summary-empty">${this.t('summary.empty_space')}</div>`}
      </div>
    </aside>`;
  }

  public renderControls(kiosk = false): TemplateResult | typeof nothing {
    if (this.host._mode !== 'view') return nothing;
    const resolved = this.config();
    const layout = this.layout();
    const temporaryReason = this.local.show && (
      resolved.unsupported ? this.t('summary.unsupported_schema')
        : !resolved.config?.show_on_mobile && this.host.narrow === true
        ? this.t('summary.hidden_mobile')
        : !resolved.config?.show_on_mobile && this.host.narrow === null
          ? this.t('summary.hidden_narrow_unknown')
          : !layout.fits ? this.t('summary.hidden_small') : ''
    );
    const toggleTitle = temporaryReason || this.t(this.local.show ? 'summary.hide' : 'summary.show');
    const stop = (event: Event) => event.stopPropagation();
    return html`<div class="summary-control ${kiosk ? 'kiosk' : ''}" role="group"
        aria-label=${this.t('summary.controls')} @click=${stop} @dblclick=${stop}
        @pointerdown=${stop} @pointerup=${stop} @pointermove=${stop} @wheel=${stop}>
      <button type="button" @click=${() => void this.openDialog()}
        title=${this.t('summary.settings')} aria-label=${this.t('summary.settings')}>
        <ha-icon icon="mdi:cog-outline"></ha-icon>
      </button>
      <button type="button" class=${this.local.show ? 'on' : ''}
        aria-pressed=${this.local.show ? 'true' : 'false'}
        title=${toggleTitle} aria-label=${toggleTitle}
        @click=${() => this.saveLocal({ show: !this.local.show })}>
        <ha-icon icon="mdi:view-dashboard-outline"></ha-icon>
      </button>
    </div>`;
  }

  public renderDialog(): TemplateResult | typeof nothing {
    if (!this.dialog || !this.editorRenderer) return nothing;
    if (!this.dialog.localOnly) this.refreshEntityIndex();
    return this.editorRenderer({
      host: this.host,
      dialog: this.dialog,
      local: this.local,
      storageUnavailable: this.storageUnavailable,
      problems: this.problems(this.dialog),
      entityIndex: this.entityIndex || refreshSummaryEntityIndex({}, null),
      setDialog: (dialog) => { this.dialog = dialog; this.host.requestUpdate(); },
      saveLocal: (patch) => this.saveLocal(patch),
      mutate: (mutate) => this.mutate(mutate),
      deleteBlock: (index) => void this.deleteBlock(index),
      dragStart: (event, token) => this.dragStart(event, token),
      drop: (event, target) => this.drop(event, target),
      sourceToken: (source) => this.sourceToken(source),
      openSource: (blockId, valueId) => this.openSource(blockId, valueId),
      closeSource: (returnFocus) => this.closeSource(returnFocus),
      setSource: (blockId, valueId, token) => this.setSource(blockId, valueId, token),
      save: () => void this.saveDialog(),
      reload: () => void this.reloadDialog(),
      close: () => this.closeDialogIfIdle(),
      t: (key) => this.t(key),
    });
  }

  private t(key: string): string {
    return key.startsWith('summary.')
      ? summaryPanelText(langOf(this.host.hass, this.host._config?.language), key)
      : this.host._t(key as I18nKey);
  }
  private translate = (key: string): string => this.t(key);

  private ensureStyle(): void {
    const root = this.host.renderRoot as ShadowRoot;
    if (this.styleSheet && root.adoptedStyleSheets.includes(this.styleSheet)) return;
    const Sheet = this.host.ownerDocument.defaultView?.CSSStyleSheet;
    if (Sheet && 'adoptedStyleSheets' in root) {
      const sheet = new Sheet(); sheet.replaceSync(summaryPanelCss);
      this.styleSheet = sheet;
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      return;
    }
    if (root.querySelector('style[data-hp-summary]')) return;
    const style = this.host.ownerDocument.createElement('style');
    style.dataset.hpSummary = 'true'; style.textContent = summaryPanelCss;
    root.insertBefore(style, root.firstChild);
  }

  private placementSlot(): string {
    return stableSummaryPlacementSlot(this.host);
  }

  private preferenceKey(): string | null {
    return summaryLocalKey({
      userId: this.host.hass?.user?.id || this.host.hass?.user?.name,
      path: location.pathname,
      host: this.host.panelHost ? 'panel' : 'lovelace',
      slot: this.placementSlot(),
    });
  }

  private identity(): string {
    return JSON.stringify({
      key: this.preferenceKey(),
      user: this.host.hass?.user?.id || this.host.hass?.user?.name || '',
      route: location.pathname,
      host: this.host.panelHost ? 'panel' : 'lovelace',
      slot: this.placementSlot(),
      kiosk: this.host._kiosk,
      canManage: this.host._canManageConfiguration,
    });
  }

  private syncLifecycle(): void {
    const next = this.identity();
    if (this.lifecycleIdentity && next !== this.lifecycleIdentity) this.resetLifecycle();
    this.lifecycleIdentity = next;
  }

  private resetLifecycle(): void {
    this.lifecycleGeneration++;
    this.dialog = null;
    this.entityIndex = null;
    this.deviceMemo = null;
    this.areaMemo = null;
    this.clockContext = '';
    this.storageKey = null;
    this.storageUnavailable = false;
    this.local = { version: 1, show: false, icon_scale: 1, font_scale: 1 };
    if (this.clockTimer) clearTimeout(this.clockTimer);
    this.clockTimer = 0;
    this.lifecycleIdentity = this.connected ? this.identity() : '';
    this.host.requestUpdate();
  }

  private current(generation: number): boolean {
    return this.connected && generation === this.lifecycleGeneration
      && this.lifecycleIdentity === this.identity();
  }

  private refreshEntityIndex(): void {
    this.entityIndex = refreshSummaryEntityIndex(this.host.hass?.states, this.entityIndex);
  }

  private syncNativeNarrow(): void {
    if (this.host.panelHost) return;
    let node: Node | null = this.host;
    for (let depth = 0; node && depth < 12; depth++) {
      const root = node.getRootNode() as Document | ShadowRoot;
      node = node.parentNode || (root instanceof ShadowRoot ? root.host : null);
      if (!node || node === this.host) continue;
      const value = (node as Node & { narrow?: unknown }).narrow;
      if (typeof value === 'boolean') {
        if (this.host.narrow !== value) this.host.narrow = value;
        return;
      }
    }
  }

  private loadLocal(): void {
    const key = this.preferenceKey();
    if (!key || key === this.storageKey) return;
    let raw: unknown = null;
    let legacy: unknown = null;
    let storageAvailable = true;
    try { raw = JSON.parse(localStorage.getItem(key) || 'null'); } catch { storageAvailable = false; }
    try { legacy = JSON.parse(localStorage.getItem(SUMMARY_PANEL_LEGACY_SCALE_KEY) || 'null'); } catch { storageAvailable = false; }
    this.storageKey = key;
    this.storageUnavailable = !storageAvailable;
    this.local = parseSummaryLocal(raw, legacy);
    this.host._kioskScale = { icon: this.local.icon_scale, font: this.local.font_scale };
  }

  private saveLocal(patch: Partial<SummaryPanelLocalPreferences>): void {
    this.local = {
      ...this.local, ...patch, version: 1,
      icon_scale: normalizeSummaryScale(patch.icon_scale ?? this.local.icon_scale),
      font_scale: normalizeSummaryScale(patch.font_scale ?? this.local.font_scale),
    };
    this.host._kioskScale = { icon: this.local.icon_scale, font: this.local.font_scale };
    this.storageKey ||= this.preferenceKey();
    let stored = false;
    try {
      if (this.storageKey) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.local));
        stored = true;
      }
    } catch { /* local preferences remain effective for this session */ }
    this.storageUnavailable = !stored;
    if (!stored) this.host._showToast?.(this.t('summary.storage_unavailable'));
    this.host.requestUpdate();
  }

  private config(): { config: SummaryPanelConfig | null; derived: boolean; unsupported: boolean } {
    return summaryPanelOf(this.host._settings, this.translate);
  }

  private async openDialog(): Promise<void> {
    const generation = this.lifecycleGeneration;
    this.loadLocal();
    try {
      this.editorLoad ||= import('./summary-panel-editor').then((module) => module.renderSummaryPanelEditor);
      this.editorRenderer = await this.editorLoad;
    } catch (error) {
      this.editorLoad = null;
      if (!this.current(generation)) return;
      this.host._showToast?.(`${this.t('summary.load_failed')} ${this.host._errText(error)}`);
      return;
    }
    if (!this.current(generation)) return;
    const resolved = this.config();
    const base = resolved.config || defaultSummaryPanel(this.translate);
    const backendUnsupported = this.host._haSummaryPanelApi !== SUMMARY_PANEL_API_VERSION;
    const localOnlyHint = resolved.unsupported ? 'summary.unsupported_schema'
      : backendUnsupported && this.host._canManageConfiguration
        ? 'summary.backend_required' : 'summary.local_only';
    this.dialog = {
      draft: cloneSummaryPanel(base), base: cloneSummaryPanel(base),
      baseRevision: this.host._cfgRev,
      localShow: this.local.show, baseLocalShow: this.local.show,
      localOnly: this.host._kiosk || !this.host._canManageConfiguration
        || backendUnsupported || resolved.unsupported,
      localOnlyHint,
      busy: false, attempted: false, entityFilter: '', activeSource: null,
      error: '', conflict: false,
    };
    if (!this.dialog.localOnly) this.refreshEntityIndex();
    this.host.requestUpdate();
  }

  private problems(dialog = this.dialog): SummaryDraftProblem[] {
    if (!dialog || dialog.localOnly) return [];
    return validateSummaryDraft(
      normalizeSummaryDraft(dialog.draft), dialog.base,
      new Set(this.host._model.map((space) => space.id)),
      new Set(Object.keys(this.host.hass?.states || {})),
    );
  }

  private mutate(mutate: (draft: SummaryPanelConfig) => void): void {
    if (!this.dialog || this.dialog.busy || this.dialog.localOnly) return;
    const draft = cloneSummaryPanel(this.dialog.draft);
    mutate(draft);
    const owner = this.dialog.activeSource;
    const ownerExists = !owner || draft.blocks.some((block) => block.id === owner.blockId
      && block.values.some((value) => value.id === owner.valueId));
    this.dialog = {
      ...this.dialog, draft, error: '', conflict: false,
      activeSource: ownerExists ? owner : null,
      entityFilter: ownerExists ? this.dialog.entityFilter : '',
    };
    this.host.requestUpdate();
  }

  private async deleteBlock(index: number): Promise<void> {
    const block = this.dialog?.draft.blocks[index];
    if (!block) return;
    const generation = this.lifecycleGeneration;
    if (block.values.length) {
      const accepted = await this.host._confirmDanger({
        key: 'summary-block', kind: 'warning',
        title: this.t('summary.delete_block_title'), message: this.t('summary.delete_block_body'),
        objectName: block.title, confirmLabel: this.t('btn.delete'), cancelLabel: this.t('btn.cancel'),
      });
      if (!accepted || !this.current(generation)) return;
    }
    this.mutate((draft) => {
      const current = draft.blocks.findIndex((candidate) => candidate.id === block.id);
      if (current >= 0) draft.blocks.splice(current, 1);
    });
  }

  private sourceToken(source: SummaryPanelSource): string {
    return source.type === 'system' ? `system:${source.key}` : `entity:${source.entity_id}`;
  }

  private openSource(blockId: string, valueId: string): void {
    if (!this.dialog || this.dialog.busy || this.dialog.localOnly) return;
    this.refreshEntityIndex();
    this.dialog = { ...this.dialog, activeSource: { blockId, valueId }, entityFilter: '' };
    this.host.requestUpdate();
    void this.host.updateComplete.then(() => {
      if (this.dialog?.activeSource?.blockId === blockId
          && this.dialog.activeSource.valueId === valueId) {
        (this.host.renderRoot.querySelector('[data-summary-picker-search]') as HTMLElement | null)?.focus();
      }
    });
  }

  private closeSource(returnFocus = false): void {
    const owner = this.dialog?.activeSource;
    if (!this.dialog || !owner) return;
    this.dialog = { ...this.dialog, activeSource: null, entityFilter: '' };
    this.host.requestUpdate();
    if (returnFocus) void this.focusSource(owner.blockId, owner.valueId);
  }

  private async focusSource(blockId: string, valueId: string): Promise<void> {
    await this.host.updateComplete;
    const token = `${blockId}\n${valueId}`;
    const buttons = this.host.renderRoot.querySelectorAll<HTMLElement>('[data-summary-source-owner]');
    [...buttons].find((button) => button.dataset.summarySourceOwner === token)?.focus();
  }

  private setSource(blockId: string, valueId: string, token: string): void {
    this.mutate((draft) => {
      const value = draft.blocks.find((block) => block.id === blockId)
        ?.values.find((candidate) => candidate.id === valueId);
      if (!value) return;
      if (token.startsWith('system:')) {
        const key = token.slice(7);
        if (isSummarySystemKey(key)) value.source = { type: 'system', key };
      } else value.source = { type: 'entity', entity_id: token.startsWith('entity:') ? token.slice(7) : token };
    });
    if (this.dialog) this.dialog = { ...this.dialog, activeSource: null, entityFilter: '' };
    this.host.requestUpdate();
    void this.focusSource(blockId, valueId);
  }

  private dragStart(event: DragEvent, token: string): void {
    event.dataTransfer?.setData('text/x-houseplan-summary', token);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  private drop(event: DragEvent, target: string): void {
    event.preventDefault();
    event.stopPropagation();
    const source = event.dataTransfer?.getData('text/x-houseplan-summary') || '';
    const from = source.split(':').map(Number);
    const to = target.split(':').map(Number);
    if (source.startsWith('block:') && target.startsWith('block:')) {
      this.mutate((draft) => { draft.blocks = moveSummaryItem(draft.blocks, from[1], to[1]); });
    } else if (source.startsWith('value:') && target.startsWith('value:') && from[1] === to[1]) {
      this.mutate((draft) => {
        draft.blocks[from[1]].values = moveSummaryItem(draft.blocks[from[1]].values, from[2], to[2]);
      });
    }
  }

  private async saveDialog(): Promise<void> {
    const dialog = this.dialog;
    if (!dialog || dialog.busy) return;
    const generation = this.lifecycleGeneration;
    const draft = normalizeSummaryDraft(dialog.draft);
    const problems = dialog.localOnly ? [] : validateSummaryDraft(
      draft, dialog.base, new Set(this.host._model.map((space) => space.id)),
      new Set(Object.keys(this.host.hass?.states || {})),
    );
    if (problems.some((problem) => problem.kind === 'error')) {
      this.dialog = { ...dialog, draft, attempted: true };
      this.host.requestUpdate();
      await this.host.updateComplete;
      (this.host.renderRoot.querySelector('[data-summary-error="true"]') as HTMLElement | null)?.focus?.();
      return;
    }
    this.dialog = { ...dialog, draft, busy: true, attempted: false, error: '', conflict: false };
    this.host.requestUpdate();
    try {
      if (!dialog.localOnly && !sameSummaryPanel(draft, dialog.base)) {
        this.host._writesPending++;
        const write = enqueueSerializedWrite(this.host._writeChain, async () => {
          if (!this.current(generation)) return;
          if (!this.host._serverCfg) throw new Error(this.t('summary.save_failed'));
          if (this.host._cfgRev !== dialog.baseRevision) throw new Error(this.t('summary.conflict'));
          const candidate = canonicalizeConfigGeometry({
            ...this.host._serverCfg,
            settings: { ...(this.host._serverCfg.settings || {}), summary_panel: draft },
          }) as ServerConfig;
          let recovered = false;
          try {
            await this.host._sendConfigCandidate(candidate);
            if (!this.current(generation)) return;
          } catch (writeError) {
            if (!this.current(generation)) throw writeError;
            try {
              const authoritative = await this.host._getAuthoritativeConfig();
              if (!this.current(generation)) throw writeError;
              const confirmed = confirmedSummaryPanelWriteRecovery(authoritative, draft);
              if (!confirmed) throw writeError;
              const configChanged = contentFingerprint(confirmed.config)
                !== (this.host._cfgContentFingerprint || contentFingerprint(this.host._serverCfg));
              if (configChanged && !await this.host._signer.prepareImage(
                this.host.hass, this.host._candidateBackdrop(confirmed.config),
              )) {
                this.host._continuity.note('asset-failed');
                this.host._scheduleLoadRetry(true);
                throw writeError;
              }
              if (configChanged && this.host._continuity.hasCompleteFrame
                  && this.host._continuity.state === 'steady') {
                this.host._beginContinuityCandidate('summary-recovery', true);
              }
              const visibleSpace = this.host._space;
              this.host._adoptStructuralResponses(authoritative);
              void this.host._syncDecorAssets(confirmed.config).catch(() => undefined);
              this.host._adoptInitialSpace(this.host._model, true);
              this.host._resumePendingNavMode();
              this.host._cacheSnapshot();
              if (this.host._space !== visibleSpace) this.host._restoreZoom();
              this.host._regSignature = '';
              this.host._maybeRebuildDevices();
              recovered = true;
            } catch { throw writeError; }
          }
          if (!recovered) {
            if (!this.current(generation)) return;
            this.host._serverCfg = candidate;
            this.host._cfgContentFingerprint = contentFingerprint(candidate);
            this.host._cacheSnapshot();
          }
        });
        this.host._writeChain = write;
        await write.finally(() => { this.host._writesPending--; });
      }
      if (!this.current(generation)) return;
      this.saveLocal({ show: dialog.localShow });
      this.dialog = null;
    } catch (error) {
      if (!this.current(generation)) return;
      const conflict = (error as { code?: unknown } | null)?.code === 'conflict'
        || this.host._cfgRev !== dialog.baseRevision;
      this.dialog = {
        ...(this.dialog || dialog), busy: false, conflict,
        error: conflict ? this.t('summary.conflict') : this.host._errText(error),
      };
    }
    if (this.current(generation)) this.host.requestUpdate();
  }

  private async reloadDialog(): Promise<void> {
    const dialog = this.dialog;
    if (!dialog || dialog.busy) return;
    const generation = this.lifecycleGeneration;
    this.dialog = { ...dialog, busy: true, error: '', conflict: false };
    this.host.requestUpdate();
    try {
      await this.host._reloadConfigOnly(true);
      if (!this.current(generation)) return;
      if (dialog.conflict && this.host._cfgRev === dialog.baseRevision) {
        throw new Error(this.t('summary.load_failed'));
      }
      const resolved = this.config();
      const base = resolved.config || defaultSummaryPanel(this.translate);
      this.dialog = {
        ...dialog, draft: cloneSummaryPanel(base), base: cloneSummaryPanel(base),
        baseRevision: this.host._cfgRev, busy: false, attempted: false,
        error: '', conflict: false,
      };
    } catch (error) {
      if (!this.current(generation)) return;
      this.dialog = { ...dialog, busy: false, error: this.host._errText(error), conflict: true };
    }
    if (this.current(generation)) this.host.requestUpdate();
  }

  private metrics(): { deviceCount: number | null; areaM2: number | null; now: Date } {
    const module = this.metricsModule;
    if (!module) return { deviceCount: null, areaM2: null, now: this.clock };
    if (!this.deviceMemo || this.deviceMemo.cfgEpoch !== this.host._cfgEpoch
        || this.deviceMemo.layoutRev !== this.host._layoutRev
        || this.deviceMemo.registryRev !== this.host._haRegistry.revision) {
      const represented = module.representedHaDeviceIds({
        registry: this.host._haRegistry,
        areaToSpace: Object.fromEntries(Object.entries(this.host._areaToSpace).map(
          ([area, value]) => [area, value.space],
        )),
        spaceIds: new Set(this.host._model.map((space) => space.id)),
        firstSpaceId: this.host._model[0]?.id || '', markers: this.host._markers,
      });
      this.deviceMemo = {
        cfgEpoch: this.host._cfgEpoch, layoutRev: this.host._layoutRev,
        registryRev: this.host._haRegistry.revision, value: represented?.size ?? null,
      };
    }
    if (!this.areaMemo || this.areaMemo.cfgEpoch !== this.host._cfgEpoch) {
      this.areaMemo = {
        cfgEpoch: this.host._cfgEpoch,
        value: this.host._serverCfg ? module.totalCleanFloorAreaM2(this.host._serverCfg, this.host._model) : null,
      };
    }
    return { deviceCount: this.deviceMemo.value, areaM2: this.areaMemo.value, now: this.clock };
  }

  private value(value: SummaryPanelValue): string {
    const module = this.metricsModule;
    const resolved = !module ? null : value.source.type === 'entity'
      ? module.summaryEntityValue(this.host.hass, value.source.entity_id)
      : module.summarySystemValue(
        value.source, this.metrics(), this.host.hass,
        langOf(this.host.hass, this.host._config?.language),
      );
    return resolved ?? this.t('summary.unavailable');
  }

  private ensureMetrics(): void {
    if (this.metricsModule || this.metricsLoad) return;
    const generation = this.lifecycleGeneration;
    this.metricsLoad = import('./summary-panel-metrics');
    void this.metricsLoad.then((module) => {
      this.metricsModule = module;
      if (this.current(generation)) this.host.requestUpdate();
    }).catch(() => undefined).finally(() => { this.metricsLoad = null; });
  }

  private layout() {
    return resolveSummaryLayout({
      width: this.stage.width, height: this.stage.height,
      ...this.safeInsets(),
      controlTop: this.host._kiosk ? this.stage.controlTop : 0,
      minimumHeight: this.stage.minimumHeight,
    });
  }

  private measureLayout(): void {
    const stage = this.host._stageEl;
    if (!stage) return;
    const probe = this.host.renderRoot.querySelector('.summary-measure') as HTMLElement | null;
    const controls = this.host.renderRoot.querySelector('.summary-control.kiosk') as HTMLElement | null;
    const stageBox = stage.getBoundingClientRect();
    const controlBox = controls?.getBoundingClientRect();
    const next = {
      width: Math.round(stage.clientWidth), height: Math.round(stage.clientHeight),
      minimumHeight: Math.max(162, Math.ceil(probe?.getBoundingClientRect().height || 0)),
      controlTop: controlBox ? Math.max(0, Math.ceil(controlBox.bottom - stageBox.top + 12)) : 0,
    };
    if (next.width !== this.stage.width || next.height !== this.stage.height
        || next.minimumHeight !== this.stage.minimumHeight || next.controlTop !== this.stage.controlTop) {
      this.stage = next;
      this.host.requestUpdate();
    }
  }

  private safeInsets(): { safeLeft: number; safeRight: number; safeTop: number; safeBottom: number } {
    const probe = this.host.renderRoot.querySelector('.summary-safe-probe') as HTMLElement | null;
    if (!probe) return { safeLeft: 0, safeRight: 0, safeTop: 0, safeBottom: 0 };
    const style = this.host.ownerDocument.defaultView?.getComputedStyle(probe);
    if (!style) return { safeLeft: 0, safeRight: 0, safeTop: 0, safeBottom: 0 };
    const px = (value: string): number => Number.parseFloat(value) || 0;
    return {
      safeLeft: px(style.paddingLeft), safeRight: px(style.paddingRight),
      safeTop: px(style.paddingTop), safeBottom: px(style.paddingBottom),
    };
  }

  private hasVisibleClock(): boolean {
    const config = this.config().config;
    if (this.host.ownerDocument.visibilityState === 'hidden' || !config) return false;
    if (!effectiveSummaryVisible({
      view: this.host._mode === 'view', localShow: this.local.show,
      showOnMobile: config.show_on_mobile, narrow: this.host.narrow, fits: this.layout().fits,
    })) return false;
    return visibleSummaryBlocks(config, this.host._space).some((block) => block.values.some(
      (value) => value.source.type === 'system' && value.source.key === 'datetime',
    ));
  }

  private syncClock(): void {
    const context = `${langOf(this.host.hass, this.host._config?.language)}\n${
      this.host.hass?.config?.time_zone || ''}`;
    if (context !== this.clockContext) {
      this.clockContext = context;
      this.clock = new Date();
    }
    const needed = this.hasVisibleClock();
    if (needed && !this.clockTimer) {
      this.clock = new Date();
      const tick = () => {
        this.clock = new Date();
        this.clockTimer = 0;
        this.host.requestUpdate();
        this.syncClock();
      };
      this.clockTimer = window.setTimeout(tick, 60_000 - Date.now() % 60_000 + 25);
    } else if (!needed && this.clockTimer) {
      clearTimeout(this.clockTimer);
      this.clockTimer = 0;
    }
  }
}
