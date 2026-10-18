/** Rare backup tools load on demand, not for every device/plan editor. */
import { nothing } from 'lit';
import type { BackupArchiveClient, renderArchiveSummary } from './backup-archive-client';

type ClientModule = typeof import('./backup-archive-client');
type Host = ConstructorParameters<typeof BackupArchiveClient>[0];

export class LazyBackupArchiveClient {
  private module?: ClientModule;
  private client?: BackupArchiveClient;
  private loading?: Promise<BackupArchiveClient>;
  private exportEpoch = 0;
  private importEpoch = 0;

  public constructor(private readonly host: Host,
    private readonly loader: () => Promise<ClientModule> = () => import('./backup-archive-client')) {}

  private load(): Promise<BackupArchiveClient> {
    if (this.client) return Promise.resolve(this.client);
    return this.loading ??= this.loader().then(module => {
      this.module = module;
      return this.client = new module.BackupArchiveClient(this.host);
    }).catch(() => {
      this.loading = undefined;
      throw new Error(this.host._t('editor.load_failed'));
    });
  }

  public cancelExport(): void { this.exportEpoch++; this.client?.cancelExport(); }
  public cancelImport(): void { this.importEpoch++; this.client?.cancelImport(); }
  public dispose(): void { this.cancelExport(); this.cancelImport(); }
  public discard(token: string): void { this.client?.discard(token); }

  public selectKind(kind: 'full' | 'space'): void {
    const state = this.host._backupExportDialog;
    if (!state || state.busy) return;
    this.cancelExport();
    this.host._backupExportDialog = { ...state, kind, planOnly: false, archive: undefined, error: '' };
  }

  public async export(metadata: { card_version: string }, errorText: (error: unknown) => string): Promise<void> {
    const state = this.host._backupExportDialog;
    if (!state || state.busy) return;
    const epoch = ++this.exportEpoch;
    const owns = () => epoch === this.exportEpoch && this.host.isConnected && !!this.host._backupExportDialog;
    this.host._backupExportDialog = { ...state, busy: true, error: '' };
    try {
      const client = await this.load();
      if (!owns()) return;
      this.host._backupExportDialog = { ...this.host._backupExportDialog!, busy: false };
      await client.export(metadata, errorText);
    } catch (error: unknown) {
      if (owns()) this.host._backupExportDialog = { ...state, busy: false, error: errorText(error) };
    }
  }

  public async preview(file: File): Promise<Awaited<ReturnType<BackupArchiveClient['preview']>>> {
    const epoch = ++this.importEpoch;
    const client = await this.load();
    if (epoch !== this.importEpoch || !this.host.isConnected) throw new DOMException('Cancelled', 'AbortError');
    return client.preview(file);
  }

  public renderSummary(...args: Parameters<typeof renderArchiveSummary>): ReturnType<typeof renderArchiveSummary> {
    return this.module?.renderArchiveSummary(...args) ?? nothing;
  }
}
