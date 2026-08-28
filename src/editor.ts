/** Card configuration editor (Lovelace GUI). */
import { LitElement, html, nothing, noChange } from 'lit';
import { langOf, t, type Lang } from './i18n';
import { LANGUAGE_RUNTIME, languageOptions } from './i18n/registry';
import { languageLoadingTemplate, languageRenderGate } from './i18n/language-runtime';
import { invalidDefaultFloor } from './card-editor-validation';

class HouseplanCardEditor extends LitElement {
  public hass?: any;
  private _config?: any;
  private _spaces: { value: string; label: string }[] | null = null;
  private _spacesLoading = false;
  private _spacesAuthoritative = false;

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
      this._spacesAuthoritative = true;
    } catch {
      this._spaces = [];
      this._spacesAuthoritative = false;
    } finally {
      this._spacesLoading = false;
    }
  }

  private get _lang(): Lang {
    return langOf(this.hass, this._config?.language);
  }

  private get _floorToken(): string | null {
    const value = this._config?.floor;
    return typeof value === 'number' ? `__houseplan_yaml_floor_index__:${String(value)}` : null;
  }

  private get _formData(): any {
    const data = { ...this._config };
    const token = this._floorToken;
    if (token) data.floor = token;
    else if (!Object.prototype.hasOwnProperty.call(data, 'floor')) data.floor = '';
    return data;
  }

  private get _schema(): any[] {
    const spaces = this._spaces || [];
    const L = this._lang;
    const floorOptions: { value: string; label: string }[] = [
      { value: '', label: t(L, 'editor.floor_none') },
    ];
    const token = this._floorToken;
    if (token) {
      floorOptions.push({
        value: token,
        label: t(L, 'editor.floor_index', { index: String(this._config?.floor) }),
      });
    }
    const currentFloor = typeof this._config?.floor === 'string' ? this._config.floor : '';
    if (currentFloor && !spaces.some((space) => space.value === currentFloor)) {
      floorOptions.push({ value: currentFloor, label: currentFloor });
    }
    floorOptions.push(...spaces);
    const currentDefault = typeof this._config?.default_floor === 'string'
      ? this._config.default_floor : '';
    const defaultFloorOptions = [...spaces];
    if (currentDefault && !spaces.some((space) => space.value === currentDefault)) {
      defaultFloorOptions.unshift({ value: currentDefault, label: currentDefault });
    }
    return [
      { name: 'title', selector: { text: {} } },
      {
        name: 'floor',
        selector: { select: { mode: 'dropdown', options: floorOptions } },
      },
      spaces.length
        ? {
            name: 'default_floor',
            selector: { select: { mode: 'dropdown', options: defaultFloorOptions } },
          }
        : { name: 'default_floor', selector: { text: {} } },
      {
        name: 'language',
        selector: {
          select: {
            mode: 'dropdown',
            options: languageOptions(t(L, 'editor.lang_auto'), this._config?.language),
          },
        },
      },
      { name: 'icon_size', selector: { number: { min: 1, max: 6, step: 0.1, mode: 'box' } } },
      { name: 'show_temperature', selector: { boolean: {} } },
      { name: 'live_states', selector: { boolean: {} } },
      { name: 'show_signal', selector: { boolean: {} } },
      { name: 'kiosk', selector: { boolean: {} } },
      { name: 'cycle', selector: { number: { min: 0, max: 3600, step: 5, mode: 'box' } } },
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
      title: t(L, 'editor.title'),
      floor: t(L, 'editor.floor'),
      default_floor: t(L, 'editor.default_floor'),
      language: t(L, 'editor.language'),
      icon_size: t(L, 'editor.icon_size'),
      show_temperature: t(L, 'editor.show_temperature'),
      live_states: t(L, 'editor.live_states'),
      show_signal: t(L, 'editor.show_signal'),
      kiosk: t(L, 'editor.kiosk'),
      cycle: t(L, 'editor.cycle'),
    };
    const schema = this._schema;
    const missingDefault = invalidDefaultFloor(
      this._config, this._spaces, this._spacesAuthoritative,
    );
    const form = (part: any[]) => html`<ha-form
        .hass=${this.hass}
        .data=${this._formData}
        .schema=${part}
        .computeLabel=${(s: any) => labels[s.name] || s.name}
        @value-changed=${this._valueChanged}
      ></ha-form>`;
    return html`
      ${form(schema.slice(0, 3))}
      ${missingDefault ? html`<div class="default-floor-error" role="alert"
        style="color:var(--error-color,#db4437);margin:-4px 0 12px;overflow-wrap:anywhere">
        ${t(L, 'editor.default_floor_missing', { id: missingDefault })}
      </div>` : nothing}
      ${form(schema.slice(3))}
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...this._config, ...ev.detail.value };
    if (config.floor === '') delete config.floor;
    else if (config.floor === this._floorToken) config.floor = this._config?.floor;
    const e = new Event('config-changed', { bubbles: true, composed: true }) as any;
    e.detail = { config };
    this.dispatchEvent(e);
  }
}

if (!customElements.get('houseplan-card-editor')) {
  customElements.define('houseplan-card-editor', HouseplanCardEditor);
}
