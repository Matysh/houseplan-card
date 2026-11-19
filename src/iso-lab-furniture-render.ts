import { svg } from 'lit';
import type { FurnitureMesh } from './iso-lab-furniture';

// Shared material for furniture and upstairs stairs: 35% less opaque.
const materialOpacity = .65;

export function furnitureShadow(mesh: FurnitureMesh, visualScale: number) {
  return svg`<path d=${mesh.shadow} fill="#233b46" fill-opacity=".12" stroke="none"
    style=${`filter:blur(${3.5*visualScale}px)`}></path>`;
}

/** Inert view paint: one translucent material, independent of Flat outline opacity. */
export function renderIsoLabFurniture(mesh: FurnitureMesh, id: string, symbol: string,
  color: string, visualScale: number, withShadow = true, lightSlot?: number) {
  return svg`<g data-hp="decor" data-id=${id} data-kind="furniture" data-symbol=${symbol}
    data-hp-furniture-volume="glass" pointer-events="none" aria-hidden="true"
    color=${color} stroke-linejoin="round" stroke-linecap="round">
    ${withShadow ? furnitureShadow(mesh,visualScale) : null}
    ${mesh.parts.map((p,i)=>svg`<g data-furniture-part=${p.name}>
      <path d=${p.side} fill="#e4edf0" fill-opacity=${.52*materialOpacity} stroke="currentColor"
        stroke-opacity=${.26*materialOpacity} stroke-width=${.7*visualScale}></path>
      <path d=${p.side} fill="currentColor" fill-opacity=${.06*materialOpacity} stroke="none"></path>
      <path d=${p.top} fill="#f7fbfc" fill-opacity=${.72*materialOpacity} stroke="currentColor"
        stroke-opacity=${.34*materialOpacity} stroke-width=${.7*visualScale}></path>
      <path d=${p.top} fill="none" stroke="#ffffff" stroke-opacity=${.4*materialOpacity}
        stroke-width=${.3*visualScale}></path>
      ${lightSlot === undefined ? null : svg`<defs><clipPath id=${'hp-surface-light-'+lightSlot+'-'+i}>
          <path d=${p.side}></path><path d=${p.top}></path>
        </clipPath></defs><g clip-path=${'url(#hp-surface-light-'+lightSlot+'-'+i+')'}
          opacity=${.8*materialOpacity} stroke="none" style="isolation:isolate">
          ${''/* #1470: project the same light field once through the part's
            silhouette, rather than rasterising a repeating full-field pattern
            per side/top. Isolation preserves the pattern's transparent backdrop
            for screen blending; the layer uses the same material multiplier. */}
          <use href="#hp-room-light-pools" transform=${'translate('+p.lightOffset.join(' ')+')'}></use>
        </g>`}
    </g>`)}
  </g>`;
}
