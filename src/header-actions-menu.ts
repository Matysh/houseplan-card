import { html, nothing, type TemplateResult } from 'lit';
import { EditorContextMenu, type EditorMenuModel } from './editor-context-menu';
import { adoptEditorContextMenuStyles } from './editor-context-menu-adoption';
import { floatingViewport } from './floating-surface';

const headerMenuLabel = (button: HTMLButtonElement): TemplateResult => {
  const label = button.getAttribute('aria-label') || button.getAttribute('data-hp-tooltip') || button.title || button.textContent?.trim() || '';
  const source = button.querySelector('ha-icon');
  const svg = !source ? button.querySelector('svg')?.cloneNode(true) as SVGElement | undefined : undefined;
  if (svg) { svg.removeAttribute('class'); svg.setAttribute('aria-hidden', 'true'); }
  const fallback: Record<string, string> = { 'space-settings': 'mdi:cog-outline', 'space-add': 'mdi:plus',
    'summary-toggle': 'mdi:page-layout-sidebar-right', 'summary-settings': 'mdi:cog-outline', 'editor-close': 'mdi:close' };
  const icon = source?.getAttribute('icon') || (source as HTMLElement & { icon?: string } | null)?.icon
    || fallback[button.dataset.hp || ''] || 'mdi:cog-outline';
  return html`<span class="header-menu-label">${svg || html`<ha-icon icon=${icon} aria-hidden="true"></ha-icon>`}<span>${label}</span></span>`;
};

/** The original controls remain the command owners, including dirty-navigation
 * guards and HA event dispatch. The sheet only presents their current snapshot. */
export class HeaderActionsMenu {
  private model: EditorMenuModel | null = null;
  private readonly presentation: EditorContextMenu;
  constructor(private readonly host: { renderRoot: DocumentFragment | HTMLElement; requestUpdate(): void; getBoundingClientRect(): DOMRect }) {
    this.presentation = new EditorContextMenu(() => host.requestUpdate());
    adoptEditorContextMenuStyles(host);
  }
  get open(): boolean { return !!this.model; }
  close(): void { this.model = null; this.presentation.retire(); this.host.requestUpdate(); }
  dispose(): void { this.model = null; this.presentation.dispose(); }
  show(head: HTMLElement, trigger: HTMLButtonElement, label: string, current: () => boolean): void {
    const commands = [...head.querySelectorAll<HTMLButtonElement>('button')].filter(button =>
      button !== trigger && !['space-tab', 'panel-menu', 'zoom-out', 'zoom-fit', 'zoom-in'].includes(button.dataset.hp || ''));
    const state = (button: HTMLButtonElement) => JSON.stringify([button.disabled,
      button.getAttribute('aria-disabled'),button.getAttribute('aria-label'),button.getAttribute('aria-pressed'),
      button.getAttribute('aria-current'),button.classList.contains('active')]);
    const snapshot = commands.map(button => [button, state(button)] as const);
    this.model = { token: {}, hp: 'header-actions-menu', label, density: 'touch', presentation: 'disclosure',
      anchor: () => trigger.getBoundingClientRect(), minWidth: trigger.getBoundingClientRect().width,
      viewport: () => {
        const viewport = floatingViewport(window), bounds = this.host.getBoundingClientRect(), header = head.getBoundingClientRect();
        const left = Math.max(viewport.left, bounds.left);
        const right = Math.min(viewport.left + viewport.width, bounds.right);
        const top = Math.max(viewport.top, header.bottom), bottom = Math.min(viewport.top + viewport.height, bounds.bottom);
        return { ...viewport, left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
      },
      trigger, returnFocus: trigger, current: () => current() && snapshot.every(([button,accepted]) => button.isConnected && state(button) === accepted),
      close: () => this.close(),
      items: commands.map((button,index) => ({ key: String(index), action: button.dataset.editorNavigation
          ? 'mode-' + button.dataset.editorNavigation : button.dataset.hp || String(index),
        label: headerMenuLabel(button),
        disabled: button.disabled || button.getAttribute('aria-disabled') === 'true',
        current: button.classList.contains('active') || button.getAttribute('aria-current') === 'page',
        pressed: button.hasAttribute('aria-pressed') ? button.getAttribute('aria-pressed') === 'true' : undefined,
        invoke: () => { this.close(); button.click(); },
      })),
    };
    this.host.requestUpdate();
  }
  render(): TemplateResult | typeof nothing {
    if (this.model && !this.model.current()) this.close();
    return this.presentation.render(this.model);
  }
}
