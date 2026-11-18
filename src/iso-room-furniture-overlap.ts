import { nothing } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { directive, type ElementPart } from 'lit/directive.js';
import type { FurnitureMesh } from './iso-lab-furniture';
import type { PlanPoint } from './iso-projection';

type Occluder = { mesh: FurnitureMesh; opacity: number };
const faces = new WeakMap<FurnitureMesh, Path2D[]>();
let probe: CanvasRenderingContext2D | null;

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
  private items: readonly Occluder[] = [];
  private observer?: ResizeObserver;
  private frame = 0;
  private previousItems: readonly Occluder[] = [];
  private previousBounds = '';
  private observedRows = new Set<HTMLElement>();

  render(_anchor: PlanPoint | undefined, _width: number, _items: readonly Occluder[]) { return nothing; }

  update(part: ElementPart, [anchor, width, items]: Parameters<RoomFurnitureOverlap['render']>) {
    this.plane = part.element as HTMLElement;
    this.anchor = anchor;
    this.viewWidth = width;
    this.items = items;
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
      this.observer.observe(plane);
      if (!plane.clientWidth) return;
      const label = plane.querySelector<HTMLElement>('.roomlabel');
      const unit = this.viewWidth / plane.clientWidth;
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

  disconnected() {
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
  reconnected() { this.schedule(); }
}

export const roomFurnitureOverlap = directive(RoomFurnitureOverlap);
