/** Shared read-only explanation for the info card and real display preview. */
import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { ResolvedDevicePresentation } from './device-presentation';
import type { I18nKey } from './i18n';

export function renderDeviceIssues(
  presentation: ResolvedDevicePresentation,
  translate: (key: I18nKey) => string,
  openSource: (eid: string) => void,
) {
  const issues = presentation.issues;
  if (!issues.length) return presentation.visual.status === 'alarm'
    ? html`<section class="device-issues alarm" role="status"><h3>${translate('device.issues.alarm_title')}</h3>
        <p>${translate('device.issues.unknown_reason')}</p></section>` : nothing;
  return html`<div class="device-issue-groups" aria-live="polite">
    ${(['alarm', 'attention', 'maintenance'] as const).map(severity => {
      const group = issues.filter(issue => issue.severity === severity);
      return group.length ? html`<section class="device-issues ${severity}" data-severity=${severity}>
        <h3><ha-icon icon=${severity === 'alarm' ? 'mdi:alert-circle-outline' : severity === 'attention' ? 'mdi:alert-outline' : 'mdi:wrench-outline'}></ha-icon>
          ${severity === 'attention' ? group[0].groupTitle : translate(severity === 'alarm' ? 'device.issues.alarm_title' : 'device.issues.maintenance_title')}</h3>
        ${repeat(group, issue => issue.cause?.id || issue.eid, issue => html`<article class="device-issue" data-source=${issue.eid} data-cause=${issue.cause?.id || issue.eid}>
          <strong>${issue.name}</strong>
          <p>${issue.explanation || translate(`device.issues.${issue.reason}` as I18nKey)}</p>
          <span class="device-issue-state">${issue.stateText || issue.state}</span>
          <details><summary>${translate('device.issues.details')}</summary>
            <code>${issue.eid}</code><code>${issue.state}${issue.deviceClass ? ` · ${issue.deviceClass}` : ''}</code>
            <button type="button" @click=${() => openSource(issue.eid)}>
              <ha-icon icon="mdi:open-in-new"></ha-icon>${translate('device.issues.open_source')}
            </button>
          </details>
        </article>`)}
      </section>` : nothing;
    })}
  </div>`;
}
