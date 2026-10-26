/** Confirmed structural commands share the existing Devices CommandStack. */
import { html, nothing } from 'lit';
import type { HouseplanEditorHostPort } from './houseplan-editor-runtime';
import type { DeviceEditorHistoryState, DeviceLayout, DeviceStructureState } from './device-position-history';
import type { NamedCommand } from './command-stack';
import type { ServerConfig } from './types';
import { toolsT, type ToolsI18nKey } from './i18n/tools';
import { langOf } from './i18n';

export interface DeviceStructureReply {
  config: ServerConfig; layout: DeviceLayout; config_rev: number; layout_rev: number; history_token?: string;
}
const randomId = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');

export class DeviceStructureHistory {
  private session = randomId();
  private context: object | null = null;
  private heartbeat: ReturnType<typeof setTimeout> | null = null;
  private lastRetention: string | null = null;
  private pending: string | null = null;
  private resolving = false;
  private unresolved: { request: Record<string, unknown>; resolve: (reply: DeviceStructureReply, recovered?: boolean) => void | Promise<void> } | null = null;
  constructor(private readonly host: HouseplanEditorHostPort) {}
  private t(key: ToolsI18nKey, args?: Record<string, string | number>): string {
    return toolsT(langOf(this.host.hass, this.host._config?.language), key, args);
  }
  get available(): boolean { return this.host._haDeviceHistoryApi === 1; }
  get needsResolution(): boolean { return !!this.unresolved && !this.resolving; }
  current(claim: object): boolean {
    const h = this.host;
    return h.isConnected && h._canEdit && !h._kiosk && h._mode === 'devices'
      && h._configWriteContext.current(claim, h.hass);
  }
  fields(create = false): { history_session: string; operation_id: string; retained_tokens?: string[] } | Record<string, never> {
    if (!this.available) return {};
    if (!this.context || !this.host._configWriteContext.current(this.context, this.host.hass)) {
      this.session = randomId(); this.context = this.host._configWriteContext.claim(); this.unresolved = null;
      this.lastRetention = null;
    }
    const stack = this.host._devicePositionHistory;
    const undo = create ? stack.commands().filter(command => stack.positionOf(command)?.lane === 'undo') : [];
    const retained = undo.slice(undo.length >= 50 ? 1 : 0).flatMap(command =>
      'kind' in command.before && command.before.kind === 'structure' ? [command.before.token] : []);
    return { history_session: this.session, operation_id: randomId(), ...(create ? { retained_tokens: retained } : {}) };
  }
  status(key: ToolsI18nKey | null, name?: string): void {
    this.pending = key ? this.t(key, { name: name || '' }) : null;
    this.host.requestUpdate();
  }
  retire(release = false): void {
    if (release && this.context && this.host._configWriteContext.current(this.context, this.host.hass))
      void this.host.hass.callWS({ type: 'houseplan/marker/history/retain', history_session: this.session, tokens: [] }).catch(() => undefined);
    if (this.heartbeat) clearTimeout(this.heartbeat);
    this.heartbeat = null; this.pending = null;
    this.lastRetention = null;
    // An old authority's receipt callback must never enter a new local stack.
    this.unresolved = null;
  }
  render() { return this.pending ? html`<span role="status" aria-live="polite" data-hp="device-structure-pending">${this.pending}</span>
    ${this.needsResolution ? html`<button class="btn" data-hp="device-structure-reconcile" @click=${() => void this.recover()}>${this.t('history.device_check_result')}</button>` : nothing}` : nothing; }
  record(reply: DeviceStructureReply, name: string, id: string, space: string): void {
    if (!reply.history_token || !this.context || !this.current(this.context)) return;
    const state: DeviceStructureState = { kind: 'structure', token: reply.history_token, deviceId: id, spaceId: space };
    this.host._devicePositionHistory.push({ name, before: state, after: state });
    this.prune();
  }
  async adopt(reply: DeviceStructureReply): Promise<void> {
    const h = this.host;
    if (h._cfgRev > reply.config_rev || h._layoutRev > reply.layout_rev) {
      await Promise.all([h._reloadConfigOnly(true), h._reloadLayoutOnly()]);
      return;
    }
    h._adoption.acceptPairWrite(reply.config, reply.layout, reply);
    h._canOptimizeUndo = false; h._undoKind = null;
    h._cfgEpoch++; h._modelCache = null; h._frame = null; h._regSignature = ''; h._deviceInboxMemo = null;
    h._maybeRebuildDevices(); h._cacheSnapshot(); h.requestUpdate();
  }
  async request(request: Record<string, unknown>, accepted: (reply: DeviceStructureReply, recovered?: boolean) => void | Promise<void>): Promise<DeviceStructureReply> {
    // A transport failure has an ambiguous result. Exactly one replay uses the
    // SAME action ID and payload; the server returns its authenticated receipt.
    this.unresolved = { request, resolve: accepted };
    this.resolving = true;
    const unpin = this.host._devicePositionHistory.pinBaseline();
    let reply: DeviceStructureReply;
    try {
      try { reply = await this.host.hass.callWS(request); }
      catch (error) {
        const code = (error as { code?: string }).code;
        if (code) { this.unresolved = null; throw error; }
        reply = await this.host.hass.callWS(request);
      }
      this.unresolved = null;
      await accepted(reply);
      this.prune();
      return reply;
    } catch (error) {
      if (this.unresolved) this.pending = this.t('history.device_unknown');
      throw error;
    } finally { this.resolving = false; unpin(); }
  }
  async settle(): Promise<void> {
    if (!this.unresolved) return;
    const { request, resolve } = this.unresolved;
    const reply: DeviceStructureReply = await this.host.hass.callWS(request);
    this.unresolved = null;
    await resolve(reply, true);
    this.prune();
  }
  private async recover(): Promise<void> {
    if (!this.needsResolution || !this.context || !this.current(this.context)) return;
    const claim = this.context;
    this.resolving = true; this.host.requestUpdate();
    try { await this.settle(); }
    catch { /* preserve the unresolved action; Retry never creates another ID */ }
    finally {
      this.resolving = false;
      if (this.current(claim)) {
        this.host._devicePositionBusy = !!this.unresolved;
        if (!this.unresolved) this.status(null); else this.host.requestUpdate();
      }
    }
  }
  prune(renew = false): void {
    if (!this.context || !this.host._configWriteContext.current(this.context, this.host.hass)) return;
    const tokens = [...new Set(this.host._devicePositionHistory.commands().flatMap(command =>
      'kind' in command.before && command.before.kind === 'structure' ? [command.before.token] : []))].sort();
    const claim = this.context;
    const signature = this.session + ':' + tokens.join(':');
    if (renew || signature !== this.lastRetention) {
      this.lastRetention = signature;
      void this.host.hass.callWS({ type: 'houseplan/marker/history/retain', history_session: this.session, tokens })
        .catch(() => { if (this.lastRetention === signature) this.lastRetention = null; });
    }
    if (!tokens.length && this.heartbeat) { clearTimeout(this.heartbeat); this.heartbeat = null; }
    if (tokens.length && this.current(claim) && !this.heartbeat)
      this.heartbeat = setTimeout(() => { this.heartbeat = null; this.prune(true); }, 5 * 60 * 1000);
  }
  async restore(direction: 'undo' | 'redo', command: NamedCommand<DeviceEditorHistoryState>): Promise<void> {
    const h = this.host, state = command.before;
    if (!('kind' in state) || state.kind !== 'structure' || !this.available || h._devicePositionBusy) return;
    const claim = h._configWriteContext.claim(), space = h._space;
    if (!this.current(claim)) return;
    h._devicePositionBusy = true;
    this.status(direction === 'undo' ? 'history.device_undo_pending' : 'history.device_redo_pending', command.name);
    try {
      await this.settle();
      if (!this.current(claim) || h._space !== space) return;
      if (h._saveConfigDebounced.pending()) h._saveConfigDebounced.flush();
      await h._writeChain;
      if (!this.current(claim) || h._space !== space || h._dirtyPos.size || h._sentPos.size) return;
      await this.request({ type: 'houseplan/marker/history', ...this.fields(), action: direction, token: state.token,
        expected_config_rev: h._cfgRev, expected_layout_rev: h._layoutRev }, async reply => {
        if (!this.current(claim) || h._space !== space) return;
        await this.adopt(reply);
        if (!this.current(claim) || h._space !== space) return;
        if (direction === 'undo') h._devicePositionHistory.confirmUndo(command);
        else h._devicePositionHistory.confirmRedo(command);
        if (h._selId && !reply.config.markers.some(marker => marker.id === h._selId && !marker.removed)) h._selId = null;
        h._showToast(h._t(direction === 'undo' ? 'history.undone' : 'history.redone', { name: command.name }),
          direction === 'undo' ? 'history.undone' : 'history.redone');
      });
    } catch (error) {
      if (!this.current(claim)) return;
      const code = (error as { code?: string }).code;
      if (code === 'device_history_conflict' || code === 'device_history_unavailable') {
        h._devicePositionHistory.removeWhere(item => item === command);
      }
      const key = code === 'device_history_unavailable' ? 'history.device_restore_unavailable' : 'history.device_structure_conflict';
      h._showToast(this.t(key), key);
    } finally {
      if (h._configWriteContext.current(claim, h.hass)) {
        h._devicePositionBusy = this.needsResolution;
        if (!this.needsResolution) this.status(null); else h.requestUpdate();
      }
    }
  }
}
