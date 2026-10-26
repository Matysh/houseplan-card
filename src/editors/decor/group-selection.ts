import { NORM_W } from '../../canvas-constants';
import { decorTextElement } from '../../decor-text-element';
import type { DecorShape } from './types';

export interface DecorTextBounds { x: number; y: number; w: number; h: number }
export interface DecorGroupOutlineContext {
  text(shape: DecorShape): DecorTextBounds | null;
}

/** Existing live-editor measurement hook owns collection; moves reuse measured text-relative offsets. */
export class DecorGroupTextBoxes {
  private readonly boxes = new Map<string, { key: string; dx: number; dy: number; w: number; h: number }>();
  clear(): void { this.boxes.clear(); }
  measure(members: readonly DecorShape[], root: ParentNode): boolean {
    const texts = members.filter(shape => shape.kind === 'text');
    if (!texts.length) { this.boxes.clear(); return false; }
    const current = new Set(texts.map(shape => shape.id));
    for (const id of this.boxes.keys()) if (!current.has(id)) this.boxes.delete(id);
    let changed = false;
    for (const shape of texts) {
      const element = decorTextElement(root, shape.id); if (!element) continue;
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
