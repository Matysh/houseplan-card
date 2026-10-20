/** Editor-only portable transfer: opaque server candidates, never client-side import parsing. */
import { html, nothing, type TemplateResult } from 'lit';
import type { I18nKey } from './i18n';
import type { ToolsI18nKey } from './i18n/tools';

export interface ArchiveSummary {
  complete: boolean;
  images: number;
  missing: Array<{ name: string; reason: string; kind: string; owner_id: string }>;
  snapshot: Array<{ obtained_at: number }>;
  snapshot_ignored_off?: boolean;
}
export interface ArchiveExport extends ArchiveSummary { archive: true; token: string; filename: string }
export interface BackupExportState {
  kind: 'full' | 'space'; planOnly: boolean; busy: boolean; error: string; archive?: ArchiveExport;
}
interface TransferHass {
  user?: { is_admin?: boolean };
  callWS<T>(message: Record<string, unknown>): Promise<T>;
  fetchWithAuth?(path: string, init: RequestInit): Promise<Response>;
  auth?: { data?: { access_token?: string } };
}
interface TransferHost {
  hass?: TransferHass;
  isConnected: boolean;
  _space: string;
  _backupExportDialog: BackupExportState | null;
  _showToast(message: string): void;
  _t(key: I18nKey, values?: Record<string, string>): string;
}
interface LegacyExport { archive?: false; document: unknown; filename: string }
interface PreviewReply {
  token: string; preview: Record<string, unknown>; expected_config_rev: number; expected_layout_rev: number;
}

function transferError(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

export class BackupArchiveClient {
  private exportEpoch = 0;
  private exportAbort?: AbortController;
  private importAbort?: AbortController;
  private exportToken?: string;
  private importToken?: string;
  private importOperation?: string;
  private pendingImportCancels = new Set<string>();
  private cleanup: Promise<void> = Promise.resolve();

  public constructor(private readonly host: TransferHost) {}

  public discard(token: string): void {
    if (token) this.cleanup = this.cleanup.then(async () => {
      await this.host.hass?.callWS({ type: 'houseplan/backup/cancel', token });
    }).catch(() => undefined);
  }

  public cancelExport(): void {
    this.exportEpoch++;
    this.exportAbort?.abort();
    if (this.exportToken) this.discard(this.exportToken);
    this.exportToken = undefined;
  }

  public cancelImport(): void {
    this.importAbort?.abort();
    if (this.importOperation) this.discardImport(this.importOperation);
    else if (this.importToken) this.discard(this.importToken);
    this.importToken = undefined;
    this.importOperation = undefined;
  }

  private discardImport(operation: string): void {
    this.pendingImportCancels.add(operation);
    this.cleanup = this.cleanup.then(() => this.flushImportCancels()).catch(() => undefined);
  }

  private async flushImportCancels(): Promise<void> {
    for (const operation_id of this.pendingImportCancels) {
      if (!this.host.hass) throw transferError('not_ready');
      await this.host.hass.callWS({ type: 'houseplan/backup/cancel', operation_id });
      this.pendingImportCancels.delete(operation_id);
    }
  }

  public dispose(): void { this.cancelExport(); this.cancelImport(); }

  public selectKind(kind: 'full' | 'space'): void {
    const state = this.host._backupExportDialog;
    if (!state || state.busy) return;
    this.cancelExport();
    this.host._backupExportDialog = { ...state, kind, planOnly: false, archive: undefined, error: '' };
  }

  private fetch(path: string, init: RequestInit): Promise<Response> {
    const hass = this.host.hass;
    if (!hass) return Promise.reject(transferError('not_ready'));
    if (hass.fetchWithAuth) return hass.fetchWithAuth(path, init);
    const token = hass.auth?.data?.access_token;
    const headers = new Headers(init.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    return fetch(path, { ...init, headers });
  }

  public async preview(file: File): Promise<PreviewReply> {
    this.cancelImport();
    const controller = new AbortController();
    this.importAbort = controller;
    await this.cleanup;
    await this.flushImportCancels();
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const magic = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const zip = (magic[0] === 0x50 && magic[1] === 0x4b) || file.name.toLowerCase().endsWith('.zip');
    if (zip && this.host.hass?.user?.is_admin !== true) throw transferError('zip_admin_only');
    if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const operation = zip ? Array.from(crypto.getRandomValues(new Uint8Array(16)),
      byte => byte.toString(16).padStart(2, '0')).join('') : undefined;
    this.importOperation = operation;
    try {
      const response = await this.fetch(zip ? '/api/houseplan/backup/import/preview'
        : '/api/houseplan/import/preview?duplicate_policy=skip', {
        method: 'POST', body: file, signal: controller.signal,
        headers: { 'content-type': zip ? 'application/zip' : 'application/json',
          ...(operation ? { 'x-houseplan-operation': operation } : {}) },
      });
      const fallback = response.status === 413 ? 'zip_limit' : zip ? 'zip_invalid' : 'invalid_format';
      const data = await response.json().catch(() => { throw transferError(fallback); }) as PreviewReply & { error?: string };
      if (!response.ok || data.error) throw transferError(data.error || fallback);
      if (controller.signal.aborted) {
        if (zip) this.discard(data.token);
        throw new DOMException('Cancelled', 'AbortError');
      }
      if (zip) this.importToken = data.token;
      return data;
    } catch (error: unknown) {
      if (operation) this.discardImport(operation);
      if (this.importOperation === operation) this.importOperation = undefined;
      throw error;
    }
  }

  public async export(metadata: { card_version: string }, errorText: (error: unknown) => string): Promise<void> {
    const host = this.host, state = host._backupExportDialog, hass = host.hass;
    if (!state || state.busy || !hass) return;
    const epoch = ++this.exportEpoch;
    this.exportAbort?.abort();
    const controller = new AbortController();
    this.exportAbort = controller;
    const owns = () => this.exportEpoch === epoch && host.isConnected && !!host._backupExportDialog;
    host._backupExportDialog = { ...state, busy: true, error: '' };
    try {
      await this.cleanup;
      if (!owns()) return;
      const result = state.archive || await hass.callWS<ArchiveExport | LegacyExport>({
        type: 'houseplan/export/create', kind: state.kind,
        ...(state.kind === 'space' ? { space_id: host._space, plan_only: state.planOnly } : {}),
        ...(state.kind === 'full' && hass.user?.is_admin === true ? { archive: true } : {}),
        card_version: metadata.card_version,
      });
      if (!owns()) {
        if (result.archive === true) this.discard(result.token);
        return;
      }
      let blob: Blob;
      if (result.archive === true) {
        this.exportToken = result.token;
        if (!result.complete && !state.archive) {
          host._backupExportDialog = { ...state, archive: result, busy: false, error: '' };
          return; // A second, distinctly labelled action is the consent.
        }
        const response = await this.fetch(`/api/houseplan/backup/export/${encodeURIComponent(result.token)}`, {
          method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ confirm_missing_content: !result.complete }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({})) as { error?: string };
          throw transferError(error.error || (response.status === 413 ? 'zip_limit' : 'zip_invalid'));
        }
        if (response.headers.get('content-type')?.split(';')[0] !== 'application/zip') throw transferError('zip_invalid');
        blob = await response.blob();
        if (this.exportEpoch === epoch) this.exportToken = undefined;
      } else {
        blob = new Blob([JSON.stringify(result.document, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
      }
      if (!owns()) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = result.filename;
      anchor.style.display = 'none'; document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      host._backupExportDialog = null;
      host._showToast(host._t('backup.export_done'));
    } catch (error: unknown) {
      if (owns()) {
        if (this.exportToken) this.discard(this.exportToken);
        this.exportToken = undefined;
        host._backupExportDialog = { ...state, archive: undefined, busy: false, error: errorText(error) };
      }
    }
  }
}

export function renderArchiveSummary(t: (key: ToolsI18nKey, values?: Record<string, string>) => string,
  summary?: ArchiveSummary, restoring = false): TemplateResult | typeof nothing {
  if (!summary) return nothing;
  const reasons: Record<string, ToolsI18nKey> = { missing: 'backup.zip_reason.missing', external: 'backup.zip_reason.external',
    invalid: 'backup.zip_reason.invalid', changed: 'backup.zip_reason.changed' };
  const dates = summary.snapshot.map(item => {
    const date = new Date(item.obtained_at);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : '—';
  }).join('; ');
  return html`<div class="backupcontent" data-hp="archive-summary">
    <b>${t('backup.zip_images_summary', { n: String(summary.images) })}</b>
    <span>${summary.snapshot.length ? t('backup.zip_snapshot_summary', { date: dates }) : t('backup.zip_snapshot_absent')}</span>
    ${restoring ? html`<span>${t('backup.zip_snapshot_replace_notice')}</span>` : nothing}
    ${summary.snapshot_ignored_off ? html`<div class="backupwarn">${t('backup.zip_snapshot_ignored_off')}</div>` : nothing}
    ${!summary.complete ? html`<div class="backupwarn" role="alert"><b>${t('backup.zip_incomplete_title')}</b>
      <p>${t('backup.zip_incomplete_hint')}</p>
      <details><summary>${t('backup.zip_missing_count', { n: String(summary.missing.length) })}</summary>
        <ul>${summary.missing.map(row => html`<li>${row.name || row.owner_id} — ${t(reasons[row.reason] || 'backup.zip_reason.invalid')}</li>`)}</ul>
      </details></div>` : nothing}
  </div>`;
}
