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
import { screenContactMarker, screenContactScene, projectedContactHit } from './device-contact-screen';
import type { PlanRotation } from './view-frame';
import { isoMarkerGlass, isoMarkerGlassAnchor, type IsoMarkerGlassProjection } from './iso-marker-outline';
import { renderIsoMarkerGlass } from './iso-marker-glass';
import { isoReadingYaw } from './iso-projection';
import { isoDeviceFaceBounds, orientIsoDeviceFace } from './iso-device-face';
import type { IsoDeviceFace, IsoDeviceWallMask } from './iso-overlays';

export interface DeviceContactFrame {
  key: string;
  enabled: boolean;
  markers: readonly (Omit<ContactMarker, 'box'> & { legacyDiameters?: readonly [number, number] })[];
  walls?: readonly ContactWall[];
  masonry?: ContactMasonry;
  floor?: { config: unknown; model: SpaceModel };
  space?: string;
  layout?: Readonly<Record<string,{x:number;y:number;s?:string;contact_basis?:unknown}|undefined>>;
  invalidate?: () => void;
  rotation?: PlanRotation;
  uprightHalfTurn?: boolean;
  /** A floor-aligned presentation; contact layout stays in canonical plan units. */
  plane?: readonly number[];
  glassProjection?: IsoMarkerGlassProjection;
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
    if (this.plane) { projectedContactHit(candidate,contact,width,height,this.plane); return; }
    const { x, y } = candidate.center;
    candidate.painted = { left: x + contact.bounds.left*width, right: x + contact.bounds.right*width,
      top: y + contact.bounds.top*height, bottom: y + contact.bounds.bottom*height };
    candidate.contains = (p) => contact.contains((p.x-x)/width,(p.y-y)/height);
  };
  public scene: DeviceContactScene | null = null;
  public reflowed = false;
  public appearanceChanged = false;
  public resizeStatus: 'limited' | 'baseline-lost' | null = null;
  public readonly work = { measurements: 0, measurementBatches: 0, rebuilds: 0, paints: 0 };
  private readonly metrics = new Map<string, ContactRect>();
  private readonly faces = new Map<string, readonly IsoDeviceFace[]>();
  private elements = new Map<string, MeasuredMarker>();
  private frameKey = '';
  private floorKey = '';
  private readonly layout = new DeviceContactLayout();
  private authored = new Map<string,ContactMarker>();
  private fontContext = '';
  private rotation: PlanRotation = 0;
  private uprightHalfTurn = false;
  private plane: readonly number[] | undefined;
  private glassProjection: IsoMarkerGlassProjection | undefined;
  private screen: { source: DeviceContactScene; rotation: PlanRotation; uprightHalfTurn: boolean; scene: DeviceContactScene } | null = null;
  private fontDocument: Document | null = null;
  private invalidate: (() => void) | undefined;
  private readonly fontsChanged = (): void => {
    this.metrics.clear(); this.faces.clear(); this.frameKey=''; this.invalidate?.();
  };

  /** Never return a previous snapshot's effective point for a newly authored drag. */
  public position(id:string, point:{x:number;y:number}):{x:number;y:number} {
    const source=this.authored.get(id), shape=this.scene?.shapes.get(id);
    return source && shape && source.x===point.x && source.y===point.y
      ? {x:shape.marker.x,y:shape.marker.y} : point;
  }
  public diameter(id: string, point: { x: number; y: number }): number | undefined {
    const authored = this.authored.get(id);
    return authored?.x === point.x && authored.y === point.y
      ? this.scene?.shapes.get(id)?.marker.diameter : undefined;
  }
  public reference(id:string):ContactMarker|undefined { return this.layout.reference(id); }
  public referenceMembers(id: string): string[] { return this.layout.referenceMembers(id); }

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
    this.plane = undefined;
    this.glassProjection = undefined;
    this.preparedFont = null;
    this.observeStacking(null);
    this.reflowed=false;
    this.resizeStatus=null;
    this.appearanceChanged=false;
    this.retireElements(); this.layout.clear(); this.authored.clear();
    this.fontDocument?.fonts?.removeEventListener('loadingdone',this.fontsChanged);
    this.fontDocument=null;this.invalidate=undefined;
  }
  private retireElements():void {
    for (const { element, ink } of this.elements.values()) {
      element.removeAttribute('data-hp-device-contact');
      element.removeAttribute('data-hp-device-component');
      element.removeAttribute('data-hp-iso-body-outline');
      const shell=element.querySelector<HTMLElement>('.device-shell');
      shell?.style.removeProperty('--hp-value-shift-x');
      shell?.style.removeProperty('--hp-value-shift-y');
      this.presentations.delete(element);
      this.hitShapes.delete(element); render(nothing, ink);
    }
    this.elements.clear(); this.frameKey = ''; this.floorKey = ''; this.scene = null;
    this.screen = null;
  }

  private preparedFont: { root: ParentNode; value: string } | null = null;
  private fontKey(root: ParentNode): string {
    const shadow = root as ShadowRoot, host = shadow.host;
    const font = host ? shadow.ownerDocument.defaultView?.getComputedStyle(host) : null;
    return font ? [font.fontFamily, font.fontWeight, font.fontStyle, font.fontStretch, font.letterSpacing].join('|') : '';
  }
  /** Read in the retained endpoint's measure batch, before terminal DOM writes. */
  public prepare(root: ParentNode): void { this.preparedFont = { root, value: this.fontKey(root) }; }
  public sync(root: ParentNode, frame: DeviceContactFrame): boolean {
    this.appearanceChanged = false;
    if (!frame.enabled) { const active = !!this.scene; if (active) this.clear(); return active; }
    const uprightHalfTurn = frame.uprightHalfTurn ?? false;
    const turned = this.rotation !== (frame.rotation ?? 0) || this.uprightHalfTurn !== uprightHalfTurn
      || String(this.plane) !== String(frame.plane)
      || this.glassProjection?.camera !== frame.glassProjection?.camera
      || this.glassProjection?.height !== frame.glassProjection?.height;
    this.rotation = frame.rotation ?? 0;
    this.uprightHalfTurn = uprightHalfTurn;
    this.plane = frame.plane;
    this.glassProjection = frame.glassProjection;
    this.observeStacking(this.plane && 'host' in root ? root as ShadowRoot : null);
    adoptDeviceContactStyles(root);
    this.invalidate=frame.invalidate;
    const doc=(root as ShadowRoot).ownerDocument;
    if(doc!==this.fontDocument) {
      this.fontDocument?.fonts?.removeEventListener('loadingdone',this.fontsChanged);
      this.fontDocument=doc;
      doc?.fonts?.addEventListener('loadingdone',this.fontsChanged);
    }
    const context = this.preparedFont?.root === root ? this.preparedFont.value : this.fontKey(root);
    this.preparedFont = null;
    if(context!==this.fontContext){this.metrics.clear();this.faces.clear();this.fontContext=context;this.frameKey='';}
    const floor = frame.floor ? deviceContactFloor(frame.floor.config, frame.floor.model) : null;
    if (floor && !floor.safe) { const active = !!this.scene; if (active) this.clear(); return active; }
    const nodes = new Map([...root.querySelectorAll<HTMLElement>('.devlayer > .dev[data-hp="device"][data-id]')]
      .map((node) => [node.dataset.id!, node]));
    const key = frame.key + '|' + uprightHalfTurn + '|' + frame.markers.map((m) => [m.id, m.x, m.y, m.diameter,
      m.virtual,m.legacyDiameters?.join(','),JSON.stringify(frame.layout?.[m.id]?.contact_basis),
      metricKey(nodes.get(m.id)?.querySelector('.device-shell'))].join(':')).join('|');
    const changedMasks = this.changedWallMasks(nodes);
    if (key === this.frameKey && frame.markers.every((m) => this.elements.get(m.id)?.element === nodes.get(m.id))) {
      if (this.scene && (turned || changedMasks.size))
        this.paint(turned ? this.scene.shapes.keys() : changedMasks);
      this.paintWallMasks(nodes);
      return turned || changedMasks.size > 0;
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
    if (this.plane) for (const [id,node] of nodes) {
      const painted = this.presentations.get(node);
      const shell = node.querySelector('.device-shell');
      if (painted && (painted.shell !== shell || painted.metrics !== this.faces.get(metricKey(shell))))
        changedMasks.add(id);
    }
    for (const m of frame.markers) {
      const element = nodes.get(m.id), shell = element?.querySelector<HTMLElement>('.device-shell');
      const ink = element?.querySelector<HTMLElement>('.device-contact-ink');
      if (!element || !shell || !ink || !(m.diameter > 0)) continue;
      const faceKey = metricKey(shell);
      const metric = fresh.get(faceKey) || this.metrics.get(faceKey);
      if (!metric) continue;
      const box = Object.fromEntries(Object.entries(metric).map(([k,v]) => [k, v * m.diameter])) as unknown as ContactRect;
      const { legacyDiameters, ...marker } = m;
      measured.push({ ...marker, box });
      nextElements.set(m.id, { element, ink });
    }
    const bases=new Map<string,ContactMarker>();
    for(const m of measured) {
      const basis=frame.space ? contactBasisMarker(m,frame.layout?.[m.id],frame.space) : null;
      if(basis){bases.set(m.id,basis);m.precise=basis.precise;}
    }
    this.authored=new Map(measured.map(m=>[m.id,m]));
    const walls=frame.walls || floor?.walls || [],masonry=frame.masonry || floor?.masonry || [];
    const legacy = new Map(frame.markers.flatMap(m => m.legacyDiameters ? [[m.id, m.legacyDiameters]] : []));
    const effective=this.layout.resolve(measured,walls,masonry,bases,frame.key,legacy.size ? legacy : undefined, uprightHalfTurn);
    this.reflowed=effective.some((m,i)=>m.x!==measured[i].x||m.y!==measured[i].y||m.diameter!==measured[i].diameter);
    const previous = this.scene;
    const nextStatus = this.layout.resizeBaselineLost ? 'baseline-lost' : this.layout.resizeLimited ? 'limited' : null;
    this.appearanceChanged = nextStatus !== this.resizeStatus || !!previous && effective.some(marker => {
      const old = previous.shapes.get(marker.id)?.marker;
      return old && old.diameter !== marker.diameter;
    });
    this.resizeStatus = nextStatus;
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
      if (turned || changedMasks.size) this.paint(turned ? previous.shapes.keys() : changedMasks);
      this.paintWallMasks(nodes);
      return turned || changedMasks.size > 0 || this.appearanceChanged;
    }
    const reusable=previous && this.floorKey===frame.key && effective.length===previous.shapes.size
      && effective.every(m=>previous.shapes.has(m.id)&&this.elements.get(m.id)?.element===nextElements.get(m.id)?.element);
    if(reusable) {
      const affected=changedMasks;
      for(const m of effective){const old=previous.shapes.get(m.id)!.marker;
        if(old.x!==m.x||old.y!==m.y||old.diameter!==m.diameter||old.virtual!==m.virtual||old.precise!==m.precise
          || ['left','right','top','bottom'].some(side=>old.box[side as keyof ContactRect]!==m.box[side as keyof ContactRect]))
          for(const id of previous.replace(m))affected.add(id);
      }
      this.elements=nextElements;this.frameKey=key;
      this.paint(turned ? previous.shapes.keys() : affected);
      this.paintWallMasks(nodes);
      return true;
    }
    this.retireElements(); this.elements = nextElements;
    this.frameKey = key; this.floorKey = frame.key;
    this.scene = new DeviceContactScene(effective, walls, masonry, true);
    this.work.rebuilds++; this.paint(this.scene.shapes.keys());
    this.paintWallMasks(nodes);
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
      probe.style.cssText = 'position:absolute;left:0;top:0;margin:0;width:800px;height:800px;--dev-size:800px;transform:none;visibility:hidden;pointer-events:none';
      probe.style.setProperty('--hp-iso-content-turn','0deg');
      probe.style.setProperty('--hp-value-shift-x','0');
      probe.style.setProperty('--hp-value-shift-y','0');
      const shell=probe.querySelector<HTMLElement>('.device-shell');
      shell?.style.removeProperty('--hp-value-shift-x');
      shell?.style.removeProperty('--hp-value-shift-y');
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
      if(core.width>0)this.faces.set(key,[...probe.querySelectorAll<HTMLElement>('.device-core,.value-badge')].map(node=>{
        const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
        const radius=style.borderTopLeftRadius.split(' ');
        const radiusX=radius[0],radiusY=radius[1]||radiusX;
        const rx=Math.min(rect.width/2,radiusX.endsWith('%')?parseFloat(radiusX)*rect.width/100:parseFloat(radiusX));
        const ry=Math.min(rect.height/2,radiusY.endsWith('%')?parseFloat(radiusY)*rect.height/100:parseFloat(radiusY));
        return {left:(rect.left-core.left-core.width/2)/core.width,right:(rect.right-core.left-core.width/2)/core.width,
          top:(rect.top-core.top-core.height/2)/core.width,bottom:(rect.bottom-core.top-core.height/2)/core.width,
          rx:rx/core.width,ry:ry/core.width};
      }));
    }
    for (const { probe } of probes) probe.remove();
    for (const [key, metric] of result) this.metrics.set(key, metric);
    while (this.metrics.size > 256) {
      const key=this.metrics.keys().next().value!;this.metrics.delete(key);this.faces.delete(key);
    }
    this.work.measurements += probes.length; this.work.measurementBatches++;
    return result;
  }

  private readonly presentations = new WeakMap<HTMLElement, {
    shell: HTMLElement;
    source: ContactShape;
    metrics: readonly IsoDeviceFace[];
    turn: number;
    joined: boolean;
    valueCore: boolean;
    presentation: ReturnType<typeof orientIsoDeviceFace>;
  }>();

  private get contentTurn(): number {
    const yaw = this.glassProjection?.camera.rotDeg ?? 0;
    return (isoReadingYaw(yaw) - yaw) * Math.PI / 180;
  }

  private present(shape: ContactShape, joined: boolean): ContactShape {
    const node = this.elements.get(shape.marker.id)?.element;
    const shell = node?.querySelector<HTMLElement>('.device-shell');
    if (!node || !shell) return shape;
    const metrics = this.faces.get(metricKey(shell));
    if (!metrics?.length) return shape;
    const turn = this.contentTurn, valueCore = node.classList.contains('valonly');
    const existing = this.presentations.get(node);
    if (existing?.shell === shell && existing.source === shape && existing.metrics === metrics
        && existing.turn === turn && existing.joined === joined && existing.valueCore === valueCore)
      return existing.presentation.shape;
    const presentation = orientIsoDeviceFace(shape, metrics, turn, valueCore, joined);
    this.presentations.set(node, { shell, source: shape, metrics, turn, joined, valueCore, presentation });
    const [x, y] = presentation.shift;
    shell.style.setProperty('--hp-value-shift-x', String(x));
    shell.style.setProperty('--hp-value-shift-y', String(y));
    return presentation.shape;
  }

  private readonly wallPaint = new WeakMap<SVGSVGElement, [IsoDeviceWallMask, readonly IsoDeviceFace[]]>();
  private readonly glassWall = new WeakMap<HTMLElement, IsoDeviceWallMask>();

  private changedWallMasks(nodes: ReadonlyMap<string, HTMLElement>): Set<string> {
    const changed = new Set<string>();
    if (!this.plane) return changed;
    for (const [id, node] of nodes) {
      const mask = (node as HTMLElement & { hpIsoWallMask?: IsoDeviceWallMask }).hpIsoWallMask;
      if (this.glassWall.get(node) !== mask) {
        changed.add(id);
        if (mask) this.glassWall.set(node, mask);
        else this.glassWall.delete(node);
      }
    }
    return changed;
  }

  private paintWallMasks(nodes: ReadonlyMap<string, HTMLElement>): void {
    if (!this.plane) return;
    const turn = this.contentTurn;
    for (const [id,node] of nodes) {
      const mask = (node as HTMLElement & { hpIsoWallMask?: IsoDeviceWallMask }).hpIsoWallMask;
      const slot = node.querySelector<SVGSVGElement>('[data-hp-wall-mask-slot]');
      const shell = node.querySelector('.device-shell');
      const geometry = this.presentations.get(node);
      const faces = geometry && geometry.shell === shell && geometry.turn === turn
        ? geometry.presentation.faces : this.faces.get(metricKey(shell));
      if (!mask || !slot || !faces?.length) {
        node.removeAttribute('data-hp-device-occlusion');
        if (slot && this.wallPaint.delete(slot)) render(nothing,slot);
        continue;
      }
      const previous = this.wallPaint.get(slot);
      if (previous?.[0] === mask && previous[1] === faces) continue;
      this.wallPaint.set(slot, [mask, faces]);
      const { occluded, cut } = mask.bodyMask(faces);
      node.toggleAttribute('data-hp-device-occlusion', !!(occluded || cut));
      if (!occluded && !cut) { render(nothing, slot); continue; }
      // The white mask background must include status satellites outside the
      // measured face, including simultaneous attention and maintenance.
      // Coordinates are in units of the measured core.
      const bounds = isoDeviceFaceBounds(faces);
      const x = Math.min(-2, bounds.left), y = Math.min(-2, bounds.top);
      const width = Math.max(3, bounds.right + 1) - x, height = Math.max(3, bounds.bottom + 1) - y;
      render(svg`<defs><mask id=${'hp-device-wall-' + encodeURIComponent(id)}
        maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox"
        x=${x} y=${y} width=${width} height=${height} style="mask-type:luminance">
        <rect x=${x} y=${y} width=${width} height=${height} fill="white"></rect>
        ${occluded ? svg`<path d=${occluded} transform=${mask.transform} fill="#4d4d4d"></path>` : nothing}
        ${cut ? svg`<path d=${cut} transform=${mask.transform} fill="black"></path>` : nothing}
      </mask></defs>`, slot);
    }
  }

  public move(id: string, x: number, y: number): void {
    if (!this.scene) return;
    this.paint(this.scene.move(id, x, y));
    // A subsequent ordinary render recognises this live position without
    // retaining a stale preview key or measuring/reindexing every other face.
    this.frameKey = '';
  }

  private stackRoot: ShadowRoot | null = null;
  private stackObserver?: MutationObserver;
  private readonly dirtyStack = new Set<string>();
  private stackPending = false;

  private noteStackChange(target: EventTarget | null): void {
    if (!(target instanceof Element)) return;
    const id = target.closest<HTMLElement>('.dev[data-hp-device-component]')?.dataset.id;
    if (!id || !this.elements.has(id)) return;
    this.dirtyStack.add(id);
    if (this.stackPending) return;
    this.stackPending = true;
    queueMicrotask(() => {
      this.stackPending = false;
      // The projection can be retired while a focus/hover update is queued.
      if (this.plane && this.scene && this.dirtyStack.size) this.paint(this.dirtyStack, true);
      this.dirtyStack.clear();
    });
  }

  private readonly onStackFocus = (event: Event) => this.noteStackChange(event.target);

  private observeStacking(root: ShadowRoot | null): void {
    if (root === this.stackRoot) return;
    this.stackRoot?.removeEventListener('focusin', this.onStackFocus);
    this.stackRoot?.removeEventListener('focusout', this.onStackFocus);
    this.stackObserver?.disconnect();
    this.stackRoot = root;
    this.dirtyStack.clear();
    if (!root) return;
    this.stackObserver ??= new MutationObserver(records => {
      for (const {target} of records) {
        if (target === this.stackRoot?.host) {
          for (const marker of this.stackRoot.querySelectorAll('.dev[data-hp-device-hover]'))
            this.noteStackChange(marker);
        } else this.noteStackChange(target);
      }
    });
    this.stackObserver.observe(root, {subtree: true, attributes: true,
      attributeFilter: ['data-hp-device-hover', 'data-hp-zigbee-topology-endpoint']});
    this.stackObserver.observe(root.host, {attributes: true, attributeFilter: ['data-pointer-hover']});
    root.addEventListener('focusin', this.onStackFocus);
    root.addEventListener('focusout', this.onStackFocus);
  }

  /** DOM depth order is sufficient until an interaction promotes a member. */
  private glassOwners(group: readonly ContactShape[]): [ContactShape, ContactShape] {
    const members = group.flatMap(shape => {
      const node = this.elements.get(shape.marker.id)?.element;
      if (!node) return [];
      const promoted = node.hasAttribute('data-hp-device-hover')
        || node.hasAttribute('data-hp-zigbee-topology-endpoint') || node.matches(':focus-visible');
      const z = promoted ? Number(getComputedStyle(node).zIndex) : 2;
      return [{shape, node, z}];
    });
    members.sort((a, b) => a.z - b.z
      || (a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    return [members[0]?.shape ?? group[0], members[members.length - 1]?.shape ?? group[0]];
  }

  private paint(ids: Iterable<string>, stackingOnly = false): void {
    const source = this.scene!, affected = new Set(ids);
    if (this.screen?.source !== source || this.screen.rotation !== this.rotation || this.screen.uprightHalfTurn !== this.uprightHalfTurn) {
      this.screen = { source, rotation: this.rotation, uprightHalfTurn: this.uprightHalfTurn,
        scene: screenContactScene(source, this.rotation, this.uprightHalfTurn) };
    } else if (this.rotation) {
      // A live move refreshes just its old/new component in the screen index.
      // Never rebuild the full contact graph on every pointer event.
      for (const id of [...affected]) {
        const marker = source.shapes.get(id)?.marker;
        if (!marker) continue;
        const next = screenContactMarker(marker, this.rotation, this.uprightHalfTurn), old = this.screen.scene.shapes.get(id)?.marker;
        if (!old || next.x !== old.x || next.y !== old.y || next.diameter !== old.diameter
            || next.virtual !== old.virtual || next.precise !== old.precise
            || (['left','right','top','bottom'] as const).some(side => next.box[side] !== old.box[side])) {
          for (const changed of this.screen.scene.replace(next)) affected.add(changed);
        }
      }
    }
    const scene = this.screen.scene;
    for (const rawGroup of scene.components(affected)) {
      // Build the projected envelope from live faces without changing the
      // authored contact graph or using the orientation in the reflow solver.
      const oriented = this.plane ? rawGroup.map(shape => this.present(shape, rawGroup.length > 1)) : rawGroup;
      const group = contactContourShapes(oriented);
      const joined = group.length > 1;
      // Split the single group shell across the farthest and nearest member's
      // stacking contexts. Neither half is repainted per device.
      const [owner, frontOwner] = this.plane ? this.glassOwners(group) : [group[0], group[0]];
      if (stackingOnly) {
        const hasHalf = (shape: ContactShape, side: 'rear' | 'front') =>
          !!this.elements.get(shape.marker.id)?.ink.querySelector(`.iso-marker-glass.${side}`);
        // Empty wall-owned halves have no ink to move.
        const oldRear = group.find(shape => hasHalf(shape, 'rear'));
        const oldFront = group.find(shape => hasHalf(shape, 'front'));
        if ((!oldRear || oldRear === owner) && (!oldFront || oldFront === frontOwner)) continue;
      }
      const active = joined || Object.keys(owner.walls).length > 0;
      const outline = active && !this.plane ? contactOutline(group,true) : '';
      const glass = this.plane ? isoMarkerGlass(group,this.plane,true,this.glassProjection) : null;
      const virtual=group.every(s=>s.marker.virtual===true);
      for (const s of group) {
        const item = this.elements.get(s.marker.id); if (!item) continue;
        const custom = joined || Object.keys(s.walls).length > 0;
        item.element.toggleAttribute('data-hp-device-contact', custom);
        item.element.toggleAttribute('data-hp-iso-body-outline',!!this.plane);
        if (joined) item.element.dataset.hpDeviceComponent = group[0].marker.id;
        else item.element.removeAttribute('data-hp-device-component');
        if (!custom && !this.plane) { this.hitShapes.delete(item.element); render(nothing, item.ink); continue; }
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
        const viewBox=`${s.marker.x - d / 2} ${s.marker.y - d / 2} ${d} ${d}`;
        const glassAnchor=isoMarkerGlassAnchor([s.marker.x,s.marker.y],this.glassProjection);
        const [glassX,glassY]=glassAnchor;
        const glassBox=`${glassX-d/2} ${glassY-d/2} ${d} ${d}`;
        // One shell per component. Repainting pieces in each member's
        // stacking context produced seams and multiplied translucent edges.
        const wallMask=(item.element as HTMLElement&{hpIsoWallMask?:IsoDeviceWallMask}).hpIsoWallMask;
        render(svg`${glass && (s===owner || s===frontOwner) ? renderIsoMarkerGlass(glass,glassBox,virtual,
          wallMask ? {id:`hp-glass-wall-${encodeURIComponent(s.marker.id)}`,mask:wallMask,
            origin:glassAnchor} : undefined,
          owner===frontOwner ? 'both' : s===owner ? 'back' : 'front') : nothing}
        <svg viewBox=${viewBox}
          preserveAspectRatio="none" aria-hidden="true">
          ${s === owner && !glass ? svg`<path data-hp="device-contact-contour" data-component=${owner.marker.id} data-grouped=${String(joined)} class=${joined ? 'device-contact-contour grouped' : 'device-contact-contour'} stroke-dasharray=${virtual?'4 3':'none'} d=${outline}></path>` : nothing}
          <path class="device-contact-hit" d=${contactOutline([own])}></path>
        </svg>`, item.ink);
        this.work.paints++;
      }
    }
  }
}
