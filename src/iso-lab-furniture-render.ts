import { svg } from 'lit';
import type { FurnitureMesh } from './iso-lab-furniture';

export function furnitureShadow(mesh: FurnitureMesh, visualScale: number) {
  return svg`<path d=${mesh.shadow} fill="#233b46" fill-opacity=".12" stroke="none"
    style=${`filter:blur(${3.5*visualScale}px)`}></path>`;
}

/** Inert view paint: flat editing, hit targets and saved layout stay native. */
export function renderIsoLabFurniture(mesh: FurnitureMesh, id: string, symbol: string,
  color: string, opacity: number, visualScale: number, withShadow = true, lightSlot?: number) {
  return svg`<g data-hp="decor" data-id=${id} data-kind="furniture" data-symbol=${symbol}
    data-hp-furniture-volume="glass" pointer-events="none" aria-hidden="true"
    color=${color} opacity=${opacity} stroke-linejoin="round" stroke-linecap="round">
    ${withShadow ? furnitureShadow(mesh,visualScale) : null}
    ${mesh.parts.map((p,i)=>svg`<g data-furniture-part=${p.name}>
      <path d=${p.side} fill="#e4edf0" fill-opacity=".52" stroke="currentColor"
        stroke-opacity=".26" stroke-width=${.7*visualScale}></path>
      <path d=${p.side} fill="currentColor" fill-opacity=".06" stroke="none"></path>
      <path d=${p.top} fill="#f7fbfc" fill-opacity=".72" stroke="currentColor"
        stroke-opacity=".34" stroke-width=${.7*visualScale}></path>
      <path d=${p.top} fill="none" stroke="#ffffff" stroke-opacity=".4"
        stroke-width=${.3*visualScale}></path>
      ${lightSlot === undefined ? null : svg`<defs><pattern id=${'hp-surface-light-'+lightSlot+'-'+i}
          patternUnits="userSpaceOnUse" x=${mesh.lightBox[0]} y=${mesh.lightBox[1]}
          width=${mesh.lightBox[2]} height=${mesh.lightBox[3]} viewBox=${mesh.lightBox.join(' ')}>
          <use href="#hp-room-light-pools" transform=${'translate('+p.lightOffset.join(' ')+')'}></use>
        </pattern></defs><g fill=${'url(#hp-surface-light-'+lightSlot+'-'+i+')'} opacity=".8" stroke="none">
          <path d=${p.side}></path><path d=${p.top}></path></g>`}
    </g>`)}
  </g>`;
}
