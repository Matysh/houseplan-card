/** Local #1451 translucent shell; all glass paint is inert. */
import { nothing, svg } from 'lit';
import type { IsoMarkerGlass } from './iso-marker-outline';
import type { IsoDeviceOcclusion, IsoDeviceWallMask } from './iso-overlays';
import type { PlanPoint } from './iso-projection';

export function renderIsoMarkerGlass(glass:IsoMarkerGlass,viewBox:string,virtual=false,
  member?:{id:string;clip:string},wall?:{id:string;mask:IsoDeviceWallMask;origin?:PlanPoint}) {
  const front=wall?.mask.glassMask(glass.frontFaces,wall.origin);
  const back=member ? undefined : wall?.mask.glassMask(glass.backFaces,wall.origin);
  const points=[...glass.frontFaces,...glass.backFaces].flat();
  const x=Math.min(...points.map(p=>p[0]))-1,y=Math.min(...points.map(p=>p[1]))-1;
  const w=Math.max(...points.map(p=>p[0]))-x+1,h=Math.max(...points.map(p=>p[1]))-y+1;
  const maskId=(side:string,occlusion:IsoDeviceOcclusion|undefined)=>
    occlusion?.occluded || occlusion?.cut ? `${wall!.id}-${side}` : undefined;
  const mask=(id:string|undefined,occlusion:IsoDeviceOcclusion|undefined)=>id && occlusion ? svg`<defs>
    <mask id=${id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
      x=${x} y=${y} width=${w} height=${h} style="mask-type:luminance">
      <rect x=${x} y=${y} width=${w} height=${h} fill="white"></rect>
      ${occlusion.occluded ? svg`<path d=${occlusion.occluded} fill="#4d4d4d"></path>` : nothing}
      ${occlusion.cut ? svg`<path d=${occlusion.cut} fill="black"></path>` : nothing}
    </mask></defs>` : nothing;
  const frontId=maskId('front',front),backId=maskId('back',back);
  return svg`
    ${member ? nothing : svg`<svg class=${`iso-marker-glass rear${virtual?' virtual':''}`} viewBox=${viewBox} preserveAspectRatio="none" aria-hidden="true">
      ${mask(backId,back)}
      <g mask=${backId ? `url(#${backId})` : nothing}>
      <path class="glass-back" d=${glass.back}></path>
      <path class="glass-rim lower" stroke-dasharray=${virtual?'6 5':'none'} d=${glass.bottom}></path>
      </g>
    </svg>`}
    <svg class=${`iso-marker-glass front${virtual?' virtual':''}`} viewBox=${viewBox} preserveAspectRatio="none" aria-hidden="true">
      ${mask(frontId,front)}
      ${member ? svg`<defs><clipPath id=${member.id}><path d=${member.clip}></path></clipPath></defs>` : nothing}
      <g clip-path=${member ? `url(#${member.id})` : nothing} mask=${frontId ? `url(#${frontId})` : nothing}>
      <path class="glass-front" d=${glass.front}></path>
      <path class="glass-rim upper" stroke-dasharray=${virtual?'6 5':'none'} d=${glass.top}></path>
      </g>
    </svg>`;
}
