/** Passive, self-contained informational surface. No HA/editor/storage capability. */
import { LitElement, css, html, unsafeCSS } from 'lit';
import { converterT } from './i18n/converter';
import type { Lang } from './i18n/registry';
import { PLAN_CONVERTER, planConverterFormats, type PlanConverterFormat } from './plan-converter';
import { settingsInlineLinkCss } from './styles/settings-action.styles';

export const CONVERTER_INFO_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
export function planConverterHint(lang: Lang, formats: readonly PlanConverterFormat[] = PLAN_CONVERTER.formats) {
  return html`<p>${converterT(lang, 'converter_hint.before_link')} <a class="hpf-link"
    href=${PLAN_CONVERTER.url} target="_blank" rel="noopener noreferrer"
    @click=${(event: Event) => event.stopPropagation()}
    @pointerdown=${(event: Event) => event.stopPropagation()}
    >${converterT(lang, 'converter_hint.link')}</a>${converterT(lang, 'converter_hint.after_link')}
    ${converterT(lang, 'converter_hint.supported_formats', { formats: planConverterFormats(formats, converterT(lang, 'converter_hint.list_separator')) })}</p>`;
}

export class HpPlanConverterInfo extends LitElement {
  static properties = { language: { type: String }, placement: { type: String, reflect: true }, formats: { attribute: false } };
  language: Lang = 'en';
  placement = 'dialog';
  formats: readonly PlanConverterFormat[] = PLAN_CONVERTER.formats;
  static styles = [css`
    :host { display:block; min-width:0; width:100%; box-sizing:border-box; margin:20px 0 0;
      color:var(--secondary-text-color); font-family:inherit; font-size:13px; line-height:1.6;
      overflow-wrap:anywhere; text-wrap:pretty; text-align:start; }
    :host([placement=empty]) { max-width:620px; margin:24px auto 0; text-align:center; }
    p { margin:0; }
  `, unsafeCSS(settingsInlineLinkCss('a'))];
  protected render() { return planConverterHint(this.language, this.formats); }
}

export function installPlanConverterInfo(): true {
  if (!customElements.get('hp-plan-converter-info')) customElements.define('hp-plan-converter-info', HpPlanConverterInfo);
  return true;
}
