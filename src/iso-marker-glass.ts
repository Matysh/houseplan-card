/** Local #1451 translucent shell; all glass paint is inert. */
import { nothing, svg } from 'lit';
import type { IsoMarkerGlass } from './iso-marker-outline';
import type { IsoDeviceWallMask } from './iso-overlays';

export function renderIsoMarkerGlass(glass:IsoMarkerGlass,viewBox:string,virtual=false,
  member?:{id:string;clip:string},wall?:{id:string;mask:IsoDeviceWallMask}) {
  const front=wall?.mask.glassMask(glass.frontFaces),back=wall?.mask.glassMask(glass.backFaces);
  const points=[...glass.frontFaces,...glass.backFaces].flat();
  const x=Math.min(...points.map(p=>p[0]))-1,y=Math.min(...points.map(p=>p[1]))-1;
  const w=Math.max(...points.map(p=>p[0]))-x+1,h=Math.max(...points.map(p=>p[1]))-y+1;
  const mask=(side:string,path:string|undefined)=>path ? svg`<defs>
    <mask id=${`${wall!.id}-${side}`} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
      x=${x} y=${y} width=${w} height=${h} style="mask-type:luminance">
      <rect x=${x} y=${y} width=${w} height=${h} fill="white"></rect>
      <path d=${path} fill="#4d4d4d"></path>
    </mask></defs>` : nothing;
  return svg`
    ${member ? nothing : svg`<svg class=${`iso-marker-glass rear${virtual?' virtual':''}`} viewBox=${viewBox} preserveAspectRatio="none" aria-hidden="true">
      ${mask('back',back)}
      <g mask=${back ? `url(#${wall!.id}-back)` : nothing}>
      <path class="glass-back" d=${glass.back}></path>
      <path class="glass-rim lower" stroke-dasharray=${virtual?'6 5':'none'} d=${glass.bottom}></path>
      </g>
    </svg>`}
    <svg class=${`iso-marker-glass front${virtual?' virtual':''}`} viewBox=${viewBox} preserveAspectRatio="none" aria-hidden="true">
      ${mask('front',front)}
      ${member ? svg`<defs><clipPath id=${member.id}><path d=${member.clip}></path></clipPath></defs>` : nothing}
      <g clip-path=${member ? `url(#${member.id})` : nothing} mask=${front ? `url(#${wall!.id}-front)` : nothing}>
      <path class="glass-front" d=${glass.front}></path>
      <path class="glass-rim upper" stroke-dasharray=${virtual?'6 5':'none'} d=${glass.top}></path>
      </g>
    </svg>`;
}
