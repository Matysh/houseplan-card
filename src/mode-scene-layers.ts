import { html, nothing, svg, type TemplateResult } from 'lit';
import { guard } from 'lit/directives/guard.js';
export interface ModeSceneLayer {
  id: string;
  inputs: readonly unknown[];
  render(): unknown;
}
/** Contiguous paint slots preserve z-order and the existing live camera. */
export function renderModeSceneLayers(
  layers: readonly ModeSceneLayer[], view: { x: number; y: number; w: number; h: number }, transform: string | undefined, gridStep: number, mode: string, observed?: (id: string) => void,
): TemplateResult {
  const render = (layer: ModeSceneLayer): TemplateResult => svg`<svg
    class=${((layer.id === 'rooms' && mode !== 'plan') || (layer.id === 'room-ink' && mode === 'plan')) ? 'plan-svg hp-mode-scene-svg' : 'hp-mode-scene-svg'}
    data-hp=${((layer.id === 'rooms' && mode !== 'plan') || (layer.id === 'room-ink' && mode === 'plan')) ? 'stage' : nothing}
    data-grid-step=${((layer.id === 'rooms' && mode !== 'plan') || (layer.id === 'room-ink' && mode === 'plan')) ? gridStep : nothing}
    data-hp-layer=${((layer.id === 'rooms' && mode !== 'plan') || (layer.id === 'room-ink' && mode === 'plan')) ? 'plan' : layer.id}
    data-hp-mode-layer=${layer.id} data-hp-live-viewbox="floor"
    viewBox="${view.x} ${view.y} ${view.w} ${view.h}"
    preserveAspectRatio="xMidYMid meet" style="z-index:1;pointer-events:none">
    <g transform=${transform || nothing}
      style=${layer.id === 'paper-ink' || layer.id === 'room-ink' && mode !== 'plan' || layer.id === 'rooms' && mode === 'plan' ? 'pointer-events:none' : 'pointer-events:auto'}>
      ${guard([...layer.inputs], () => { observed?.(layer.id); return layer.render(); })}
    </g>
  </svg>`;
  return html`${layers.filter(layer => layer.id !== 'room-ink' && layer.id !== 'paper-ink').map(layer => {
    const other = layer.id === 'rooms' ? 'room-ink' : layer.id === 'paper' ? 'paper-ink' : null;
    return other ? html`<div class="hp-mode-crossfade" data-hp-mode-pair=${layer.id}>
      ${render(layer)}${render(layers.find(item => item.id === other)!)}
    </div>` : render(layer);
  })}`;
}
