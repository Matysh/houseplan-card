import { html, nothing, type TemplateResult } from 'lit';
import { EditorContextMenu, type EditorMenuModel, type EditorMenuItem } from './editor-context-menu';
import { inboxMenuViewport } from './device-inbox-menu';
import { floatingViewport } from './floating-surface';
import type { HouseplanEditorRuntime } from './houseplan-editor-runtime';
import type { DeviceInboxRow } from './device-inbox';

/** One catalog-row owner; filtering/navigation retires it, including old DOM. */
export class CatalogContextMenu {
  private readonly presentation = new EditorContextMenu(() => this.host.requestUpdate());
  private owner: { key: string; model: EditorMenuModel; active: boolean } | null = null;
  constructor(private readonly runtime: HouseplanEditorRuntime) {}
  private get host() { return this.runtime.host; }
  isOpen(key: string): boolean { return this.owner?.key === key && this.owner.active; }
  close(): void {
    this.presentation.retire();
    if (this.owner) this.owner.active = false;
    this.host.requestUpdate();
  }
  dispose(): void { this.presentation.dispose(); this.owner = null; }
  sync(visible: DeviceInboxRow[]): void {
    if (this.owner?.active && (!this.owner.model.current() || !visible.some(row=>row.key===this.owner!.key))) this.close();
  }
  render(key: string): TemplateResult | typeof nothing {
    return this.owner?.key === key ? this.presentation.render(this.owner.active ? this.owner.model : null) : nothing;
  }
  open(event: MouseEvent, row: DeviceInboxRow): void {
    const target = event.currentTarget as HTMLButtonElement, local = target.parentElement!;
    const dialog = this.host._deviceInbox;
    if (!dialog || dialog.busy || !this.host._canEdit || this.host._kiosk) return;
    if (this.isOpen(row.key)) { this.close(); return; }
    const authority = this.host._configWriteContext.claim(), revision = this.host._cfgRev, navigation = this.runtime.navigationIntent;
    const item = (key: string, label: string | TemplateResult, invoke: () => void, disabled = false, title?: string): EditorMenuItem =>
      ({ key, label, invoke, disabled, title, action: `device-catalog-${key}`, value: row.key });
    const items: EditorMenuItem[] = [];
    if (row.canEdit && !(row.category === 'on_plan' && !row.canFind)) items.push(item('edit', this.host._t('device_inbox.edit'), () => this.runtime._openInboxMarker(row)));
    if (row.canHide) items.push(item('hide', this.host._t('device_inbox.hide'), () => this.runtime._setInboxHidden(row, true)));
    if (row.category === 'available') items.push(item('disable', this.host._t('device_inbox.hide_available'), () => this.runtime._setInboxHidden(row, true)));
    if (row.category === 'hidden') items.push(item('find', html`<ha-icon icon="mdi:crosshairs-gps"></ha-icon>${this.host._t('device_inbox.find')}`,
      () => this.runtime._findInboxDevice(row), !row.canFind, row.canFind ? undefined : this.host._t('device_inbox.find_hidden_hint')));
    if (this.host._bindingHasHaPage(row.binding)) items.push(item('open-ha', this.host._t('btn.open_in_ha'), () => this.host._openBindingInHa(row.binding)));
    const token = {}, current = () => this.owner?.model.token === token && this.owner.active
      && this.host.isConnected && this.host._deviceInbox === dialog && !dialog.busy && this.host._canEdit && !this.host._kiosk
      && this.host._cfgRev === revision && this.runtime.navigationIntent === navigation && target.isConnected
      && this.host._configWriteContext.current(authority, this.host.hass);
    this.owner = { key: row.key, active: true, model: { token, hp: 'catalog-context-menu', items,
      anchor: () => target.getBoundingClientRect(), localTo: local, gap: 4, minWidth: 180, returnFocus: target,
      current, close: () => this.close(), viewport: () => {
        const shell = target.closest('hp-dialog');
        const header = shell?.shadowRoot?.querySelector<HTMLElement>('.header');
        const footer = shell?.querySelector<HTMLElement>('[slot=footer]');
        const viewport = floatingViewport(window);
        return header && footer ? inboxMenuViewport(header.getBoundingClientRect(), footer.getBoundingClientRect(), viewport) : viewport;
      } } };
    this.host.requestUpdate();
  }
}
