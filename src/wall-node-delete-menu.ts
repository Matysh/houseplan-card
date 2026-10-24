/** The existing node editor owns this menu and its cancellable intent. The
 * common menu owns presentation; the common node writer/history own changes. */
import { html, nothing, type TemplateResult } from 'lit';
import { EditorContextMenu, menuPoint } from './editor-context-menu';
import { applyNodeDelete, type NodeDeleteIntent } from './wall-node-delete';
import { canonicalizeConfigGeometryInPlace } from './coordinate-canonicalization';
import { nodeDeleteRefusalKey } from './wall-node-refusal';
import type { NodeDeleteHistory } from './wall-node-editor';
import type { NodeMoveSpace, NodePoint, WallNode } from './wall-node-move';
import type { NodeWriteBasis } from './wall-node-write';
import type { ServerConfig } from './types';

export interface NodeDeleteMenuPort {
  context(): { enabled: boolean; api: boolean; space: string; revision: number };
  config(): ServerConfig | null;
  navigation(): number;
  epoch(): number;
  claim(): () => boolean;
  beforeIntent(retry: () => void): boolean;
  topology(): { nodes: WallNode[]; source: NodeMoveSpace } | null;
  basis(space: string): NodeWriteBasis;
  validate(space: NodeMoveSpace, before: NodeMoveSpace): boolean;
  write(history: NodeDeleteHistory, basis: NodeWriteBasis, current: () => boolean): Promise<ServerConfig>;
  record(history: NodeDeleteHistory, after: NodeMoveSpace): void;
  document: Document;
  stage(): HTMLElement | null;
  root(): ParentNode;
  busy(): boolean;
  setBusy(value: boolean): void;
  changed(): void;
  text(key: string): string;
  toast(message: string, key: string): void;
}
interface Target {
  point: NodePoint | null; x: number; y: number; space: string; navigation: number;
  epoch: number; claim: () => boolean;
}
interface Menu extends Target {
  config: ServerConfig; revision: number; source: NodeMoveSpace; basis: NodeWriteBasis;
  reason: string | null; api: boolean;
}
export class WallNodeDeleteMenu {
  private menu: Menu | null = null;
  /** An opening/command waiting for Properties is cancellable even without DOM.
   * The chosen command survives its own presentation's normal retirement. */
  private intent: Target | null = null;
  private readonly presentation: EditorContextMenu;
  constructor(private readonly port: NodeDeleteMenuPort) {
    this.presentation = new EditorContextMenu(() => port.changed());
  }
  private current(target: Target, strict = false): boolean {
    const ctx = this.port.context();
    return ctx.enabled && ctx.space === target.space && target.claim()
      && this.port.navigation() === target.navigation && this.port.epoch() === target.epoch
      && (!strict || ctx.api && this.port.config() === (target as Menu).config && ctx.revision === (target as Menu).revision);
  }
  private unlisten(): void {
    const view = this.port.document.defaultView;
    view?.removeEventListener('pointerdown', this.outsidePending, true);
    view?.removeEventListener('keydown', this.keyPending, true);
  }
  private listen(): void {
    const view = this.port.document.defaultView;
    view?.addEventListener('pointerdown', this.outsidePending, true);
    view?.addEventListener('keydown', this.keyPending, true);
  }
  private readonly keyPending = (event: KeyboardEvent): void => {
    // The focused Properties field still owns its normal Escape behavior.
    if (event.key === 'Escape' || event.key === 'Tab') this.cancel();
  };
  private readonly outsidePending = (event: PointerEvent): void => {
    this.cancel(); this.outside(event);
  };
  private readonly outside = (event: PointerEvent): void => {
    if (event.composedPath().includes(this.port.stage()!)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  cancel(): boolean {
    const active = !!(this.menu || this.intent);
    this.presentation.retire(); this.menu = null; this.intent = null; this.unlisten();
    if (active) this.port.changed();
    return active;
  }
  dispose(): void { this.cancel(); this.presentation.dispose(); }
  open(event: MouseEvent, point: NodePoint | null): void {
    this.cancel();
    if (!this.port.context().enabled || this.port.busy()) return;
    const target: Target = { point: point ? [...point] : null, x: event.clientX, y: event.clientY,
      space: this.port.context().space, navigation: this.port.navigation(), epoch: this.port.epoch(), claim: this.port.claim() };
    this.intent = target; this.listen();
    const show = (): void => {
      if (this.intent !== target || !this.current(target) || this.port.busy()) return;
      const config = this.port.config(), data = this.port.topology();
      if (!config || !data) { this.cancel(); return; }
      const menu: Menu = { ...target, config, source: data.source, revision: this.port.context().revision,
        basis: this.port.basis(target.space), reason: null, api: this.port.context().api };
      menu.reason = !this.port.context().api ? 'node_delete_update_required' : this.reason(menu);
      this.unlisten(); this.intent = null; this.menu = menu; this.port.changed();
    };
    if (this.port.beforeIntent(show)) show();
  }
  private candidate(menu: Menu): NodeMoveSpace | string {
    if (!menu.point) return 'node_delete_unsafe';
    try {
      const result = applyNodeDelete(menu.source, { point: menu.point });
      if (!result.ok) return `node_delete_${result.reason}`;
      canonicalizeConfigGeometryInPlace({ spaces: [result.space] });
      return this.port.validate(result.space, menu.source) ? result.space : 'node_delete_unsafe';
    } catch { return 'node_delete_unsafe'; }
  }
  private reason(menu: Menu): string | null {
    const result = this.candidate(menu);
    return typeof result === 'string' ? result : null;
  }
  private choose(menu: Menu): void {
    if (this.menu !== menu || menu.reason || !this.current(menu, true) || this.port.busy()) return;
    // Retire the retained button before transferring authority to a distinct
    // intent. EditorContextMenu invokes before its normal close callback.
    this.presentation.retire(); this.menu = null; this.intent = menu; this.listen(); this.port.changed();
    const send = (): void => {
      if (this.intent !== menu || !this.current(menu, true) || this.port.busy()) return;
      const reason = this.reason(menu);
      if (reason) { this.cancel(); this.port.toast(this.port.text(reason), reason); return; }
      void this.write(menu);
    };
    if (this.port.beforeIntent(send)) send();
  }
  private async write(menu: Menu): Promise<void> {
    const intent: NodeDeleteIntent = { point: [...menu.point!] };
    const history: NodeDeleteHistory = { kind: 'delete', beforeSpace: menu.source, intent, direction: 'apply' };
    const current = () => this.intent === menu && this.current(menu, true);
    this.port.setBusy(true); this.port.changed();
    try {
      const config = await this.port.write(history, menu.basis, current);
      const after = config.spaces.find(space => space.id === menu.space) as NodeMoveSpace;
      this.port.record(history, after);
    } catch (error) {
      // A same-authority server refusal may reload before returning. Its
      // operation-specific explanation belongs to this navigation, not its DOM.
      if (menu.claim() && this.port.navigation() === menu.navigation && this.port.context().space === menu.space) {
        const key = nodeDeleteRefusalKey(error); this.port.toast(this.port.text(key), key);
      }
    } finally {
      if (this.intent === menu) this.cancel();
      this.port.setBusy(false); this.port.changed();
    }
  }
  render(): TemplateResult | typeof nothing {
    if (this.intent && !this.current(this.intent, 'config' in this.intent)) this.cancel();
    if (this.menu && !this.current(this.menu, false)) this.cancel();
    // An old backend still has a disabled menu, but a changed source retires it.
    if (this.menu && (this.port.config() !== this.menu.config || this.port.context().revision !== this.menu.revision
        || this.port.context().api !== this.menu.api)) this.cancel();
    const menu = this.menu;
    if (!menu) return this.presentation.render(null);
    return this.presentation.render({ token: menu, hp: 'node-context-menu', anchor: menuPoint(menu.x, menu.y),
      returnFocus: this.port.root().querySelector('[data-hp="editor-close"]'),
      current: () => this.menu === menu && this.current(menu) && this.port.config() === menu.config
        && this.port.context().revision === menu.revision && this.port.context().api === menu.api,
      close: () => this.cancel(), outside: this.outside,
      items: [{ key: 'delete', action: 'node-delete', disabled: !!menu.reason,
        label: menu.reason ? html`<span>${this.port.text('node_delete')}<br>${this.port.text(menu.reason)}</span>` : this.port.text('node_delete'),
        invoke: () => this.choose(menu) }] });
  }
}
