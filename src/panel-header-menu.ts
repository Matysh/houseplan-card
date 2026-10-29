import { html, nothing, type TemplateResult } from 'lit';

export interface PanelMenuHass {
  dockedSidebar?: string;
  kioskMode?: boolean;
  auth?: { external?: { config?: { hasSidebar?: boolean } } };
  localize?: (key: string) => string | undefined;
}

/** Public custom-panel inputs; no native registration, context or HA I/O. */
export function panelMenuState(
  hass: PanelMenuHass | null | undefined, narrow: boolean, kiosk: boolean, fallback: string,
): { visible: boolean; label: string } {
  let label = fallback;
  for (const key of ['ui.sidebar.sidebar_toggle', 'ui.common.menu', 'ui.panel.lovelace.menu']) {
    const translated = hass?.localize?.(key);
    if (translated && translated !== key) { label = translated; break; }
  }
  // HA20240605 has no kioskMode field; a known modern true still hides.
  // Consistently use modern external-sidebar policy on supported HA versions.
  const visible = !kiosk && hass?.kioskMode !== true
    && hass?.auth?.external?.config?.hasSidebar !== true
    && (narrow || hass?.dockedSidebar === 'always_hidden');
  return { visible, label };
}

export function panelMenuKey(
  hass: PanelMenuHass | null | undefined, narrow: boolean, fallback: string,
): string {
  const state = panelMenuState(hass, narrow, false, fallback);
  return JSON.stringify([state.visible, state.label]);
}

export function renderPanelMenu(state: { visible: boolean; label: string }): TemplateResult | typeof nothing {
  if (!state.visible) return nothing;
  return html`<button class="panel-menu" type="button" data-hp="panel-menu"
    aria-label=${state.label} title=${state.label}
    @click=${(event: Event) => event.currentTarget?.dispatchEvent(new CustomEvent('hass-toggle-menu', {
      bubbles: true, composed: true,
    }))}><ha-icon icon="mdi:menu"></ha-icon></button>`;
}
