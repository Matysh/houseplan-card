import { nothing, svg, type TemplateResult } from 'lit';
import { NORM_W } from '../../canvas-constants';
import { furnitureRenderTransform, type FurnitureGraphic } from '../../furniture';
import type { DecorShape } from './types';

export interface DecorTextBounds { x: number; y: number; w: number; h: number }
export interface DecorGroupOutlineContext {
  text(shape: DecorShape): DecorTextBounds | null;
  art(symbol: string): FurnitureGraphic | null;
}

/** Variant B: the actual individual shapes, without a group frame, handles or hit ownership. */
export function renderDecorGroupOutlines(members: readonly DecorShape[], context: DecorGroupOutlineContext): TemplateResult {
  return svg`<g class="hp-prop-selection hp-prop-group-selection" aria-hidden="true" fill="none" pointer-events="none">
    ${members.map(shape => {
      let outline: TemplateResult | typeof nothing;
      if (shape.kind === 'line') outline = svg`<path d="M${shape.x1*NORM_W} ${shape.y1*NORM_W}L${shape.x2*NORM_W} ${shape.y2*NORM_W}" vector-effect="non-scaling-stroke"></path>`;
      else if (shape.kind === 'furniture') {
        const art = context.art(shape.symbol);
        outline = art ? svg`<path d=${art.d} transform=${furnitureRenderTransform(shape,NORM_W,NORM_W,art.viewW,art.viewH)} vector-effect="non-scaling-stroke"></path>` : nothing;
      } else {
        const box = shape.kind === 'text' ? context.text(shape)
          : { x: shape.x*NORM_W, y: shape.y*NORM_W, w: shape.w*NORM_W, h: shape.h*NORM_W };
        if (!box) return nothing;
        const x = shape.kind === 'text' ? shape.x*NORM_W : box.x+box.w/2;
        const y = shape.kind === 'text' ? shape.y*NORM_W : box.y+box.h/2;
        outline = svg`<g transform=${shape.angle ? `rotate(${shape.angle} ${x} ${y})` : nothing}>
          ${shape.kind === 'ellipse'
            ? svg`<ellipse cx=${x} cy=${y} rx=${box.w/2} ry=${box.h/2} vector-effect="non-scaling-stroke"></ellipse>`
            : svg`<rect x=${box.x} y=${box.y} width=${box.w} height=${box.h} vector-effect="non-scaling-stroke"></rect>`}</g>`;
      }
      return svg`<g class="hp-prop-group-contour" data-decor-selection=${shape.id}>${outline}</g>`;
    })}</g>`;
}

/** Existing live-editor measurement hook owns collection; moves reuse measured text-relative offsets. */
export class DecorGroupTextBoxes {
  private readonly boxes = new Map<string, { key: string; dx: number; dy: number; w: number; h: number }>();
  clear(): void { this.boxes.clear(); }
  measure(members: readonly DecorShape[], root: ParentNode): boolean {
    const texts = members.filter(shape => shape.kind === 'text');
    if (!texts.length) { this.boxes.clear(); return false; }
    const elements = new Map([...root.querySelectorAll<SVGGraphicsElement>('text.dtext[data-id]')]
      .map(node => [node.getAttribute('data-id'), node]));
    const current = new Set(texts.map(shape => shape.id));
    for (const id of this.boxes.keys()) if (!current.has(id)) this.boxes.delete(id);
    let changed = false;
    for (const shape of texts) {
      const element = elements.get(shape.id); if (!element) continue;
      const style = getComputedStyle(element);
      const key = JSON.stringify([element.textContent, style.fontFamily, style.fontSize, style.fontWeight, style.letterSpacing]);
      if (this.boxes.get(shape.id)?.key === key) continue;
      let box: DOMRect;
      try { box = element.getBBox(); } catch { continue; }
      if (![box.x,box.y,box.width,box.height].every(Number.isFinite) || !box.width && !box.height) continue;
      this.boxes.set(shape.id, { key, dx: box.x-shape.x*NORM_W, dy: box.y-shape.y*NORM_W, w: box.width, h: box.height });
      changed = true;
    }
    return changed;
  }
  get(shape: DecorShape): DecorTextBounds | null {
    const box = this.boxes.get(shape.id);
    return shape.kind === 'text' && box ? { x: shape.x*NORM_W+box.dx, y: shape.y*NORM_W+box.dy, w: box.w, h: box.h } : null;
  }
}
