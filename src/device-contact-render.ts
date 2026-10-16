/** Shared Flat DOM adapter. Face geometry is measured only on metric invalidation. */
import { nothing, render, svg } from 'lit';
import {
  contactContains, contactOutline, joinedContactSide,
  type ContactMarker, type ContactRect, type ContactShape, type ContactWall,
} from './device-contact-geometry';
import { contactBounds, DeviceContactScene } from './device-contact-scene';
import type { DeviceHitCandidate } from './device-hit-owner';
import type { ContactMasonry } from './device-contact-walls';
import { renderDeviceFace } from './device-face';
import type { ResolvedDevicePresentation } from './device-presentation';
import { deviceContactFloor } from './device-contact-floor';
import type { SpaceModel } from './types';
import { adoptDeviceContactStyles } from './device-contact.styles';

export interface DeviceContactFrame {
  key: string;
  enabled: boolean;
  markers: readonly Omit<ContactMarker, 'box'>[];
  walls?: readonly ContactWall[];
  masonry?: ContactMasonry;
  floor?: { config: unknown; model: SpaceModel };
}
interface MeasuredMarker { element: HTMLElement; ink: HTMLElement; key: string; metric: ContactRect }
const metricKey = (shell: Element | null | undefined): string => shell
  ? JSON.stringify([shell.className, ...[...shell.querySelectorAll('.valtext,.value-badge')]
    .map((node) => [node.textContent, node.getAttribute('style')])]) : '';

export class DeviceContactRenderer {
  private readonly hitShapes = new WeakMap<HTMLElement, {
    bounds: ContactRect; contains: (x: number, y: number) => boolean;
  }>();
  public readonly hit = (marker: HTMLElement, candidate: DeviceHitCandidate, width: number, height: number): void => {
    const contact = this.hitShapes.get(marker); if (!contact) return;
    const { x, y } = candidate.center;
    candidate.painted = { left: x + contact.bounds.left*width, right: x + contact.bounds.right*width,
      top: y + contact.bounds.top*height, bottom: y + contact.bounds.bottom*height };
    candidate.contains = (p) => contact.contains((p.x-x)/width,(p.y-y)/height);
  };
  public scene: DeviceContactScene | null = null;
  public readonly work = { measurements: 0, measurementBatches: 0, rebuilds: 0, paints: 0 };
  private readonly metrics = new Map<string, ContactRect>();
  private elements = new Map<string, MeasuredMarker>();
  private frameKey = '';
  private frame: DeviceContactFrame | null = null;

  /** Optimize supplies positive owner/face evidence for all floors, including
   * ones not currently mounted. Uses this same production face/metric cache. */
  public faceMetric(parent: HTMLElement, presentation: ResolvedDevicePresentation): ContactRect | undefined {
    const sample = document.createElement('div'); sample.className = 'dev';
    render(renderDeviceFace(presentation, { surface: 'preview' }), sample);
    const key = metricKey(sample.querySelector('.device-shell'));
    const cached = this.metrics.get(key);
    if (cached) { render(nothing, sample); return cached; }
    parent.append(sample);
    const metric = this.measure(new Map([[key, sample]])).get(key);
    render(nothing, sample); sample.remove();
    return metric;
  }

  public clear(): void {
    for (const { element, ink } of this.elements.values()) {
      element.removeAttribute('data-hp-device-contact');
      element.removeAttribute('data-hp-device-component');
      this.hitShapes.delete(element); render(nothing, ink);
    }
    this.elements.clear(); this.frameKey = ''; this.frame = null; this.scene = null;
  }

  public sync(root: ParentNode, frame: DeviceContactFrame): boolean {
    if (!frame.enabled) { const active = !!this.scene; if (active) this.clear(); return active; }
    adoptDeviceContactStyles(root);
    const floor = frame.floor ? deviceContactFloor(frame.floor.config, frame.floor.model) : null;
    if (floor && !floor.safe) { const active = !!this.scene; if (active) this.clear(); return active; }
    const nodes = new Map([...root.querySelectorAll<HTMLElement>('.devlayer > .dev[data-hp="device"][data-id]')]
      .map((node) => [node.dataset.id!, node]));
    const key = frame.key + '|' + frame.markers.map((m) => [m.id, m.x, m.y, m.diameter,
      metricKey(nodes.get(m.id)?.querySelector('.device-shell'))].join(':')).join('|');
    if (key === this.frameKey && frame.markers.every((m) => this.elements.get(m.id)?.element === nodes.get(m.id))) return false;
    const measured: ContactMarker[] = [];
    const nextElements = new Map<string, MeasuredMarker>();
    const pending = new Map<string, HTMLElement>();
    for (const m of frame.markers) {
      const element = nodes.get(m.id), shell = element?.querySelector('.device-shell');
      if (element && shell) {
        const faceKey = metricKey(shell);
        if (!this.metrics.has(faceKey)) pending.set(faceKey, element);
      }
    }
    const fresh = this.measure(pending);
    for (const m of frame.markers) {
      const element = nodes.get(m.id), shell = element?.querySelector<HTMLElement>('.device-shell');
      const ink = element?.querySelector<HTMLElement>('.device-contact-ink');
      if (!element || !shell || !ink || !(m.diameter > 0)) continue;
      const faceKey = metricKey(shell);
      const metric = fresh.get(faceKey) || this.metrics.get(faceKey);
      if (!metric) continue;
      const box = Object.fromEntries(Object.entries(metric).map(([k,v]) => [k, v * m.diameter])) as unknown as ContactRect;
      measured.push({ ...m, box }); nextElements.set(m.id, { element, ink, key: faceKey, metric });
    }
    const previous = this.scene;
    const sameGeometry = previous && this.frame?.key === frame.key && measured.length === previous.shapes.size
      && measured.every((m) => {
        const old = previous.shapes.get(m.id)?.marker;
        return old && old.x === m.x && old.y === m.y && old.diameter === m.diameter
          && (['left','right','top','bottom'] as const).every((side) => old.box[side] === m.box[side])
          && this.elements.get(m.id)?.element === nextElements.get(m.id)?.element;
      });
    // A new value can have the exact same fitted box. Refresh its metric key,
    // not the complete spatial graph; the shared face already paints the text.
    if (sameGeometry) { this.elements = nextElements; this.frameKey = key; this.frame = frame; return false; }
    this.clear(); this.elements = nextElements;
    this.frameKey = key; this.frame = frame;
    this.scene = new DeviceContactScene(measured, frame.walls || floor?.walls || [], frame.masonry || floor?.masonry);
    this.work.rebuilds++; this.paint(this.scene.shapes.keys());
    return true;
  }

  /** A fixed core probe makes the fitted face independent of viewport zoom/DPR.
   * It is the real face and its real inherited font/CSS, not a second renderer
   * or a glyph-count approximation. Cached per distinct visible face metric.
   */
  private measure(elements: ReadonlyMap<string, HTMLElement>): Map<string, ContactRect> {
    const result = new Map<string, ContactRect>();
    if (!elements.size) return result;
    // Write every probe before reading any rectangle: unique values must not
    // force a complete layout once per device on a cold floor/editor entry.
    const probes = [...elements].map(([key, element]) => {
      const probe = element.cloneNode(true) as HTMLElement;
      // Measure the future contact variant, including its designer badge fit.
      // A standalone marker keeps its old CSS face until a real edge exists.
      probe.setAttribute('data-hp-device-contact', ''); probe.removeAttribute('data-id');
      probe.removeAttribute('data-hp'); probe.setAttribute('aria-hidden', 'true'); probe.inert = true;
      probe.style.cssText = 'position:absolute;left:0;top:0;margin:0;width:800px;height:800px;--dev-size:800px;visibility:hidden;pointer-events:none';
      probe.querySelector('.device-contact-ink')?.replaceChildren();
      element.parentElement?.append(probe);
      return { key, probe };
    });
    for (const { key, probe } of probes) {
      const core = probe.getBoundingClientRect(), face = probe.querySelector('.device-shell-frame')?.getBoundingClientRect();
      if (face && core.width > 0) result.set(key, {
        left: (face.left - core.left - core.width / 2) / core.width,
        right: (face.right - core.left - core.width / 2) / core.width,
        top: (face.top - core.top - core.height / 2) / core.width,
        bottom: (face.bottom - core.top - core.height / 2) / core.width,
      });
    }
    for (const { probe } of probes) probe.remove();
    for (const [key, metric] of result) this.metrics.set(key, metric);
    while (this.metrics.size > 256) this.metrics.delete(this.metrics.keys().next().value!);
    this.work.measurements += probes.length; this.work.measurementBatches++;
    return result;
  }

  public move(id: string, x: number, y: number): void {
    if (!this.scene) return;
    this.paint(this.scene.move(id, x, y));
    // A subsequent ordinary render recognises this live position without
    // retaining a stale preview key or measuring/reindexing every other face.
    if (this.frame) this.frameKey = '';
  }

  private paint(ids: Iterable<string>): void {
    const scene = this.scene!;
    for (const group of scene.components(ids)) {
      const joined = group.length > 1;
      const owner = group[0];
      const active = joined || Object.keys(owner.walls).length > 0;
      const outline = active ? contactOutline(group) : '';
      for (const s of group) {
        const item = this.elements.get(s.marker.id); if (!item) continue;
        const custom = joined || Object.keys(s.walls).length > 0;
        item.element.toggleAttribute('data-hp-device-contact', custom);
        if (joined) item.element.dataset.hpDeviceComponent = owner.marker.id;
        else item.element.removeAttribute('data-hp-device-component');
        if (!custom) { this.hitShapes.delete(item.element); render(nothing, item.ink); continue; }
        const sides: ContactShape['walls'] = { ...s.walls };
        for (const id of scene.edges.get(s.marker.id) || []) {
          const side = joinedContactSide(s, scene.shapes.get(id)!); if (side) sides[side] = 'device';
        }
        const own = { ...s, walls: sides };
        const normalized: ContactShape = { ...own, marker: { ...s.marker, x: 0, y: 0, diameter: 1 },
          box: { left: s.box.left / s.marker.diameter, right: s.box.right / s.marker.diameter,
            top: s.box.top / s.marker.diameter, bottom: s.box.bottom / s.marker.diameter }, radius: s.radius / s.marker.diameter };
        this.hitShapes.set(item.element, { bounds: contactBounds(normalized),
          contains: (x, y) => contactContains(normalized, [x,y]) });
        const d = s.marker.diameter;
        render(svg`<svg viewBox=${`${s.marker.x - d / 2} ${s.marker.y - d / 2} ${d} ${d}`}
          preserveAspectRatio="none" aria-hidden="true">
          ${s === owner ? svg`<path class=${joined ? 'device-contact-contour grouped' : 'device-contact-contour'} d=${outline}></path>` : nothing}
          <path class="device-contact-hit" d=${contactOutline([own])}></path>
        </svg>`, item.ink);
        this.work.paints++;
      }
    }
  }
}
