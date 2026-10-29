import './houseplan-card';
import { parseRouteKiosk } from './panel-route-kiosk';
import type { RouteKiosk } from './route-kiosk';

const sameRouteKiosk = (a: RouteKiosk, b: RouteKiosk): boolean =>
  a.enabled === b.enabled && a.position === b.position && a.profile === b.profile
    && JSON.stringify(a.overrides ?? {}) === JSON.stringify(b.overrides ?? {});

interface PanelRoute { prefix?: string; path?: string; }

interface HouseplanCardElement extends HTMLElement {
  hass?: unknown;
  panelHost: boolean;
  narrow: boolean | null;
  routeKiosk: RouteKiosk;
  setConfig(config: { type: 'custom:houseplan-card' }): void;
}

/** Properties Home Assistant assigns to a custom panel element, in its order. */
const PRE_UPGRADE_PROPERTIES = ['panel', 'hass', 'narrow', 'route'] as const;

/** Home Assistant custom-panel shell; the existing card owns all product state. */
export class HouseplanPanel extends HTMLElement {
  private _hass?: unknown;
  private _narrow = false;
  private _route?: unknown;
  private _panel?: unknown;
  private _card?: HouseplanCardElement;
  private _acceptedUrl = '';
  private _acceptedRoute?: unknown;
  private _pendingRoute?: { intent: RouteKiosk; url: string; route: unknown };
  private readonly _onLocationChanged = (): void => {
    const prefix = new URL(this._acceptedUrl || location.pathname, location.origin).pathname.split('/').slice(0, 2).join('/');
    if (location.pathname.split('/').slice(0, 2).join('/') !== prefix) return;
    this.route = { prefix, path: location.pathname.slice(prefix.length) };
  };
  private readonly _onRouteApplied = (): void => {
    const pending = this._pendingRoute;
    if (!pending || !this._card || !sameRouteKiosk(pending.intent, this._card.routeKiosk)) return;
    const moved = this._url() !== pending.url;
    this._route = pending.route;
    this._acceptedRoute = pending.route;
    this._acceptedUrl = pending.url;
    this._pendingRoute = undefined;
    if (moved) {
      history.replaceState(history.state, '', this._acceptedUrl);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
    }
  };

  public constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._adoptPreUpgradeProperties();
  }

  public connectedCallback(): void {
    this._adoptPreUpgradeProperties();
    this._ensureShell();
    window.addEventListener('location-changed', this._onLocationChanged);
    window.addEventListener('popstate', this._onLocationChanged);
  }

  public disconnectedCallback(): void {
    window.removeEventListener('location-changed', this._onLocationChanged);
    window.removeEventListener('popstate', this._onLocationChanged);
    this._pendingRoute = undefined;
  }

  /** Home Assistant creates the panel element and assigns `hass`/`narrow`/
   *  `route`/`panel` as soon as the module script fires `load`; with the
   *  top-level `await import('./houseplan-card.js')` in this entry the class is
   *  defined a moment later, so those values land as OWN data properties that
   *  shadow the accessors below for the life of the element (#488). Re-route
   *  them through the accessors once, in HA's own assignment order. */
  private _adoptPreUpgradeProperties(): void {
    for (const key of PRE_UPGRADE_PROPERTIES) {
      if (!Object.prototype.hasOwnProperty.call(this, key)) continue;
      const value = (this as unknown as Record<string, unknown>)[key];
      delete (this as unknown as Record<string, unknown>)[key];
      (this as unknown as Record<string, unknown>)[key] = value;
    }
  }

  public get hass(): unknown | undefined { return this._hass; }
  public set hass(value: unknown | undefined) {
    this._hass = value;
    this._ensureShell();
    if (this._card) this._card.hass = value;
  }

  public get narrow(): boolean { return this._narrow; }
  public set narrow(value: boolean) {
    this._narrow = Boolean(value);
    this.toggleAttribute('narrow', this._narrow);
    if (this._card) this._card.narrow = this._narrow;
  }

  public get route(): unknown { return this._route; }
  public set route(value: unknown) { this._route = value; this._applyRouteKiosk(); }

  public get panel(): unknown { return this._panel; }
  public set panel(value: unknown) { this._panel = value; }

  private _url(): string { return location.pathname + location.search + location.hash; }

  private _applyRouteKiosk(): void {
    if (!this._card) return;
    const route = this._route as PanelRoute | undefined;
    const prefix = route?.prefix || location.pathname.split('/').slice(0, 2).join('/');
    // The fallback also accepts the older demo's full-path route shape.
    let path = route?.path ?? location.pathname.slice(prefix.length);
    if (path === prefix || path.startsWith(prefix + '/')) path = path.slice(prefix.length);
    const intent = parseRouteKiosk(path, location.search);
    this._pendingRoute = { intent, url: this._url(), route: this._route };
    this._card.routeKiosk = intent;
    if (sameRouteKiosk(intent, this._card.routeKiosk)) this._onRouteApplied();
    else if (this._acceptedUrl) {
      // An existing draft decision owns the old page until it resumes this intent.
      history.replaceState(history.state, '', this._acceptedUrl);
      this._route = this._acceptedRoute;
    }
  }

  private _ensureShell(): void {
    if (this._card || !this.shadowRoot) return;

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
        /* HA mounts a custom panel inside <ha-panel-custom>, a block with
         * safe-area padding and NO height, so a percentage here resolves to
         * auto and the stage collapses to 0 px (#488). Take the viewport
         * like HA's own iframe panels do, minus the insets HA pads with. */
        height: 100vh;
        height: calc(100dvh - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px));
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
        grid-template-rows: minmax(0, 1fr);
        overflow: hidden;
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
    const content = document.createElement('main');
    content.className = 'content';
    const card = document.createElement('houseplan-card') as HouseplanCardElement;
    card.panelHost = true;
    card.narrow = this._narrow;
    card.addEventListener('hp-route-kiosk-applied', this._onRouteApplied);
    this._card = card;
    this._applyRouteKiosk();
    card.setConfig({ type: 'custom:houseplan-card' });
    if (this._hass !== undefined) card.hass = this._hass;
    content.append(card);
    page.append(content);
    this.shadowRoot.append(style, page);
    this._card = card;
  }


}

if (!customElements.get('houseplan-panel')) {
  customElements.define('houseplan-panel', HouseplanPanel);
}
