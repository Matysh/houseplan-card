/** Background-only commands and menu. No asset/file operation belongs here. */
import { nothing, type TemplateResult } from 'lit';
import { EditorContextMenu, menuPoint } from './editor-context-menu';
import type { HouseplanEditorRuntime } from './houseplan-editor-runtime';
import { copyDecor, reorderDecor, type DecorOrder } from './editors/decor/order';
import { propertiesT } from './editors/properties/strings';
import { langOf } from './i18n';
import { toolsT, type ToolsI18nKey } from './i18n/tools';

type Command = DecorOrder | 'delete' | 'copy';
interface Target { id: string; space: string; context: object; navigation: number; revision: number }
interface Menu extends Target { x: number; y: number }

export class DecorOrderEditor {
  private menu: Menu | null = null;
  private readonly presentation = new EditorContextMenu(() => this.host.requestUpdate());
  constructor(private readonly runtime: HouseplanEditorRuntime) {}
  private get host() { return this.runtime.host; }
  private t(key: ToolsI18nKey): string { return toolsT(langOf(this.host.hass, this.host._config?.language), key); }
  label(command: Command): string {
    return command === 'delete' ? propertiesT(langOf(this.host.hass, this.host._config?.language), 'delete')
      : this.t(command === 'front' ? 'decor.bring_front' : command === 'back' ? 'decor.send_back' : 'decor.copy');
  }
  private get allowed(): boolean {
    const h = this.host;
    return h.isConnected && h._mode === 'decor' && h._canEdit && !h._kiosk
      && h._norm && h._loadOk && !!h._serverCfg && !h._editorSecondaryDialogBlocked
      && h._configWriteGuard()();
  }
  private get gesturing(): boolean {
    const h = this.host;
    return !!(h._decorDraft || h._decorMove || h._dtDrag || this.runtime.backdropGesture.active);
  }
  private target(id: string): Target {
    return { id, space: this.host._space, context: this.host._configWriteContext.claim(),
      navigation: this.runtime.navigationIntent, revision: this.host._cfgRev };
  }
  private current(target: Target, revision = false): boolean {
    return this.allowed && !this.gesturing && target.space === this.host._space
      && target.navigation === this.runtime.navigationIntent
      && this.host._configWriteContext.current(target.context, this.host.hass)
      && (!revision || target.revision === this.host._cfgRev)
      && this.host._decorList.some(shape => shape.id === target.id);
  }
  /** Field completion may be asynchronous; retain the original writer/space. */
  command(id: string, command: Command, target = this.target(id)): void {
    if (!this.current(target, true)) return;
    if (!this.runtime.properties.beforeIntent(() => this.command(id, command, target))) return;
    if (!this.current(target, true)) return;
    const h = this.host, before = this.runtime._geometrySnapshot();
    let items = h._decorList;
    if (command === 'delete') { this.runtime._deleteDecor(id); return; }
    if (command === 'copy') {
      const seed = `decor-${crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
      let newId = seed, suffix = 0;
      while (items.some(item => item.id === newId)) newId = `${seed}-${++suffix}`;
      const result = copyDecor(items, id, newId, h._gridPitch);
      if ('error' in result) {
        const key = result.error === 'limit' ? 'decor.copy_limit' : 'decor.copy_no_space';
        h._showToast(this.t(key), key); return;
      }
      items = [...items, result.shape];
      h._curSpaceCfg.decor = items;
      this.runtime._activateDecorTool('select'); h._decorSel = result.shape.id;
      this.runtime.properties.select(result.shape.kind, result.shape.id);
    } else {
      items = reorderDecor(items, id, command);
      if (items === h._decorList) return;
      h._curSpaceCfg.decor = items;
    }
    this.runtime._recordGeometry(this.t(command === 'copy' ? 'history.decor_copy'
      : command === 'front' ? 'history.decor_front' : 'history.decor_back'), before);
    this.runtime._saveConfig(); h.requestUpdate();
  }
  close(): void {
    if (!this.menu) return;
    this.presentation.retire(); this.menu = null;
    this.host.requestUpdate();
  }
  private outside = (event: PointerEvent): void => {
    if (event.composedPath().some(node => node instanceof Element && node.classList.contains('stage'))) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  /** Read the actual SVG geometry in reverse paint order, even under a drawing tool. */
  private pick(event: MouseEvent): string | null {
    const nodes = [...this.host.renderRoot.querySelectorAll<SVGGraphicsElement>('.decorlayer [data-hp="decor"]')];
    for (const node of nodes.reverse()) {
      const matrix = node.getScreenCTM(); if (!matrix) continue;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      if (node instanceof SVGGeometryElement) {
        if (node.isPointInStroke(point) || (getComputedStyle(node).fill !== 'none' && node.isPointInFill(point))) return node.dataset.id ?? null;
      } else {
        const box = node.getBBox();
        if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) return node.dataset.id ?? null;
      }
    }
    return null;
  }
  open(event: MouseEvent): void {
    if (!this.allowed || this.gesturing || ('pointerType' in event && event.pointerType !== 'mouse')) return;
    const id = this.pick(event); if (!id) return;
    event.preventDefault(); event.stopPropagation();
    const target = this.target(id);
    const show = () => {
      if (!this.current(target)) return;
      this.close();
      this.host._editorSecondary.closeForNavigation();
      const shape = this.host._decorList.find(item => item.id === id)!;
      if (!this.runtime.properties.select(shape.kind, id)) return;
      this.host._decorSel = id;
      this.menu = { ...this.target(id), x: event.clientX, y: event.clientY };
      this.host.requestUpdate();
    };
    if (this.runtime.properties.beforeIntent(show)) show();
  }
  render(): TemplateResult | typeof nothing {
    let menu = this.menu;
    if (menu && !this.current(menu, true)) { this.close(); menu = null; }
    const owner = menu;
    if (!owner) return this.presentation.render(null);
    const items = this.host._decorList;
    const disabled = (command: Command) => command === 'front' ? items[items.length - 1]?.id === owner.id
      : command === 'back' ? items[0]?.id === owner.id : false;
    return this.presentation.render({ token: owner, hp: 'decor-context-menu', anchor: menuPoint(owner.x, owner.y),
      returnFocus: this.host.renderRoot.querySelector('[data-hp="editor-close"]'),
      current: () => this.menu === owner && this.current(owner, true), close: () => this.close(), outside: this.outside,
      items: (['front', 'back', 'copy', 'delete'] as const).map(command => ({ key: command, label: this.label(command),
        action: `decor-${command}`, disabled: disabled(command), invoke: () => {
          this.close(); this.command(owner.id, command, owner);
        } })) });
  }
}
