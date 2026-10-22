import { html, nothing, type TemplateResult } from 'lit';
import type { SegmentedOptions } from './editors/form-kit';

/** Shared single-choice markup, independent of the editor form/style graph. */
export function selectControl<T extends string>({
  name, value, options, onChange, ariaLabel, disabled = false,
}: SegmentedOptions<T>): TemplateResult {
  return html`<hp-settings-select><select data-hp="field" data-field=${name} class="hpf-select" id=${name} name=${name} .value=${value} aria-label=${ariaLabel ?? nothing}
    ?disabled=${disabled} @change=${(event: Event) => onChange((event.target as HTMLSelectElement).value as T)}>
    ${options.map(option => html`<option value=${option.value} ?selected=${option.value === value} ?disabled=${option.disabled}>${option.label}</option>`)}
  </select></hp-settings-select>`;
}
