/** Local #1451 translucent shell; all glass paint is inert. */
import { svg } from 'lit';
import type { IsoMarkerGlass } from './iso-marker-outline';

export function renderIsoMarkerGlass(glass:IsoMarkerGlass,viewBox:string,virtual=false) {
  return svg`
    <svg class=${`iso-marker-glass rear${virtual?' virtual':''}`} viewBox=${viewBox} preserveAspectRatio="none" aria-hidden="true">
      <path class="glass-back" d=${glass.back}></path>
      <path class="glass-rim lower" stroke-dasharray=${virtual?'6 5':'none'} d=${glass.bottom}></path>
    </svg>
    <svg class=${`iso-marker-glass front${virtual?' virtual':''}`} viewBox=${viewBox} preserveAspectRatio="none" aria-hidden="true">
      <path class="glass-front" d=${glass.front}></path>
      <path class="glass-rim upper" stroke-dasharray=${virtual?'6 5':'none'} d=${glass.top}></path>
    </svg>`;
}
