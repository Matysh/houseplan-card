/**
 * #869: «Оптимизировать планы» — свой ленивый чанк. Рантайм редактора держит
 * только этот загрузчик; диалог, его отчёт о непроверенных записях и помощники
 * грузятся при первом открытии (или при первом отказе preflight копии
 * пространства — ради dev-лога), а не входят в статический граф редактора.
 *
 * Строки диалога, появившиеся в #869, живут в ленивом словаре `settings`
 * (приём #600/#627): здесь порт получает переводчик, который сначала смотрит
 * туда, затем в основной каталог карточки.
 */
import { nothing, type TemplateResult } from 'lit';

import type { I18nKey, Lang } from './i18n';
import { hasSettingsTranslation, settingsT } from './i18n/settings';
import type { OptimizePlansDialog, OptimizePlansDialogPort } from './optimize-plans-dialog';
import type { OptimizeGeometryPreflightResult } from './plan-geometry-preflight';
import { sameOptimizeSource } from './optimize-source';
import type { ServerConfig } from './types';
import { optimizeFailure, optimizeFailureDiagnostics, OptimizeWriteFailure, type OptimizeStatusState } from './optimize-feedback';
import { renderOptimizeStatus } from './optimize-status';

/** The runtime's port: the card's own catalog only; the loader adds `settings`. */
export type OptimizePlansHostPort = Omit<OptimizePlansDialogPort, 't'> & {
  t(key: I18nKey, vars?: Record<string, string | number>): string;
};

export class LazyOptimizePlansDialog {
  private dialog: OptimizePlansDialog | null = null;
  private loading: Promise<OptimizePlansDialog> | null = null;
  private lifecycle = {};

  public constructor(
    private readonly port: OptimizePlansHostPort,
    private readonly lang: () => Lang,
  ) {}

  /** The loaded dialog; a failed import is retried on the next call. */
  public load(): Promise<OptimizePlansDialog> {
    if (this.dialog) return Promise.resolve(this.dialog);
    this.loading ??= Promise.all([import('./optimize-plans-dialog'), import('./plan-optimizer')]).then(([{ OptimizePlansDialog: Dialog }, { optimizePlans }]) => {
      const port = this.port;
      this.dialog = new Dialog({
        ...port,
        t: (key, vars) => (hasSettingsTranslation(this.lang(), key)
          ? settingsT(this.lang(), key, vars) : port.t(key as I18nKey, vars)),
      }, { optimize: optimizePlans, sourceMatches: sameOptimizeSource, feedback: {
        failure: optimizeFailure, diagnostics: optimizeFailureDiagnostics,
        isWriteFailure: (error): error is OptimizeWriteFailure => error instanceof OptimizeWriteFailure,
        renderStatus: renderOptimizeStatus,
      } });
      return this.dialog;
    }, (error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  private async withDialog(action: (dialog: OptimizePlansDialog) => unknown): Promise<void> {
    const showToast = this.port.captureToast?.() ?? ((message: string, id?: string) => this.port.showToast(message, id));
    let dialog: OptimizePlansDialog;
    try {
      dialog = await this.load();
    } catch {
      showToast(`${this.port.t('editor.load_failed')} ${this.port.t('editor.retry_advice')}`);
      return;
    }
    await action(dialog);
  }

  public get clipboardFallback(): string | null { return this.dialog?.clipboardFallback ?? null; }
  public open(): Promise<void> {
    if (!this.port.canWrite()) {
      this.port.showToast(settingsT(this.lang(), 'gs.optimize_write_required'), 'gs.optimize_write_required');
      return Promise.resolve();
    }
    if (this.dialog) return Promise.resolve(this.dialog.open());
    const source = this.port.source(), lifecycle = this.lifecycle;
    const pending: OptimizeStatusState = { phase: 'loading', config: this.port.config(), source, busy: true };
    this.port.setDialog(pending);
    return (async () => {
      await this.port.present();
      if (this.lifecycle !== lifecycle || this.port.dialog() !== pending || source.authorityCurrent?.() === false) return;
      try {
        const dialog = await this.load();
        if (this.lifecycle === lifecycle && this.port.dialog() === pending
          && this.port.source().connection === source.connection && source.authorityCurrent?.() !== false)
          await dialog.open();
      } catch (error) {
        if (this.lifecycle === lifecycle && this.port.dialog() === pending
          && this.port.source().connection === source.connection && source.authorityCurrent?.() !== false)
          this.port.setDialog({ ...pending, phase: 'failure', busy: false,
            failure: optimizeFailure(error, pending.config, 'loading') });
      }
    })();
  }
  public retire(): void { this.lifecycle = {}; this.dialog?.retire(); }
  public preview(removeLive: boolean): Promise<void> {
    return this.withDialog((dialog) => dialog.preview(removeLive));
  }
  /** A dev log only: a dialog that cannot load must not raise a second error. */
  public async reportPreflightFailure(
    preflight: OptimizeGeometryPreflightResult, candidate: ServerConfig | null,
  ): Promise<void> {
    if (preflight.ok) return;
    try { (await this.load()).reportPreflightFailure(preflight, candidate); } catch { /* best effort */ }
  }
  public toggleLivePositions(): void { this.dialog?.toggleLivePositions(); }
  public async run(): Promise<void> { await this.dialog?.run(); }
  public async retryRegistry(): Promise<void> { await this.dialog?.retryRegistry(); }
  public async copyDiagnostics(): Promise<void> { await this.dialog?.copyDiagnostics(); }

  /** A state written before the chunk arrived paints once it has loaded. */
  public render(): TemplateResult | typeof nothing {
    if (this.dialog) return this.dialog.render();
    const state = this.port.dialog();
    if (!state || 'report' in state) return nothing;
    return renderOptimizeStatus(state, {
      ...this.port,
      t: (key, vars) => hasSettingsTranslation(this.lang(), key)
        ? settingsT(this.lang(), key, vars) : this.port.t(key as I18nKey, vars),
      close: () => this.port.setDialog(null),
      refresh: () => this.open(),
      support: undefined,
    });
  }
}
