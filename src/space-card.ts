/**
 * houseplan-space-card — a READ-ONLY, static schematic of a single houseplan space,
 * embeddable on any dashboard. Renders exactly what is configured (plan + configured
 * room borders/names + device markers at their saved positions) with NO interactivity
 * (no clicks/hover/tooltips/drag/more-info) and NO live states. A footer button opens
 * the space in the full component via a deep-link (`#space=<id>`).
 */
import { LitElement, html, nothing, css, type TemplateResult, type PropertyValues } from 'lit';
import { cardStyles } from './styles';
import { renderSpaceStatic, spaceModels } from './space-render';
import { getConfig, onConfigChange, cachedSnapshot, type HpConfigSnapshot } from './config-store';
import { t, langOf, type Lang } from './i18n';
import { ContentSigner } from './signing';
import { referencedContentUrls } from './logic';
import './space-editor';

const fireEvent = (node: EventTarget, type: string, detail?: unknown) => {
  const ev = new Event(type, { bubbles: true, composed: true }) as any;
  ev.detail = detail ?? {};
  node.dispatchEvent(ev);
};
const navigate = (path: string) => {
  history.pushState(null, '', path);
  fireEvent(window, 'location-changed', { replace: false });
};

interface SpaceCardConfig {
  type: string;
  space: string;
  title?: string;
  show_button?: boolean;
  button_label?: string;
  button_target?: string;
  icon_size?: number;
  language?: string;
}

class HouseplanSpaceCard extends LitElement {
  public hass?: any;
  private _config?: SpaceCardConfig;
  private _snap: HpConfigSnapshot | null = null;
  private _loading = false;
  private _unsub?: () => void;
  private _stageWidth = 0;
  private _stageObserver?: ResizeObserver;
  private _observedStage?: HTMLElement;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _snap: { state: true },
  };

  public static getConfigElement() {
    return document.createElement('houseplan-space-card-editor');
  }

  public static getStubConfig(hass: any): Partial<SpaceCardConfig> {
    const snap = cachedSnapshot();
    const first = spaceModels(snap?.config || null)[0]?.id || '';
    return { type: 'custom:houseplan-space-card', space: first, show_button: true };
  }

  public setConfig(config: SpaceCardConfig): void {
    if (!config || !config.space) {
      throw new Error('houseplan-space-card: "space" is required');
    }
    this._config = { show_button: true, button_target: '/plan-doma', ...config };
    // instant paint from the full card's localStorage snapshot, refresh in the background
    this._snap = this._snap || cachedSnapshot();
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._unsub = onConfigChange(() => {
      this._loading = false;
      this._snap = null;
      this.requestUpdate();
    });
    // a dashboard on a wall tablet outlives a 24 h signature
    this._signer.start(() => this.hass, () => this._referenced());
  }

  public disconnectedCallback(): void {
    this._unsub?.();
    this._unsub = undefined;
    this._stageObserver?.disconnect();
    this._stageObserver = undefined;
    this._observedStage = undefined;
    this._signer.dispose();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (this.hass && !this._loading && (!this._snap || changed.has('hass'))) {
      if (!this._snap || !this._loadedOnce) this._load();
    }
  }

  protected updated(): void {
    const stage = this.renderRoot.querySelector<HTMLElement>('.hp-static-stage') || undefined;
    if (stage === this._observedStage) return;
    this._stageObserver?.disconnect();
    this._observedStage = stage;
    if (!stage) {
      this._stageObserver = undefined;
      return;
    }
    const measure = () => {
      const width = stage.clientWidth;
      if (width > 0 && Math.abs(width - this._stageWidth) > 0.5) {
        this._stageWidth = width;
        this.requestUpdate();
      }
    };
    this._stageObserver = new ResizeObserver(measure);
    this._stageObserver.observe(stage);
    measure();
  }

  private _loadedOnce = false;
  private async _load(): Promise<void> {
    if (!this.hass || this._loading) return;
    this._loading = true;
    try {
      const snap = await getConfig(this.hass);
      this._snap = snap;
      this._loadedOnce = true;
    } catch {
      /* keep any localStorage snapshot */
    } finally {
      this._loading = false;
      this.requestUpdate();
    }
  }

  private get _lang(): Lang {
    return langOf(this.hass, this._config?.language);
  }

  public getCardSize(): number {
    const models = spaceModels(this._snap?.config || null);
    const sp = models.find((s) => s.id === this._config?.space);
    if (sp) {
      const ratio = sp.vb[3] / sp.vb[2]; // h/w
      return Math.max(3, Math.round(ratio * 8)) + (this._config?.show_button === false ? 0 : 1);
    }
    return 6;
  }

  private _errorCard(msg: string): TemplateResult {
    return html`<ha-card><div class="hp-static-error">${msg}</div></ha-card>`;
  }

  /**
   * Same signer as the main card (review R3-2). The previous copy here signed
   * the url and then threw it away: `getCardSize()` mutated a throwaway model
   * while `render()` rebuilt its own from the config, so the <image> kept
   * asking for the raw protected path and got a 401 on every render.
   */
  private _signer = new ContentSigner(() => this.requestUpdate());

  private _referenced(): Set<string> {
    return referencedContentUrls(this._snap?.config);
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this._config) return nothing;
    const cfg = this._snap?.config;
    if (!cfg) {
      // still loading and no snapshot yet
      return html`<ha-card><div class="hp-static-error">${t(this._lang, 'space_card.loading')}</div></ha-card>`;
    }
    const spaceId = this._config.space;
    const stage = renderSpaceStatic({
      hass: this.hass,
      cfg,
      layout: this._snap?.layout || {},
      spaceId,
      iconSize: this._config.icon_size,
      stageWidth: this._stageWidth,
      lang: this._lang,
      // resolved at render time: a url baked in earlier would be the unsigned one
      displayUrl: (raw) => this._signer.display(this.hass, raw),
    });
    if (!stage) {
      return this._errorCard(t(this._lang, 'space_card.not_found', { id: spaceId }));
    }
    const sp = spaceModels(cfg).find((s) => s.id === spaceId);
    const title = this._config.title !== undefined ? this._config.title : sp?.title || '';
    const showButton = this._config.show_button !== false;
    const label = this._config.button_label || t(this._lang, 'space_card.button');
    return html`
      <ha-card>
        ${title ? html`<div class="hp-static-title">${title}</div>` : nothing}
        ${stage}
        ${showButton
          ? html`<div class="hp-static-foot">
              <button class="hp-static-btn" @click=${this._goToSpace}>${label}</button>
            </div>`
          : nothing}
      </ha-card>
    `;
  }

  private _goToSpace = (): void => {
    const base = (this._config?.button_target || '/plan-doma').replace(/#.*$/, '');
    navigate(`${base}#space=${encodeURIComponent(this._config!.space)}`);
  };

  static styles = [
    cardStyles,
    css`
      .hp-static-title {
        font-weight: 700;
        padding: 10px 14px 6px;
        font-size: 16px;
        color: var(--primary-text-color);
      }
      .hp-static-stage {
        position: relative;
        width: 100%;
        container-type: inline-size;
        overflow: hidden;
        pointer-events: none; /* kill ALL interaction on the schematic (§4) */
        background: var(--ha-card-background, var(--card-background-color, #111));
      }
      .hp-static-stage svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }
      /* Opaque plan paper — the scene bg_color/daynight sky shows only AROUND
         the plan (owner 2026-08-03). The static card keeps its historical
         canvas colour: the theme card background. Drawn plans paper the room
         contours (per-room shapes, fill only, no stroke) — same contract as
         the full card. */
      .hp-paper {
        fill: var(--ha-card-background, var(--card-background-color, #111));
        stroke: none;
      }
      .wallbody-fill {
        fill: var(--wall-fill, #ffffff);
        fill-opacity: var(--wall-fill-op, 1);
        fill-rule: evenodd;
        stroke: none;
        pointer-events: none;
      }
      .wallbody {
        fill: url(#hp-wall-hatch);
        fill-rule: evenodd;
        stroke: var(--room-stroke, var(--hp-muted, #607d8b));
        stroke-width: 0.6;
        pointer-events: none;
      }
      .wallbody.solid {
        fill: none;
      }
      .hp-static-stage .devlayer {
        position: absolute;
        inset: 0;
      }
      .hp-static-foot {
        padding: 8px 12px 12px;
        pointer-events: auto; /* the button stays clickable */
      }
      .hp-static-btn {
        width: 100%;
        padding: 9px 14px;
        border: none;
        border-radius: 10px;
        background: var(--primary-color, #3ea6ff);
        color: var(--text-primary-color, #fff);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }
      .hp-static-btn:hover {
        filter: brightness(1.08);
      }
      .hp-static-error {
        padding: 24px;
        text-align: center;
        color: var(--secondary-text-color, #9aa4ad);
      }
    `,
  ];
}

if (!customElements.get('houseplan-space-card')) {
  customElements.define('houseplan-space-card', HouseplanSpaceCard);
}

(window as any).customCards = (window as any).customCards || [];
if (!(window as any).customCards.find((c: any) => c.type === 'houseplan-space-card')) {
  (window as any).customCards.push({
    type: 'houseplan-space-card',
    name: 'House Plan — Space (static)',
    description: 'Read-only static schematic of a single houseplan space, with a deep-link button.',
    preview: false,
    documentation: 'https://github.com/Matysh/houseplan-card',
  });
}

export { HouseplanSpaceCard };
