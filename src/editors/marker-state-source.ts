import { html, nothing, type TemplateResult } from 'lit';
import { field } from './form-kit';
import type { MarkerDialogDraft } from './marker-form-state';
import { markerStateSourceCandidates, normalizeMarkerStateSource, type StateSourceHass } from '../marker-state-source';
import type { SettingsI18nKey } from '../i18n/settings';

/** A form only: source semantics and diagnostics come from the shared resolver. */
export function renderMarkerStateSource(options: {
  draft: MarkerDialogDraft;
  registry: StateSourceHass;
  hass: StateSourceHass;
  protectedFace: boolean;
  t: (key: SettingsI18nKey) => string;
  change: (draft: MarkerDialogDraft) => void;
}): TemplateResult {
  const { draft: d, registry, hass, protectedFace, t, change } = options;
  const source = d.stateSource;
  const eid = typeof source?.entity_id === 'string' ? source.entity_id : '';
  const candidates = markerStateSourceCandidates(d.binding, registry);
  const disabled = d.binding === 'virtual' || protectedFace;
  const explicit = source?.active_states !== undefined;
  const state = Array.isArray(source?.active_states) ? source.active_states[0] ?? '' : '';
  return html`<div data-state-source>
    ${field({ label: t('marker.state_source'), htmlFor: 'marker-state-source',
      hint: t(disabled ? protectedFace ? 'marker.state_source_special' : 'marker.state_source_virtual' : 'marker.state_source_help'),
      control: html`<hp-settings-select><select id="marker-state-source" ?disabled=${disabled}
        @change=${(e: Event) => change({ ...d, stateSource: (e.target as HTMLSelectElement).value
          ? { entity_id: (e.target as HTMLSelectElement).value } : null, stateSourceTouched: true })}>
        <option value="" ?selected=${disabled || source == null}>${t('marker.state_source_auto')}</option>
        ${!disabled && source != null && !candidates.includes(eid) ? html`<option selected value=${eid || '__invalid__'}>${eid || t('marker.state_source_invalid')}</option>` : nothing}
        ${candidates.map(id => html`<option value=${id} ?selected=${!disabled && id === eid}>
            ${String(registry.entities?.[id]?.name || hass.states?.[id]?.attributes?.friendly_name || id)} · ${id} · ${String(hass.states?.[id]?.state ?? '—')}
          </option>`)}
      </select></hp-settings-select>`,
    })}
    ${!disabled && source != null ? html`
      ${field({ label: t('marker.state_source_active_when'), htmlFor: 'marker-state-source-mode',
        help: html`<hp-help instant data-help-key="marker.state_source_mode_help"
          .text=${t('marker.state_source_mode_help')} .ariaLabel=${t('marker.state_source_mode_help.aria')}></hp-help>`,
        control: html`<hp-settings-select><select id="marker-state-source-mode"
          @change=${(e: Event) => {
            const next = { ...source, entity_id: eid }; delete next.active_states;
            if ((e.target as HTMLSelectElement).value === 'states') next.active_states = [];
            change({ ...d, stateSource: next, stateSourceTouched: true });
          }}>
          <option value="standard" ?selected=${!explicit}>${t('marker.state_source_standard')}</option>
          <option value="states" ?selected=${explicit}>${t('marker.state_source_manual')}</option>
        </select></hp-settings-select>`,
      })}
      ${explicit ? html`<div class="hpf-field" id="marker-state-source-states">
        <input class="hpf-input" aria-label=${t('marker.state_source_active_when')} .value=${state}
          @input=${(e: Event) => change({ ...d, stateSource: { ...source, entity_id: eid,
            active_states: [(e.target as HTMLInputElement).value] }, stateSourceTouched: true })}>
      </div>` : nothing}
      ${!normalizeMarkerStateSource(source) ? html`<p class="hpf-note hpf-note-warning" role="alert">${t('marker.state_source_states_invalid')}</p>` : nothing}
    ` : nothing}
  </div>`;
}
