/** #1089: transient View command owner; shared presentation, no eager editor graph. */
import { nothing, type TemplateResult } from 'lit';
import { EditorContextMenu, menuPoint } from './editor-context-menu';
import { adoptEditorContextMenuStyles } from './editor-context-menu-adoption';
import { inboxVisibilityAllowed } from './device-inbox';
import { resolveDeviceMoreInfoTarget, type MoreInfoFailure } from './device-more-info';
import type { DevItem } from './types';
import type { HouseplanEditorHostPort, HouseplanEditorRuntime } from './houseplan-editor-runtime';

export const VIEW_DEVICE_MENU_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';
export interface ViewDeviceMenuRequest {
  target: Element | null; x: number; y: number;
  current(): DevItem | null;
}
interface Host extends HouseplanEditorHostPort {
  readonly ownerDocument: Document;
  _otherDialogsBlocked: boolean;
  _openMoreInfo(entityId: string): void;
  _openMarkerDialog(device: DevItem, view: boolean, current?: () => boolean): void;
  _ensureEditorRuntime(): Promise<boolean>;
  _editorRuntime: HouseplanEditorRuntime | null;
}
type Command = 'settings' | 'ha' | 'info' | 'visibility' | 'delete';
const moreInfoReason: Record<MoreInfoFailure, 'view.menu_no_ha' | 'view.menu_foreign' | 'view.menu_disabled' | 'view.menu_unverified'> = {
  virtual: 'view.menu_no_ha', invalid: 'view.menu_no_ha', missing: 'view.menu_no_ha',
  foreign: 'view.menu_foreign', disabled: 'view.menu_disabled', unverified: 'view.menu_unverified',
};

export class ViewDeviceMenu {
  private readonly host: Host;
  private menu: ViewDeviceMenuRequest | null = null;
  private generation = 0;
  private busy = false;
  private closingPointer: number | null = null;
  private readonly presentation: EditorContextMenu;
  constructor(host: object) {
    this.host = host as Host;
    this.presentation = new EditorContextMenu(() => this.host.requestUpdate());
    adoptEditorContextMenuStyles(this.host);
  }
  private readonly retire = () => { this.close(); };
  private readonly freshInput = () => { this.closingPointer = null; };
  private readonly closingClick = (event: MouseEvent) => {
    if (this.closingPointer === null || 'pointerId' in event && event.pointerId !== this.closingPointer) return;
    this.closingPointer = null; event.preventDefault(); event.stopImmediatePropagation();
  };
  connect(): void {
    const view = this.host.ownerDocument.defaultView;
    view?.addEventListener('blur', this.retire); view?.addEventListener('pagehide', this.retire);
    view?.addEventListener('pointerdown', this.freshInput, true); view?.addEventListener('keydown', this.freshInput, true);
    view?.addEventListener('click', this.closingClick, true);
  }
  disconnect(): void {
    this.close(); this.presentation.dispose();
    const view = this.host.ownerDocument.defaultView;
    view?.removeEventListener('blur', this.retire); view?.removeEventListener('pagehide', this.retire);
    view?.removeEventListener('pointerdown', this.freshInput, true); view?.removeEventListener('keydown', this.freshInput, true);
    view?.removeEventListener('click', this.closingClick, true); this.closingPointer = null;
  }
  close(): void {
    this.generation++; this.menu = null; this.presentation.retire(); this.host.requestUpdate();
  }
  open(request: ViewDeviceMenuRequest): void {
    this.close();
    if (this.busy || !request.current()) return;
    adoptEditorContextMenuStyles(this.host); this.menu = request; this.host.requestUpdate();
  }
  private availability(device: DevItem) {
    const h = this.host, writer = h._canEdit && !h._kiosk && !h._devicePositionBusy && !h._otherDialogsBlocked;
    // The display roster can temporarily project hidden=false; storage owns this command.
    const hidden = h._markers.find(marker => marker.id === device.id)?.hidden === true;
    const visible = device.virtual || device.bindingKind === 'virtual' || inboxVisibilityAllowed(hidden ? 'hidden' : 'on_plan',
      device.bindingStatus ?? { kind: 'unverified', reason: 'registry_unavailable', enabledEntityIds: [], allEntityIds: [] });
    const ha = resolveDeviceMoreInfoTarget(h.hass, h._fullRegistryHass, device);
    return { writer, hidden, visible, ha };
  }
  private async invoke(command: Command, owner: ViewDeviceMenuRequest): Promise<void> {
    const device = owner.current();
    if (this.busy || this.menu !== owner || !device) return;
    const { writer, hidden, visible, ha } = this.availability(device);
    if (command === 'ha' && !ha.entityId || ['settings', 'visibility', 'delete'].includes(command) && !writer
      || command === 'visibility' && !visible) return;
    // Accepted intent outlives only this normal close, never a later owner/blur/navigation.
    const generation = this.generation;
    const current = () => generation === this.generation && !!owner.current();
    this.menu = null; this.presentation.retire(); this.host.requestUpdate();
    if (command === 'ha') { if (current()) this.host._openMoreInfo(ha.entityId!); return; }
    if (command === 'info') { if (current()) this.host._infoCard = owner.current(); return; }
    if (command === 'settings') { this.host._openMarkerDialog(device, true, current); return; }
    this.busy = true;
    try {
      if (await this.host._ensureEditorRuntime() && current()) {
        await this.host._editorRuntime?._runViewDeviceMenuAction(device, command, hidden, current);
      }
    } finally { this.busy = false; }
  }
  render(): TemplateResult | typeof nothing {
    const owner = this.menu, device = owner?.current();
    if (owner && !device) this.close();
    if (!owner || !device) return this.presentation.render(null);
    const h = this.host, { writer, hidden, visible, ha } = this.availability(device);
    const denied = h._t('toast.device_settings_unavailable');
    const item = (key: Command, label: string, disabled = false, title = '') => ({ key,
      action: `view-device-${key}`, label, disabled, title, invoke: () => { void this.invoke(key, owner); } });
    const rect = owner.target?.getBoundingClientRect();
    return this.presentation.render({ token: owner, hp: 'device-context-menu', density: 'touch', minWidth: 180,
      anchor: owner.x || owner.y || !rect ? menuPoint(owner.x, owner.y) : rect,
      returnFocus: owner.target, current: () => this.menu === owner && !!owner.current(), close: () => this.close(),
      outside: event => { this.closingPointer = event.pointerId; event.preventDefault(); event.stopImmediatePropagation(); },
      items: [item('settings', h._t('tap.settings'), !writer, writer ? '' : denied),
        item('ha', h._t('view.menu_ha'), !ha.entityId, ha.failure ? h._t(moreInfoReason[ha.failure]) : ''),
        item('info', h._t('tap.info')),
        item('visibility', h._t(hidden ? 'view.menu_show' : 'device_inbox.hide'), !writer || !visible,
          !writer ? denied : visible ? '' : h._t('device_inbox.show_disabled')),
        item('delete', h._t('btn.delete'), !writer, writer ? '' : denied)],
    });
  }
}
