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
import { optimizePlans } from './plan-optimizer';
import { sameOptimizeSource } from './optimize-source';
import type { ServerConfig } from './types';

/** The runtime's port: the card's own catalog only; the loader adds `settings`. */
export type OptimizePlansHostPort = Omit<OptimizePlansDialogPort, 't'> & {
  t(key: I18nKey, vars?: Record<string, string | number>): string;
};

export class LazyOptimizePlansDialog {
  private dialog: OptimizePlansDialog | null = null;
  private loading: Promise<OptimizePlansDialog> | null = null;

  public constructor(
    private readonly port: OptimizePlansHostPort,
    private readonly lang: () => Lang,
  ) {}

  /** The loaded dialog; a failed import is retried on the next call. */
  public load(): Promise<OptimizePlansDialog> {
    if (this.dialog) return Promise.resolve(this.dialog);
    this.loading ??= import('./optimize-plans-dialog').then(({ OptimizePlansDialog: Dialog }) => {
      const port = this.port;
      this.dialog = new Dialog({
        ...port,
        t: (key, vars) => (hasSettingsTranslation(this.lang(), key)
          ? settingsT(this.lang(), key, vars) : port.t(key as I18nKey, vars)),
      }, { optimize: optimizePlans, sourceMatches: sameOptimizeSource });
      return this.dialog;
    }, (error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  private async withDialog(action: (dialog: OptimizePlansDialog) => unknown): Promise<void> {
    let dialog: OptimizePlansDialog;
    try {
      dialog = await this.load();
    } catch {
      this.port.showToast(`${this.port.t('editor.load_failed')} ${this.port.t('editor.retry_advice')}`);
      return;
    }
    await action(dialog);
  }

  public get clipboardFallback(): string | null { return this.dialog?.clipboardFallback ?? null; }
  public open(): Promise<void> {
    if (!this.port.canWrite()) {
      this.port.showToast(settingsT(this.lang(), 'gs.optimize_write_required'));
      return Promise.resolve();
    }
    const connection = this.port.source().connection;
    return this.withDialog((dialog) => {
      if (this.port.source().connection === connection) dialog.open();
    });
  }
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
    void this.load().then(() => this.port.requestUpdate(), () => undefined);
    return nothing;
  }
}
