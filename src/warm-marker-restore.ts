/** An unpublished draft is not an active marker modal until its renderer exists. */
import { html, nothing, type TemplateResult } from 'lit';
import type { I18nKey } from './i18n';

export class WarmMarkerRestore<T> {
  private serial = 0;
  private draft: T | null = null;
  private phase: 'idle' | 'loading' | 'failed' = 'idle';
  constructor(private readonly port: {
    allowed(draft: T): boolean;
    ensure(): Promise<boolean>;
    restore(draft: T): void;
    changed(): void;
  }) {}
  get active(): boolean { return this.draft !== null; }
  cancel(): void {
    ++this.serial;
    if (!this.active) return;
    this.draft = null; this.phase = 'idle'; this.port.changed();
  }
  begin(draft: T): void {
    this.cancel();
    if (!this.port.allowed(draft)) return;
    this.draft = draft;
    this.load();
  }
  private load(): void {
    const draft = this.draft, serial = ++this.serial;
    if (!draft || !this.port.allowed(draft)) { this.cancel(); return; }
    this.phase = 'loading'; this.port.changed();
    void this.port.ensure().then((ready) => {
      if (serial !== this.serial || this.draft !== draft) return;
      if (!this.port.allowed(draft)) { this.cancel(); return; }
      if (!ready) { this.phase = 'failed'; this.port.changed(); return; }
      this.draft = null; this.phase = 'idle';
      this.port.restore(draft); this.port.changed();
    });
  }
  reconcile(): void { if (this.draft && !this.port.allowed(this.draft)) this.cancel(); }
  render(t: (key: I18nKey) => string): TemplateResult | typeof nothing {
    if (!this.active) return nothing;
    const failed = this.phase === 'failed';
    return html`<hp-dialog data-kind="marker-restore" .title=${t('info.device_header')}
      dismiss-on-scrim @hp-close=${() => this.cancel()}>
      <div class="body" role="status">${t(failed ? 'editor.load_failed' : 'editor.loading')}</div>
      <div class="row" slot="footer">
        <button type="button" class="btn ghost" data-hp="dialog-cancel" @click=${() => this.cancel()}>${t('btn.close')}</button>
        ${failed ? html`<button type="button" class="btn on" data-hp="restore-retry" @click=${() => this.load()}>${t('continuity.retry')}</button>` : nothing}
      </div>
    </hp-dialog>`;
  }
}
