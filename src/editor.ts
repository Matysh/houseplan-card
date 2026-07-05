/** Редактор конфигурации карточки (GUI в Lovelace). */
import { LitElement, html, nothing } from 'lit';

const LABELS: Record<string, string> = {
  title: 'Заголовок',
  default_floor: 'Пространство по умолчанию',
  icon_size: 'Размер иконок, % ширины плана',
  show_temperature: 'Показывать температуру',
  live_states: 'Живые состояния (вкл/выкл, открыто…)',
  show_signal: 'Показывать сигнал zigbee (LQI)',
};

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

  /** Пространства из серверного конфига интеграции — не хардкод. */
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

  private get _schema(): any[] {
    const spaces = this._spaces || [];
    return [
      { name: 'title', selector: { text: {} } },
      spaces.length
        ? {
            name: 'default_floor',
            selector: { select: { mode: 'dropdown', options: spaces } },
          }
        : { name: 'default_floor', selector: { text: {} } },
      { name: 'icon_size', selector: { number: { min: 1, max: 6, step: 0.1, mode: 'box' } } },
      { name: 'show_temperature', selector: { boolean: {} } },
      { name: 'live_states', selector: { boolean: {} } },
      { name: 'show_signal', selector: { boolean: {} } },
    ];
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    this._loadSpaces();
    return html`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this._schema}
      .computeLabel=${(s: any) => LABELS[s.name] || s.name}
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
