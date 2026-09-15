import { svg, type SVGTemplateResult } from 'lit';

export type PaperShape =
  | { path: string }
  | { poly: string }
  | { rect: { x: number; y: number; w: number; h: number; rx: number } };

/** One shared renderer keeps the visible paper and its shadow silhouette exact. */
export function renderPaperShapes(
  shapes: readonly PaperShape[],
  groupClass = 'hp-paperg',
): SVGTemplateResult {
  return svg`<g class=${groupClass}>${shapes.map((shape) =>
    'path' in shape
      ? svg`<path class="hp-paper" d=${shape.path} fill-rule="evenodd" pointer-events="none"></path>`
      : 'poly' in shape
        ? svg`<polygon class="hp-paper" points=${shape.poly} pointer-events="none"></polygon>`
        : svg`<rect class="hp-paper" x=${shape.rect.x} y=${shape.rect.y}
            width=${shape.rect.w} height=${shape.rect.h} rx=${shape.rect.rx}
            pointer-events="none"></rect>`,
  )}</g>`;
}
