/**
 * The LED strip tool of the Devices editor (#780, ТЗ §4, §5) — its own lazy
 * chunk, loaded by the editor runtime only on entry into the tool, when the
 * shown space has an editable strip, or for the device dialog's
 * representation section (ТЗ §13.1). Nothing here reaches the initial View
 * graph or the editor runtime graph.
 *
 * Owns: drawing a chain (clean clicks only — pan, pinch, a second finger,
 * cancel or a synthetic click never add a point), the selection of one strip
 * with its vertex handles and its tray, the device picker, the
 * "icon ↔ LED strip" switch and the LED commands of the device history.
 * Writes go through the editor's optimistic transaction
 * (`_prepareConfigCandidate` → `beginOptimistic` → `_saveConfigNow`): a failed
 * write rolls back, a conflict follows the shared policy.
 *
 * Stored points are normalised (render units / NORM_W), like the layout.
 */
import { html, nothing, svg, type TemplateResult } from 'lit';
import { NORM_W } from './space-geometry';
import { roomPoly } from './logic';
import {
  geometryAllRings, physicalBodyParts, pointInPhysicalGeometry,
} from './physical-geometry';
import { wallBodiesGeometry } from './wall-thickness';
import {
  LED_MAX_POINTS, LED_MAX_STRIPS, clampToBodies, clampVertexMove, compactPoints,
  isClosedStrip, pathD, validStripPoints, type PlacementBodies, type Pt,
} from './led-strip-geometry';
import { LED_LANGUAGE_RUNTIME, ledT, type LedI18nKey } from './i18n/led';
import { langOf } from './i18n';
import type { DevItem, LedStripModel, Marker, OpeningCfg, ServerConfig, SpaceModel } from './types';
import type { EditorSecondaryModel } from './editor-secondary';
import type { OptimisticAttempt } from './serialized-write-queue';

export const LED_EDITOR_FINGERPRINT = '__HOUSEPLAN_SOURCE_FINGERPRINT__';

/** The LED command of the device history: one strip record before/after (ТЗ §4 п.9). */
export interface LedHistoryState {
  kind: 'led';
  spaceId: string;
  stripId: string;
  strip: LedStripModel | null;
}

type Opening = OpeningCfg & { rx: number; ry: number; rlen: number };

/** What the tool reads from the card (structurally; the card is passed in). */
export interface LedEditorHost {
  hass: { states: Record<string, unknown> } & Record<string, unknown>;
  _config?: { language?: string } | null;
  _serverCfg: ServerConfig | null;
  _curSpaceCfg: { walls?: unknown } | null | undefined;
  _space: string;
  _mode: string;
  _devices: DevItem[];
  _suppressClick: boolean;
  _markerDialog: { devId?: string } | null;
  _editorRuntime: LedEditorRuntime | null;
  _cellCm: number;
  _gridPitch: number;
  _wallKeyPitch: number;
  _spaceWalls: unknown[];
  _openingsR: Opening[];
  _devicePositionHistory: { push(command: { name: string; before: unknown; after: unknown }): void };
  _adoption: {
    beginOptimistic(base: ServerConfig, candidate: ServerConfig): OptimisticAttempt<ServerConfig>;
    stageLocalConfig(config: ServerConfig): void;
  };
  _saveConfigDebounced: { pending(): boolean; cancel(): void };
  _regSignature: string;
  _spaceModel(): SpaceModel | undefined;
  _floorKey(spaceId: string): string;
  _screenToVb(sx: number, sy: number): number[];
  _openCuts(): number[][];
  _roomWallOpeningInputs(openings: Opening[], space: SpaceModel): Array<{ x: number; y: number; angle: number; length: number }>;
  _partitionOpeningCuts(space: SpaceModel, accept: (opening: OpeningCfg) => boolean): unknown[];
  _rollbackOptimistic(attempt: OptimisticAttempt<ServerConfig>): boolean;
  _maybeRebuildDevices(): void;
  _showToast(message: string): void;
  _errText(error: unknown): string;
  requestUpdate(): void;
}

/** The editor runtime methods the tool calls. */
export interface LedEditorRuntime {
  _svgPoint(ev: MouseEvent): number[];
  _snap(p: number[]): number[];
  _prepareConfigCandidate(config: ServerConfig): ServerConfig;
  _saveConfigNow(attempt?: OptimisticAttempt<ServerConfig> | null): Promise<void>;
  _openMarkerDialog(d?: DevItem): void;
}

type Strips = { id: string; led_strips?: LedStripModel[] };

const CLICK_SLOP_PX = 6;
const MAGNET_PX = 12;
const HANDLE_PX = 7;
const HIT_PX = 22;

const scaleOut = (p: Pt): [number, number] => [p[0] / NORM_W, p[1] / NORM_W];
const scaleIn = (p: readonly number[]): Pt => [p[0] * NORM_W, p[1] * NORM_W];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function spacesOf(cfg: ServerConfig | null | undefined): Strips[] {
  return (cfg?.spaces || []) as Strips[];
}

function stripsOf(cfg: ServerConfig | null | undefined, spaceId: string): LedStripModel[] {
  return spacesOf(cfg).find((space) => space.id === spaceId)?.led_strips || [];
}

/** The strip (any space) that holds this marker, active or hidden. */
function ownerOf(cfg: ServerConfig | null | undefined, markerId: string) {
  for (const space of spacesOf(cfg)) {
    const strip = space.led_strips?.find((item) => item.marker === markerId);
    if (strip) return { spaceId: space.id, strip };
  }
  return null;
}

function snap45(from: Pt, to: Pt): Pt {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (!len) return to;
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [from[0] + Math.cos(angle) * len, from[1] + Math.sin(angle) * len];
}

function nearestOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return [a[0] + t * dx, a[1] + t * dy];
}

export class LedStripEditor {
  /** The tool is armed: clean clicks add points. */
  tool = false;
  chain: { points: Pt[]; convert: string | null } | null = null;
  hover: Pt | null = null;
  stopped = false;
  sel: string | null = null;
  picker: string | null = null;
  /** A strip waiting for "New device…" (bound in that dialog's write). */
  pendingBind: { stripId: string; spaceId: string } | null = null;
  private drag: { id: string; index: number; pointerId: number; points: Pt[]; moved: boolean } | null = null;
  private down = new Map<number, { x: number; y: number }>();
  private gesture = false;
  private busy = false;
  private spaceId = '';
  private bodyCache: { key: string; bodies: PlacementBodies; guides: Pt[][] } | null = null;

  constructor(private readonly host: LedEditorHost) {
    void LED_LANGUAGE_RUNTIME.ensure(this.lang).then(() => host.requestUpdate());
  }

  /** The live editor runtime (it may be remounted under the same card). */
  private get rt(): LedEditorRuntime {
    return this.host._editorRuntime!;
  }

  private get lang() {
    return langOf(this.host.hass, this.host._config?.language);
  }

  t(key: LedI18nKey, vars?: Record<string, string | number>): string {
    return ledT(this.lang, key, vars);
  }

  /** Screen px per render unit at the current zoom. */
  private get perUnit(): number {
    const a = this.host._screenToVb(0, 0), b = this.host._screenToVb(100, 0);
    const units = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return units > 0 ? 100 / units : 1;
  }

  // -------------------------------------------------------------------------
  // Placement bodies (ТЗ §6): masonry, partitions and columns with doors,
  // gates and passages cut by geometry — windows stay solid; zero walls are
  // no bodies (their axes are magnet guides only).

  private placement(): { bodies: PlacementBodies; guides: Pt[][] } {
    const host = this.host;
    const space = host._spaceModel();
    if (!space) return { bodies: { rings: [], inside: () => false }, guides: [] };
    const key = `${host._floorKey(space.id)}|${host._cellCm}|${host._gridPitch}`;
    if (this.bodyCache?.key === key) return this.bodyCache;
    const passes = (o: OpeningCfg) => o.type !== 'window';
    let geoms: unknown[] = [];
    try {
      const extras = physicalBodyParts(space, host._cellCm, host._gridPitch, host._gridPitch * 0.0002,
        host._partitionOpeningCuts(space, passes) as never).all;
      const united = wallBodiesGeometry(space.rooms, host._spaceWalls as never, host._openCuts(),
        host._roomWallOpeningInputs(host._openingsR.filter(passes), space),
        host._wallKeyPitch, host._cellCm, host._gridPitch, NORM_W, extras);
      geoms = [united.geom, ...united.components.map((c) => c.geom)];
    } catch {
      geoms = []; // fail-open for placement only: light keeps its own barriers
    }
    const rings = geoms.flatMap((geom) => geometryAllRings(geom)).map((ring) => ring.map((p) => [p[0], p[1]] as Pt));
    const eps = host._gridPitch * 1e-4;
    const nearFace = (p: Pt) => rings.some((ring) => ring.some((a, i) => {
      const q = nearestOnSegment(p, a, ring[(i + 1) % ring.length]);
      return Math.hypot(p[0] - q[0], p[1] - q[1]) <= eps;
    }));
    // Strict interior: a point on a face is outside, so touching and sliding along work.
    const inside = (p: Pt) => geoms.some((geom) => pointInPhysicalGeometry([p[0], p[1]], geom)) && !nearFace(p);
    const guides = space.rooms.flatMap((room) => {
      const poly = roomPoly(room);
      return poly ? [poly.map((p) => [p[0], p[1]] as Pt)] : [];
    });
    this.bodyCache = { key, bodies: { rings, inside }, guides };
    return this.bodyCache;
  }

  /** Grid snap or Shift 45°, then the face/axis magnet within MAGNET_PX on screen. */
  private snapPoint(raw: Pt, shift: boolean, from: Pt | null): Pt {
    const { bodies, guides } = this.placement();
    let p: Pt = from && shift ? snap45(from, raw) : (this.rt._snap([raw[0], raw[1]]) as unknown as Pt);
    let best = MAGNET_PX / this.perUnit;
    for (const ring of [...bodies.rings, ...guides]) {
      for (let i = 0; i < ring.length; i++) {
        const q = nearestOnSegment(raw, ring[i], ring[(i + 1) % ring.length]);
        const d = Math.hypot(raw[0] - q[0], raw[1] - q[1]);
        if (d < best) { best = d; p = q; }
      }
    }
    return p;
  }

  // -------------------------------------------------------------------------
  // Tool lifecycle

  open(convert: string | null = null): void {
    const space = this.host._spaceModel();
    if (!space) return;
    if (stripsOf(this.host._serverCfg, space.id).length >= LED_MAX_STRIPS) {
      this.host._showToast(this.t('led.limit_strips'));
      return;
    }
    this.tool = true;
    this.sel = null;
    this.picker = null;
    this.chain = { points: [], convert };
    this.hover = null;
    this.stopped = false;
    this.host.requestUpdate();
  }

  /** Leave the tool; an unfinished correct chain is finished, never lost (ТЗ §4 п.3). */
  close(): void {
    const pending = this.chain?.points.length ? this.finish() : null;
    this.tool = false;
    this.chain = null;
    this.hover = null;
    this.down.clear();
    if (!pending) this.host.requestUpdate();
  }

  /** Mode, space or editor change: drop session-only state (ТЗ §4 п.8). */
  reset(): void {
    if (this.tool) this.close();
    this.sel = null;
    this.drag = null;
    this.picker = null;
  }

  /**
   * Keys of the Devices editor, after dialogs (ТЗ §4 п.3, п.8, п.9). Returns
   * true when the key was the tool's: Ctrl+Z of a chain removes its own point
   * first, Esc finishes a chain, then leaves the tool, then drops the selection.
   */
  key(e: KeyboardEvent, undo: boolean): boolean {
    if (undo) {
      if (!this.chain?.points.length) return false;
      this.chain.points.pop();
      this.stopped = false;
      this.host.requestUpdate();
      return true;
    }
    if (e.key !== 'Escape') return false;
    if (this.picker) { this.picker = null; this.host.requestUpdate(); return true; }
    if (this.drag) { this.drag = null; this.host.requestUpdate(); return true; }
    if (this.chain?.points.length) { void this.finish(); return true; }
    if (this.tool) { this.close(); return true; }
    if (this.sel) { this.select(null); return true; }
    return false;
  }

  select(id: string | null): void {
    this.sel = id;
    this.host.requestUpdate();
  }

  /** A clean click on the free background drops the selection (ТЗ §4 п.8). */
  backgroundClick(ev: MouseEvent): void {
    if (!this.sel || this.tool || this.host._suppressClick) return;
    const path = (ev.composedPath?.() || []) as Element[];
    // Only the plan itself is background: not the tray, a dialog, a strip or a handle.
    if (!path.some((node) => node?.classList?.contains?.('zoomwrap'))
      || path.some((node) => node?.hasAttribute?.('data-led-select') || node?.hasAttribute?.('data-led-handle'))) return;
    this.select(null);
  }

  // -------------------------------------------------------------------------
  // Drawing input: one owner per sequence; only a clean click adds a point.

  private onDown(e: PointerEvent): void {
    this.down.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.down.size > 1) this.gesture = true;
  }

  private onMove(e: PointerEvent): void {
    const start = this.down.get(e.pointerId);
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP_PX) this.gesture = true;
    if (!this.tool || (this.down.size && e.pointerType !== 'mouse')) return;
    const last = this.chain?.points[this.chain.points.length - 1] || null;
    let p = this.snapPoint(this.rawPoint(e), e.shiftKey, last);
    this.stopped = false;
    if (last) {
      const hit = clampToBodies(last, p, this.placement().bodies);
      if (hit) { p = hit.point; this.stopped = hit.stopped; }
    }
    this.hover = p;
    this.host.requestUpdate();
  }

  private onUp(e: PointerEvent): void {
    const start = this.down.get(e.pointerId);
    this.down.delete(e.pointerId);
    const clean = !!start && !this.gesture && e.button === 0 && !this.host._suppressClick
      && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= CLICK_SLOP_PX;
    if (!this.down.size) this.gesture = false;
    if (clean && this.tool) this.addPoint(e);
  }

  private onCancel(e: PointerEvent): void {
    this.down.delete(e.pointerId);
    this.gesture = this.down.size > 0;
  }

  private rawPoint(e: MouseEvent): Pt {
    const p = this.rt._svgPoint(e);
    return [p[0], p[1]];
  }

  private addPoint(e: PointerEvent): void {
    if (this.busy) return;
    const { bodies } = this.placement();
    const chain = this.chain || (this.chain = { points: [], convert: null });
    const last = chain.points[chain.points.length - 1] || null;
    let p = this.snapPoint(this.rawPoint(e), e.shiftKey, last);
    if (!last) {
      if (bodies.inside(p)) { this.host._showToast(this.t('led.stopped')); return; } // a start inside a body
    } else {
      const near = (q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1]) * this.perUnit <= HANDLE_PX * 1.5;
      // A click on the first point closes a chain of ≥ 3 distinct vertices.
      const first = chain.points[0];
      if (compactPoints(chain.points).length >= 3 && near(first)) {
        const back = clampToBodies(last, first, bodies);
        if (back && !back.stopped) {
          chain.points.push([first[0], first[1]]);
          void this.finish();
          return;
        }
      }
      // A double click on the last point finishes; a repeat click writes no zero segment.
      if (near(last)) {
        if (e.detail >= 2 && chain.points.length >= 2) void this.finish();
        return;
      }
      const hit = clampToBodies(last, p, bodies);
      if (!hit) return;
      if (hit.stopped) this.host._showToast(this.t('led.stopped'));
      p = hit.point;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) * this.perUnit < 0.5) return;
    }
    if (chain.points.length >= LED_MAX_POINTS) {
      this.host._showToast(this.t('led.limit_points'));
      return;
    }
    chain.points.push(p);
    this.stopped = false;
    this.host.requestUpdate();
  }

  /** Esc, a double click, a click on the first point, a tool or editor change. */
  async finish(): Promise<void> {
    const chain = this.chain;
    const space = this.host._spaceModel();
    this.chain = null;
    this.hover = null;
    if (this.tool && chain?.convert) this.tool = false;
    if (!chain || !space) { this.host.requestUpdate(); return; }
    const stored = compactPoints(chain.points).map(scaleOut);
    if (!validStripPoints(stored)) {
      // Fewer than two distinct points: nothing is written, nothing converted.
      if (this.tool) this.chain = { points: [], convert: null };
      this.host.requestUpdate();
      return;
    }
    const id = `led_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const strip: LedStripModel = chain.convert
      ? { id, points: stored, marker: chain.convert, active: true }
      : { id, points: stored, marker: null };
    const ok = await this.write(this.t(chain.convert ? 'led.history_view' : 'led.history_draw'),
      space.id, id, () => strip);
    if (ok) {
      this.tool = false;
      this.sel = id;
      if (!chain.convert) this.picker = id; // bind now, or "Later"
    }
    this.host.requestUpdate();
  }

  // -------------------------------------------------------------------------
  // One transaction per command (ТЗ §4 п.9, §5): the strip record and, for a
  // link, the marker's explicit space — atomically, with rollback.

  private async write(
    name: string, spaceId: string, stripId: string,
    next: (current: LedStripModel | null) => LedStripModel | null, record = true,
  ): Promise<boolean> {
    const cfg = this.host._serverCfg;
    if (!cfg || this.busy) return false;
    let candidate = clone(cfg);
    const space = spacesOf(candidate).find((item) => item.id === spaceId);
    if (!space) return false;
    const strips = [...(space.led_strips || [])];
    const index = strips.findIndex((item) => item.id === stripId);
    const before = index >= 0 ? clone(strips[index]) : null;
    const after = next(before ? clone(before) : null);
    if (same(before, after)) return true; // a no-op is no command
    if (after && !before && strips.length >= LED_MAX_STRIPS) {
      this.host._showToast(this.t('led.limit_strips'));
      return false;
    }
    if (after && index >= 0) strips[index] = after;
    else if (after) strips.push(after);
    else strips.splice(index, 1);
    space.led_strips = strips;
    const markerId = after?.marker;
    if (markerId) {
      // ТЗ §5: the link creates or reuses the live marker and writes its explicit space.
      let marker = candidate.markers?.find((item) => item.id === markerId && !item.removed);
      const dev = this.device(markerId);
      if (!marker && dev?.bindingKind) {
        const binding = dev.bindingKind === 'virtual' ? 'virtual' : `${dev.bindingKind}:${dev.bindingRef}`;
        candidate.markers = (candidate.markers || []).filter((item) => item.id !== markerId
          && (binding === 'virtual' || item.binding !== binding));
        candidate.markers.push(marker = { id: markerId, binding } as Marker);
      }
      if (marker && !marker.space) marker.space = spaceId;
    }
    candidate = this.rt._prepareConfigCandidate(candidate);
    const attempt = this.host._adoption.beginOptimistic(cfg, candidate);
    this.host._adoption.stageLocalConfig(candidate);
    if (this.host._saveConfigDebounced.pending()) this.host._saveConfigDebounced.cancel();
    this.host._regSignature = '';
    this.host._maybeRebuildDevices();
    this.busy = true;
    this.host.requestUpdate();
    try {
      await this.rt._saveConfigNow(attempt);
      if (record) {
        this.host._devicePositionHistory.push({
          name,
          before: { kind: 'led', spaceId, stripId, strip: before } satisfies LedHistoryState,
          after: { kind: 'led', spaceId, stripId, strip: after } satisfies LedHistoryState,
        });
      }
      return true;
    } catch (error) {
      this.host._rollbackOptimistic(attempt);
      this.host._regSignature = '';
      this.host._maybeRebuildDevices();
      this.host._showToast(this.t('led.save_failed', { err: this.host._errText(error) }));
      return false;
    } finally {
      this.busy = false;
      this.host.requestUpdate();
    }
  }

  /**
   * Undo/Redo of an LED command: restore only this strip's record, and only
   * while the current record is still the one the command left — a newer
   * change by someone else is never rolled back (ТЗ §4 п.9).
   */
  async applyHistory(target: LedHistoryState, from: LedHistoryState): Promise<'ok' | 'stale' | 'failed'> {
    const current = stripsOf(this.host._serverCfg, target.spaceId).find((item) => item.id === target.stripId) || null;
    if (!same(current, from.strip)) return 'stale';
    const marker = target.strip?.marker;
    if (marker && ownerOf(this.host._serverCfg, marker)?.strip.id !== target.stripId
        && ownerOf(this.host._serverCfg, marker)) return 'stale';
    const ok = await this.write('', target.spaceId, target.stripId, () => clone(target.strip), false);
    if (ok && this.sel === target.stripId && target.strip?.active === false) this.sel = null;
    return ok ? 'ok' : 'failed';
  }

  // -------------------------------------------------------------------------
  // Actions of the tray, the picker and the device dialog

  private device(markerId: string | null | undefined): DevItem | undefined {
    return markerId ? this.host._devices.find((item) => item.id === markerId) : undefined;
  }

  async bind(stripId: string, markerId: string | null, spaceId = this.host._space): Promise<void> {
    const owner = markerId ? ownerOf(this.host._serverCfg, markerId) : null;
    if (owner && owner.strip.id !== stripId) { this.host._showToast(this.t('led.taken')); return; }
    const ok = await this.write(this.t('led.history_view'), spaceId, stripId,
      (strip) => (strip ? { ...strip, marker: markerId, ...(strip.active === false ? { active: true } : {}) } : null));
    if (ok) this.picker = null;
  }

  async setActive(stripId: string, active: boolean, spaceId = this.host._space): Promise<void> {
    const ok = await this.write(this.t('led.history_view'), spaceId, stripId,
      (strip) => (strip ? { ...strip, active } : null));
    if (ok && !active && this.sel === stripId) this.select(null);
  }

  async remove(stripId: string, spaceId = this.host._space): Promise<void> {
    const ok = await this.write(this.t('led.delete'), spaceId, stripId, () => null);
    if (ok && this.sel === stripId) this.select(null);
  }

  /** "New device…": the marker dialog's save binds the strip in its own write. */
  private newDevice(stripId: string): void {
    this.pendingBind = { stripId, spaceId: this.host._space };
    this.picker = null;
    this.rt._openMarkerDialog();
  }

  /**
   * ТЗ §5: a strip belongs to its space — the marker dialog may not move a
   * bound marker (even with a hidden shape) to another space; unbind first.
   */
  markerMoveBlocked(markerId: string | undefined, targetSpaceId: string): boolean {
    const owner = markerId ? ownerOf(this.host._serverCfg, markerId) : null;
    if (!owner || owner.spaceId === targetSpaceId) return false;
    this.host._showToast(this.t('led.space'));
    return true;
  }

  /**
   * The marker dialog's save, on its candidate — one transaction (ТЗ §5): a
   * rebinding renames the strip link, "New device…" binds its pending strip.
   */
  linkMarker(candidate: ServerConfig, oldId: string | undefined, id: string): void {
    for (const space of spacesOf(candidate)) {
      for (const strip of space.led_strips || []) if (oldId && oldId !== id && strip.marker === oldId) strip.marker = id;
    }
    this.bindPending(candidate, id);
  }

  /** A deleted marker leaves an unbound, visible strip in the same write (ТЗ §5). */
  unlinkMarkers(cfg: ServerConfig, removed: ReadonlySet<string>): void {
    for (const space of spacesOf(cfg)) {
      for (const strip of space.led_strips || []) {
        if (strip.marker && removed.has(strip.marker)) Object.assign(strip, { marker: null, active: true });
      }
    }
  }

  private bindPending(candidate: ServerConfig, id: string): void {
    const pending = this.pendingBind;
    this.pendingBind = null;
    const strip = pending && spacesOf(candidate).find((space) => space.id === pending.spaceId)
      ?.led_strips?.find((item) => item.id === pending.stripId);
    if (!pending || !strip || ownerOf(candidate, id)) return;
    strip.marker = id;
    strip.active = true;
    const marker = candidate.markers?.find((item) => item.id === id);
    if (marker && !marker.space) marker.space = pending.spaceId;
  }

  // -------------------------------------------------------------------------
  // Rendering

  /** The SVG layer of the Devices editor: unbound strips, hit paths, handles, the chain. */
  layer(space: SpaceModel): TemplateResult | typeof nothing {
    if (space.id !== this.spaceId) {
      const changed = !!this.spaceId;
      this.spaceId = space.id;
      this.bodyCache = null;
      if (changed) queueMicrotask(() => this.reset());
    }
    const per = this.perUnit;
    const strips = stripsOf(this.host._serverCfg, space.id)
      .filter((strip) => strip.active !== false && validStripPoints(strip.points));
    const geometry = (strip: LedStripModel) => {
      const points = (this.drag?.id === strip.id ? this.drag.points : strip.points.map(scaleIn));
      return pathD({ points, closed: isClosedStrip(points) });
    };
    const sel = strips.find((strip) => strip.id === this.sel) || null;
    const chain = this.chain;
    const preview = chain ? [...chain.points, ...(this.hover && this.tool ? [this.hover] : [])] : [];
    const accent = 'var(--primary-color, #03a9f4)';
    return svg`<g class="led-editor" data-hp-led-editor="1">
      ${strips.filter((strip) => !this.device(strip.marker)).map((strip) => svg`<path class="led-unbound"
        data-led-unbound="${strip.id}" d="${geometry(strip)}" fill="none" stroke="#8a8a8a"
        stroke-width="${3 / per}" stroke-dasharray="${8 / per} ${6 / per}" stroke-linecap="round"
        stroke-linejoin="round" pointer-events="none"></path>`)}
      ${sel ? svg`<path class="led-selected" d="${geometry(sel)}" fill="none" stroke="${accent}"
        stroke-opacity="0.45" stroke-width="${10 / per}" stroke-linecap="round" stroke-linejoin="round"
        pointer-events="none"></path>` : nothing}
      ${this.tool ? nothing : strips.map((strip) => svg`<path class="led-select-hit" data-led-select="${strip.id}"
        d="${geometry(strip)}" fill="none" stroke="transparent" stroke-width="${(2 * HIT_PX) / per}"
        stroke-linecap="round" stroke-linejoin="round" pointer-events="stroke" style="cursor:pointer"
        @click=${(e: MouseEvent) => {
          e.stopPropagation();
          if (!this.host._suppressClick) this.select(strip.id);
        }}></path>`)}
      ${sel && !this.tool ? this.handles(sel, per) : nothing}
      ${preview.length ? svg`<polyline class="led-chain" points="${preview.map((p) => `${p[0]},${p[1]}`).join(' ')}"
        fill="none" stroke="${this.stopped ? '#e53935' : accent}" stroke-width="${3 / per}"
        stroke-linecap="round" stroke-linejoin="round" pointer-events="none"></polyline>
        ${chain!.points.map((p, i) => svg`<circle class="led-chain-point" cx="${p[0]}" cy="${p[1]}"
          r="${(i ? HANDLE_PX * 0.6 : HANDLE_PX) / per}" fill="white" stroke="${accent}"
          stroke-width="${2 / per}" pointer-events="none"></circle>`)}` : nothing}
    </g>`;
  }

  private handles(strip: LedStripModel, per: number): TemplateResult {
    const points = this.drag?.id === strip.id ? this.drag.points : strip.points.map(scaleIn);
    const count = isClosedStrip(points) ? points.length - 1 : points.length;
    return svg`${points.slice(0, count).map((p, index) => svg`<circle class="led-handle"
      data-led-handle="${index}" cx="${p[0]}" cy="${p[1]}" r="${HANDLE_PX / per}" fill="white"
      stroke="var(--primary-color, #03a9f4)" stroke-width="${2 / per}" style="cursor:grab;touch-action:none"
      @pointerdown=${(e: PointerEvent) => this.handleDown(e, strip, index)}
      @pointermove=${(e: PointerEvent) => this.handleMove(e)}
      @pointerup=${(e: PointerEvent) => void this.handleUp(e)}
      @pointercancel=${() => this.handleCancel()}
      @lostpointercapture=${() => this.handleCancel()}></circle>`)}` as unknown as TemplateResult;
  }

  private handleDown(e: PointerEvent, strip: LedStripModel, index: number): void {
    if (e.button !== 0 || this.busy) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    this.drag = { id: strip.id, index, pointerId: e.pointerId, points: strip.points.map(scaleIn), moved: false };
  }

  private handleMove(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const next = clampVertexMove(drag.points, drag.index,
      this.snapPoint(this.rawPoint(e), false, null), this.placement().bodies);
    const points = [...drag.points];
    const last = points.length - 1;
    points[drag.index] = next;
    if (isClosedStrip(drag.points) && drag.index === 0) points[last] = next;
    drag.points = points;
    drag.moved = true;
    this.host.requestUpdate();
  }

  private async handleUp(e: PointerEvent): Promise<void> {
    const drag = this.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    this.drag = null;
    const stored = drag.points.map(scaleOut);
    if (!drag.moved || !validStripPoints(stored)) { this.host.requestUpdate(); return; }
    await this.write(this.t('led.history_shape'), this.host._space, drag.id,
      (strip) => (strip ? { ...strip, points: stored } : null));
  }

  private handleCancel(): void {
    if (!this.drag) return;
    this.drag = null; // a cancelled gesture writes nothing and records nothing
    this.host.requestUpdate();
  }

  /** Stage chrome: the capture layer while drawing (icons do not take the input) and the picker. */
  chrome(): TemplateResult | typeof nothing {
    const dialog = this.host._markerDialog;
    // A closed "New device…" dialog drops its pending link; an icon's dialog
    // drops the strip selection (ТЗ §4 п.8), the strip's own settings keep it.
    if (!dialog) this.pendingBind = null;
    else if (this.sel && !this.pendingBind && dialog.devId !== stripsOf(this.host._serverCfg, this.host._space)
      .find((item) => item.id === this.sel)?.marker) this.sel = null;
    if (this.host._mode !== 'devices') return nothing;
    return html`${this.tool ? html`<div class="led-capture" data-hp-led-capture="1"
      style="position:absolute;inset:0;z-index:4;cursor:crosshair;touch-action:none"
      @pointerdown=${(e: PointerEvent) => this.onDown(e)}
      @pointermove=${(e: PointerEvent) => this.onMove(e)}
      @pointerup=${(e: PointerEvent) => this.onUp(e)}
      @pointercancel=${(e: PointerEvent) => this.onCancel(e)}
      @lostpointercapture=${(e: PointerEvent) => this.onCancel(e)}
      @pointerleave=${() => { this.hover = null; this.host.requestUpdate(); }}
      @click=${(e: MouseEvent) => e.stopPropagation()}
      @dblclick=${(e: MouseEvent) => e.stopPropagation()}
      @contextmenu=${(e: MouseEvent) => e.preventDefault()}></div>` : nothing}${this.pickerDialog()}`;
  }

  /** The tray (ТЗ §4 п.7): the drawing operation, or the selected strip. */
  secondary(): EditorSecondaryModel | null {
    if (this.host._mode !== 'devices') return null;
    if (this.tool) {
      const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
      const n = this.chain?.points.length || 0;
      return {
        contextId: 'led-draw',
        kind: 'operation',
        ariaLabel: this.t('led.tool'),
        visibleLabel: this.t('led.tool'),
        dismissPolicy: 'stay-open-on-canvas',
        dismiss: () => this.close(),
        content: html`<span class="hint" data-led-hint>${n
          ? this.t(touch ? 'led.points_touch' : 'led.points', { n })
          : `${this.t(touch ? 'led.start_touch' : 'led.start')}. ${this.t('led.hint')}`}</span>
          ${n ? html`<button class="btn" data-led-action="finish" @click=${() => void this.finish()}>
            <ha-icon icon="mdi:check"></ha-icon>${this.t('led.finish')}</button>` : nothing}
          ${this.chain?.convert ? html`<button class="btn ghost" data-led-action="cancel" @click=${() => {
            this.chain = null; this.tool = false; this.host.requestUpdate();
          }}>${this.t('led.cancel')}</button>` : nothing}`,
      };
    }
    const strip = stripsOf(this.host._serverCfg, this.host._space)
      .find((item) => item.id === this.sel && item.active !== false);
    if (!strip) return null;
    const device = this.device(strip.marker);
    const label = device?.name || this.t('led.unbound');
    const button = (action: string, icon: string, text: string, run: () => void, cls = 'ghost') =>
      html`<button class="btn ${cls}" data-led-action=${action} ?disabled=${this.busy} @click=${run}>
        <ha-icon icon=${icon}></ha-icon>${text}</button>`;
    return {
      contextId: `led-${strip.id}`,
      kind: 'selection',
      ariaLabel: label,
      visibleLabel: label,
      dismiss: () => this.select(null),
      content: html`
        ${device ? button('settings', 'mdi:tune', this.t('led.settings'),
          () => this.rt._openMarkerDialog(device)) : nothing}
        ${button('bind', 'mdi:link-variant', this.t(device ? 'led.change' : 'led.bind'),
          () => { this.picker = strip.id; this.host.requestUpdate(); })}
        ${strip.marker ? button('unbind', 'mdi:link-variant-off', this.t('led.unbind'),
          () => void this.bind(strip.id, null)) : nothing}
        ${device ? button('icon', 'mdi:lightbulb-outline', this.t('led.show_icon'),
          () => void this.setActive(strip.id, false)) : nothing}
        ${button('delete', 'mdi:delete-outline', this.t('led.delete'), () => void this.remove(strip.id), 'danger')}`,
    };
  }

  /** The device picker: devices of this space, lights first; taken ones explained, or a new one. */
  private pickerDialog(): TemplateResult | typeof nothing {
    const stripId = this.picker;
    if (!stripId) return nothing;
    const current = stripsOf(this.host._serverCfg, this.host._space).find((item) => item.id === stripId);
    if (!current) return nothing;
    const isLight = (d: DevItem) => d.entities.some((eid) => eid.startsWith('light.'));
    const devices = this.host._devices
      .filter((d) => d.space === this.host._space && !d.marker?.removed)
      .sort((a, b) => Number(isLight(b)) - Number(isLight(a)) || a.name.localeCompare(b.name));
    const close = () => { this.picker = null; this.host.requestUpdate(); };
    return html`<hp-dialog .hass=${this.host.hass} data-kind="led-picker" .title=${this.t('led.pick_title')}
      icon="mdi:led-strip-variant" @hp-close=${close}>
      <div class="body led-picker" style="display:flex;flex-direction:column;gap:4px">
        ${devices.length ? devices.map((d) => {
          const owner = ownerOf(this.host._serverCfg, d.id);
          const taken = !!owner && owner.strip.id !== stripId;
          return html`<button class="btn ghost led-pick ${current.marker === d.id ? 'on' : ''}"
            data-led-pick=${d.id} ?disabled=${taken || this.busy} title=${taken ? this.t('led.taken') : d.name}
            style="justify-content:flex-start" @click=${() => void this.bind(stripId, d.id)}>
            <ha-icon icon=${d.icon || 'mdi:lightbulb'}></ha-icon>${d.name}${taken
              ? html` <small class="hint">· ${this.t('led.taken')}</small>` : nothing}</button>`;
        }) : html`<div class="hint">${this.t('led.pick_empty')}</div>`}
      </div>
      <div class="row" slot="footer">
        <button class="btn" data-led-action="new-device" @click=${() => this.newDevice(stripId)}>
          <ha-icon icon="mdi:plus-box-outline"></ha-icon>${this.t('led.pick_new')}</button>
        <span class="spacer"></span>
        <button class="btn ghost" data-led-action="later" @click=${close}>${this.t('led.later')}</button>
      </div>
    </hp-dialog>`;
  }

  /**
   * The representation section of the device dialog (ТЗ §5): "Show as LED
   * strip" (restoring a hidden shape at once, or drawing one) or "Show as
   * icon"; for a hidden shape also unbind/delete. `leave` runs the dialog's
   * own save/discard guard and closes it; false keeps the dialog.
   */
  markerSection(devId: string, leave: () => Promise<boolean>): TemplateResult {
    const owner = ownerOf(this.host._serverCfg, devId);
    const active = !!owner && owner.strip.active !== false;
    const then = (action: () => unknown) => async () => { if (await leave()) await action(); };
    const button = (name: string, icon: string, text: string, run: () => unknown, cls = 'ghost') =>
      html`<button class="btn ${cls}" type="button" data-led-action=${name} ?disabled=${this.busy}
        @click=${then(run)}><ha-icon icon=${icon}></ha-icon>${text}</button>`;
    return html`<div class="hpf-group led-representation" data-led-representation=${active ? 'strip' : 'icon'}>
      ${active ? html`<span class="hpf-note">${this.t('led.type_note')}</span>` : nothing}
      <div class="row" style="flex-wrap:wrap;gap:6px">
        ${active
          ? button('show-icon', 'mdi:lightbulb-outline', this.t('led.show_icon'),
            () => this.setActive(owner.strip.id, false, owner.spaceId))
          : button('show-strip', 'mdi:led-strip-variant', this.t('led.show_strip'),
            () => (owner ? this.setActive(owner.strip.id, true, owner.spaceId) : this.open(devId)))}
        ${owner && !active ? html`
          ${button('unbind', 'mdi:link-variant-off', this.t('led.unbind'),
            () => this.bind(owner.strip.id, null, owner.spaceId))}
          ${button('delete', 'mdi:delete-outline', this.t('led.delete'),
            () => this.remove(owner.strip.id, owner.spaceId), 'danger')}` : nothing}
      </div>
    </div>`;
  }
}

export function createLedStripEditor(host: LedEditorHost): LedStripEditor {
  return new LedStripEditor(host);
}
