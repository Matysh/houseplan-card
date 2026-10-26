/** Config editor (Lovelace GUI) for houseplan-space-card. */
import { LitElement, html, nothing, noChange } from 'lit';
import { langOf, type Lang } from './i18n';
import { SETTINGS_LANGUAGE_RUNTIME as CARD_EDITOR_LANGUAGE_RUNTIME, settingsT } from './i18n/settings';
import { languageLoadingTemplate, languageRenderGate } from './i18n/language-runtime';
import { resolveSpaceCardFit } from './space-geometry';
import { invalidCardRotation, cardRotationOptions, rotationFormValue, rotationConfigValue } from './card-editor-validation';

class HouseplanSpaceCardEditor extends LitElement {
  public hass?: any;
  private _config?: any;
  private _spaces: { value: string; label: string }[] | null = null;
  private _spacesLoading = false;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _spaces: { state: true },
  };

  public setConfig(config: any): void {
    this._config = config;
  }

  private async _loadSpaces(): Promise<void> {
    if (this._spaces || this._spacesLoading || !this.hass) return;
    this._spacesLoading = true;
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/config/get' });
      this._spaces = (resp?.config?.spaces || []).map((s: any) => ({ value: s.id, label: s.title || s.id }));
    } catch {
      this._spaces = [];
    } finally {
      this._spacesLoading = false;
    }
  }

  private get _lang(): Lang {
    return langOf(this.hass, this._config?.language);
  }

  private get _schema(): any[] {
    const spaces = this._spaces || [];
    return [
      spaces.length
        ? { name: 'space', selector: { select: { mode: 'dropdown', options: spaces } } }
        : { name: 'space', selector: { text: {} } },
      { name: 'title', selector: { text: {} } },
      { name: 'rotation', selector: { select: { mode: 'dropdown', options: cardRotationOptions } } },
      {
        name: 'fit',
        selector: { select: { mode: 'dropdown', options: [
          { value: 'content', label: settingsT(this._lang, 'editor.fit_content') },
          { value: 'house', label: settingsT(this._lang, 'editor.fit_house') },
        ] } },
      },
      { name: 'show_button', selector: { boolean: {} } },
      { name: 'button_label', selector: { text: {} } },
      { name: 'button_target', selector: { text: {} } },
      { name: 'icon_size', selector: { number: { min: 1, max: 6, step: 0.1, mode: 'box' } } },
      { name: 'show_temperature', selector: { boolean: {} } },
      { name: 'live_states', selector: { boolean: {} } },
      { name: 'light_pools', selector: { boolean: {} } },
    ];
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const localeGate = languageRenderGate(
      this, CARD_EDITOR_LANGUAGE_RUNTIME, langOf(this.hass, this._config.language),
    );
    if (localeGate === 'cold') return languageLoadingTemplate();
    if (localeGate === 'warm') return noChange;
    this._loadSpaces();
    const L = this._lang;
    const labels: Record<string, string> = {
      space: settingsT(L, 'editor.space'),
      title: settingsT(L, 'editor.title'),
      rotation: settingsT(L, 'editor.rotation'),
      fit: settingsT(L, 'editor.framing'),
      show_button: settingsT(L, 'editor.show_button'),
      button_label: settingsT(L, 'editor.button_label'),
      button_target: settingsT(L, 'editor.button_target'),
      icon_size: settingsT(L, 'editor.icon_size'),
      show_temperature: settingsT(L, 'editor.show_temperature'),
      live_states: settingsT(L, 'editor.live_states'),
      light_pools: settingsT(L, 'editor.light_pools'),
    };
    return html`<ha-form
      .hass=${this.hass}
      .data=${{ ...this._config, fit: resolveSpaceCardFit(this._config.fit), rotation: rotationFormValue(this._config.rotation) }}
      .schema=${this._schema}
      .computeLabel=${(s: any) => labels[s.name] || s.name}
      @value-changed=${this._valueChanged}
    ></ha-form>${invalidCardRotation(this._config) ? html`<div class="card-config-error" role="alert"
      style="color:var(--error-color,#db4437)">${settingsT(L, 'editor.rotation_invalid')}</div>` : nothing}`;
  }

  private _valueChanged(ev: CustomEvent): void {
    if (CARD_EDITOR_LANGUAGE_RUNTIME.state(this._lang) === 'pending') return;
    // `aspect_ratio` was exposed by the editor but never consumed by the
    // square static card. Strip the stale no-op key on the next real edit so
    // the UI cannot keep promising a setting that has no effect.
    const config = { ...(this._config || {}), ...ev.detail.value };
    config.rotation = rotationConfigValue(config.rotation);
    delete config.aspect_ratio;
    const e = new Event('config-changed', { bubbles: true, composed: true }) as any;
    e.detail = { config };
    this.dispatchEvent(e);
  }
}

if (!customElements.get('houseplan-space-card-editor')) {
  customElements.define('houseplan-space-card-editor', HouseplanSpaceCardEditor);
}
