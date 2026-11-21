import { nothing, svg } from 'lit';
import type { FurnitureMesh } from './iso-lab-furniture';
import type { isoFurnitureLightSampler } from './iso-wall-light';

// Shared material for furniture and upstairs stairs: 35% less opaque.
const materialOpacity = .65;

export function furnitureShadow(mesh: FurnitureMesh, visualScale: number, blur = true) {
  return svg`<path d=${mesh.shadow} fill="#233b46" fill-opacity=".12" stroke="none"
    style=${blur ? `filter:blur(${3.5*visualScale}px)` : nothing}></path>`;
}

/** Inert view paint: one translucent material, independent of Flat outline opacity. */
export function renderIsoLabFurniture(mesh: FurnitureMesh, id: string, symbol: string,
  color: string, visualScale: number, withShadow = true, sampleLight?: ReturnType<typeof isoFurnitureLightSampler>,
  glOwned = false) {
  return svg`<g data-hp="decor" data-id=${id} data-kind="furniture" data-symbol=${symbol}
    data-hp-furniture-volume="glass" ?data-hp-gl-furniture=${glOwned} pointer-events="none" aria-hidden="true"
    color=${color} stroke-linejoin="round" stroke-linecap="round">
    ${withShadow ? furnitureShadow(mesh,visualScale) : null}
    ${mesh.parts.map(p=>svg`<g data-furniture-part=${p.name}>
      <path data-hp-furniture-base d=${p.side} fill="#e4edf0" fill-opacity=${.52*materialOpacity} stroke="currentColor"
        stroke-opacity=${.26*materialOpacity} stroke-width=${.7*visualScale}></path>
      <path d=${p.side} fill="currentColor" fill-opacity=${.06*materialOpacity} stroke="none"></path>
      <path data-hp-furniture-base d=${p.top} fill="#f7fbfc" fill-opacity=${.72*materialOpacity} stroke="currentColor"
        stroke-opacity=${.34*materialOpacity} stroke-width=${.7*visualScale}></path>
      <path d=${p.top} fill="none" stroke="#ffffff" stroke-opacity=${.4*materialOpacity}
        stroke-width=${.3*visualScale}></path>
      ${sampleLight?.(p.lightPoint).map(({source,alpha}) => svg`<path
        class="glow-spot ${source.entering ? 'is-entering' : ''} ${source.leaving ? 'is-leaving' : ''}"
        d=${p.side + ' ' + p.top} fill=${source.color} fill-opacity=${alpha * .8 * materialOpacity}
        stroke="none" style="mix-blend-mode:screen"></path>`)}
    </g>`)}
  </g>`;
}
