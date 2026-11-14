/** Eager, small shell: a lazy optimizer must not hide its own loading state. */
import { html, nothing, type TemplateResult } from 'lit';
import type { I18nKey } from './i18n';
import type { SettingsI18nKey } from './i18n/settings';
import type { OptimizeStatusState } from './optimize-feedback';
import type { PlanHost } from './plan-host';

export interface OptimizeStatusActions {
  t(key: I18nKey | SettingsI18nKey, vars?: Record<string, string | number>): string;
  planHost(): Pick<PlanHost, 'environment'>;
  close(): void;
  refresh?(): unknown;
  copy?(): unknown;
  support?(): unknown;
  fallback?: string | null;
}
export function renderOptimizeStatus(state: OptimizeStatusState, actions: OptimizeStatusActions): TemplateResult {
  const t = actions.t;
  const failure = state.failure;
  const busy = state.busy;
  const unknown = state.phase === 'unknown';
  const detail = failure?.code === 'graph-missing' ? 'gs.optimize_geometry_missing'
    : failure?.code === 'third-owner' ? 'gs.optimize_geometry_owners'
    : failure?.code.includes('thickness') ? 'gs.optimize_geometry_thickness'
    : failure?.code.includes('dependency') ? 'gs.optimize_geometry_dependency'
    : failure?.code.includes('host') ? 'gs.optimize_geometry_host' : null;
  const title = busy ? t(state.phase === 'refreshing' ? 'gs.optimize_refreshing' : 'gs.optimize_checking')
    : t(unknown ? 'gs.optimize_unknown_title' : 'gs.optimize_failed_title');
  return html`<hp-dialog form-shell settings-layout compact wide class="ui-dialog" .hass=${actions.planHost().environment.presentation}
    data-kind="settings" .title=${t('gs.align_title')} icon="mdi:broom" dismiss-on-scrim @hp-close=${actions.close}>
    <div class="body optimize-status" aria-busy=${busy ? 'true' : 'false'}>
      <p class="alignmsg" role="status">${busy ? html`<ha-icon class="hpf-spinner" icon="mdi:loading"></ha-icon>` : nothing}${title}</p>
      ${!busy && failure ? html`<p class="alignmsg">${t(unknown ? 'gs.optimize_unknown_hint'
        : failure.code === 'missing_plan' ? 'gs.optimize_failure_missing_plan'
        : `gs.optimize_failure_${failure.kind}` as SettingsI18nKey)}</p>
        ${detail && failure.kind === 'geometry' ? html`<p class="alignmsg">${t(detail)}</p>` : nothing}
        ${failure.spaceName ? html`<p class="alignmsg">${t('gs.optimize_location', { space: failure.spaceName })}${failure.roomName ? html` · ${failure.roomName}` : nothing}</p>` : nothing}
        ${!unknown ? html`<p class="rhint">${t('gs.optimize_not_applied')}</p>` : nothing}
        ${failure.kind === 'geometry' || failure.kind === 'prepare' ? html`<p class="rhint">${t('gs.optimize_geometry_help')}</p>` : nothing}
        ${state.refreshFailed ? html`<p class="rhint" role="alert">${t('gs.optimize_refresh_failed')}</p>` : nothing}
        <div class="optimize-actions">
          ${actions.refresh && (unknown || failure.kind === 'changed' || failure.kind === 'load' || failure.code === 'missing_plan') ? html`<button class="btn ghost optimize-refresh" @click=${actions.refresh}>${t('gs.optimize_refresh')}</button>` : nothing}
          ${actions.copy ? html`<button class="btn ghost optimize-copy" @click=${actions.copy}><ha-icon icon="mdi:content-copy"></ha-icon>${t('gs.preflight_copy')}</button>` : nothing}
          ${actions.support ? html`<button class="btn ghost optimize-support" @click=${actions.support}>${t('gs.optimize_support')}</button>` : nothing}
        </div>
        ${actions.fallback ? html`<pre class="preflight-diagnostics">${actions.fallback}</pre>` : nothing}` : nothing}
    </div>
    <div class="row" slot="footer"><span class="spacer"></span><button class="btn ghost" data-hp="dialog-cancel" @click=${actions.close}>${t('btn.close')}</button></div>
  </hp-dialog>`;
}
