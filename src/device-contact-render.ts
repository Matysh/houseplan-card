/** Shared Flat DOM adapter. Face geometry is measured only on metric invalidation. */
import { nothing, render, svg } from 'lit';
import {
  contactContains, contactContourShapes, contactOutline, joinedContactSide,
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
import { contactBasisMarker } from './device-contact-basis';
import { DeviceContactLayout } from './device-contact-layout';
import { screenContactMarker, screenContactScene } from './device-contact-screen';
import type { PlanRotation } from './view-frame';

export interface DeviceContactFrame {
  key: string;
  enabled: boolean;
  markers: readonly Omit<ContactMarker, 'box'>[];
  walls?: readonly ContactWall[];
  masonry?: ContactMasonry;
  floor?: { config: unknown; model: SpaceModel };
  space?: string;
  layout?: Readonly<Record<string,{x:number;y:number;s?:string;contact_basis?:unknown}|undefined>>;
  invalidate?: () => void;
  rotation?: PlanRotation;
}
interface MeasuredMarker { element: HTMLElement; ink: HTMLElement }
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
  public reflowed = false;
  public readonly work = { measurements: 0, measurementBatches: 0, rebuilds: 0, paints: 0 };
  private readonly metrics = new Map<string, ContactRect>();
  private elements = new Map<string, MeasuredMarker>();
  private frameKey = '';
  private floorKey = '';
  private readonly layout = new DeviceContactLayout();
  private authored = new Map<string,ContactMarker>();
  private fontContext = '';
  private rotation: PlanRotation = 0;
  private screen: { source: DeviceContactScene; rotation: PlanRotation; scene: DeviceContactScene } | null = null;
  private fontDocument: Document | null = null;
  private invalidate: (() => void) | undefined;
  private readonly fontsChanged = (): void => {
    this.metrics.clear(); this.frameKey=''; this.invalidate?.();
  };

  /** Never return a previous snapshot's effective point for a newly authored drag. */
  public position(id:string, point:{x:number;y:number}):{x:number;y:number} {
    const source=this.authored.get(id), shape=this.scene?.shapes.get(id);
    return source && shape && source.x===point.x && source.y===point.y
      ? {x:shape.marker.x,y:shape.marker.y} : point;
  }
  public reference(id:string):ContactMarker|undefined { return this.layout.reference(id); }

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
    this.reflowed=false;
    this.retireElements(); this.layout.clear(); this.authored.clear();
    this.fontDocument?.fonts?.removeEventListener('loadingdone',this.fontsChanged);
    this.fontDocument=null;this.invalidate=undefined;
  }
  private retireElements():void {
    for (const { element, ink } of this.elements.values()) {
      element.removeAttribute('data-hp-device-contact');
      element.removeAttribute('data-hp-device-component');
      this.hitShapes.delete(element); render(nothing, ink);
    }
    this.elements.clear(); this.frameKey = ''; this.floorKey = ''; this.scene = null;
    this.screen = null;
  }

  public sync(root: ParentNode, frame: DeviceContactFrame): boolean {
    if (!frame.enabled) { const active = !!this.scene; if (active) this.clear(); return active; }
    const turned = this.rotation !== (frame.rotation ?? 0);
    this.rotation = frame.rotation ?? 0;
    adoptDeviceContactStyles(root);
    this.invalidate=frame.invalidate;
    const doc=(root as ShadowRoot).ownerDocument;
    if(doc!==this.fontDocument) {
      this.fontDocument?.fonts?.removeEventListener('loadingdone',this.fontsChanged);
      this.fontDocument=doc;
      doc?.fonts?.addEventListener('loadingdone',this.fontsChanged);
    }
    const host=(root as ShadowRoot).host;
    const font=host?doc.defaultView?.getComputedStyle(host):null;
    const context=font?[font.fontFamily,font.fontWeight,font.fontStyle,font.fontStretch,font.letterSpacing].join('|'):'';
    if(context!==this.fontContext){this.metrics.clear();this.fontContext=context;this.frameKey='';}
    const floor = frame.floor ? deviceContactFloor(frame.floor.config, frame.floor.model) : null;
    if (floor && !floor.safe) { const active = !!this.scene; if (active) this.clear(); return active; }
    const nodes = new Map([...root.querySelectorAll<HTMLElement>('.devlayer > .dev[data-hp="device"][data-id]')]
      .map((node) => [node.dataset.id!, node]));
    const key = frame.key + '|' + frame.markers.map((m) => [m.id, m.x, m.y, m.diameter,
      m.virtual,JSON.stringify(frame.layout?.[m.id]?.contact_basis),
      metricKey(nodes.get(m.id)?.querySelector('.device-shell'))].join(':')).join('|');
    if (key === this.frameKey && frame.markers.every((m) => this.elements.get(m.id)?.element === nodes.get(m.id))) {
      if (turned && this.scene) this.paint(this.scene.shapes.keys());
      return turned;
    }
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
      measured.push({ ...m, box }); nextElements.set(m.id, { element, ink });
    }
    const bases=new Map<string,ContactMarker>();
    for(const m of measured) {
      const basis=frame.space ? contactBasisMarker(m,frame.layout?.[m.id],frame.space) : null;
      if(basis){bases.set(m.id,basis);m.precise=basis.precise;}
    }
    this.authored=new Map(measured.map(m=>[m.id,m]));
    const walls=frame.walls || floor?.walls || [],masonry=frame.masonry || floor?.masonry || [];
    const effective=this.layout.resolve(measured,walls,masonry,bases,frame.key);
    this.reflowed=effective.some((m,i)=>m.x!==measured[i].x||m.y!==measured[i].y);
    const previous = this.scene;
    const sameGeometry = previous && this.floorKey === frame.key && measured.length === previous.shapes.size
      && effective.every((m) => {
        const old = previous.shapes.get(m.id)?.marker;
        return old && old.x === m.x && old.y === m.y && old.diameter === m.diameter && old.virtual===m.virtual && old.precise===m.precise
          && (['left','right','top','bottom'] as const).every((side) => old.box[side] === m.box[side])
          && this.elements.get(m.id)?.element === nextElements.get(m.id)?.element;
      });
    // A new value can have the exact same fitted box. Refresh its metric key,
    // not the complete spatial graph; the shared face already paints the text.
    if (sameGeometry) {
      this.elements = nextElements; this.frameKey = key;
      if (turned) this.paint(previous.shapes.keys());
      return turned;
    }
    const reusable=previous && this.floorKey===frame.key && effective.length===previous.shapes.size
      && effective.every(m=>previous.shapes.has(m.id)&&this.elements.get(m.id)?.element===nextElements.get(m.id)?.element);
    if(reusable) {
      const affected=new Set<string>();
      for(const m of effective){const old=previous.shapes.get(m.id)!.marker;
        if(old.x!==m.x||old.y!==m.y||old.diameter!==m.diameter||old.virtual!==m.virtual||old.precise!==m.precise
          || ['left','right','top','bottom'].some(side=>old.box[side as keyof ContactRect]!==m.box[side as keyof ContactRect]))
          for(const id of previous.replace(m))affected.add(id);
      }
      this.elements=nextElements;this.frameKey=key;this.paint(turned ? previous.shapes.keys() : affected);return true;
    }
    this.retireElements(); this.elements = nextElements;
    this.frameKey = key; this.floorKey = frame.key;
    this.scene = new DeviceContactScene(effective, walls, masonry, true);
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
    this.frameKey = '';
  }

  private paint(ids: Iterable<string>): void {
    const source = this.scene!, affected = new Set(ids);
    if (this.screen?.source !== source || this.screen.rotation !== this.rotation) {
      this.screen = { source, rotation: this.rotation, scene: screenContactScene(source, this.rotation) };
    } else if (this.rotation) {
      // A live move refreshes just its old/new component in the screen index.
      // Never rebuild the full contact graph on every pointer event.
      for (const id of [...affected]) {
        const marker = source.shapes.get(id)?.marker;
        if (!marker) continue;
        const next = screenContactMarker(marker, this.rotation), old = this.screen.scene.shapes.get(id)?.marker;
        if (!old || next.x !== old.x || next.y !== old.y || next.diameter !== old.diameter
            || next.virtual !== old.virtual || next.precise !== old.precise
            || (['left','right','top','bottom'] as const).some(side => next.box[side] !== old.box[side])) {
          for (const changed of this.screen.scene.replace(next)) affected.add(changed);
        }
      }
    }
    const scene = this.screen.scene;
    for (const rawGroup of scene.components(affected)) {
      const group=contactContourShapes(rawGroup);
      const joined = group.length > 1;
      const owner = group[0];
      const active = joined || Object.keys(owner.walls).length > 0;
      const outline = active ? contactOutline(group,true) : '';
      const virtual=group.every(s=>s.marker.virtual===true);
      for (const s of group) {
        const item = this.elements.get(s.marker.id); if (!item) continue;
        const custom = joined || Object.keys(s.walls).length > 0;
        item.element.toggleAttribute('data-hp-device-contact', custom);
        if (joined) item.element.dataset.hpDeviceComponent = owner.marker.id;
        else item.element.removeAttribute('data-hp-device-component');
        if (!custom) { this.hitShapes.delete(item.element); render(nothing, item.ink); continue; }
        const sides: ContactShape['walls'] = { ...s.walls };
        for (const id of scene.edges.get(s.marker.id) || []) {
          const side = joinedContactSide(scene.shapes.get(s.marker.id)!, scene.shapes.get(id)!,false); if (side) sides[side] = 'device';
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
          ${s === owner ? svg`<path data-hp="device-contact-contour" data-component=${owner.marker.id} data-grouped=${String(joined)} class=${joined ? 'device-contact-contour grouped' : 'device-contact-contour'} stroke-dasharray=${virtual?'4 3':'none'} d=${outline}></path>` : nothing}
          <path class="device-contact-hit" d=${contactOutline([own])}></path>
        </svg>`, item.ink);
        this.work.paints++;
      }
    }
  }
}
