/** Card configuration editor (Lovelace GUI). */
import { LitElement, html, nothing, noChange } from 'lit';
import { langOf, type Lang } from './i18n';
import { languageOptions } from './i18n/registry';
import { SETTINGS_LANGUAGE_RUNTIME as CARD_EDITOR_LANGUAGE_RUNTIME, settingsT } from './i18n/settings';
import { languageLoadingTemplate, languageRenderGate } from './i18n/language-runtime';
import { invalidDefaultFloor, invalidCardRotation, fullCardPresentationConfig, invalidFullCardPresentation } from './card-editor-validation';
import { validPlanRotation } from './view-frame';

class HouseplanCardEditor extends LitElement {
  public hass?: any;
  private _config?: any;
  private _spaces: { value: string; label: string }[] | null = null;
  private _spacesLoading = false;
  private _spacesAuthoritative = false;
  private _inheritedIso = false;

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
      this._inheritedIso = resp?.config?.settings?.volumetric_view === true;
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
    const data = { ...this._config, view: this._config?.view ?? '',
      plan_rotation: this._config?.plan_rotation === undefined ? '' : String(this._config.plan_rotation) };
    const token = this._floorToken;
    if (token) data.floor = token;
    else if (!Object.prototype.hasOwnProperty.call(data, 'floor')) data.floor = '';
    return data;
  }

  private get _schema(): any[] {
    const spaces = this._spaces || [];
    const L = this._lang;
    const floorOptions: { value: string; label: string }[] = [
      { value: '', label: settingsT(L, 'editor.floor_none') },
    ];
    const token = this._floorToken;
    if (token) {
      floorOptions.push({
        value: token,
        label: settingsT(L, 'editor.floor_index', { index: String(this._config?.floor) }),
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
    const iso = this._config?.view === 'iso' || this._config?.view === undefined && this._inheritedIso;
    const legacyRotation = this._config?.rotation;
    const rotationOptions = [{ value: '', label: settingsT(L, 'editor.rotation_inherit') }];
    for (let angle = 0; angle < 360; angle += iso ? 45 : 90) {
      rotationOptions.push({ value: String(angle), label: `${angle}°` });
    }
    const authoredAngle = this._config?.plan_rotation;
    if (validPlanRotation(authoredAngle) && !rotationOptions.some(option => option.value === String(authoredAngle))) {
      rotationOptions.push({ value: String(authoredAngle), label: `${authoredAngle}°` });
    }
    const viewOptions = [
      { value: '', label: settingsT(L, 'screens.view_inherit') },
      { value: 'flat', label: settingsT(L, 'screens.view_flat') },
      { value: 'iso', label: settingsT(L, 'screens.view_iso') },
    ];
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
            options: languageOptions(settingsT(L, 'editor.lang_auto'), this._config?.language),
          },
        },
      },
      { name: 'icon_size', selector: { number: { min: 1, max: 6, step: 0.1, mode: 'box' } } },
      { name: 'view', selector: { select: { mode: 'dropdown', options: viewOptions } } },
      { name: 'plan_rotation', selector: { select: { mode: 'dropdown', options: rotationOptions } },
        ...(Number.isInteger(legacyRotation) && [0, 90, 180, 270].includes(legacyRotation)
          ? { description: settingsT(L, 'editor.rotation_legacy', { angle: legacyRotation }) } : {}) },
      { name: 'show_temperature', selector: { boolean: {} } },
      { name: 'live_states', selector: { boolean: {} } },
      { name: 'kiosk', selector: { boolean: {} } },
      { name: 'cycle', selector: { number: { min: 0, max: 3600, step: 5, mode: 'box' } } },
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
      title: settingsT(L, 'editor.title'),
      floor: settingsT(L, 'editor.floor'),
      default_floor: settingsT(L, 'editor.default_floor'),
      language: settingsT(L, 'editor.language'),
      icon_size: settingsT(L, 'editor.icon_size'),
      view: settingsT(L, 'screens.view'),
      plan_rotation: settingsT(L, 'editor.rotation'),
      show_temperature: settingsT(L, 'editor.show_temperature'),
      live_states: settingsT(L, 'editor.live_states'),
      kiosk: settingsT(L, 'editor.kiosk'),
      cycle: settingsT(L, 'editor.cycle'),
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
        .computeHelper=${(s: any) => s.description ?? ''}
        @value-changed=${this._valueChanged}
      ></ha-form>`;
    return html`
      ${form(schema.slice(0, 3))}
      ${missingDefault ? html`<div class="default-floor-error" role="alert"
        style="color:var(--error-color,#db4437);margin:-4px 0 12px;overflow-wrap:anywhere">
        ${settingsT(L, 'editor.default_floor_missing', { id: missingDefault })}
      </div>` : nothing}
      ${form(schema.slice(3))}
      ${invalidFullCardPresentation(this._config) ? html`<div class="card-config-error" role="alert"
        style="color:var(--error-color,#db4437)">${settingsT(L, 'editor.presentation_invalid')}</div>` : nothing}
      ${this._config.plan_rotation === undefined && invalidCardRotation(this._config) ? html`<div class="card-config-error" role="alert"
        style="color:var(--error-color,#db4437)">${settingsT(L, 'editor.rotation_invalid')}</div>` : nothing}
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    if (CARD_EDITOR_LANGUAGE_RUNTIME.state(this._lang) === 'pending') return;
    const config = fullCardPresentationConfig(this._config, ev.detail.value);
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
