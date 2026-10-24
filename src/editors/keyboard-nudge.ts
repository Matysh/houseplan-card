/** Commands belong to the existing editor selection/lane; no listener, capture or writer of their own. */
import { CANVAS_LIMIT, NORM_W } from '../canvas-constants';
import { contentFingerprint } from '../visual-continuity';
import { devicePlacement, sameDevicePlacement } from '../device-position-history';
import { prepareContactMove } from '../device-contact-write';
import { supersedeDeferredWrite } from '../config-adoption';
import { nudgePlan, type NudgeSelection } from './plan-nudge';
import type { HouseplanEditorRuntime } from '../houseplan-editor-runtime';
import type { PropertiesIdentity } from './properties/controller';

type Identity = { kind: 'device'; id: string } | NudgeSelection;
interface Owner { identity: Identity; key: string; authority: object; epoch: number; revision: number; layoutRevision: number; retired: boolean; point?: {x:number;y:number} }
interface Job { owner: Owner; dx: number; dy: number; applied: boolean }
const contextChanged = () => Object.assign(new Error('keyboard command context changed'), { code: 'context-changed' });

/** Controls retain native arrows through nested Shadow DOM and after an async wait. */
export function arrowControl(nodes: readonly EventTarget[]): boolean {
  return nodes.some(node => (node as Element)?.matches?.('input,textarea,select,button,summary,a[href],[contenteditable]:not([contenteditable="false"]),[role="button"]:not([data-hp="device"]):not([data-hp="opening"]),[role="textbox"],[role="slider"],[role="spinbutton"],[role="combobox"],[role="listbox"],[role="menu"],[role="tablist"],[role="radiogroup"],.hp-properties,.editor-secondary'));
}

export class KeyboardNudge {
  private owner: Owner | null = null;
  private readonly jobs = new Set<Job>();
  constructor(private readonly runtime: HouseplanEditorRuntime) {}
  private get host() { return this.runtime.host; }
  private retireOwner(owner: Owner): void { owner.retired = true; if (this.owner===owner) this.owner=null; }
  retire(): void { if (this.owner) this.retireOwner(this.owner); }
  private selection(): Identity | null {
    const h = this.host, identity = this.runtime.properties.identity;
    if (h._mode === 'devices') {
      const id = identity?.kind === 'device' ? identity.objectId : h._selId;
      const device = h._devices.find(d => d.id === id && d.space === h._space);
      // A drawn LED's geometry is not an icon-position anchor.
      if (!device || device.bindingStatus?.kind === 'ha_disabled' || h._ledEditor?.sel) return null;
      return { kind: 'device', id: device.id };
    }
    if (h._mode !== 'plan' || h._tool !== 'select') return null;
    if (identity && ['partition','contour','opening'].includes(identity.kind))
      return { kind: identity.kind as NudgeSelection['kind'], id: identity.objectId };
    return h._physicalSel?.kind === 'partition' ? { kind: 'partition', id: h._physicalSel.id } : null;
  }
  private key(identity: Identity): string {
    const h = this.host;
    return JSON.stringify([h._space,h._mode,h._tool,identity.kind,identity.id,this.runtime.navigationIntent,
      (this.runtime.properties.identity as PropertiesIdentity | null)?.binding]);
  }
  private allowed(): boolean {
    const h = this.host, r = this.runtime;
    return h.isConnected && h._canEdit && !h._kiosk && h._norm && h._loadOk && !!h._serverCfg
      && h._configWriteGuard()() && !h._editorSecondaryDialogBlocked && !r.properties.fields.draft
      && !h._pointers.size && !h._panStart && !h._pinchStart && !h._drag && !h._deviceDrag && !h._opDrag
      && !h._resize.dragging && !r.physicalGesture.drag && !r.nodeMove?.dragging && !r.nodeMove?.busy && !r.stairs.dragging
      && (!h._devicePositionBusy || [...this.jobs].some(j=>j.applied && j.owner===this.owner && !j.owner.retired && j.owner.identity.kind==='device'))
      && !h._path.length && !h.renderRoot.querySelector('[role="menu"]:not([inert]),[role="listbox"]:not([inert])');
  }
  private focusedControl(): boolean {
    let element: Element | null = this.host.renderRoot.ownerDocument?.activeElement ?? null;
    const path: Element[] = [];
    while (element) { path.push(element); element = element.shadowRoot?.activeElement ?? null; }
    return arrowControl(path);
  }
  private dataCurrent(owner: Owner): boolean {
    const h = this.host;
    return h.isConnected && h._canEdit && !h._kiosk && h._loadOk && h._adoption.adoptionEpoch === owner.epoch
      && h._configWriteContext.current(owner.authority, h.hass);
  }
  private current(owner: Owner): boolean {
    const selected = this.selection();
    return !owner.retired && this.owner === owner && this.dataCurrent(owner) && this.allowed()
      && !this.focusedControl() && !!selected && this.key(selected) === owner.key
      && this.host._cfgRev === owner.revision && this.host._layoutRev === owner.layoutRevision;
  }
  private plan(owner: Owner, dx: number, dy: number) {
    const h = this.host, space = h._curSpaceCfg;
    if (!space || owner.identity.kind === 'device') return null;
    return nudgePlan(space, owner.identity, dx / NORM_W, dy / NORM_W, h._cellCm);
  }
  private possible(owner: Owner, dx: number, dy: number): boolean {
    const h = this.host, pending = [...this.jobs].filter(j => j.owner === owner && !j.applied);
    if (owner.identity.kind === 'device') {
      const device = h._devices.find(d => d.id === owner.identity.id);
      if (!device) return false;
      const point = owner.point ?? h._pos(device), x = point.x + dx + pending.reduce((n,j) => n+j.dx,0), y = point.y + dy + pending.reduce((n,j) => n+j.dy,0);
      return [x,y].every(n => Number.isFinite(n) && Math.abs(n) <= CANVAS_LIMIT*NORM_W);
    }
    let space = h._curSpaceCfg;
    if (!space) return false;
    for (const job of [...pending, {dx,dy}]) {
      const next = nudgePlan(space, owner.identity, job.dx/NORM_W, job.dy/NORM_W, h._cellCm);
      if (!next) return false;
      space = next;
    }
    try { return !!h._serverCfg && h._checkSpacePhysicalGeometry({...h._serverCfg,spaces:[space]},space.id).ok; }
    catch { return false; }
  }
  handle(event: KeyboardEvent, dx: number, dy: number): boolean {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey
      || arrowControl(event.composedPath()) || this.focusedControl() || !this.allowed()) return false;
    if ([...this.jobs].some(j=>this.host._configWriteContext.owns(j.owner.authority))
        && (!this.owner || !this.current(this.owner))) { this.retire(); return false; }
    const identity = this.selection(); if (!identity) return false;
    const h = this.host, key = this.key(identity);
    if (!this.owner || !this.current(this.owner) || this.owner.key !== key) {
      this.retire(); this.owner = { identity, key, authority: h._configWriteContext.claim(), epoch: h._adoption.adoptionEpoch,
        revision: h._cfgRev, layoutRevision: h._layoutRev, retired: false };
    }
    const owner = this.owner;
    if (!this.possible(owner, dx, dy)) return false;
    const job: Job = {owner,dx,dy,applied:false}; this.jobs.add(job);
    void this.runtime.properties.command(async () => {
      try {
        if (!this.current(owner)) return;
        if (owner.identity.kind === 'device') await this.moveDevice(job);
        else await this.movePlan(job);
      } catch (error: unknown) {
        this.retireOwner(owner);
        if (this.dataCurrent(owner) && (error as {code?:string})?.code !== 'context-changed')
          h._showToast(h._t('toast.pos_save_failed', {err:h._errText(error)}), 'toast.pos_save_failed');
      } finally { this.jobs.delete(job); if (![...this.jobs].some(j=>j.owner===owner) && this.owner===owner) this.owner=null; }
    });
    return true;
  }
  private async movePlan(job: Job): Promise<void> {
    const {owner,dx,dy} = job;
    const h = this.host, r = this.runtime;
    if (h._saveConfigDebounced.pending()) h._saveConfigDebounced.flush();
    await h._writeChain;
    if (!this.current(owner)) return;
    const space = this.plan(owner, dx, dy), before = r._geometrySnapshot();
    if (!space || !before || !h._serverCfg) return;
    const previous = structuredClone(h._serverCfg);
    const candidate = { ...structuredClone(previous), spaces: previous.spaces.map(s => s.id === h._space ? space : s) };
    job.applied = true;
    h._adoption.stageLocalConfig(candidate);
    const name = h._t(owner.identity.kind === 'opening' ? 'history.move_opening' : 'history.physical_move');
    if (!r._commitPhysicalGeometry(name, before, [], false)) { this.retireOwner(owner); return; }
    const attempt = r._stageOptimisticConfig(previous, r._prepareConfigCandidate(h._serverCfg!));
    const restoreDeferred = supersedeDeferredWrite(h._saveConfigDebounced);
    try {
      await r._saveConfigNow(attempt, () => {
        if (!this.current(owner) || contentFingerprint(h._serverCfg) !== attempt.attemptedFingerprint) throw contextChanged();
        return true;
      }, () => this.dataCurrent(owner));
      owner.revision = h._cfgRev;
      if (this.current(owner)) { r._recordGeometry(name, before); h.requestUpdate(); }
    } catch (error) {
      if (h._adoption.adoptionEpoch === owner.epoch) restoreDeferred(h._rollbackOptimistic(attempt));
      throw error;
    }
  }
  private async moveDevice(job: Job): Promise<void> {
    const {owner,dx,dy} = job;
    const h = this.host, id = owner.identity.id, device = h._devices.find(d => d.id === id && d.space === h._space);
    if (!device || !this.current(owner)) return;
    const point = owner.point ?? h._pos(device), x = point.x+dx, y = point.y+dy;
    if (![x,y].every(n => Number.isFinite(n) && Math.abs(n) <= CANVAS_LIMIT*NORM_W)) return;
    const before = devicePlacement(h._layout,id), target = h._devicePlacementForCanvas(device,x,y,true);
    const movement = prepareContactMove(h, {id,spaceId:h._space,before}, target, true);
    const edits = [movement.after,...movement.after.related ?? []];
    let accepted = false;
    const guard = { current: (revision?: number) => this.current(owner) && (revision === undefined || revision === owner.layoutRevision),
      accepted: (revision: number) => accepted = this.dataCurrent(owner) && h._layoutRev <= revision
        && edits.every(s => sameDevicePlacement(devicePlacement(h._layout,s.deviceId),s.placement)) };
    job.applied = true;
    owner.point = {x:target.x*NORM_W,y:target.y*NORM_W};
    h._devicePositionBusy = true;
    for (const state of edits) h._previewDevicePlacement(state.deviceId,state.placement);
    try {
      await h._persistDevicePlacement(id,movement.after.placement,movement.after.related,guard);
      if (!accepted) {
        this.retireOwner(owner);
        if (this.dataCurrent(owner) && h._layoutRev > owner.layoutRevision
            && edits.every(s => sameDevicePlacement(devicePlacement(h._layout,s.deviceId),s.placement))) await h._reloadLayoutOnly();
        return;
      }
      owner.layoutRevision = h._layoutRev;
      owner.point = {x:movement.after.placement!.x*NORM_W,y:movement.after.placement!.y*NORM_W};
      if (this.current(owner)) h._devicePositionHistory.push({name:h._t('history.device_move',{name:device.name}),...movement});
    } catch (error) {
      // Lost permission may retire an unsent command. Restore only its exact
      // still-owned preview; a newer adoption/revision or placement always wins.
      if (h._adoption.adoptionEpoch === owner.epoch && h._layoutRev === owner.layoutRevision
          && edits.every(s => sameDevicePlacement(devicePlacement(h._layout,s.deviceId),s.placement)))
        for (const state of [movement.before,...movement.before.related ?? []]) h._previewDevicePlacement(state.deviceId,state.placement);
      if ((error as {code?:string})?.code === 'conflict' && this.dataCurrent(owner)) await h._reloadLayoutOnly();
      throw error;
    } finally { if (h._configWriteContext.owns(owner.authority)) { h._devicePositionBusy=false; h.requestUpdate(); } }
  }
}
