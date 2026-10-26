/** Devices-only command/menu, deliberately outside the initial View graph (#935). */
import { nothing, type TemplateResult } from 'lit';
import { EditorContextMenu, menuPoint } from './editor-context-menu';
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
import { deviceEditorAllowed } from './device-editor-access';
import { deviceCopyFileGroups, deviceCopyIncoming, deviceCopyPosition, deviceCopyRadius, nextDeviceCopyName, rewriteDeviceCopyFiles, virtualDeviceCopy } from './device-copy';
import { effectiveDeviceBaseSize } from './device-marker-geometry';
import { ledStripsByMarker } from './led-strip-gate';
import { iconUnit } from './space-geometry';
import { contentFingerprint } from './visual-continuity';
import { langOf } from './i18n';
import { toolsT, type ToolsI18nKey } from './i18n/tools';
import type { DevItem, ServerConfig } from './types';
import type { DeviceLayout } from './device-position-history';
import { canonicalizePosition } from './coordinate-canonicalization';

interface Menu {
  id: string; space: string; context: object; cr: number; lr: number; cfg: string; layout: string;
  x: number; y: number; target: Element | null;
}
interface CopyResponse { config: ServerConfig; layout: DeviceLayout; config_rev: number; layout_rev: number }
interface DeviceMenuCommands {
  settings(device: DevItem, current: () => boolean): void;
  visibility(device: DevItem, hidden: boolean): Promise<void>;
  remove(device: DevItem, current: () => boolean): Promise<void>;
}

export class DeviceCopyEditor {
  private menu: Menu | null = null;
  private busy = false;
  private busyContext: object | null = null;
  private operation = 0;
  private readonly presentation = new EditorContextMenu(() => this.host.requestUpdate());
  constructor(private readonly host: HouseplanEditorHostPort, private readonly copied?: (id: string, sourceId: string) => void,
    private readonly commands?: DeviceMenuCommands) {}
  private t(key: ToolsI18nKey): string { return toolsT(langOf(this.host.hass, this.host._config?.language), key); }
  private allowed(): boolean {
    const h = this.host;
    return h.isConnected && h._mode === 'devices' && h._norm && h._loadOk && !!h._serverCfg && deviceEditorAllowed(h._canEdit, h._kiosk);
  }
  private contextCurrent(m: Menu): boolean {
    return this.allowed() && this.host._space === m.space
      && this.host._configWriteContext.current(m.context, this.host.hass);
  }
  private unchanged(m: Menu): boolean {
    const h = this.host;
    return this.contextCurrent(m) && h._cfgRev === m.cr && h._layoutRev === m.lr
      && contentFingerprint(h._serverCfg) === m.cfg && contentFingerprint(h._layout) === m.layout;
  }
  close(focus = false): void {
    if (!this.menu) return;
    const target = this.menu?.target;
    this.presentation.retire(); this.menu = null;
    if (focus && target?.isConnected && 'focus' in target) (target as HTMLElement).focus({ preventScroll: true });
    this.host.requestUpdate();
  }
  open(event: MouseEvent, source: DevItem): void {
    if (!this.allowed()) return;
    event.preventDefault(); event.stopPropagation();
    const h = this.host, current = h._devices.find(d => d.id === source.id && d.space === h._space);
    if (this.busyContext && !h._configWriteContext.owns(this.busyContext)) { this.busy = false; this.operation++; }
    if (this.busy || h._devicePositionBusy || h._deviceDrag || !current || current.hidden && !h._showAll) return;
    this.close();
    this.menu = { id: current.id, space: h._space, context: h._configWriteContext.claim(), cr: h._cfgRev, lr: h._layoutRev,
      cfg: contentFingerprint(h._serverCfg), layout: contentFingerprint(h._layout),
      x: event.clientX, y: event.clientY, target: event.currentTarget as Element | null };
    h.requestUpdate();
  }
  render(): TemplateResult | typeof nothing {
    let m = this.menu;
    if (m && !this.contextCurrent(m)) { this.close(); m = null; }
    const owner = m;
    const device = owner && this.host._devices.find(d => d.id === owner.id && d.space === owner.space);
    const active = !!device && (!device.bindingStatus || device.bindingStatus.kind === 'active');
    const invoke = (command: keyof DeviceMenuCommands) => {
      if (!owner || !this.unchanged(owner)) return;
      const current = this.host._devices.find(d => d.id === owner.id && d.space === owner.space);
      if (!current) return;
      this.close();
      if (command === 'visibility') void this.commands?.visibility(current, !current.hidden);
      else void this.commands?.[command](current, () => this.unchanged(owner));
    };
    return this.presentation.render(owner ? { token: owner, hp: 'device-context-menu', anchor: menuPoint(owner.x, owner.y), minWidth: 180,
      returnFocus: owner.target, current: () => this.menu === owner && this.unchanged(owner), close: focus => this.close(focus),
      items: [
        { key: 'settings', action: 'device-context-settings', label: this.t('device.settings'), invoke: () => invoke('settings') },
        { key: 'copy', hp: 'device-copy', label: this.t('device.copy'), disabled: !active, invoke: () => void this.copy(owner) },
        { key: 'visibility', action: 'device-context-visibility', label: this.t(device?.hidden ? 'device.show_on_plan' : 'device.hide'),
          disabled: !active, title: active ? '' : this.host._t('device_inbox.show_disabled'), invoke: () => invoke('visibility') },
        { key: 'delete', action: 'device-context-delete', label: this.host._t('btn.delete'), invoke: () => invoke('remove') },
      ] } : null);
  }
  /** Same guarded command as the context menu; no synthetic pointer event. */
  async copyDevice(source: DevItem): Promise<void> {
    const h = this.host;
    if (!this.allowed() || this.busy || h._devicePositionBusy || h._deviceDrag) return;
    const current = h._devices.find(d => d.id === source.id && d.space === h._space);
    if (!current || current.bindingStatus && current.bindingStatus.kind !== 'active') return;
    await this.copy({ id: current.id, space: h._space, context: h._configWriteContext.claim(), cr: h._cfgRev, lr: h._layoutRev,
      cfg: contentFingerprint(h._serverCfg), layout: contentFingerprint(h._layout), x: 0, y: 0, target: null });
  }
  private async copy(m: Menu): Promise<void> {
    if (this.busy || !this.unchanged(m)) { this.close(); this.host._showToast(this.t('device.copy_changed'), 'device.copy_changed'); return; }
    const h = this.host;
    let id = '';
    const operation = ++this.operation;
    this.busyContext = m.context;
    this.busy = true; h._devicePositionBusy = true; this.close();
    const authority = () => h.isConnected && h._configWriteContext.current(m.context, h.hass);
    const fail = (key: ToolsI18nKey): never => { throw { copyKey: key }; };
    let sent = false;
    try {
      // getRandomValues also works on ordinary HTTP HA installations.
      id = 'v_' + Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');
      if (h._saveConfigDebounced.pending()) h._saveConfigDebounced.flush();
      await h._writeChain;
      if (!this.unchanged(m) || h._dirtyPos.size || h._sentPos.size) fail('device.copy_changed');
      const d = h._devices.find(item => item.id === m.id && item.space === m.space);
      if (!d || (d.bindingStatus && d.bindingStatus.kind !== 'active')) fail('device.copy_changed');
      const source = d!, config = h._serverCfg!, space = h._spaceModelById(m.space)!;
      const incoming = deviceCopyIncoming(config, source);
      const name = nextDeviceCopyName(source.name, [
        ...h._devices.map(item => item.name), ...(config.markers || []).filter(marker => !marker.removed).map(marker => marker.name || ''),
      ], this.t('device.copy_fallback'));
      const marker = virtualDeviceCopy(source, id, name, incoming, h._planHass, h._fillColors.glow_light.c);
      const configured = h._config?.icon_size ?? 2.5;
      const radius = effectiveDeviceBaseSize(configured > 8 ? 2.5 : configured) / 100 * iconUnit(space) * .634375;
      const footprint = (item: DevItem) => ({ ...h._pos(item), radius: deviceCopyRadius(
        radius * h._devicePresentation(item).scale, h._deviceContacts?.scene?.shapes.get(item.id)) });
      const strips = ledStripsByMarker(space);
      const position = deviceCopyPosition(footprint(source), h._devices.filter(item => item.space === m.space && !item.hidden && !strips.has(item.id)).map(footprint),
        h._gridPitch, [...strips.values()].map(strip => ({ points: strip.points.map(p => p.map(n => n * 1000)), radius: radius * .12 })));
      if (!position) fail('device.copy_no_space');
      for (const [owner, names] of deviceCopyFileGroups(marker)) {
        if (!this.unchanged(m)) fail('device.copy_changed');
        let mapping: Record<string, string>;
        try {
          const result = await h.hass.callWS({ type: 'houseplan/files/migrate', from_id: owner, to_id: id });
          mapping = result?.mapping || {};
          if (!names.every(name => typeof mapping[name] === 'string' && mapping[name])) fail('device.copy_files_failed');
        } catch { fail('device.copy_files_failed'); }
        marker.pdfs = rewriteDeviceCopyFiles(marker.pdfs || [], owner, id, mapping!);
      }
      const currentSource = h._devices.find(item => item.id === source.id && item.space === m.space);
      if (!this.unchanged(m) || !currentSource
          || currentSource.bindingStatus && currentSource.bindingStatus.kind !== 'active') fail('device.copy_changed');
      sent = true;
      const pos = canonicalizePosition({ ...position!, s: m.space });
      const response: CopyResponse = await h.hass.callWS({ type: 'houseplan/marker/copy',
        position: pos, expected_config_rev: m.cr, expected_layout_rev: m.lr, source_id: source.id,
        source_binding: source.marker?.binding || `${source.bindingKind}:${source.bindingRef}`,
        marker });
      if (!authority()) return;
      if (h._cfgRev > response.config_rev || h._layoutRev > response.layout_rev) {
        await Promise.all([h._reloadConfigOnly(true), h._reloadLayoutOnly()]);
      } else {
        h._adoption.acceptPairWrite(response.config, response.layout, response);
        h._canOptimizeUndo = false; h._undoKind = null;
        h._cfgEpoch++; h._modelCache = null; h._frame = null; h._regSignature = '';
        h._maybeRebuildDevices(); h._cacheSnapshot(); h.requestUpdate();
      }
      if (this.contextCurrent(m)) {
        const view = h._view;
        if (view && position) {
          const x = position.x * 1000, y = position.y * 1000, pad = radius * (marker.size || 1);
          const dx = Math.max(view.x + pad - x, 0) - Math.max(x - (view.x + view.w - pad), 0);
          const dy = Math.max(view.y + pad - y, 0) - Math.max(y - (view.y + view.h - pad), 0);
          if (dx || dy) h._applyView(h._zoom, view.x + view.w / 2 - dx, view.y + view.h / 2 - dy);
        }
        h._showToast(this.t('device.copy_created'), 'device.copy_created');
        this.copied?.(id, m.id);
      }
    } catch (error) {
      if (!authority()) return;
      // A lost reply is ambiguous, not permission to submit a second ID.
      if (sent) {
        try { await Promise.all([h._reloadConfigOnly(true), h._reloadLayoutOnly()]); } catch { /* retain the failure, never retry the write */ }
        if (h._serverCfg?.markers?.some(marker => marker.id === id) && h._layout[id]) {
          if (this.contextCurrent(m)) { h._showToast(this.t('device.copy_created'), 'device.copy_created'); this.copied?.(id, m.id); }
          return;
        }
      }
      const detail = error as { code?: string; copyKey?: ToolsI18nKey };
      const linksFailed = detail.code?.startsWith('marker_control_')
        || detail.code === 'invalid_marker_control' || detail.code === 'duplicate_marker_control';
      const key = detail.copyKey || (detail.code === 'conflict' ? 'device.copy_changed'
        : detail.code === 'unauthorized' ? 'device.copy_access'
        : linksFailed ? 'device.copy_links_failed'
        : detail.code === 'unknown_command' ? 'device.copy_backend' : 'device.copy_failed');
      h._showToast(this.t(key), key);
    } finally {
      if (operation === this.operation) {
        this.busy = false; this.busyContext = null;
        if (authority()) { h._devicePositionBusy = false; h.requestUpdate(); }
      }
    }
  }
}
