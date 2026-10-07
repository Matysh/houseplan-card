/** Lazy Select-only adapter. Preview has no route into a config/history writer. */
import { nothing, render, svg, type TemplateResult } from 'lit';
import { NORM_W, GRID_STEP_N } from './canvas-constants';
import { commitWallSegmentModel } from './wall-segment-model';
import { canonicalizeConfigGeometryInPlace } from './coordinate-canonicalization';
import { cancelHouseplanPointerMove, flushHouseplanPointerMove, queueHouseplanPointerMove } from './pointer-move-queue';
import { applyNodeMove, pickWallNode, prepareNodeMove, resolveNodeMoveSnap, structuralNodeWalls,
  structuralWallNodes, sameNodePoint, type NodeMoveIntent, type NodeMovePlan,
  type NodeMoveSpace, type NodePoint, type WallNode, type NodeMoveReason } from './wall-node-move';
import type { ServerConfig } from './types';
import type { NodePreviewScene } from './wall-node-preview';

export interface NodeMoveHistory { beforeSpace: NodeMoveSpace; intent: NodeMoveIntent; direction: 'apply' | 'undo' }
export interface NodeEditorContext { enabled: boolean; space: string; revision: number; api: boolean }
export interface WallNodeEditorPort {
  context(): NodeEditorContext;
  config(): ServerConfig | null;
  screenPoint(event: PointerEvent): NodePoint;
  unitsPerPixel(): number;
  stage(): HTMLElement | null;
  root(): ParentNode;
  document: Document;
  text(key: string, params?: Record<string, string>): string;
  toast(text: string): void;
  changed(): void;
  validate(space: NodeMoveSpace, before: NodeMoveSpace, final: boolean): boolean;
  paintOpportunity(): Promise<void>;
  write(history: NodeMoveHistory, expectedRevision: number): Promise<ServerConfig>;
  record(before: NodeMoveSpace, after: NodeMoveSpace, intent: NodeMoveIntent): void;
  historyFailed(): void;
  scene?(space: NodeMoveSpace, before: NodeMoveSpace): NodePreviewScene | null;
}
interface Session {
  pointer: number; revision: number; configIdentity: string; plan: NodeMovePlan;
  capture: HTMLElement; axis: string | null; target: NodePoint; guide: string | null;
  candidate: NodeMoveSpace | null; affected: string[]; invalid: NodeMoveReason | null;
  moved: boolean; released: boolean; outline: boolean;
}

export class WallNodeEditor {
  private session: Session | null = null;
  private cache: { space: string; identity: string; nodes: WallNode[]; source: NodeMoveSpace } | null = null;
  private tail = false;
  private touched: { element: SVGElement; mask: string; opacity: string; transition: string }[] = [];
  private liveRoots: SVGGElement[] = [];
  private listening = true;
  public busy = false;
  private readonly pagehide = (): void => { this.cancel(); };
  constructor(private readonly port: WallNodeEditorPort) {
    port.document.defaultView?.addEventListener('pagehide', this.pagehide);
  }
  get dragging(): boolean { return !!this.session; }
  get preview(): { space: string; sp: NodeMoveSpace } | null {
    const s = this.session;
    return s?.moved && s.candidate ? { space: s.plan.source.id, sp: s.candidate } : null;
  }
  get activePointerId(): number | null { return this.session?.pointer ?? null; }
  get invalid(): NodeMoveReason | null { return this.session?.invalid || null; }
  get unitsPerPixel(): number { return this.port.unitsPerPixel(); }

  private nodes(): { nodes: WallNode[]; source: NodeMoveSpace } | null {
    const ctx = this.port.context(), config = this.port.config();
    const raw = config?.spaces.find(s => s.id === ctx.space) as NodeMoveSpace | undefined;
    if (!raw || !config) return null;
    const identity = JSON.stringify(raw);
    if (this.cache?.space === ctx.space && this.cache.identity === identity) return this.cache;
    // A legacy read/hover is never materialised into the authoritative carrier.
    // Its local snapshot is discarded on cancel; accepted edit migrates once.
    const source = commitWallSegmentModel({ ...config, spaces: [raw] }).config.spaces[0] as NodeMoveSpace;
    const nodes = structuralWallNodes(source);
    this.cache = { space: ctx.space, identity, source, nodes };
    return this.cache;
  }

  /** Invoked by the existing capture-phase input owner, ahead of wall bodies. */
  guardEvent(event: Event): boolean {
    if (event.type === 'click' || event.type === 'contextmenu') {
      if (!this.tail) return false;
      event.preventDefault(); event.stopImmediatePropagation(); return true;
    }
    const ev = event as PointerEvent;
    if (event.type === 'pointerdown') {
      this.tail = false;
      if (this.session && this.session.pointer !== ev.pointerId) { this.cancel(); return false; }
      return this.down(ev);
    }
    if (!this.session || this.session.pointer !== ev.pointerId) return false;
    if (event.type === 'pointermove') this.move(ev);
    else if (event.type === 'pointerup') void this.up(ev);
    else if (event.type === 'pointercancel' || event.type === 'lostpointercapture') {
      if (event.type !== 'lostpointercapture' || !this.session.released) this.cancel();
    } else return false;
    ev.preventDefault(); ev.stopImmediatePropagation(); return true;
  }

  private down(ev: PointerEvent): boolean {
    const ctx = this.port.context(), stage = this.port.stage();
    if (!ctx.enabled || !stage || !ev.composedPath().includes(stage)) return false;
    if (this.busy) { ev.preventDefault(); ev.stopImmediatePropagation(); return true; }
    if (ev.pointerType !== 'mouse' || ev.button !== 0 || !ev.isPrimary) return false;
    const data = this.nodes(); if (!data) return false;
    const hit = pickWallNode(data.nodes, this.port.screenPoint(ev), this.port.unitsPerPixel());
    if (!hit.node && !hit.ambiguous) return false;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if (hit.ambiguous) { this.port.toast(this.port.text('node_move_ambiguous')); return true; }
    if (!ctx.api) { this.port.toast(this.port.text('node_move_update_required')); return true; }
    if (!hit.node!.supported) { this.port.toast(this.port.text('node_move_unsupported_junction')); return true; }
    const splitIds: Record<string, string> = {};
    if (hit.node!.passing === 2) for (const wall of hit.node!.walls) if (!sameNodePoint(wall.a, hit.node!.point)
        && !sameNodePoint(wall.b, hit.node!.point)) {
      // randomUUID is secure-context-only; HA commonly runs on a LAN HTTP URL.
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
      const hex = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
      splitIds[`${wall.kind}:${wall.id}`] = `${wall.kind}-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    const plan = prepareNodeMove(data.source, hit.node!, data.nodes, splitIds);
    this.session = { pointer: ev.pointerId, revision: ctx.revision,
      configIdentity: JSON.stringify(this.port.config()), plan, capture: stage,
      axis: null, target: [...hit.node!.point], guide: null, candidate: null,
      affected: [], invalid: null, moved: false, released: false, outline: false };
    try { stage.setPointerCapture(ev.pointerId); } catch { this.session = null; return true; }
    stage.style.cursor = 'grabbing';
    // The X-axis prompt belongs to the bounded live layer. A card toast here
    // schedules a full-floor render after capture, inside the drag window.
    this.port.changed(); return true;
  }

  private current(s: Session): boolean {
    const ctx = this.port.context();
    return this.session === s && ctx.enabled && ctx.space === s.plan.source.id
      && ctx.revision === s.revision && ctx.api;
  }
  private move(ev: PointerEvent): void {
    const s = this.session; if (!s || s.released) return;
    queueHouseplanPointerMove(this, 'node', () => {
      if (!this.current(s)) { this.cancel(); return; }
      const snapped = resolveNodeMoveSnap(s.plan, this.port.screenPoint(ev), this.port.unitsPerPixel(), s.axis);
      s.axis = snapped.axis; s.target = snapped.point; s.guide = snapped.guide;
      const candidate = applyNodeMove(s.plan, s.target, s.axis);
      s.moved = !sameNodePoint(s.target, s.plan.node.point);
      s.invalid = candidate.ok ? null : candidate.reason;
      s.candidate = candidate.ok && candidate.changed ? candidate.space : null;
      if (s.candidate) canonicalizeConfigGeometryInPlace({ spaces: [s.candidate] });
      s.affected = candidate.ok ? candidate.affected : [];
      if (s.candidate && !this.port.validate(s.candidate, s.plan.source, false)) s.invalid = 'invalid';
      // Invalid is the LAST resolved candidate, never the previous valid one.
      this.port.changed();
    });
  }

  private async up(ev: PointerEvent): Promise<void> {
    const s = this.session; if (!s || s.released) return;
    flushHouseplanPointerMove(this, 'node');
    if (!this.current(s)) { this.cancel(); return; }
    s.released = true; this.tail = true;
    // Flush -> DOM -> actual paint opportunity -> save that very candidate.
    // Esc/external adoption may retire the session while the paint is awaited.
    this.port.changed();
    await this.port.paintOpportunity();
    if (!this.current(s)) { if (this.session === s) this.cancel(); return; }
    if (!s.moved || !s.candidate || s.invalid || JSON.stringify(this.port.config()) !== s.configIdentity
        || !this.port.validate(s.candidate, s.plan.source, true)) {
      if (s.invalid) this.port.toast(this.port.text(`node_move_${s.invalid}`));
      this.cancel(); return;
    }
    const history: NodeMoveHistory = { beforeSpace: s.plan.source,
      intent: { point: [...s.plan.node.point], target: [...s.target], axis: s.axis, split_ids: s.plan.splitIds }, direction: 'apply' };
    this.busy = true;
    try {
      const config = await this.port.write(history, s.revision);
      const after = config.spaces.find(space => space.id === history.beforeSpace.id) as NodeMoveSpace;
      this.port.record(history.beforeSpace, after, history.intent);
    } catch {
      this.port.toast(this.port.text('node_move_invalid', { reason: this.port.text('toast.geometry_unsafe') }));
    } finally { this.busy = false; this.cancel(); }
  }

  applyHistory(history: NodeMoveHistory): boolean {
    if (this.busy || !this.port.context().enabled || !this.port.context().api) return false;
    this.busy = true;
    void this.port.write(history, this.port.context().revision)
      .catch(() => { this.port.historyFailed(); this.port.toast(this.port.text('toast.geometry_unsafe')); })
      .finally(() => { this.busy = false; this.cache = null; this.port.changed(); });
    return true;
  }
  cancel(): boolean {
    const s = this.session;
    cancelHouseplanPointerMove(this);
    if (!s) return false;
    this.session = null; this.cache = null; this.tail = true;
    s.capture.style.cursor = '';
    try { if (s.capture.hasPointerCapture(s.pointer)) s.capture.releasePointerCapture(s.pointer); } catch { /* detached */ }
    this.restorePaint(); this.clearLive(); this.port.changed(); return true;
  }
  dispose(): void { this.cancel(); this.cache = null; this.clearLive(); this.listening = false;
    this.port.document.defaultView?.removeEventListener('pagehide', this.pagehide); }

  render(live = false): TemplateResult | typeof nothing {
    const ctx = this.port.context();
    if (ctx.enabled && !this.listening) { this.listening = true; this.port.document.defaultView?.addEventListener('pagehide', this.pagehide); }
    if (!ctx.enabled) { this.cancel(); this.cache = null; return nothing; }
    if (this.session && !this.current(this.session)) this.cancel();
    const data = this.session ? { source: this.session.plan.source, nodes: this.session.plan.nodes } : this.nodes();
    if (!data) return nothing;
    const s = this.session, p = s?.moved ? s.target : null;
    const unitPx = this.port.unitsPerPixel() * NORM_W;
    const toPath = (points: number[][]): string => `M${points.map(p => p.map(v => v * NORM_W).join(' ')).join('L')}Z`;
    const affected = s?.candidate ? structuralNodeWalls(s.candidate).filter(w => s.affected.includes(`${w.kind}:${w.id}`)
      || Object.values(s.plan.splitIds).includes(w.id)) : s?.moved ? s.plan.node.walls.filter(w =>
        sameNodePoint(w.a, s.plan.node.point) || sameNodePoint(w.b, s.plan.node.point)
        || !s.plan.node.axes.find(a => a.key === s.axis)?.walls.some(c => c.id === w.id && c.kind === w.kind)) : [];
    const oldAffected = s?.moved ? s.plan.node.walls.filter(w =>
      sameNodePoint(w.a, s.plan.node.point) || sameNodePoint(w.b, s.plan.node.point)
      || !s.plan.node.axes.find(a => a.key === s.axis)?.walls.some(c => c.id === w.id && c.kind === w.kind)) : [];
    const strips = (s?.outline || !s?.candidate ? oldAffected : affected).map(w => {
      const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], len = Math.hypot(dx, dy);
      const half = Math.max(w.cm / (data.source.cell_cm || 5) * GRID_STEP_N / 2, this.port.unitsPerPixel() * 2);
      const ox = -dy / len * half, oy = dx / len * half, cap = half;
      const ax = w.a[0] - dx / len * cap, ay = w.a[1] - dy / len * cap;
      const bx = w.b[0] + dx / len * cap, by = w.b[1] + dy / len * cap;
      return [[ax + ox, ay + oy], [bx + ox, by + oy], [bx - ox, by - oy], [ax - ox, ay - oy]];
    });
    return svg`<g class="hp-node-layer" data-hp-node-state=${s ? s.invalid ? 'invalid' : s.moved ? 'preview' : 'captured' : 'idle'}>
      ${live && s?.moved ? svg`<defs><mask id="hp-node-ghost-mask" maskUnits="objectBoundingBox" x="-10%" y="-10%" width="120%" height="120%" style="mask-type:luminance">
        <rect x="-5000000" y="-5000000" width="10000000" height="10000000" fill="white"/>
        ${strips.map(poly => svg`<path d=${toPath(poly)} fill=${s?.candidate && !s.outline ? '#808080' : 'black'}/>`)}
      </mask></defs>` : nothing}
      ${(live && s ? [s.plan.node] : data.nodes).map(n => svg`<circle class="hp-node-handle" data-node=${n.key}
        cx=${(s?.plan.node.key === n.key && p ? p[0] : n.point[0]) * NORM_W}
        cy=${(s?.plan.node.key === n.key && p ? p[1] : n.point[1]) * NORM_W}
        r=${unitPx * 12} fill="transparent" style=${`cursor:${s ? 'grabbing' : n.supported && ctx.api ? 'grab' : 'not-allowed'}`}
        ><title>${this.port.text(!ctx.api ? 'node_move_update_required' : !n.supported ? 'node_move_unsupported_junction' : 'node_move_hint')}</title></circle>
        <circle data-node=${n.key} pointer-events="none" cx=${(s?.plan.node.key === n.key && p ? p[0] : n.point[0]) * NORM_W}
        cy=${(s?.plan.node.key === n.key && p ? p[1] : n.point[1]) * NORM_W} r=${unitPx * 3}
        fill=${s?.invalid && s.plan.node.key === n.key ? '#e35d45' : 'var(--primary-color, #03a9f4)'} opacity=${s?.moved && s.plan.node.key === n.key ? '.5' : '1'}/>`)}
      ${s?.moved && s.invalid && (!s.candidate || s.outline) ? oldAffected.map(w => svg`<path
        d=${`M${[w.a, s.target, w.b].filter((_, i) => i === 1 || !sameNodePoint(i === 0 ? w.a : w.b, s.plan.node.point))
          .map(p => p.map(v => v * NORM_W).join(' ')).join('L')}`}
        fill="none" stroke="#e35d45" stroke-opacity=".5" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`) : nothing}
      ${s?.invalid ? svg`<text x=${s.target[0] * NORM_W + unitPx * 16} y=${s.target[1] * NORM_W}
        fill="#e35d45" font-size=${unitPx * 12} pointer-events="none">${this.port.text(`node_move_${s.invalid}`)}</text>` : nothing}
      ${s?.plan.node.passing === 2 && !s.axis ? svg`<text x=${s.target[0] * NORM_W + unitPx * 16}
        y=${s.target[1] * NORM_W} fill="var(--primary-text-color)" font-size=${unitPx * 12}
        pointer-events="none">${this.port.text('node_move_choose_axis')}</text>` : nothing}
      ${s?.moved && s.guide ? svg`<line class="hp-node-guide" pointer-events="none" stroke="var(--primary-color, #03a9f4)" stroke-dasharray="4 4"
        stroke-width="1" vector-effect="non-scaling-stroke" x1=${s.plan.node.point[0] * NORM_W} y1=${s.plan.node.point[1] * NORM_W}
        x2=${s.target[0] * NORM_W} y2=${s.target[1] * NORM_W}/>` : nothing}
    </g>`;
  }

  private restorePaint(): void {
    for (const { element, mask, opacity } of this.touched) { element.style.mask = mask; element.style.opacity = opacity; }
    const changed = this.touched.filter(t => t.element.style.transition !== t.transition);
    // Flush once while transitions are off: restore never fades the hidden old
    // floor through a ghost or fades authoritative geometry back after Esc.
    if (changed.length) this.port.document.defaultView?.getComputedStyle(changed[0].element).opacity;
    for (const { element, transition } of changed) element.style.transition = transition;
    this.touched = [];
  }
  private clearLive(): void { for (const root of this.liveRoots) { render(nothing, root); root.remove(); } this.liveRoots = []; }
  /** Separate local production paper/fill/masonry passes preserve layer order.
   * The settled scene and every authoritative/cache/write carrier stay frozen. */
  paint(): void {
    this.restorePaint();
    const s = this.session; if (!s) { this.clearLive(); return; }
    const root = this.port.root();
    const svgRoot = root.querySelector<SVGSVGElement>('svg.plan-svg'); if (!svgRoot) return;
    if (this.liveRoots.some(r => !r.isConnected)) this.clearLive();
    if (!this.liveRoots.length) {
      for (let i = 0; i < 3; i++) {
        const group = this.port.document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.dataset.hpNodeLive = String(i); group.setAttribute('pointer-events', 'none');
        const anchor = i === 0 ? svgRoot.querySelector('.hp-backdrop, [data-hp="room"]')
          : i === 1 ? svgRoot.querySelector('[data-hp="room"]') : null;
        (anchor?.parentElement || svgRoot).insertBefore(group, anchor); this.liveRoots.push(group);
      }
    }
    const scene = s.candidate ? this.port.scene?.(s.candidate, s.plan.source) : null;
    s.outline = !!s.invalid && !scene;
    const mask = (id: string, d: string): TemplateResult => svg`<mask id=${id} maskUnits="objectBoundingBox"
      x="-10%" y="-10%" width="120%" height="120%" style="mask-type:luminance">
      <rect x="-5000000" y="-5000000" width="10000000" height="10000000" fill="white"/>
      <path d=${d} fill="black" fill-rule="evenodd"/>
    </mask>`;
    render(scene?.paper || nothing, this.liveRoots[0]);
    render(scene?.rooms || nothing, this.liveRoots[1]);
    render(svg`<defs>${scene ? svg`<mask id="hp-node-old-walls-mask" maskUnits="objectBoundingBox"
      x="-10%" y="-10%" width="120%" height="120%" style="mask-type:luminance">
      <rect x="-5000000" y="-5000000" width="10000000" height="10000000" fill="white"/>
      <path d=${scene.oldWallsD} fill="black" fill-rule="evenodd"/>
      <path d=${scene.oldPaperD} fill="black" fill-rule="evenodd"/>
      ${scene.oldZeroD.map(d => svg`<path d=${d}
        stroke="black" stroke-width="4" vector-effect="non-scaling-stroke"/>`)}</mask>` : nothing}
      ${scene ? mask('hp-node-old-paper-mask', scene.oldPaperD) : nothing}</defs>${scene?.walls || nothing}${this.render(true)}`, this.liveRoots[2]);
    const oldZero = scene?.oldZeroD || s.plan.node.walls.filter(w => w.cm === 0).map(w =>
      `M${w.a.map(v => v * NORM_W).join(' ')}L${w.b.map(v => v * NORM_W).join(' ')}`);
    const elements = root.querySelectorAll<SVGElement>(`.hp-node-layer [data-node="${s.plan.node.key}"], .wallbodies, .room-outline, .seg, .zerowall, .zero-wall, .plan-snap-overlay, .hidden-wall-diagnostic, .physical-chrome, .physical-hit, .hp-paperg, [data-hp="room"], .openinglayer [data-hp="opening"]`);
    for (const element of elements) {
      if (element.closest('[data-hp-node-live]')) continue;
      this.touched.push({ element, mask: element.style.mask, opacity: element.style.opacity, transition: element.style.transition });
      if (element.closest('.hp-node-layer')) element.style.opacity = '0';
      else if (element.matches('.zero-wall')) {
        const a = `${element.getAttribute('x1')} ${element.getAttribute('y1')}`;
        const b = `${element.getAttribute('x2')} ${element.getAttribute('y2')}`;
        if (s.moved && (oldZero.includes(`M${a}L${b}`) || oldZero.includes(`M${b}L${a}`))) element.style.opacity = '0';
      }
      else if (scene && element.matches('[data-hp="room"]')) {
        if (scene.roomIds.includes(element.dataset.id || '')) { element.style.transition = 'none'; element.style.opacity = '0'; }
      } else if (scene && element.matches('[data-hp="opening"]')) {
        if (scene.openingIds.includes(element.dataset.id || '')) element.style.opacity = '0';
      } else if (scene) element.style.mask = element.matches('.hp-paperg')
        ? 'url(#hp-node-old-paper-mask)' : 'url(#hp-node-old-walls-mask)';
      else if (s.moved && element.matches('.wallbodies, .room-outline, .seg, .zerowall, .plan-snap-overlay, .hidden-wall-diagnostic, .physical-chrome, .physical-hit')) element.style.mask = 'url(#hp-node-ghost-mask)';
      else if (s.moved && element.matches('[data-hp="opening"]') && s.plan.source.openings?.some(o => o.id === element.dataset.id
        && o.host && s.plan.node.walls.some(w => w.id === o.host?.id))) element.style.opacity = '0';
    }
  }
}
