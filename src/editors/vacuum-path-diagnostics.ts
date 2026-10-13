import { html, type TemplateResult } from 'lit';
import type { HouseplanEditorHostPort } from '../houseplan-editor-runtime';
import type { DevItem } from '../types';

export function renderVacuumPathDiagnostics(host: Pick<HouseplanEditorHostPort, '_t' | '_vacTrailDiagnostics'>, device: DevItem): TemplateResult {
  const info = host._vacTrailDiagnostics(device);
  const sources = { native: 'vac.path_native', integration: 'vac.path_native',
    positions: 'vac.path_positions', server: 'vac.path_positions', local: 'vac.path_local', none: 'vac.path_none' } as const;
  const reasons = { ok: 'vac.path_ok', sampled: 'vac.path_sampled', none: 'vac.path_none',
    stale: 'vac.path_stale', limited: 'vac.path_limited', unsupported: 'vac.path_unsupported',
    coordinates_unverified: 'vac.path_coordinates_unverified', run_unverified: 'vac.path_run_unverified' } as const;
  return html`
    <div><span>${host._t('vac.diag_trail_source')}</span><b>${host._t(sources[info.source as keyof typeof sources] ?? 'vac.path_none')}</b></div>
    <div><span>${host._t('vac.diag_trail_quality')}</span><b>${host._t(reasons[info.reason as keyof typeof reasons] ?? 'vac.path_unsupported')}</b></div>
    <div><span>${host._t('vac.diag_trail_counts')}</span><b>${info.raw} / ${info.stored} / ${info.rendered}</b></div>
    <div><span>${host._t('vac.diag_trail_received')}</span><b>${Number.isFinite(info.receivedAt) ? new Date(info.receivedAt! * 1000).toLocaleTimeString() : '—'}</b></div>
    <div><span>${host._t('vac.diag_trail_final')}</span><b>${host._t(info.final ? 'common.yes' : 'vac.path_final_unconfirmed')}</b></div>`;
}
