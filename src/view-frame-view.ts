import { html, nothing } from 'lit';
import { homeArrowPosition, type FrameRect, type PlanRotation } from './view-frame';

/** "Home is that way" (CANVAS §5): an unbounded plane points back to content. */
export function renderHomeArrow(base: number[], view: FrameRect | null, rotation: PlanRotation,
  title: string, fit: () => void) {
  const arrow = homeArrowPosition(base, view, rotation);
  return !arrow ? nothing : html`<button class="homearrow hpf-icon-action hpf-icon-navigation" data-hp-tooltip=${title} aria-label=${title}
    style="left:${arrow.left.toFixed(1)}%;top:${arrow.top.toFixed(1)}%"
    @click=${(event: Event) => { event.stopPropagation(); fit(); }}>
    <ha-icon icon="mdi:arrow-right-thick" style="transform:rotate(${arrow.angle.toFixed(1)}deg)"></ha-icon>
  </button>`;
}

export function renderPlanRotationControls(t: (key: 'title.rotate_left' | 'title.rotate_right') => string,
  rotate: (direction: -1 | 1) => void) {
  return html`<button class="btn zb hpf-icon-action" data-hp="rotate-left" @click=${() => rotate(-1)}
    data-hp-tooltip=${t('title.rotate_left')} aria-label=${t('title.rotate_left')}><ha-icon icon="mdi:rotate-left"></ha-icon></button>
    <button class="btn zb hpf-icon-action" data-hp="rotate-right" @click=${() => rotate(1)}
    data-hp-tooltip=${t('title.rotate_right')} aria-label=${t('title.rotate_right')}><ha-icon icon="mdi:rotate-right"></ha-icon></button>`;
}
