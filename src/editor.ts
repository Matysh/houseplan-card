/** Редактор конфигурации карточки (GUI в Lovelace). */
import { LitElement, html, nothing } from 'lit';

const SCHEMA = [
  { name: 'title', selector: { text: {} } },
  {
    name: 'default_floor',
    selector: {
      select: {
        mode: 'dropdown',
        options: [
          { value: 'f1', label: '1 этаж' },
          { value: 'f2', label: '2 этаж' },
          { value: 'yard', label: 'Двор' },
        ],
      },
    },
  },
  { name: 'icon_size', selector: { number: { min: 14, max: 48, mode: 'box' } } },
  { name: 'show_temperature', selector: { boolean: {} } },
  { name: 'live_states', selector: { boolean: {} } },
];

const LABELS: Record<string, string> = {
  title: 'Заголовок',
  default_floor: 'Этаж по умолчанию',
  icon_size: 'Размер иконок, px',
  show_temperature: 'Показывать температуру',
  live_states: 'Живые состояния (вкл/выкл, открыто…)',
};

class HouseplanCardEditor extends LitElement {
  public hass?: any;
  private _config?: any;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  public setConfig(config: any): void {
    this._config = config;
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    return html`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${SCHEMA}
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
