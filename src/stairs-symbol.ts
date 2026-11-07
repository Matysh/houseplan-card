import { nothing, svg, type TemplateResult } from 'lit';
import { guard } from 'lit/directives/guard.js';
import type { Stair, cachedStairMarkup, cachedStairRenderGeometry } from './stairs';

interface StairSymbol {
  stair: Stair;
  geometry: ReturnType<typeof cachedStairRenderGeometry>;
  markup: ReturnType<typeof cachedStairMarkup>;
  classes: string;
  targetState: string;
  style: string;
  role: string;
  label: string;
  focusable?: boolean;
  down?: (event: PointerEvent) => void;
  click?: (event: Event) => void;
  doubleClick?: (event: MouseEvent) => void;
  enter?: (event: PointerEvent) => void;
  move?: (event: PointerEvent) => void;
  leave?: () => void;
  key?: (event: KeyboardEvent) => void;
  extra?: unknown;
}

/** One Lit template identity preserves the heavy symbol when its input owner changes. */
export function renderStairSymbol(input: StairSymbol): TemplateResult {
  const { stair, geometry, markup } = input;
  return svg`<g class="hp-stair ${input.classes}"
    data-hp="stair" data-id=${stair.id} data-kind=${stair.kind}
    data-target-state=${input.targetState} style=${input.style}
    role=${input.role} tabindex=${input.focusable ? '0' : nothing} aria-label=${input.label}
    @pointerdown=${input.down ?? nothing} @click=${input.click ?? nothing}
    @dblclick=${input.doubleClick ?? nothing} @pointerenter=${input.enter ?? nothing}
    @pointermove=${input.move ?? nothing} @pointerleave=${input.leave ?? nothing}
    @keydown=${input.key ?? nothing}>
    ${guard([geometry, markup], () => svg`
      <polygon class="hp-stair-outline" points=${markup.outline}></polygon>
      <polygon class="hp-stair-hit" points=${markup.outline}></polygon>
      ${geometry.trapezoid.map(line => svg`<line class="hp-stair-trapezoid"
        x1=${line.a[0]} y1=${line.a[1]} x2=${line.b[0]} y2=${line.b[1]}></line>`)}
      ${markup.treads ? svg`<path class="hp-stair-tread" d=${markup.treads}></path>` : nothing}
      <path class="hp-stair-arrow" d=${geometry.arrowPath}></path>`)}
    ${input.extra ?? nothing}
  </g>`;
}

/** Shared parent identity keeps cached symbol parts attached across modes. */
export function renderStairLayer(items: readonly unknown[], draft: unknown = nothing, preview: unknown = nothing): TemplateResult {
  return svg`<g class="hp-stairs-layer">${items}${draft}${preview}</g>`;
}
