/**
 * Диалог «Оптимизировать планы» (Общие настройки → Сетка), #642.
 *
 * Первый вынос из монолита по образцу `live-*` и `RadarSetupController`: узкий
 * порт `OptimizePlansDialogPort` из 18 членов вместо `HouseplanEditorHostPort`
 * на 350, без делегатов-заглушек в карточке. Модуль импортирует только
 * редакторский рантайм, поэтому остаётся в его ленивом чанке; карточка берёт
 * отсюда только тип состояния.
 *
 * Сам диалог (`_alignDialog`) остаётся `@state` карточки: харнесс и golden
 * пишут его напрямую. Сюда переехали два куска состояния, которые карточке
 * не принадлежали: инлайн-фолбэк буфера обмена и дедуп dev-лога.
 */
import { html, nothing, type TemplateResult } from 'lit';
import type { PlanHost } from './plan-host';

import { formatLatticeShiftCm } from './coordinate-canonicalization';
import type { DeviceLayout } from './device-position-history';
import { haRegistryDiagnostics } from './ha-binding-status';
import type { I18nKey } from './i18n';
import type { SettingsI18nKey } from './i18n/settings';
import {
  unverifiedDiagnostics, unverifiedGroup, unverifiedName,
  type UnverifiedGroup,
} from './optimize-unverified';
import {
  spacePhysicalGeometryFingerprint, type OptimizeGeometryPreflightResult,
} from './plan-geometry-preflight';
import type { OptimizeReport, optimizePlans } from './plan-optimizer';
import type {
  SpaceReferencePositionDetail, SpaceReferenceRepairContext,
} from './space-reference-repair';
import type { ServerConfig } from './types';
import type { OptimizeSource, OptimizeWriteGuard, sameOptimizeSource } from './optimize-source';
import { contentFingerprint } from './visual-continuity';
import type { optimizeFailure, optimizeFailureDiagnostics, OptimizeWriteFailure,
  OptimizeReceipt, OptimizeStatusState } from './optimize-feedback';
import type { OptimizeReloadResult } from './optimize-reload';
import type { renderOptimizeStatus } from './optimize-status';

/** Optimization preview plus the exact pair, so commit cannot differ from it. */
export type OptimizePreviewState = {
    report: OptimizeReport; config: any; layout: Record<string, any>;
    preflight: OptimizeGeometryPreflightResult | null;
    /** the promised maximum, in centimetres, ALREADY rounded up (AUD-158B1-01) */
    cm: number;
    /** the space that maximum belongs to, named only when there are several */
    where: string;
    changed: boolean;
    busy: boolean;
    /** False by default; true only after the secondary preview action. */
    removeLiveMissingPositions: boolean;
    removeInvalidMissingPositions: boolean;
    source: OptimizeSource;
    vacuumNames: string[];
    /** #869: a registry re-check is in flight (memory only). */
    retrying?: boolean;
    /** #869: the last re-check still brought no complete registry. */
    retryFailed?: boolean;
    phase?: 'preview' | 'saving' | 'verifying' | 'result';
    outcome?: 'clean' | 'limited' | 'remaining' | 'unchecked' | 'stale';
    afterReport?: OptimizeReport;
    replacesUndo?: boolean;
    canUndo?: boolean;
};
export type OptimizePlansDialogState = OptimizePreviewState | OptimizeStatusState;
const previewState = (state: OptimizePlansDialogState | null): state is OptimizePreviewState =>
  !!state && 'report' in state;

export function optimizeHasObservations(report: OptimizeReport): boolean {
  return !!(report.wallsStraightenSkipped || report.nestedRefsUnresolved
    || report.liveMissingPositions.length || report.unverifiedPositions.length
    || report.invalidPositionsRetained.length || report.registryAuthoritative === false);
}

/**
 * Всё, что диалогу нужно от редактора. Порт собирает рантайм в конструкторе;
 * других зависимостей у модуля нет. Рост порта выше 23 членов — сигнал, что
 * сюда протекает чужая подсистема (юнит `optimize-plans-dialog.test.mjs`).
 */
export interface OptimizePlansDialogPort {
  dialog(): OptimizePlansDialogState | null;
  setDialog(next: OptimizePlansDialogState | null): void;
  /** #869: the dialog's own strings live in the lazy `settings` dictionary. */
  t(key: I18nKey | SettingsI18nKey, vars?: Record<string, string | number>): string;
  planHost(): PlanHost;
  config(): ServerConfig | null;
  /** the normalised plan exists — the preview has something to optimise */
  planReady(): boolean;
  canWrite(): boolean;
  source(): OptimizeSource;
  layout(): DeviceLayout | null | undefined;
  integrationVersion(): string | null;
  /** `displayVersion(CARD_VERSION)` of the runtime; no second copy here */
  cardVersion(): string;
  requestUpdate(): void;
  showToast(message: string, id?: string): void;
  captureToast?(): (message: string, id?: string) => void;
  support(message: string): boolean;
  checkGeometry(config: ServerConfig): OptimizeGeometryPreflightResult;
  referenceContext(removeLiveMissingPositions: boolean, removeInvalidMissingPositions?: boolean): SpaceReferenceRepairContext;
  /** In a browser resolves after a presented frame; synchronous ports are useful in pure tests. */
  present(): void | Promise<void>;
  clearGeometryGesture(): void;
  commit(config: ServerConfig, layout: DeviceLayout, guard: OptimizeWriteGuard): Promise<OptimizeReceipt>;
  /** a write conflict reloads both stores before the error toast */
  reloadAfterConflict(): Promise<OptimizeReloadResult>;
  /** #780: strips passing through walls of the optimised result (lazy LED tool). */
  ledNote(): TemplateResult | typeof nothing;
}

export function preflightDiagnostics(
  preflight: OptimizeGeometryPreflightResult,
  candidate: ServerConfig | null,
  { cardVersion, now }: { cardVersion: string; now: Date },
): object {
  // CODE-REVIEW-295-r1 M1: hash the CANDIDATE spaces the preflight judged,
  // not the already-saved config — a saved-config hash is exactly what a
  // space export would reproduce, and the block promises what the export
  // does not carry.
  const spacesById = new Map(((candidate as any)?.spaces || []) // any-ok: кандидат приходит из untyped optimizePlans, форма spaces не гарантирована
    .map((space) => [String(space?.id || ''), space]));
  return {
    kind: 'houseplan-optimize-preflight',
    origin: 'runtime',
    cardVersion,
    checkedAt: now.toISOString(),
    preflightFingerprint: preflight.fingerprint,
    failures: preflight.failures.map((failure) => ({
      spaceId: failure.spaceId,
      displayName: failure.displayName,
      reason: failure.reason,
      detail: failure.detail ?? null,
      spaceGeometryFingerprint: spacesById.has(failure.spaceId)
        ? spacePhysicalGeometryFingerprint(spacesById.get(failure.spaceId))
        : null,
    })),
  };
}

/**
 * #869: what the dialog takes from the runtime besides the port. The optimizer
 * is injected, not imported: this module is its own lazy chunk, and a static
 * edge into the editor runtime chunk would make Rollup rename the runtime's
 * named exports that the immutable-URL retry reads (#803).
 */
export interface OptimizePlansDialogOptions {
  optimize: typeof optimizePlans;
  sourceMatches: typeof sameOptimizeSource;
  /** Like optimize itself, eager editor helpers are injected to keep raw-URL exports stable. */
  feedback: {
    failure: typeof optimizeFailure;
    diagnostics: typeof optimizeFailureDiagnostics;
    isWriteFailure(error: unknown): error is OptimizeWriteFailure;
    renderStatus: typeof renderOptimizeStatus;
  };
  /** the bounded wait of «Check again», 10 s by default */
  registryRetryMs?: number;
}

export class OptimizePlansDialog {
  private planPort(): PlanHost { return this.port.planHost(); }
  /**
   * CODE-REVIEW-295-r1 M2: the inline clipboard fallback belongs to one
   * dialog showing. Keyed by the dialog object, a reopened dialog — always a
   * new object — can never display the previous refusal's JSON, and closing
   * needs no manual reset.
   */
  private readonly fallbacks = new WeakMap<object, string>();
  /** #295: dev-log once per distinct failing preflight, not once per render. */
  private reportedFingerprint: string | null = null;

  private readonly registryRetryMs: number;
  private operation: { state: OptimizePlansDialogState } | null = null;
  private uncertain: OptimizeStatusState | null = null;

  public retire(): void { this.operation = null; this.uncertain = null; }

  private owns(source: OptimizeSource): boolean {
    return source.authorityCurrent?.() !== false && source.connection === this.port.source().connection;
  }

  /** Closing changes visibility, not the ownership of an already dispatched request. */
  private publish(owner: { state: OptimizePlansDialogState }, state: OptimizePlansDialogState): boolean {
    if (this.operation !== owner || !this.owns(owner.state.source)) return false;
    const visible = this.port.dialog() === owner.state;
    owner.state = state;
    if (visible) this.port.setDialog(state);
    return true;
  }

  private close = (): void => { this.port.setDialog(null); };

  public constructor(
    private readonly port: OptimizePlansDialogPort,
    private readonly options: OptimizePlansDialogOptions,
  ) {
    this.registryRetryMs = options.registryRetryMs ?? 10_000;
  }

  /** #295: diagnostics text shown inline when the clipboard is unavailable. */
  public get clipboardFallback(): string | null {
    const dialog = this.port.dialog();
    return dialog ? this.fallbacks.get(dialog) ?? null : null;
  }

  private diagnostics(
    preflight: OptimizeGeometryPreflightResult,
    candidate: ServerConfig | null,
  ): object {
    return preflightDiagnostics(preflight, candidate, {
      cardVersion: this.port.cardVersion(), now: new Date(),
    });
  }

  public reportPreflightFailure(
    preflight: OptimizeGeometryPreflightResult,
    candidate: ServerConfig | null,
  ): void {
    if (preflight.ok || preflight.fingerprint === this.reportedFingerprint) return;
    this.reportedFingerprint = preflight.fingerprint;
    // eslint-disable-next-line no-console
    console.warn('[houseplan] optimize preflight failed', this.diagnostics(preflight, candidate));
  }

  public async copyDiagnostics(): Promise<void> {
    const showToast = this.port.captureToast?.() ?? ((message: string, id?: string) => this.port.showToast(message, id));
    const dialog = this.port.dialog();
    if (!dialog) return;
    const text = this.diagnosticText(dialog);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (this.fallbacks.delete(dialog)) this.port.requestUpdate();
      showToast(this.port.t('gs.preflight_copied'), 'gs.preflight_copied');
    } catch {
      // Insecure context / embedded webview: surface the block inline so the
      // owner can select and copy it by hand.
      this.fallbacks.set(dialog, text);
      this.port.requestUpdate();
    }
  }

  private diagnosticText(dialog: OptimizePlansDialogState): string | null {
    if (!previewState(dialog)) return dialog.failure ? JSON.stringify(this.options.feedback.diagnostics(
      dialog.failure, dialog.source, { card: this.port.cardVersion(), integration: this.port.integrationVersion() },
    ), null, 2) : null;
    if (dialog.preflight && !dialog.preflight.ok)
      return JSON.stringify(this.diagnostics(dialog.preflight, dialog.config ?? null), null, 2);
    const report = dialog.afterReport ?? dialog.report;
    if (report.unverifiedPositions.length) return JSON.stringify(unverifiedDiagnostics({
      items: report.unverifiedPositions, registry: haRegistryDiagnostics(null, this.planPort().environment.registry),
      analysisAuthoritative: report.registryAuthoritative === true,
      cardVersion: this.port.cardVersion(), integrationVersion: this.port.integrationVersion(), now: new Date(),
    }), null, 2);
    return dialog.outcome && dialog.outcome !== 'clean' ? JSON.stringify({
      kind: 'houseplan-optimize-result', outcome: dialog.outcome,
      cardVersion: this.port.cardVersion(), integrationVersion: this.port.integrationVersion(),
      configRev: dialog.source.configRev, layoutRev: dialog.source.layoutRev,
      configFingerprint: dialog.source.configFingerprint, layoutFingerprint: dialog.source.layoutFingerprint,
      wallsSkipped: report.wallsStraightenSkipped, unverified: report.unverifiedPositions.length,
      retainedPositions: report.liveMissingPositions.length, unresolvedReferences: report.nestedRefsUnresolved,
    }, null, 2) : null;
  }

  private support = (): void => {
    const state = this.port.dialog();
    if (!state) return;
    // The existing support message has a 10,000-code-point limit. A large
    // preflight retains its copy action; only the bounded summary is prefilled.
    let diagnostic = this.diagnosticText(state);
    if (diagnostic && [...diagnostic].length > 7000) diagnostic = JSON.stringify({
      kind: 'houseplan-optimize', summaryOnly: true, cardVersion: this.port.cardVersion(),
      configRev: state.source.configRev, layoutRev: state.source.layoutRev,
    });
    const message = `${this.port.t('gs.optimize_support_intro')}\n${diagnostic || ''}`;
    if (this.port.support(message)) this.close();
    else this.port.showToast(this.port.t('gs.optimize_support_busy'), 'gs.optimize_support_busy');
  };

  /**
   * Preview whole-plan maintenance. Nothing is written here: the pure run
   * produces both the report and the exact config/layout pair to commit.
   */
  public preview(removeLiveMissingPositions: boolean, removeInvalidMissingPositions = false,
    replacesUndo = false): void | Promise<void> {
    if (this.operation && !this.owns(this.operation.state.source)) this.operation = null;
    if (this.uncertain && !this.owns(this.uncertain.source)) this.uncertain = null;
    if (this.operation && this.owns(this.operation.state.source)) {
      this.port.setDialog(this.operation.state); return;
    }
    if (this.uncertain && this.owns(this.uncertain.source)) {
      this.port.setDialog(this.uncertain); return;
    }
    const config = this.port.config();
    if (!this.port.canWrite()) {
      this.port.showToast(this.port.t('gs.optimize_write_required'), 'gs.optimize_write_required');
      return;
    }
    if (!this.port.planReady() || !config) return;
    const source = this.port.source();
    const pending: OptimizeStatusState = { phase: 'checking', busy: true, source, config };
    const owner = { state: pending as OptimizePlansDialogState };
    this.operation = owner;
    this.port.setDialog(pending);
    const calculate = (): void => {
      if (this.operation !== owner || !this.owns(source)) return;
      if (this.port.dialog() !== pending) { this.operation = null; return; }
      if (!this.port.canWrite() || !this.options.sourceMatches(source, this.port.source())) {
        this.publish(owner, { ...pending, phase: 'failure', busy: false,
          failure: this.options.feedback.failure({ code: this.port.canWrite() ? 'optimize_preview_changed' : 'unauthorized' }, config, 'checking') });
        this.operation = null; return;
      }
      try {
        this.publish(owner, this.calculatePreview(config, source, removeLiveMissingPositions, removeInvalidMissingPositions, replacesUndo));
      } catch (error) {
        this.publish(owner, { ...pending, phase: 'failure', busy: false, failure: this.options.feedback.failure(error, config, 'checking') });
      } finally { if (this.operation === owner) this.operation = null; }
    };
    const presented = this.port.present();
    return presented ? presented.then(calculate) : calculate();
  }

  private calculatePreview(config: ServerConfig, source: OptimizeSource, removeLiveMissingPositions: boolean,
    removeInvalidMissingPositions: boolean, replacesUndo: boolean): OptimizePreviewState {
    const spaces = config.spaces || [];
    const r = this.options.optimize(
        config,
        this.port.layout() || {},
        this.port.referenceContext(removeLiveMissingPositions, removeInvalidMissingPositions),
      );
    const preflight = r.changed ? this.port.checkGeometry(r.config) : null;
    if (preflight) this.reportPreflightFailure(preflight, r.config);
    // The maximum geometry shift is an UPPER BOUND, not a sample. The run
    // measured every element in the centimetres of ITS OWN space — converting
    // one normalised maximum through the first space's `cell_cm` understated
    // a two-scale plan twentyfold (AUD-158B1-01) — and the last tenth is
    // rounded UP, so the promise can never be smaller than the deed.
    const cm = Math.ceil(r.report.maxShiftCm * 10) / 10;
    const sp = spaces.find((x) => x?.id != null && String(x.id) === r.report.maxSpace);
    const where = spaces.length > 1 && sp ? String(sp.title || sp.id) : '';
    const rooms = new Set((r.config.spaces || []).flatMap((space) =>
      (space.rooms || []).map((room) => room.id)));
    const vacuumNames = (r.config.markers || []).filter((marker) =>
      Object.values(marker.vacuum?.segment_map || {}).some((room) =>
        typeof room === 'string' && !!room && !rooms.has(room)))
      .map((marker) => String(marker.name || marker.id));
    // A new dialog object also starts without an inline clipboard fallback.
    return {
      report: r.report, config: r.config, layout: r.layout, cm, where,
      preflight, changed: r.changed, busy: false, removeLiveMissingPositions,
      removeInvalidMissingPositions, source,
      vacuumNames, replacesUndo,
    };
  }

  public open(): void | Promise<void> { return this.preview(false); }

  public toggleLivePositions(): void {
    const dialog = this.port.dialog();
    if (!previewState(dialog) || dialog.outcome || dialog.busy || dialog.retrying || !dialog.report.liveMissingPositions.length) return;
    if (this.refreshChanged(dialog)) return;
    void this.preview(!dialog.removeLiveMissingPositions, dialog.removeInvalidMissingPositions, !!dialog.replacesUndo);
  }

  public toggleInvalidPositions(): void {
    const d = this.port.dialog();
    if (!previewState(d) || d.outcome || d.busy || d.retrying || (d.changed && !d.preflight?.ok)
      || !d.report.invalidPositionsEligible.length) return;
    if (this.refreshChanged(d)) return;
    void this.preview(d.removeLiveMissingPositions, !d.removeInvalidMissingPositions, !!d.replacesUndo);
  }

  private refreshChanged(d: OptimizePreviewState): boolean {
    if (this.options.sourceMatches(d.source, this.port.source())) return false;
    this.preview(false, false);
    this.port.showToast(this.port.t('gs.optimize_preview_changed'), 'gs.optimize_preview_changed');
    return true;
  }

  /**
   * #869 «Check again»: one bounded reload of the HA registries, then the same
   * preview again. The report never changes by itself (it is the exact pair
   * Apply writes), and only the dialog that asked takes the answer: a closed
   * or reopened dialog discards it.
   */
  public async retryRegistry(): Promise<void> {
    const dialog = this.port.dialog();
    if (!previewState(dialog) || dialog.busy || dialog.retrying) return;
    const pending = { ...dialog, retrying: true, retryFailed: false };
    this.port.setDialog(pending);
    const complete = await (this.planPort().refreshRegistry?.(this.registryRetryMs) ?? Promise.resolve(false));
    if (this.port.dialog() !== pending) return;
    // New evidence requires a new opt-in; never carry deletion consent across a refresh.
    if (complete) await this.preview(false, false, (!!dialog.outcome && dialog.canUndo === true) || !!dialog.replacesUndo);
    if (this.port.dialog() === pending) {
      this.port.setDialog({ ...pending, retrying: false, retryFailed: !complete });
    }
  }

  /**
   * The backend persists an intent before either store changes, then keeps a
   * one-deep snapshot that remains undoable until the next plan edit.
   */
  public async run(): Promise<void> {
    const showToast = this.port.captureToast?.() ?? ((message: string, id?: string) => this.port.showToast(message, id));
    const d = this.port.dialog();
    if (!this.port.canWrite()) {
      this.port.showToast(this.port.t('gs.optimize_write_required'), 'gs.optimize_write_required');
      return;
    }
    if (!previewState(d) || d.outcome || d.retrying || this.operation || this.uncertain) return;
    if (d.busy || !this.port.config() || !d.changed || !d.preflight?.ok) return;
    if (!this.options.sourceMatches(d.source, this.port.source())) {
      await this.preview(false, false);
      this.port.showToast(this.port.t('gs.optimize_preview_changed'), 'gs.optimize_preview_changed');
      return;
    }
    const pending: OptimizePreviewState = { ...d, busy: true, phase: 'saving' };
    const owner = { state: pending as OptimizePlansDialogState };
    this.operation = owner;
    this.port.setDialog(pending);
    let commitStarted = false;
    let accepted = false;
    try {
      await this.port.present();
      if (!this.owns(d.source) || this.operation !== owner) return;
      if (d.preflight.fingerprint !== contentFingerprint(d.config)) {
        const preflight = this.port.checkGeometry(d.config);
        this.reportPreflightFailure(preflight, d.config);
        if (!preflight.ok) { this.publish(owner, { ...d, preflight, busy: false }); return; }
      }
      this.port.clearGeometryGesture();
      commitStarted = true;
      const receipt = await this.port.commit(d.config, d.layout, {
        source: d.source, current: () => this.port.source(), canWrite: () => this.port.canWrite(),
      });
      accepted = true;
      await this.finishResult(owner, d, receipt);
      if (this.owns(d.source) && (!this.port.dialog() || this.port.dialog() === owner.state))
        showToast(this.port.t('gs.optimize_saved_title'), 'gs.optimize_saved_title');
    } catch (error) {
      if (this.operation !== owner || !this.owns(d.source)) return;
      if (accepted || (this.options.feedback.isWriteFailure(error) && error.stage === 'acknowledged')) {
        this.publish(owner, { ...d, phase: 'result', busy: false, outcome: 'unchecked' });
        return;
      }
      // A bare rejection from a writer is conservatively post-dispatch. Only
      // the narrow writer's evidence can prove a before-dispatch refusal.
      const failure = this.options.feedback.failure(error, d.config,
        this.options.feedback.isWriteFailure(error) ? error.stage : commitStarted ? 'dispatched' : 'checking');
      const next: OptimizeStatusState = { phase: failure.kind === 'unknown' ? 'unknown' : 'failure',
        source: d.source, config: d.config, busy: false, failure };
      this.publish(owner, next);
      if (next.phase === 'unknown') this.uncertain = next;
      if (!this.port.dialog() || this.port.dialog() === owner.state) {
        const toastKey = next.phase === 'unknown' ? 'gs.optimize_unknown_title' : 'gs.optimize_failed_title';
        showToast(this.port.t(toastKey), toastKey);
      }
      if (failure.kind === 'changed' && this.port.canWrite()) {
        this.operation = null;
        await this.refresh();
      }
    } finally {
      if (this.operation === owner) this.operation = null;
    }
  }

  private async finishResult(owner: { state: OptimizePlansDialogState }, d: OptimizePreviewState,
    receipt: OptimizeReceipt): Promise<void> {
    if (!this.owns(d.source) || this.operation !== owner) return;
    this.publish(owner, { ...d, phase: 'verifying', busy: true });
    let outcome: NonNullable<OptimizePreviewState['outcome']> = 'unchecked';
    let afterReport: OptimizeReport | undefined;
    let source = this.port.source();
    try {
      if (!receipt.canonical && await this.port.reloadAfterConflict() !== 'adopted')
        throw new Error('Canonical pair unavailable');
      source = this.port.source();
      if (source.configRev !== receipt.configRev || source.layoutRev !== receipt.layoutRev
        || (receipt.canonical && (source.configFingerprint !== contentFingerprint(receipt.config)
          || source.layoutFingerprint !== contentFingerprint(receipt.layout)))) outcome = 'stale';
      else {
        await this.port.present();
        if (!this.port.canWrite() || !this.options.sourceMatches(source, this.port.source())) outcome = 'stale';
        else {
          const result = this.options.optimize(this.port.config()!, this.port.layout() || {},
            this.port.referenceContext(d.removeLiveMissingPositions, d.removeInvalidMissingPositions));
          afterReport = result.report;
          outcome = !this.options.sourceMatches(source, this.port.source()) ? 'stale'
            : result.changed ? 'remaining' : optimizeHasObservations(result.report) ? 'limited' : 'clean';
        }
      }
    } catch { /* The save already succeeded. A failed postcheck is not a rejected save. */ }
    this.publish(owner, { ...d, source, phase: 'result', busy: false, outcome, afterReport, canUndo: receipt.canUndo });
  }

  private recheck = (): void => {
    const d = this.port.dialog();
    if (previewState(d) && !d.busy) void this.preview(false, false, (!!d.outcome && d.canUndo === true) || !!d.replacesUndo);
  };

  private refresh = async (): Promise<void> => {
    const d = this.port.dialog();
    if (!d || d.busy || this.operation) return;
    const uncertain = this.uncertain;
    const pending: OptimizeStatusState = { phase: 'refreshing', config: this.port.config(),
      source: this.port.source(), busy: true };
    const owner = { state: pending as OptimizePlansDialogState };
    this.operation = owner;
    this.port.setDialog(pending);
    let refreshed: OptimizeReloadResult = 'failed';
    try { refreshed = await this.port.reloadAfterConflict(); } catch { /* A rejected read is not adoption. */ }
    if (this.operation !== owner || !this.owns(pending.source)) return;
    if (refreshed === 'adopted') {
      const visible = this.port.dialog() === pending;
      this.uncertain = null; this.operation = null;
      if (visible) await this.preview(false, false);
    } else {
      const failed: OptimizeStatusState = uncertain ? { ...uncertain, refreshFailed: true }
        : { ...pending, phase: 'failure', busy: false, refreshFailed: true,
          failure: this.options.feedback.failure({ code: 'conflict' }, pending.config, 'refreshing') };
      this.publish(owner, failed);
      if (uncertain) this.uncertain = failed;
      this.operation = null;
    }
  };

  /**
   * #869: records that could not be matched. One explanation (they belong to
   * floors that are gone, are not drawn and can stay), the count per cause,
   * the registry line with «Check again» when this analysis ran on incomplete
   * HA data, and the support copy whenever the geometry check did not refuse.
   */
  private renderUnverified(d: OptimizePreviewState, failed: boolean): TemplateResult {
    const items = d.report.unverifiedPositions;
    const groups: Record<UnverifiedGroup, SpaceReferencePositionDetail[]> = {
      legacy_group: [], unknown_owner: [], registry_unavailable: [],
    };
    for (const item of items) groups[unverifiedGroup(item)].push(item);
    const hass = { areas: this.planPort().environment.registry.areas };
    const names = groups.legacy_group.map((item) => unverifiedName(hass, item)).filter(Boolean);
    const more = Math.max(0, names.length - 3);
    const legacyNames = names.length
      ? this.port.t('gs.optimize_live_names', {
          names: names.slice(0, 3).join(', '),
          more: more ? this.port.t('gs.optimize_reference_more', { n: String(more) }) : '',
        })
      : '';
    const limited = d.report.registryAuthoritative === false;
    const line = (n: number, key: SettingsI18nKey, vars: Record<string, string> = {}) => (n
      ? html`<li>${this.port.t(key, { n: String(n), ...vars })}</li>` : nothing);
    return html`<div class="optimize-unverified">
      <p class="alignmsg">${this.port.t('gs.optimize_unverified', { n: String(items.length) })}</p>
      <p class="rhint">${this.port.t('gs.optimize_unverified_safe')}</p>
      <ul>
        ${line(groups.legacy_group.length, 'gs.optimize_unverified_legacy', { names: legacyNames })}
        ${line(groups.unknown_owner.length, 'gs.optimize_unverified_unknown')}
        ${line(groups.registry_unavailable.length, 'gs.optimize_unverified_unchecked')}
      </ul>
      ${limited ? html`<div class="optimize-registry" role="status">
          <p class="rhint">${this.port.t('gs.optimize_registry_limited')}</p>
          ${d.retryFailed ? html`<p class="rhint">${this.port.t('gs.optimize_registry_still_limited')}</p>` : nothing}
        </div>` : nothing}
      ${limited || !failed ? html`<div class="optimize-actions">
          ${limited ? html`<button class="btn ghost optimize-action optimize-retry" type="button"
            ?disabled=${d.busy || !!d.retrying} @click=${() => this.retryRegistry()}>
            <ha-icon icon="mdi:refresh"></ha-icon>${this.port.t('gs.optimize_retry')}
          </button>` : nothing}
          ${failed ? nothing : html`<button class="btn ghost optimize-action optimize-copy" type="button"
            @click=${() => this.copyDiagnostics()}>
            <ha-icon icon="mdi:content-copy"></ha-icon>${this.port.t('gs.preflight_copy')}
          </button>`}
        </div>` : nothing}
      ${this.fallbackBlock(failed ? null : this.clipboardFallback)}
    </div>`;
  }

  /** #295: the copy text, selectable inline when the clipboard refused it. */
  private fallbackBlock(text: string | null): TemplateResult | typeof nothing {
    return text ? html`<details open>
      <summary>${this.port.t('gs.preflight_copy')}</summary>
      <pre style="user-select:text;white-space:pre-wrap">${text}</pre>
    </details>` : nothing;
  }

  /**
   * The confirmation separates geometry movement from lossless maintenance,
   * and promises the one-deep undo before either store is changed.
   */
  render(): TemplateResult | typeof nothing {
    const state = this.port.dialog();
    if (!state) return nothing;
    if (!previewState(state)) return this.options.feedback.renderStatus(state, {
      ...this.port, close: this.close, refresh: this.refresh, copy: () => this.copyDiagnostics(),
      support: this.support, fallback: this.clipboardFallback,
    });
    const d = state;
    const r = d.report;
    const applied = !!d.outcome || d.phase === 'verifying';
    const failed = !applied && d.changed && !d.preflight?.ok;
    const failures = d.preflight?.failures || [];
    const visibleNames = failures.slice(0, 3).map((failure) => failure.displayName);
    const spaces = visibleNames.length
      ? visibleNames.join(', ')
      : this.port.t('gs.align_preflight_space', { n: '1' });
    const remaining = Math.max(0, failures.length - visibleNames.length);
    const more = remaining
      ? this.port.t('gs.align_preflight_more', { n: String(remaining) })
      : '';
    const repaired = r.spaceRefsRemapped + r.roomRefsRemapped
      + r.positionsRemapped + r.markersDetached;
    const scalarMaintenance = r.migrated + r.canonicalized + r.coordsCanonicalized
      + r.wallsMerged + r.spansMerged + r.partitionsMerged;
    const modelMaintenance = scalarMaintenance
      + r.wallSegmentsMigrated
      + r.roomDraftsMigrated + r.roomDraftSegmentsMigrated
      + r.legacyZeroWallsMigrated;
    const gridWarning = r.moved + r.rotated + r.coordsCanonicalized + r.wallsStraightened;
    const straightenCm = Math.ceil(r.maxStraightenShiftCm * 10) / 10;
    const straightenSpace = (this.port.config()?.spaces || []).find(
      (space) => String(space?.id || '') === r.maxStraightenSpace,
    );
    const straightenWhere = (this.port.config()?.spaces || []).length > 1 && straightenSpace
      ? String(straightenSpace.title || straightenSpace.id) : '';
    const removed = r.orphanRoomLabelsRemoved + r.orphanDevicePositionsRemoved
      + r.orphanGroupPositionsRemoved;
    const invalidEligible = r.invalidPositionsEligible;
    const invalidRetained = r.invalidPositionsRetained;
    const liveNames = r.liveMissingPositions.map((item) => item.name).filter(Boolean);
    const visibleLiveNames = liveNames.slice(0, 3).join(', ');
    const remainingLiveNames = Math.max(0, liveNames.length - 3);
    const liveNamesText = visibleLiveNames
      ? this.port.t('gs.optimize_live_names', {
          names: visibleLiveNames,
          more: remainingLiveNames
            ? this.port.t('gs.optimize_reference_more', { n: String(remainingLiveNames) }) : '',
        })
      : '';
    const hass = { areas: this.planPort().environment.registry.areas };
    const detailStatus = (item: typeof r.removedPositions[number]): string => {
      if (r.removedPositions.some((removedItem) => removedItem.id === item.id)) {
        return this.port.t('gs.optimize_detail_removed');
      }
      if (r.liveMissingPositions.some((liveItem) => liveItem.id === item.id)) {
        return this.port.t('gs.optimize_detail_live');
      }
      return this.port.t('gs.optimize_detail_unverified');
    };
    const detailKind = (kind: typeof r.removedPositions[number]['kind']): string => this.port.t(
      kind === 'room_label' ? 'gs.optimize_detail_room_label'
        : kind === 'group' ? 'gs.optimize_detail_group'
        : kind === 'device' ? 'gs.optimize_detail_device'
        : kind === 'legacy_group' ? 'gs.optimize_detail_legacy_group'
        : 'gs.optimize_detail_unknown',
    );
    // #869 п. 10: a known name first, then the id; otherwise as before.
    const detailText = (item: SpaceReferencePositionDetail): string => {
      const name = unverifiedName(hass, item);
      const base = { status: detailStatus(item), kind: detailKind(item.kind) };
      return name
        ? this.port.t('gs.optimize_detail_item_named', { ...base, name, id: item.id, space: item.spaceId })
        : this.port.t('gs.optimize_detail_item', { ...base, id: item.id, space: item.spaceId });
    };
    const referenceDetails = [
      ...r.removedPositions,
      ...r.liveMissingPositions.filter((item) => (
        !r.removedPositions.some((removedItem) => removedItem.id === item.id)
      )),
      ...r.unverifiedPositions,
    ];
    const visibleDetails = referenceDetails.slice(0, 10);
    const remainingDetails = Math.max(0, referenceDetails.length - visibleDetails.length);
    return html`<hp-dialog form-shell settings-layout compact wide class="ui-dialog" .hass=${this.planPort().environment.presentation} data-kind="settings" .title=${this.port.t('gs.align_title')} icon="mdi:broom"
      dismiss-on-scrim @hp-close=${this.close}>
        <div class="body">
          ${d.busy ? html`<p class="alignmsg" role="status" aria-live="polite"><ha-icon class="hpf-spinner" icon="mdi:loading"></ha-icon>${this.port.t(d.phase === 'verifying' ? 'gs.optimize_verifying' : 'gs.optimize_saving')}</p>
            <p class="rhint">${this.port.t('gs.optimize_close_hint')}</p>` : nothing}
          ${d.outcome ? html`<h3 class="hpf-section-heading" role="status">${this.port.t(d.outcome === 'clean' ? 'gs.optimize_success_title' : 'gs.optimize_saved_title')}</h3>
            <p class="alignmsg">${this.port.t(`gs.optimize_result_${d.outcome}`)}</p>
            <h3 class="hpf-section-heading">${this.port.t('gs.optimize_applied')}</h3>` : nothing}
          ${d.replacesUndo || (d.outcome === 'remaining' && d.canUndo) ? html`<p class="rhint">${this.port.t('gs.optimize_replaces_undo')}</p>` : nothing}
          ${failed
            ? html`
              <p class="alignmsg">${this.port.t('gs.align_preflight_failed', { spaces, more })}</p>
              ${failures.slice(0, 10).map((failure) => html`<p class="alignmsg">
                ${failure.displayName}: ${this.port.t(`gs.preflight_reason_${failure.reason}` as I18nKey)}
              </p>`)}
              ${failures.length > 10 ? html`<p class="alignmsg">
                ${this.port.t('gs.align_preflight_more', { n: String(failures.length - 10) })}
              </p>` : nothing}
              <div class="rhint">${this.port.t('gs.optimize_not_applied')}</div>
              <div class="rhint">${this.port.t('gs.optimize_geometry_help')}</div>
              <div class="row">
                <button class="btn ghost" @click=${() => this.copyDiagnostics()}>
                  <ha-icon icon="mdi:content-copy"></ha-icon>
                  ${this.port.t('gs.preflight_copy')}
                </button>
                <button class="btn ghost optimize-support" @click=${this.support}>${this.port.t('gs.optimize_support')}</button>
              </div>
              ${this.fallbackBlock(this.clipboardFallback)}`
            : !d.changed
            ? html`${!optimizeHasObservations(r) ? html`<h3 class="hpf-section-heading" role="status">${this.port.t('gs.optimize_clean_title')}</h3>` : nothing}
              <p class="alignmsg">${this.port.t(
                r.liveMissingPositions.length || r.nestedRefsUnresolved || r.wallsStraightenSkipped
                  || r.invalidPositionsRetained.length || (r.registryAuthoritative === false && !r.unverifiedPositions.length)
                  ? 'gs.optimize_no_automatic_changes'
                  // #869 п. 1: unmatched records alone ask nothing of the person.
                  : r.unverifiedPositions.length ? 'gs.optimize_no_changes' : 'gs.align_none',
              )}</p>`
            : html`
          ${applied && (gridWarning || r.rotated || r.partitionsReconciled || r.openingsRehosted || r.openingParametersCanonicalized) ? html`<h4 class="hpf-section-heading">${this.port.t('gs.optimize_group_geometry')}</h4>` : nothing}
          ${r.moved ? html`<p class="alignmsg">${this.port.t(applied ? 'gs.optimize_applied_count' : 'gs.align_count', {
                  n: String(r.moved), total: String(r.total), cm: String(d.cm),
                })}</p>` : nothing}
              ${r.currentPositionsMoved ? html`<p class="alignmsg">${this.port.t('gs.optimize_visible_positions', {
                  n: String(r.currentPositionsMoved), total: String(r.currentPositions),
                })}</p>` : nothing}
              ${r.archivedPositions ? html`<p class="alignmsg">${this.port.t('gs.optimize_missing_space_positions', {
                  n: String(r.archivedPositionsMoved), total: String(r.archivedPositions),
                })}</p>` : nothing}
              ${d.where
                ? html`<p class="alignmsg">${this.port.t('gs.align_where', { s: d.where })}</p>`
                : nothing}
              ${r.rotated
                ? html`<p class="alignmsg">${this.port.t('gs.align_turned', { n: String(r.rotated) })}</p>`
                : nothing}
              ${r.partitionsReconciled ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_coincident_partitions', { n: String(r.partitionsReconciled) },
                )}</p>` : nothing}
              ${r.openingsRehosted ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_openings_rehosted', { n: String(r.openingsRehosted) },
                )}</p>` : nothing}
              ${r.openingParametersCanonicalized ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_opening_parameters', { n: String(r.openingParametersCanonicalized) },
                )}</p>` : nothing}
              ${r.wallsStraightened ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_walls_straightened', {
                    n: String(r.wallsStraightened), cm: String(straightenCm),
                  },
                )}</p>` : nothing}
              ${straightenWhere ? html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_walls_straightened_where', { s: straightenWhere },
                )}</p>` : nothing}
              ${applied && (modelMaintenance || r.glowSpacesMigrated || r.glowRoomsMigrated || r.latticeCoordinatesCanonicalized) ? html`<h4 class="hpf-section-heading">${this.port.t('gs.optimize_group_model')}</h4>` : nothing}
              ${r.latticeCoordinatesCanonicalized ? html`
                <p class="alignmsg">${this.port.t('gs.optimize_lattice_summary', {
                  n: String(r.latticeCoordinatesCanonicalized),
                  cm: formatLatticeShiftCm(r.latticeMaxShiftCm),
                })}</p>
                ${r.latticeSpaces.map((space) => html`<p class="alignmsg">${this.port.t(
                  'gs.optimize_lattice_space', {
                    space: space.space,
                    n: String(space.canonicalized),
                    far: String(space.far),
                  },
                )}</p>`)}
              ` : nothing}
              ${r.wallSegmentsMigrated ? html`<p class="alignmsg">${this.port.t(
                  'gs.wall_segments_migrated', { n: String(r.wallSegmentsMigrated) },
                )}</p>` : nothing}
              ${r.roomDraftsMigrated || r.roomDraftSegmentsMigrated ? html`
                <p class="alignmsg">${this.port.t('gs.room_drafts_migrated', {
                  drafts: String(r.roomDraftsMigrated),
                  segments: String(r.roomDraftSegmentsMigrated),
                })}</p>` : nothing}
              ${r.legacyZeroWallsMigrated ? html`<p class="alignmsg">${this.port.t(
                  'gs.zero_walls_migrated', { n: String(r.legacyZeroWallsMigrated) },
                )}</p>` : nothing}
              ${scalarMaintenance ? html`<p class="alignmsg">${this.port.t('gs.optimize_changes', {
                  m: String(r.migrated), c: String(r.canonicalized),
                  p: String(r.coordsCanonicalized), w: String(r.wallsMerged),
                  s: String(r.spansMerged), i: String(r.partitionsMerged),
                })}</p>` : nothing}
              ${r.glowSpacesMigrated || r.glowRoomsMigrated
                ? html`<p class="alignmsg">${this.port.t('gs.optimize_glow_migration', {
                    spaces: String(r.glowSpacesMigrated),
                    rooms: String(r.glowRoomsMigrated),
                  })}</p>`
                : nothing}
              ${gridWarning && !applied ? html`<div class="rhint">${this.port.t('gs.align_warn')}</div>` : nothing}`}
          ${!failed && !applied && r.wallsStraightenSkipped ? html`<p class="rhint">${this.port.t(
              'gs.optimize_walls_straighten_skipped', {
                n: String(r.wallsStraightenSkipped),
              },
            )}</p>` : nothing}
          ${applied && (repaired || removed) ? html`<h4 class="hpf-section-heading">${this.port.t('gs.optimize_group_references')}</h4>` : nothing}
          ${repaired && !failed
            ? html`<p class="alignmsg">${this.port.t('gs.optimize_references', {
                spaces: String(r.spaceRefsRemapped), rooms: String(r.roomRefsRemapped),
                positions: String(r.positionsRemapped), detached: String(r.markersDetached),
              })}</p>`
            : nothing}
          ${removed && !failed
            ? html`<p class="alignmsg">${this.port.t('gs.optimize_orphans_removed', {
                total: String(removed),
                rooms: String(r.orphanRoomLabelsRemoved),
                devices: String(r.orphanDevicePositionsRemoved),
                groups: String(r.orphanGroupPositionsRemoved),
              })}</p>`
            : nothing}
          ${r.liveMissingPositions.length && !applied && !failed
            ? html`<div class="optimize-live">
                <p class="alignmsg">${this.port.t(d.removeLiveMissingPositions
                  ? 'gs.optimize_live_positions_remove' : 'gs.optimize_live_positions', {
                  n: String(r.liveMissingPositions.length), names: liveNamesText,
                })}</p>
                <button class="btn ghost optimize-cleanup" type="button"
                  aria-pressed=${d.removeLiveMissingPositions ? 'true' : 'false'}
                  @click=${() => this.toggleLivePositions()} ?disabled=${d.busy || !!d.retrying}>
                  <ha-icon icon=${d.removeLiveMissingPositions ? 'mdi:undo' : 'mdi:map-marker-remove-outline'}></ha-icon>
                  ${this.port.t(d.removeLiveMissingPositions
                    ? 'gs.optimize_live_keep' : 'gs.optimize_live_remove')}
                </button>
                ${d.removeLiveMissingPositions
                  ? html`<div class="rhint optimize-selected" role="status">
                      ${this.port.t('gs.optimize_live_selected')}
                    </div>`
                  : nothing}
              </div>`
            : nothing}
          ${r.unverifiedPositions.length && !applied ? this.renderUnverified(d, failed) : nothing}
          ${!applied && !failed && (invalidEligible.length || invalidRetained.length) ? html`<div class="optimize-invalid">
              <p class="alignmsg">${this.port.t('gs.optimize_invalid_eligible', {
                n: String(invalidEligible.length),
              })}</p>
              <p class="rhint">${this.port.t('gs.optimize_invalid_hint')}</p>
              <button class="btn ghost optimize-action optimize-invalid-cleanup" type="button"
                aria-pressed=${d.removeInvalidMissingPositions ? 'true' : 'false'}
                ?disabled=${!invalidEligible.length || d.busy || !!d.retrying || failed || !this.port.canWrite()}
                @click=${() => this.toggleInvalidPositions()}>
                <ha-icon icon=${d.removeInvalidMissingPositions ? 'mdi:undo' : 'mdi:broom'}></ha-icon>
                ${this.port.t(d.removeInvalidMissingPositions
                  ? 'gs.optimize_invalid_keep' : 'gs.optimize_invalid_remove')}
              </button>
              ${!invalidEligible.length ? html`<p class="rhint">${this.port.t('gs.optimize_invalid_none_safe')}</p>` : nothing}
              ${d.removeInvalidMissingPositions ? html`<p class="rhint" role="status">
                ${this.port.t('gs.optimize_invalid_selected', { n: String(r.invalidPositionsRemoved.length) })}
              </p>` : nothing}
              ${invalidRetained.length ? html`<p class="rhint">${this.port.t('gs.optimize_invalid_retained', {
                  n: String(invalidRetained.length),
                })}</p>
                <ul>${(['live_owner', 'unknown_shape', 'registry_unavailable', 'unsupported_model'] as const)
                  .map((reason) => {
                    const n = invalidRetained.filter((item) => item.cleanupReason === reason).length;
                    return n ? html`<li>${this.port.t(`gs.optimize_invalid_${reason}`, { n: String(n) })}</li>` : nothing;
                  })}</ul>` : nothing}
            </div>` : nothing}
          ${r.nestedRefsUnresolved && !failed && !applied
            ? html`<div class="rhint" role="alert">${this.port.t('gs.optimize_vacuum_warning', {
                n: String(r.nestedRefsUnresolved),
              })}</div>`
            : nothing}
          ${!failed ? (d.vacuumNames || []).map((name) => html`<p class="rhint">${this.port.t('gs.optimize_vacuum_action', { name })}</p>`) : nothing}
          ${!failed ? this.port.ledNote() : nothing}
          ${d.outcome && d.afterReport && optimizeHasObservations(d.afterReport) ? html`
            <h3 class="hpf-section-heading">${this.port.t('gs.optimize_remaining')}</h3>
            ${d.afterReport.unverifiedPositions.length || d.afterReport.registryAuthoritative === false
              ? this.renderUnverified({ ...d, report: d.afterReport }, false) : nothing}
            ${d.afterReport.wallsStraightenSkipped ? html`<p class="rhint">${this.port.t('gs.optimize_walls_straighten_skipped', { n: String(d.afterReport.wallsStraightenSkipped) })}</p>` : nothing}
            ${d.afterReport.liveMissingPositions.length ? html`<p class="rhint">${this.port.t('gs.optimize_retained_positions', { n: String(d.afterReport.liveMissingPositions.length) })}</p>` : nothing}
            ${d.afterReport.nestedRefsUnresolved ? html`<p class="rhint">${this.port.t('gs.optimize_vacuum_warning', { n: String(d.afterReport.nestedRefsUnresolved) })}</p>` : nothing}
            ${d.afterReport.invalidPositionsRetained.length ? html`<p class="rhint">${this.port.t('gs.optimize_invalid_retained', { n: String(d.afterReport.invalidPositionsRetained.length) })}</p>` : nothing}
            ` : nothing}
          ${d.outcome && d.outcome !== 'clean' ? html`<div class="optimize-actions">
            ${!d.afterReport?.unverifiedPositions.length ? html`<button class="btn ghost optimize-copy" @click=${() => this.copyDiagnostics()}>${this.port.t('gs.preflight_copy')}</button>` : nothing}
            <button class="btn ghost optimize-support" @click=${this.support}>${this.port.t('gs.optimize_support')}</button>
          </div>${!d.afterReport?.unverifiedPositions.length ? this.fallbackBlock(this.clipboardFallback) : nothing}` : nothing}
          ${referenceDetails.length && !failed
            ? html`<details class="optimize-details">
                <summary>${this.port.t('gs.optimize_details')}</summary>
                <ul>
                  ${visibleDetails.map((item) => html`<li>${detailText(item)}</li>`)}
                </ul>
                ${remainingDetails
                  ? html`<div class="rhint">${this.port.t('gs.optimize_details_more', {
                      n: String(remainingDetails),
                    })}</div>`
                  : nothing}
              </details>`
            : nothing}
        </div>
        <div class="row" slot="footer">
          <span class="spacer"></span>
          <button class="btn ghost" data-hp="dialog-cancel" @click=${this.close}>${this.port.t(
            d.changed && !d.busy && !applied ? 'btn.cancel' : 'btn.close',
          )}</button>
          ${d.outcome && d.outcome !== 'clean' ? html`<button class="btn ghost optimize-recheck" @click=${d.outcome === 'stale' ? this.refresh : this.recheck}>${this.port.t(d.outcome === 'stale' ? 'gs.optimize_refresh' : 'gs.optimize_recheck')}</button>` : nothing}
          ${applied || !d.changed || !d.preflight?.ok ? nothing : html`
            <button class="btn on" data-hp="dialog-confirm" @click=${() => this.run()} ?disabled=${d.busy || !!d.retrying || !this.port.canWrite()}>
              <ha-icon class=${d.busy ? 'hpf-spinner' : ''} icon=${d.busy ? 'mdi:loading' : 'mdi:check'}></ha-icon>${this.port.t(d.busy ? 'gs.optimize_saving' : d.removeInvalidMissingPositions ? 'gs.optimize_apply_changes' : 'gs.align_run')}
            </button>`}
        </div>
    </hp-dialog>`;
  }
}
