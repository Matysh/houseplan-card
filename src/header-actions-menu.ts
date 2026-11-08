import { nothing, type TemplateResult } from 'lit';
import { EditorContextMenu, type EditorMenuModel } from './editor-context-menu';
import { adoptEditorContextMenuStyles } from './editor-context-menu-adoption';

/** The original controls remain the command owners, including dirty-navigation
 * guards and HA event dispatch. The sheet only presents their current snapshot. */
export class HeaderActionsMenu {
  private model: EditorMenuModel | null = null;
  private readonly presentation: EditorContextMenu;
  constructor(private readonly host: { renderRoot: DocumentFragment | HTMLElement; requestUpdate(): void }) {
    this.presentation = new EditorContextMenu(() => host.requestUpdate());
    adoptEditorContextMenuStyles(host);
  }
  get open(): boolean { return !!this.model; }
  close(): void { this.model = null; this.presentation.retire(); this.host.requestUpdate(); }
  dispose(): void { this.model = null; this.presentation.dispose(); }
  show(head: HTMLElement, trigger: HTMLButtonElement, label: string, current: () => boolean): void {
    const commands = [...head.querySelectorAll<HTMLButtonElement>('button')].filter(button =>
      button !== trigger && button.dataset.hp !== 'space-tab');
    const state = (button: HTMLButtonElement) => JSON.stringify([button.disabled,
      button.getAttribute('aria-disabled'),button.getAttribute('aria-label'),button.getAttribute('aria-pressed'),
      button.getAttribute('aria-current'),button.classList.contains('active')]);
    const snapshot = commands.map(button => [button, state(button)] as const);
    this.model = { token: {}, hp: 'header-actions-menu', label, density: 'touch',
      anchor: () => trigger.getBoundingClientRect(), minWidth: trigger.getBoundingClientRect().width,
      trigger, returnFocus: trigger, current: () => current() && snapshot.every(([button,accepted]) => button.isConnected && state(button) === accepted),
      close: () => this.close(),
      items: commands.map((button,index) => ({ key: String(index), action: button.dataset.editorNavigation
          ? 'mode-' + button.dataset.editorNavigation : button.dataset.hp || String(index),
        label: button.getAttribute('aria-label') || button.getAttribute('data-hp-tooltip') || button.title || button.textContent?.trim() || '',
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
