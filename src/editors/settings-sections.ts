import { html, nothing, type TemplateResult } from 'lit';
import type { HpDialog } from '../hp-dialog';

export interface SettingsSection {
  id: string;
  title: string;
  body: TemplateResult;
  specialized?: boolean;
}
export interface SettingsSectionHost {
  requestUpdate(): void;
  renderRoot: DocumentFragment | HTMLElement;
}
const selections = new WeakMap<object, Map<string, string>>();
const sessions = new WeakMap<object, Map<string, object>>();

export function selectedSettingsSection(host: object, kind: string): string | undefined {
  return selections.get(host)?.get(kind);
}

export function settingsSectionOf(host: object, kind: string, sections: readonly SettingsSection[]): string {
  const selected = selections.get(host)?.get(kind);
  return sections.find(section => section.id === selected)?.id || sections[0]?.id || '';
}

export function selectSettingsSection(host: SettingsSectionHost, kind: string, id: string): void {
  (host.renderRoot as ParentNode).querySelector<HpDialog>(`hp-dialog:has([data-settings-kind="${kind}"])`)?.closeTransientOverlays('exclusive');
  let values = selections.get(host);
  if (!values) { values = new Map(); selections.set(host, values); }
  values.set(kind, id);
  host.requestUpdate();
}

/** The fields stay mounted: navigation never replaces the draft or its controls. */
export function settingsSections(
  host: SettingsSectionHost, kind: string, sections: readonly SettingsSection[], navigationLabel: string, session?: object,
): TemplateResult {
  if (session) {
    let owners = sessions.get(host);
    if (!owners) { owners = new Map(); sessions.set(host, owners); }
    if (owners.get(kind) !== session) { selections.get(host)?.delete(kind); owners.set(kind, session); }
  }
  const selected = settingsSectionOf(host, kind, sections);
  const multiple = sections.length > 1;
  return html`<div class="hpf-settings-layout ${multiple ? '' : 'hpf-settings-single'}" data-settings-kind=${kind}>
    ${multiple ? html`
      <nav class="hpf-settings-nav" aria-label=${navigationLabel}>
        ${sections.map((section, index) => html`
          ${section.specialized && !sections[index - 1]?.specialized ? html`<hr />` : nothing}
          <button type="button" data-hp="settings-section" data-kind=${kind} data-section=${section.id} data-section-target=${section.id} aria-current=${section.id === selected ? 'page' : nothing}
            @click=${() => selectSettingsSection(host, kind, section.id)}>${section.title}</button>`)}
      </nav>
      <label class="hpf-settings-mobile"><span class="hpf-sr-only">${navigationLabel}</span>
        <hp-settings-select><select class="hpf-select" data-hp="field" data-field="settings-section" aria-label=${navigationLabel} .value=${selected}
          @change=${(event: Event) => selectSettingsSection(host, kind, (event.target as HTMLSelectElement).value)}>
          ${sections.map(section => html`<option value=${section.id} ?selected=${section.id === selected}>${section.title}</option>`)}
        </select></hp-settings-select>
      </label>` : nothing}
    <div class="hpf-settings-content">
      ${sections.map(section => html`<section class="hpf-settings-pane" data-settings-section=${section.id}
        ?hidden=${section.id !== selected} aria-label=${section.title}>${section.body}</section>`)}
    </div>
  </div>`;
}

/** Validation can reveal a field in a different section before moving focus. */
export function revealSettingsField(host: SettingsSectionHost, field: HTMLElement): void {
  const layout = field.closest<HTMLElement>('[data-settings-kind]');
  const pane = field.closest<HTMLElement>('[data-settings-section]');
  if (layout?.dataset.settingsKind && pane?.dataset.settingsSection) {
    selectSettingsSection(host, layout.dataset.settingsKind, pane.dataset.settingsSection);
  }
  requestAnimationFrame(() => { field.scrollIntoView({ block: 'center' }); field.focus(); });
}
