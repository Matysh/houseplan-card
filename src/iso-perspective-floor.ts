import { html, nothing, svg, type TemplateResult } from 'lit';
import { applyIsoMatrix, isoFloorMatrix, isoHeightLift, projectPlanPoint, unprojectIsoAffine, type IsoCamera, type ViewRect } from './iso-projection';

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


/** The portable startup packet only accepts ordinary SVG. Its floor is
 * approximated by affine triangles referring to one source tree. The live
 * floor and all volumes use the exact lens. */
export function renderIsoPerspectiveSnapshot(camera: IsoCamera, bounds: ViewRect, content: TemplateResult[]): TemplateResult {
  const affine = isoFloorMatrix(camera);
  const ends = [applyIsoMatrix([bounds.x,bounds.y],affine),
    applyIsoMatrix([bounds.x+bounds.w,bounds.y+bounds.h],affine)];
  const left = Math.min(ends[0][0],ends[1][0]), top = Math.min(ends[0][1],ends[1][1]);
  const columns = 2, rows = 16;
  const width = Math.abs(ends[0][0]-ends[1][0])/columns;
  const height = Math.abs(ends[0][1]-ends[1][1])/rows;
  if (!(width > 0 && height > 0)) return svg`${content}`;
  const project = (x: number, y: number) => projectPlanPoint(unprojectIsoAffine([x,y],camera),0,camera);
  const tiles = Array.from({length:rows*columns*2},(_,index) => {
    const opposite = index % 2 !== 0;
    const col = Math.floor(index/2) % columns, row = Math.floor(index/(2*columns));
    const x = left + (col + Number(opposite)) * width, y = top + (row + Number(opposite)) * height;
    const dx = opposite ? -width : width, dy = opposite ? -height : height;
    const a = project(x,y), b = project(x+dx,y), c = project(x,y+dy);
    const m = [(b[0]-a[0])/dx,(b[1]-a[1])/dx,(c[0]-a[0])/dy,(c[1]-a[1])/dy];
    m.push(a[0] - m[0]*x - m[2]*y, a[1] - m[1]*x - m[3]*y);
    const id = 'hp-startup-floor-triangle-' + index;
    // The adjacent clips overlap at antialiased seams. A separate outline
    // keeps the outer edges of the floor exact.
    const midX = (a[0]+b[0]+c[0])/3, midY = (a[1]+b[1]+c[1])/3;
    const clip = [a,b,c].map(([px,py])=>[midX+(px-midX)*1.16,midY+(py-midY)*1.16]);
    const d = 'M ' + clip.map(p=>p.join(' ')).join(' L ') + ' Z';
    return {id,d,transform:'matrix(' + m.join(' ') + ')'};
  });
  const right = left+width*columns, bottom = top+height*rows;
  const outline = [[left,top],[right,top],[right,bottom],[left,bottom]].map(([x,y])=>project(x,y).join(' ')).join(' ');
  return svg`<g aria-hidden="true"><defs><g id="hp-startup-floor-source">${content}</g>
    <clipPath id="hp-startup-floor-bounds"><polygon points=${outline}></polygon></clipPath>
    ${tiles.map(tile => svg`<clipPath id=${tile.id}><path d=${tile.d}></path></clipPath>`)}</defs>
    <g clip-path="url(#hp-startup-floor-bounds)">${tiles.map(tile => svg`<g clip-path=${'url(#'+tile.id+')'}>
      <use href="#hp-startup-floor-source" transform=${tile.transform}></use></g>`)}</g></g>`;
}
