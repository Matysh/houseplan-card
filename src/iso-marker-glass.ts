/** The two depth-sorted halves of a raised device's shared outline. */
import { nothing, svg } from 'lit';
import type { IsoMarkerGlass } from './iso-marker-outline';
import type { IsoDeviceWallMask } from './iso-overlays';
import type { PlanPoint } from './iso-projection';

type GlassWall = { id: string; mask: IsoDeviceWallMask; origin: PlanPoint };

export function renderIsoMarkerGlass(glass: IsoMarkerGlass, viewBox: string, virtual = false,
  wall?: GlassWall, layer: 'both' | 'front' | 'back' = 'both') {
  const renderSide = (side: 'front' | 'back') => {
    const front = side === 'front';
    const faces = front ? glass.frontFaces : glass.backFaces;
    if (!faces.length) return nothing;
    // Use the actual depth of this half for both its fill and strokes. A
    // covered rear face must not hide any visible front surface at the same XY.
    const occlusion = wall?.mask.glassMask(faces, wall.origin);
    const id = wall && (occlusion?.occluded || occlusion?.cut) ? `${wall.id}-${side}` : undefined;
    const dashes = virtual ? '6 5' : 'none';
    return svg`<svg class=${`iso-marker-glass ${front ? 'front' : 'rear'}${virtual ? ' virtual' : ''}`}
      viewBox=${viewBox} preserveAspectRatio="none" aria-hidden="true">
      ${id && occlusion ? svg`<defs>
        <mask id=${id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
          x=${glass.bounds[0]} y=${glass.bounds[1]} width=${glass.bounds[2]} height=${glass.bounds[3]}
          style="mask-type:luminance">
          <rect x=${glass.bounds[0]} y=${glass.bounds[1]} width=${glass.bounds[2]} height=${glass.bounds[3]} fill="white"></rect>
          ${occlusion.occluded ? svg`<path d=${occlusion.occluded} fill="black"></path>` : nothing}
          ${occlusion.cut ? svg`<path d=${occlusion.cut} fill="black"></path>` : nothing}
        </mask></defs>` : nothing}
      <g mask=${id ? `url(#${id})` : nothing}>
        <path class=${`glass-${side}`} d=${glass[side]}></path>
        <path class="glass-rim upper" stroke-dasharray=${dashes} d=${front ? glass.frontTop : glass.backTop}></path>
        <path class="glass-rim lower" stroke-dasharray=${dashes} d=${front ? glass.frontBottom : glass.backBottom}></path>
      </g>
    </svg>`;
  };
  return svg`${layer !== 'front' ? renderSide('back') : nothing}${layer !== 'back' ? renderSide('front') : nothing}`;
}
