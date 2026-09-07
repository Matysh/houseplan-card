import './houseplan-card';

interface HouseplanCardElement extends HTMLElement {
  hass?: unknown;
  panelHost: boolean;
  setConfig(config: { type: 'custom:houseplan-card' }): void;
}

interface HomeAssistantPanelHost {
  localize?: (key: string) => string | undefined;
}

/** Home Assistant custom-panel shell; the existing card owns all product state. */
export class HouseplanPanel extends HTMLElement {
  private _hass?: HomeAssistantPanelHost;
  private _narrow = false;
  private _route?: unknown;
  private _panel?: unknown;
  private _card?: HouseplanCardElement;
  private _menuButton?: HTMLButtonElement;

  public constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  public connectedCallback(): void {
    this._ensureShell();
  }

  public get hass(): HomeAssistantPanelHost | undefined { return this._hass; }
  public set hass(value: HomeAssistantPanelHost | undefined) {
    this._hass = value;
    this._ensureShell();
    if (this._card) this._card.hass = value;
    this._syncMenuLabel();
  }

  public get narrow(): boolean { return this._narrow; }
  public set narrow(value: boolean) {
    this._narrow = Boolean(value);
    this.toggleAttribute('narrow', this._narrow);
  }

  public get route(): unknown { return this._route; }
  public set route(value: unknown) { this._route = value; }

  public get panel(): unknown { return this._panel; }
  public set panel(value: unknown) { this._panel = value; }

  private _ensureShell(): void {
    if (this._card || !this.shadowRoot) return;

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        color: var(--primary-text-color);
        background: var(--primary-background-color);
      }
      .page {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        overflow: hidden;
      }
      .appbar {
        box-sizing: border-box;
        min-width: 0;
        min-height: var(--header-height, 56px);
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 16px;
        background: var(--app-header-background-color, var(--primary-background-color));
        color: var(--app-header-text-color, var(--primary-text-color));
        border-bottom: 1px solid var(--divider-color);
        z-index: 1;
      }
      .toolbar {
        min-width: 0;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .menu {
        box-sizing: border-box;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        margin: 0;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 50%;
        color: inherit;
        background: transparent;
        cursor: pointer;
      }
      .menu:focus-visible {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
      }
      @media (hover: hover) {
        .menu:hover { background: var(--secondary-background-color); }
      }
      .menu ha-icon { --mdc-icon-size: 24px; }
      .title {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 20px;
        font-weight: 500;
        line-height: 1.2;
      }
      .title ha-icon {
        --mdc-icon-size: 24px;
        color: var(--primary-color);
      }
      .content {
        min-width: 0;
        min-height: 0;
        overflow: hidden;
      }
      houseplan-card {
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
      }
    `;

    const page = document.createElement('div');
    page.className = 'page';
    const appbar = document.createElement('header');
    appbar.className = 'appbar';
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    toolbar.setAttribute('role', 'toolbar');

    const menu = document.createElement('button');
    menu.className = 'menu';
    menu.type = 'button';
    menu.innerHTML = '<ha-icon icon="mdi:menu"></ha-icon>';
    menu.addEventListener('click', () => {
      menu.dispatchEvent(new CustomEvent('hass-toggle-menu', {
        bubbles: true,
        composed: true,
      }));
    });
    this._menuButton = menu;

    const title = document.createElement('div');
    title.className = 'title';
    title.setAttribute('role', 'heading');
    title.setAttribute('aria-level', '1');
    title.innerHTML = '<ha-icon icon="mdi:floor-plan"></ha-icon><span>House Plan</span>';
    toolbar.append(menu, title);
    appbar.append(toolbar);

    const content = document.createElement('main');
    content.className = 'content';
    const card = document.createElement('houseplan-card') as HouseplanCardElement;
    card.panelHost = true;
    card.setConfig({ type: 'custom:houseplan-card' });
    if (this._hass !== undefined) card.hass = this._hass;
    content.append(card);
    page.append(appbar, content);
    this.shadowRoot.append(style, page);
    this._card = card;
    this._syncMenuLabel();
  }

  private _syncMenuLabel(): void {
    if (!this._menuButton) return;
    const label = this._hass?.localize?.('ui.common.menu')
      || this._hass?.localize?.('ui.panel.lovelace.menu')
      || 'Menu';
    this._menuButton.setAttribute('aria-label', label);
    this._menuButton.title = label;
  }
}

if (!customElements.get('houseplan-panel')) {
  customElements.define('houseplan-panel', HouseplanPanel);
}
