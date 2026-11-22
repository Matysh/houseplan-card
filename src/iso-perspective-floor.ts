import { html, nothing, svg, type TemplateResult } from 'lit';
import { isoHeightLift, type IsoCamera, type ViewRect } from './iso-projection';

function lensStyle(view: ViewRect, height: number, x: number, y: number, rate: number, lift: number) {
  const origin = ((x-view.x)/view.w*100) + '% ' + ((y-view.y)/view.h*100) + '%';
  const matrix = 'matrix3d(1,0,0,0,0,1,0,' + (-rate*view.h/height) + ',0,0,1,0,0,' + (-lift*height/view.h) + ',0,1)';
  return {origin,matrix};
}

/** A CSS transform on an HTML plane paints projective floor SVG in both
 * Chromium and WebKit. It shares the anchored view box of the scene. */
export function renderIsoPerspectiveFloor(camera: IsoCamera, content: TemplateResult, view: ViewRect,
  size: readonly [number,number], height = 0, layer: 'floor' | 'led' | 'vacuum' = 'floor'): TemplateResult {
  const {center:[x,y],rate} = camera.perspective!;
  const lift = isoHeightLift(camera,height);
  const {origin,matrix} = lensStyle(view,size[1],x,y,rate,lift);
  return html`<div data-hp-iso-perspective-floor data-lens=${[x,y,rate,lift].join(' ')}
    class=${layer === 'vacuum' ? 'vactrail' : nothing} data-hp=${layer === 'vacuum' ? 'vacuum-trail' : nothing}
    style=${'position:absolute;inset:0;pointer-events:none;transform-origin:' + origin + ';transform:' + matrix
      + (layer === 'led' ? ';z-index:2' : '')}>
    ${svg`<svg data-hp-live-viewbox=${layer === 'vacuum' ? nothing : 'camera'}
      data-hp-live-inherited-scene=${layer === 'vacuum' ? 'camera' : nothing}
      viewBox=${[view.x,view.y,view.w,view.h].join(' ')} preserveAspectRatio="none"
      style="display:block;width:100%;height:100%;overflow:visible;pointer-events:none">${content}</svg>`}
  </div>`;
}

export function resizeIsoPerspectiveFloor(svg: SVGElement, viewBox: string) {
  const plane = svg.parentElement;
  const lens = plane?.getAttribute('data-lens');
  if (!plane || !lens) return;
  const width = plane.clientWidth, height = plane.clientHeight;
  if (!width || !height) return;
  const [vx,vy,w,h] = viewBox.split(/\s+/).map(Number);
  if (!(w > 0 && h > 0)) return;
  const [x,y,rate,lift] = lens.split(' ').map(Number);
  const {origin,matrix} = lensStyle({x:vx,y:vy,w,h},height,x,y,rate,lift);
  if (plane.style.transformOrigin !== origin) plane.style.transformOrigin = origin;
  if (plane.style.transform !== matrix) plane.style.transform = matrix;
}

