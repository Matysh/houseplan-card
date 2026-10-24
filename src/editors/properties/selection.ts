import { nothing, svg, type TemplateResult } from 'lit';
import { NORM_W } from '../../canvas-constants';
import { planRect } from '../../space-geometry';
import type { OpeningDimension } from '../../opening-dimensions';
import type { PropertiesTarget } from './catalog';
import { decorPropertiesBox } from './transforms';

export interface PropertiesSelectionContext {
  unitPerPx: number; cellCm: number;
  textBox: { x: number; y: number; w: number; h: number } | null;
  reference: OpeningDimension | null;
}

/** Screen-fixed paint only. The existing native handles keep owning every gesture. */
export function renderPropertiesSelection(target: PropertiesTarget | null, context: PropertiesSelectionContext): TemplateResult | typeof nothing {
  if (!target || target.kind === 'device') return nothing;
  const px = context.unitPerPx, half = 4 * px;
  const handle = (x: number, y: number) => svg`<rect x=${x-half} y=${y-half} width=${half*2} height=${half*2} fill="white"></rect>`;
  const tag = (x: number,y: number,text: string) => svg`<g><rect x=${x} y=${y} width=${(text.length*7+22)*px} height=${26*px} rx=${4*px} fill="white" stroke="#9dcfd7" stroke-width="1"></rect>
    <text x=${x+11*px} y=${y+17*px} font-size=${12*px} fill="#167e8e" stroke="none">${text}</text></g>`;
  const pivot = (x: number, y: number) => svg`<circle cx=${x} cy=${y} r=${4*px} fill="white"></circle><path d="M${x-7*px} ${y}h${14*px}M${x} ${y-7*px}v${14*px}" stroke-width="1"></path>`;
  let content: TemplateResult | typeof nothing = nothing;
  if (target.kind === 'partition' || target.kind === 'contour') {
    const { a, b, cm } = target.value;
    const x1=a[0]*NORM_W, y1=a[1]*NORM_W, x2=b[0]*NORM_W, y2=b[1]*NORM_W;
    const length=Math.hypot(x2-x1,y2-y1), nx=length?(y2-y1)/length:0, ny=length?-(x2-x1)/length:-1;
    content = svg`<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width=${cm/context.cellCm*(NORM_W/240)+4*px} opacity=".2" vector-effect="none"></path>
      <path d="M${x1} ${y1}L${x2} ${y2}"></path>${handle(x1,y1)}${handle(x2,y2)}
      ${target.kind==='contour' ? svg`${tag(x1-14*px,y1-48*px,'A')}${tag(x2-14*px,y2-48*px,'B')}`
        : svg`${tag(x1-23*px,y1+24*px,'A')}${tag(x2-22*px,y2+24*px,'B')}
          <path d="M${x1+nx*25*px} ${y1+ny*25*px}l${nx*12*px} ${ny*12*px}M${x1+nx*31*px} ${y1+ny*31*px}L${x2+nx*31*px} ${y2+ny*31*px}M${x2+nx*25*px} ${y2+ny*25*px}l${nx*12*px} ${ny*12*px}"></path>`}`;
  } else if (target.kind==='column') {
    const c=target.value, x=c.center[0]*NORM_W,y=c.center[1]*NORM_W,r=c.cm/context.cellCm*(NORM_W/240)/2;
    content=svg`<g transform=${c.shape==='square'&&c.angle?`rotate(${c.angle} ${x} ${y})`:nothing}>
      ${c.shape==='circle'?svg`<circle cx=${x} cy=${y} r=${r+3*px}></circle>`:svg`<rect x=${x-r-3*px} y=${y-r-3*px} width=${2*r+6*px} height=${2*r+6*px}></rect>`}${pivot(x,y)}</g>`;
  } else if (target.kind === 'decor' || target.kind === 'backdrop') {
    let box: { x: number; y: number; w: number; h: number; angle?: number }, anchor: [number, number];
    if (target.kind === 'backdrop') {
      box = planRect(target.value); anchor = [box.x + box.w/2, box.y + box.h/2];
    } else {
      const shape = target.value, projected = decorPropertiesBox(shape);
      if (shape.kind === 'line') return svg`<g class="hp-prop-selection" aria-hidden="true"><path d="M${shape.x1*NORM_W} ${shape.y1*NORM_W}L${shape.x2*NORM_W} ${shape.y2*NORM_W}"></path>
        ${handle(shape.x1*NORM_W,shape.y1*NORM_W)}${handle(shape.x2*NORM_W,shape.y2*NORM_W)}</g>`;
      anchor = [projected.x*NORM_W, projected.y*NORM_W];
      if (shape.kind === 'text') {
        if (!context.textBox) return nothing;
        box = { ...context.textBox, angle: shape.angle };
      } else box = { x: shape.x*NORM_W, y: shape.y*NORM_W, w: shape.w*NORM_W, h: shape.h*NORM_W, angle: shape.angle };
    }
    const cx=box.x+box.w/2, cy=box.y+box.h/2;
    content = svg`<g transform=${box.angle ? `rotate(${box.angle} ${anchor[0]} ${anchor[1]})` : nothing}>
      <rect x=${box.x} y=${box.y} width=${box.w} height=${box.h}></rect>
      ${[box.x,box.x+box.w].flatMap(x=>[box.y,box.y+box.h].map(y=>handle(x,y)))}
      <path d="M${cx} ${box.y}v${-24*px}"></path><circle cx=${cx} cy=${box.y-24*px} r=${4*px} fill="white"></circle>
      ${pivot(cx,cy)}</g>`;
  } else if (target.kind === 'led') {
    content = svg`<polyline points=${target.value.points.map(p=>`${p[0]*NORM_W},${p[1]*NORM_W}`).join(' ')}></polyline>
      ${target.value.points.map(p=>handle(p[0]*NORM_W,p[1]*NORM_W))}`;
  } else if (target.kind === 'opening') {
    const opening=target.value, x=opening.x*NORM_W, y=opening.y*NORM_W;
    const rad=opening.angle*Math.PI/180, ux=Math.cos(rad), uy=Math.sin(rad), halfLength=opening.length*NORM_W/2;
    const h=opening.flip_h ? 1 : -1;
    content = svg`<path d="M${x-ux*halfLength} ${y-uy*halfLength}L${x+ux*halfLength} ${y+uy*halfLength}" stroke-dasharray="4 3"></path>
      ${pivot(x,y)}${opening.type === 'door' ? svg`<circle cx=${x+ux*halfLength*h} cy=${y+uy*halfLength*h} r=${6*px} fill="#078a9e" stroke="white"></circle>` : nothing}`;
  }
  const ref=context.reference;
  return svg`<g class="hp-prop-selection" aria-hidden="true">${content}
    ${ref ? svg`<path d="M${ref.from[0]} ${ref.from[1]}l${ref.labelNormal[0]*50*px} ${ref.labelNormal[1]*50*px}M${ref.to[0]} ${ref.to[1]}l${ref.labelNormal[0]*50*px} ${ref.labelNormal[1]*50*px}
        M${ref.from[0]+ref.labelNormal[0]*42*px} ${ref.from[1]+ref.labelNormal[1]*42*px}L${ref.to[0]+ref.labelNormal[0]*42*px} ${ref.to[1]+ref.labelNormal[1]*42*px}"></path>
      <circle cx=${ref.to[0]} cy=${ref.to[1]} r=${5*px} fill="white"></circle>` : nothing}</g>`;
}
