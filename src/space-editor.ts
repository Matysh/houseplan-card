/** Config editor (Lovelace GUI) for houseplan-space-card. */
import { LitElement, html, nothing } from 'lit';
import { langOf, t, type Lang } from './i18n';

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
      { name: 'aspect_ratio', selector: { text: {} } },
      { name: 'icon_size', selector: { number: { min: 1, max: 6, step: 0.1, mode: 'box' } } },
    ];
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    this._loadSpaces();
    const L = this._lang;
    const labels: Record<string, string> = {
      space: t(L, 'editor.space'),
      title: t(L, 'editor.title'),
      show_button: t(L, 'editor.show_button'),
      button_label: t(L, 'editor.button_label'),
      button_target: t(L, 'editor.button_target'),
      aspect_ratio: t(L, 'editor.aspect_ratio'),
      icon_size: t(L, 'editor.icon_size'),
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

if (!customElements.get('houseplan-space-card-editor')) {
  customElements.define('houseplan-space-card-editor', HouseplanSpaceCardEditor);
}
