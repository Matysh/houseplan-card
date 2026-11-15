import { nothing, type TemplateResult } from 'lit';
import { EditorContextMenu, menuPoint } from './editor-context-menu';
import { planHostOf } from './ha-plan-host';
import { requestRoomClose } from './editors/draft-actions';
import type { HouseplanEditorRuntime } from './houseplan-editor-runtime';

type Command = 'settings' | 'resize' | 'split' | 'merge' | 'delete';
interface Target { id: string; space: string; context: object; navigation: number; revision: number; epoch: number }
interface Menu extends Target { x: number; y: number }

/** Room commands are entry points into the existing tools, never a geometry writer. */
export class RoomContextMenu {
  private menu: Menu | null = null;
  private dismissTarget: EventTarget | null = null;
  private readonly presentation = new EditorContextMenu(() => this.host.requestUpdate());
  constructor(private readonly runtime: HouseplanEditorRuntime) {}
  private get host() { return this.runtime.host; }
  private get allowed(): boolean {
    const h = this.host;
    return h.isConnected && h._mode === 'plan' && h._canEdit && !h._kiosk && h._norm && h._loadOk
      && !!h._serverCfg && !h._modeTransitionBusy && !h._editorSecondaryDialogBlocked && h._configWriteGuard()();
  }
  private get gesturing(): boolean {
    const h = this.host;
    return !!(h._panStart || h._drag || h._rlResize || h._opDrag || h._path.length || h._resize.dragging
      || h._decorMove || h._dtDrag || this.runtime.physicalGesture.active || this.runtime.stairs.dragging
      || this.runtime.nodeMove?.dragging || this.runtime.nodeMove?.busy || this.runtime.backdropGesture.active);
  }
  private target(id: string): Target {
    const h = this.host;
    return { id, space: h._space, context: h._configWriteContext.claim(), navigation: this.runtime.navigationIntent,
      revision: h._cfgRev, epoch: h._cfgEpoch };
  }
  private current(target: Target, navigation = true): boolean {
    const h = this.host;
    return this.allowed && !this.gesturing && target.space === h._space && target.revision === h._cfgRev
      && target.epoch === h._cfgEpoch && (!navigation || target.navigation === this.runtime.navigationIntent)
      && h._configWriteContext.current(target.context, planHostOf(h))
      && !!h._spaceModel()?.rooms.some(room => room.id === target.id);
  }
  close(): void {
    if (!this.menu) return;
    this.presentation.retire(); this.menu = null; this.host.requestUpdate();
  }
  dispose(): void { this.close(); this.clearDismissTail(); this.presentation.dispose(); }
  private clearDismissTail(): void {
    this.dismissTarget = null;
    window.removeEventListener('click', this.dismissTail, true);
    window.removeEventListener('pointerdown', this.dismissTail, true);
    window.removeEventListener('keydown', this.dismissTail, true);
  }
  private readonly dismissTail = (event: Event): void => {
    if (event.type === 'click' && !event.composedPath().includes(this.dismissTarget!)) return;
    this.clearDismissTail();
    if (event.type === 'click') { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  private outside = (event: PointerEvent): void => {
    if (event.composedPath().some(node => node instanceof Element && node.classList.contains('stage'))) {
      event.preventDefault(); event.stopImmediatePropagation();
      // This press dismisses the menu. Its matching click must not feed an armed drawing tool.
      // A fresh press/key retires the barrier even if the browser omitted that click.
      this.clearDismissTail(); this.dismissTarget = event.target;
      window.addEventListener('click', this.dismissTail, true);
      window.addEventListener('pointerdown', this.dismissTail, true);
      window.addEventListener('keydown', this.dismissTail, true);
    }
  };
  open(event: MouseEvent): void {
    if (event.defaultPrevented || !this.allowed || this.gesturing
      || ('pointerType' in event && event.pointerType !== 'mouse')) return;
    const point = this.runtime._svgPoint(event);
    if (this.runtime._roomFaceObjectHit(point, event.composedPath())) return;
    const room = [...(this.host._spaceModel()?.rooms ?? [])].reverse().find(room => this.runtime._pointInRoom(point, room));
    if (!room?.id) return;
    event.preventDefault(); event.stopPropagation();
    const target = this.target(room.id);
    const show = () => {
      if (!this.current(target)) return;
      this.menu = { ...target, x: event.clientX, y: event.clientY };
      this.host.requestUpdate();
    };
    if (this.runtime.properties.beforeIntent(show)) show();
  }
  private command(target: Target, command: Command): void {
    if (!this.current(target)) return;
    if (!this.runtime.properties.beforeIntent(() => this.command(target, command))) return;
    if (!this.current(target)) return;
    this.close();
    const h = this.host;
    const room = h._spaceModel()!.rooms.find(room => room.id === target.id)!;
    if (command === 'settings') this.runtime._openRoomEdit(room);
    else if (command === 'delete') this.runtime._openRoomDelete(target.id);
    else {
      this.runtime._activateMarkupTool(command);
      // Tool activation intentionally retires navigation; all other ownership must still hold.
      if (!this.current(target, false) || h._tool !== command) return;
      if (command === 'resize') h._resize.selectRoom(target.id);
      else if (command === 'split') h._splitSel = { roomId: target.id, pts: [] };
      else h._mergeSel = target.id;
    }
    h.requestUpdate();
  }
  deleteFromSettings(): void {
    const h = this.host, id = h._roomEditId;
    if (!id || !h._roomDialog || this.runtime.roomSaveBusy || h._mode !== 'plan' || !h._canEdit
      || h._kiosk || !h._configWriteGuard()()) return;
    const target = this.target(id);
    void requestRoomClose(this.runtime, () => {
      if (this.current(target)) this.runtime._openRoomDelete(id);
    });
  }
  render(): TemplateResult | typeof nothing {
    if (this.menu && !this.current(this.menu)) this.close();
    const owner = this.menu;
    if (!owner) return this.presentation.render(null);
    const t = this.host._t.bind(this.host);
    const labels: Record<Command, string> = {
      settings: `${t('room.settings_short')}…`, resize: t('markup.resize'), split: `${t('markup.split')}…`,
      merge: t('room.context_merge'), delete: t('room.delete'),
    };
    return this.presentation.render({ token: owner, hp: 'room-context-menu', anchor: menuPoint(owner.x, owner.y),
      label: this.host._spaceModel()?.rooms.find(room => room.id === owner.id)?.name || t('room.default_name'),
      returnFocus: this.host.renderRoot.querySelector('[data-hp="editor-close"]'),
      current: () => this.menu === owner && this.current(owner), close: () => this.close(), outside: this.outside,
      items: (['settings', 'resize', 'split', 'merge', 'delete'] as const).map(command => ({
        key: command, label: labels[command], action: `room-${command}`, invoke: () => this.command(owner, command),
      })),
    });
  }
}
