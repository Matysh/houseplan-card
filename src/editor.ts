/** Card configuration editor (Lovelace GUI). */
import { LitElement, html, nothing } from 'lit';
import { langOf, t, type Lang } from './i18n';

class HouseplanCardEditor extends LitElement {
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

  /** Spaces come from the integration's server config — never hard-coded. */
  private async _loadSpaces(): Promise<void> {
    if (this._spaces || this._spacesLoading || !this.hass) return;
    this._spacesLoading = true;
    try {
      const resp = await this.hass.callWS({ type: 'houseplan/config/get' });
      this._spaces = (resp?.config?.spaces || []).map((s: any) => ({
        value: s.id,
        label: s.title || s.id,
      }));
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
    const L = this._lang;
    return [
      { name: 'title', selector: { text: {} } },
      spaces.length
        ? {
            name: 'default_floor',
            selector: { select: { mode: 'dropdown', options: spaces } },
          }
        : { name: 'default_floor', selector: { text: {} } },
      {
        name: 'language',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: '', label: t(L, 'editor.lang_auto') },
              { value: 'en', label: t(L, 'editor.lang_en') },
              { value: 'ru', label: t(L, 'editor.lang_ru') },
            ],
          },
        },
      },
      { name: 'icon_size', selector: { number: { min: 1, max: 6, step: 0.1, mode: 'box' } } },
      { name: 'show_temperature', selector: { boolean: {} } },
      { name: 'live_states', selector: { boolean: {} } },
      { name: 'show_signal', selector: { boolean: {} } },
    ];
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    this._loadSpaces();
    const L = this._lang;
    const labels: Record<string, string> = {
      title: t(L, 'editor.title'),
      default_floor: t(L, 'editor.default_floor'),
      language: t(L, 'editor.language'),
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
    const config = { ...this._config, ...ev.detail.value };
    const e = new Event('config-changed', { bubbles: true, composed: true }) as any;
    e.detail = { config };
    this.dispatchEvent(e);
  }
}

if (!customElements.get('houseplan-card-editor')) {
  customElements.define('houseplan-card-editor', HouseplanCardEditor);
}
