/** Config editor (Lovelace GUI) for houseplan-space-card. */
import { LitElement, html, nothing, noChange } from 'lit';
import { langOf, t, type Lang } from './i18n';
import { LANGUAGE_RUNTIME } from './i18n/registry';
import { languageLoadingTemplate, languageRenderGate } from './i18n/language-runtime';

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
      { name: 'show_button', selector: { boolean: {} } },
      { name: 'button_label', selector: { text: {} } },
      { name: 'button_target', selector: { text: {} } },
      { name: 'icon_size', selector: { number: { min: 1, max: 6, step: 0.1, mode: 'box' } } },
      { name: 'show_temperature', selector: { boolean: {} } },
      { name: 'live_states', selector: { boolean: {} } },
      { name: 'show_signal', selector: { boolean: {} } },
    ];
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const localeGate = languageRenderGate(
      this, LANGUAGE_RUNTIME, langOf(this.hass, this._config.language),
    );
    if (localeGate === 'cold') return languageLoadingTemplate();
    if (localeGate === 'warm') return noChange;
    this._loadSpaces();
    const L = this._lang;
    const labels: Record<string, string> = {
      space: t(L, 'editor.space'),
      title: t(L, 'editor.title'),
      show_button: t(L, 'editor.show_button'),
      button_label: t(L, 'editor.button_label'),
      button_target: t(L, 'editor.button_target'),
      icon_size: t(L, 'editor.icon_size'),
      show_temperature: t(L, 'editor.show_temperature'),
      live_states: t(L, 'editor.live_states'),
      show_signal: t(L, 'editor.show_signal'),
    };
    return html`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${(s: any) => labels[s.name] || s.name}
      @value-changed=${this._valueChanged}
    ></ha-form>`;
  }

  private _valueChanged(ev: CustomEvent): void {
    // `aspect_ratio` was exposed by the editor but never consumed by the
    // square static card. Strip the stale no-op key on the next real edit so
    // the UI cannot keep promising a setting that has no effect.
    const config = { ...(this._config || {}), ...ev.detail.value };
    delete config.aspect_ratio;
    const e = new Event('config-changed', { bubbles: true, composed: true }) as any;
    e.detail = { config };
    this.dispatchEvent(e);
  }
}

if (!customElements.get('houseplan-space-card-editor')) {
  customElements.define('houseplan-space-card-editor', HouseplanSpaceCardEditor);
}
