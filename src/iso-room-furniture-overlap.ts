import { nothing } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { directive, type ElementPart } from 'lit/directive.js';
import type { FurnitureMesh } from './iso-lab-furniture';
import type { PlanPoint, ViewRect } from './iso-projection';
import { isoRoomLabelBounds } from './iso-room-label-bounds';

type Occluder = { mesh: FurnitureMesh; opacity: number };
const faces = new WeakMap<FurnitureMesh, Path2D[]>();
let probe: CanvasRenderingContext2D | null;
let nextMaskId = 0;

// The label and the inverse-projected furniture paths share floor coordinates.
// Rasterise only the visible text row so holes between legs stay open.
function coveringOpacity(items: readonly Occluder[], x: number, y: number, w: number, h: number) {
  if (!(w > 0 && h > 0)) return 0;
  let opacity = 0;
  for (const item of items) {
    const [left, top, width, height] = item.mesh.lightBox;
    if (item.opacity <= opacity || x+w < left || y+h < top || x > left+width || y > top+height) continue;
    if (!probe) {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 16;
      probe = canvas.getContext('2d', {willReadFrequently:true});
      if (!probe) return 0;
    }
    let paths = faces.get(item.mesh);
    if (!paths) {
      paths = item.mesh.parts.flatMap(part=>[new Path2D(part.side),new Path2D(part.top)]);
      faces.set(item.mesh,paths);
    }
    const pw = probe.canvas.width, ph = probe.canvas.height;
    probe.resetTransform();
    probe.clearRect(0,0,pw,ph);
    probe.setTransform(pw/w,0,0,ph/h,-x*pw/w,-y*ph/h);
    for (const path of paths) probe.fill(path);
    const pixels = probe.getImageData(0,0,pw,ph).data;
    for (let i=3; i<pixels.length; i+=4) {
      if (pixels[i]>64) { opacity = item.opacity; break; }
    }
  }
  return opacity;
}

class RoomFurnitureOverlap extends AsyncDirective {
  private plane?: HTMLElement;
  private anchor?: PlanPoint;
  private viewWidth = 0;
  private view?: ViewRect;
  private visual?: PlanPoint;
  private mask?: SVGMaskElement;
  private maskUse?: SVGUseElement;
  private items: readonly Occluder[] = [];
  private observer?: ResizeObserver;
  private frame = 0;
  private previousItems: readonly Occluder[] = [];
  private previousBounds = '';
  private observedRows = new Set<HTMLElement>();
  private observedLabel?: HTMLElement;
  private observedViewport?: HTMLElement;

  render(_anchor: PlanPoint | undefined, _width: number, _items: readonly Occluder[],
    _view?: ViewRect, _visual?: PlanPoint) { return nothing; }

  update(part: ElementPart, [anchor, width, items, view, visual]: Parameters<RoomFurnitureOverlap['render']>) {
    this.plane = part.element as HTMLElement;
    this.anchor = anchor;
    this.viewWidth = width;
    this.items = items;
    this.view = view;
    this.visual = visual;
    this.schedule();
    return nothing;
  }

  private schedule = () => {
    if (this.frame || !this.isConnected) return;
    this.frame = requestAnimationFrame(()=>{
      this.frame = 0;
      const plane = this.plane;
      if (!plane) return;
      this.observer ??= new ResizeObserver(this.schedule);
      const viewport = plane.parentElement;
      if (!viewport?.clientWidth) return;
      if (this.observedViewport !== viewport) {
        if (this.observedViewport) this.observer.unobserve(this.observedViewport);
        this.observer.observe(viewport); this.observedViewport = viewport;
      }
      const label = plane.querySelector<HTMLElement>('.roomlabel');
      // #1470: the paint plane is now bounded, not viewport-sized. Furniture
      // probes still use the original floor-units-per-camera-pixel contract.
      const unit = this.viewWidth / viewport.clientWidth;
      if (this.observedLabel !== label) {
        if (this.observedLabel) this.observer.unobserve(this.observedLabel);
        if (label) this.observer.observe(label);
        this.observedLabel = label ?? undefined;
      }
      if (label) {
        this.boundPaint(plane,label,viewport);
      }
      const bounds: [number,number,number,number][] = [];
      const rows = new Set(label?.querySelectorAll<HTMLElement>('.rlname,.rlmetrics'));
      for (const old of this.observedRows) if (!rows.has(old)) this.observer.unobserve(old);
      this.observedRows = rows;
      if (label && this.anchor) {
        const [cx,cy] = this.anchor;
        for (const row of rows) {
          this.observer.observe(row);
          const w = row.offsetWidth*unit, h = row.offsetHeight*unit;
          const top = cy+(row.offsetTop-label.offsetHeight/2)*unit;
          bounds.push([cx-w/2,top,w,h]);
        }
      }
      const signature = bounds.join('|');
      if (signature === this.previousBounds && this.items.length === this.previousItems.length &&
          this.items.every((item,i)=>item.mesh === this.previousItems[i].mesh && item.opacity === this.previousItems[i].opacity)) return;
      this.previousBounds = signature;
      this.previousItems = this.items;
      const covered = Math.max(0,...bounds.map(box=>coveringOpacity(this.items,...box)));
      plane.style.opacity = covered ? String(1-.7*covered) : '';
    });
  };

  private boundPaint(plane: HTMLElement, label: HTMLElement, viewport: HTMLElement) {
    if (!this.view || !this.visual) return;
    const style = getComputedStyle(label), transform = new DOMMatrixReadOnly(style.transform);
    const origin = style.transformOrigin.split(' ').map(Number.parseFloat);
    // Metrics are absolutely positioned below the name and may be wider than
    // it. They are ink too; label.offsetHeight alone excludes the entire row.
    const points = [[0,0],[label.offsetWidth,label.offsetHeight]];
    for (const row of label.querySelectorAll<HTMLElement>('.rlname,.rlmetrics')) {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(row).transform);
      const rowOrigin = getComputedStyle(row).transformOrigin.split(' ').map(Number.parseFloat);
      for (const [x,y] of [[0,0],[row.offsetWidth,0],[row.offsetWidth,row.offsetHeight],[0,row.offsetHeight]]) {
        points.push([row.offsetLeft+rowOrigin[0]+matrix.a*(x-rowOrigin[0])+matrix.c*(y-rowOrigin[1])+matrix.e,
          row.offsetTop+rowOrigin[1]+matrix.b*(x-rowOrigin[0])+matrix.d*(y-rowOrigin[1])+matrix.f]);
      }
    }
    const left = Math.min(...points.map(point=>point[0])), top = Math.min(...points.map(point=>point[1]));
    const content: [number,number,number,number] = [left,top,
      Math.max(...points.map(point=>point[0]))-left,Math.max(...points.map(point=>point[1]))-top];
    const box = isoRoomLabelBounds(this.visual,this.view,[viewport.clientWidth,viewport.clientHeight],
      [label.offsetWidth,label.offsetHeight],[transform.a,transform.b,transform.c,transform.d,transform.e,transform.f],
      [origin[0],origin[1]],content);
    if (!box) return;
    if (!this.mask) {
      const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns,'svg');
      svg.setAttribute('width','0'); svg.setAttribute('height','0'); svg.setAttribute('aria-hidden','true');
      svg.style.position = 'absolute'; svg.style.pointerEvents = 'none';
      const mask = document.createElementNS(ns,'mask');
      mask.id = `hp-room-label-wall-mask-${++nextMaskId}`;
      for (const [name,value] of Object.entries({maskUnits:'objectBoundingBox',maskContentUnits:'objectBoundingBox',x:'0',y:'0',width:'1',height:'1'})) mask.setAttribute(name,value);
      mask.style.maskType = 'luminance';
      const rect = document.createElementNS(ns,'rect');
      rect.setAttribute('width','1'); rect.setAttribute('height','1'); rect.setAttribute('fill','white');
      const use = document.createElementNS(ns,'use');
      use.setAttribute('href','#hp-room-wall-silhouette'); use.setAttribute('fill','#4d4d4d');
      mask.append(rect,use); svg.append(mask); plane.append(svg);
      this.mask = mask; this.maskUse = use;
      plane.style.setProperty('--hp-room-wall-mask',`url(#${mask.id})`);
    }
    const rect = box.scene;
    this.maskUse!.setAttribute('transform',`scale(${1/rect.w} ${1/rect.h}) translate(${-rect.x} ${-rect.y})`);
    plane.style.inset = 'auto';
    for (const name of ['left','top','width','height'] as const) plane.style[name] = `${box[name]}px`;
    plane.style.setProperty('--hp-label-left',`${box.labelX}px`);
    plane.style.setProperty('--hp-label-top',`${box.labelY}px`);
    plane.dataset.hpLabelBounded = '';
  }

  disconnected() {
    this.observer?.disconnect();
    this.observedLabel = undefined;
    this.observedViewport = undefined;
    this.observedRows.clear();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
  reconnected() { this.schedule(); }
}

export const roomFurnitureOverlap = directive(RoomFurnitureOverlap);
