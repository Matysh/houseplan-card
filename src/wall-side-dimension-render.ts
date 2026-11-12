import {html,svg,nothing,type TemplateResult} from 'lit';
import type {DimensionPlacement,DimensionBox} from './wall-side-dimension-layout';
import type {DimensionPoint} from './wall-side-dimensions';
const stop=(event:Event):void=>event.stopPropagation();
export function renderWallSideDimensions(items:readonly DimensionPlacement[],width:number,height:number,
  list:DimensionBox|null,title:string,context:string,ink:string):TemplateResult|typeof nothing {
  if(!items.length)return nothing;
  const line=(a:DimensionPoint,b:DimensionPoint,rail=false)=>svg`<line x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]}
    stroke=${rail?'var(--accent-color,var(--primary-color,#03a9f4))':ink}></line>`;
  return html`<div data-hp="wall-side-dimensions" data-context=${context}
      style="position:absolute;inset:0;pointer-events:none;z-index:8;overflow:hidden">
    <svg width="100%" height="100%" viewBox=${`0 0 ${width} ${height}`} aria-hidden="true" style="overflow:hidden">
      ${items.map(item=>{
        const {a,b,railA,railB,normal,tangent,labelCenter:c,labelBox:box}=item;
        const beyond=(p:DimensionPoint):DimensionPoint=>[p[0]+normal[0]*4,p[1]+normal[1]*4];
        const tick=(p:DimensionPoint)=>line([p[0]-(tangent[0]+normal[0])*2,p[1]-(tangent[1]+normal[1])*2],
          [p[0]+(tangent[0]+normal[0])*2,p[1]+(tangent[1]+normal[1])*2]);
        const middle:DimensionPoint=[(railA[0]+railB[0])/2,(railA[1]+railB[1])/2];
        return svg`<g data-hp="wall-side-dimension" data-interval=${item.interval.id} data-carrier=${item.interval.carrier}
          data-side=${item.interval.side??nothing} data-role=${item.interval.role??'wall-side'} data-source=${item.interval.source} data-length-cm=${item.interval.lengthCm}
          data-from=${JSON.stringify(item.interval.from)} data-to=${JSON.stringify(item.interval.to)}
          data-reference-source=${item.interval.referenceSource??nothing} data-room=${item.interval.roomId??nothing}
          fill="none" stroke-width="1" pointer-events="none">
          ${item.interval.source==='unavailable'?nothing:svg`
            <g data-hp="dimension-witnesses">${line(a,beyond(railA))}${line(b,beyond(railB))}${tick(railA)}${tick(railB)}</g>
            <g data-hp="dimension-rail">${line(railA,railB,true)}</g>
            ${Math.hypot(c[0]-middle[0],c[1]-middle[1])>1?line(middle,c):nothing}`}
          <rect x=${box.x} y=${box.y} width=${box.w} height=${box.h} rx="2"
            fill="var(--card-background-color,#fff)" fill-opacity=".94" stroke="none"></rect>
          <text x=${c[0]} y=${c[1]+4} text-anchor="middle" fill="var(--primary-text-color,#444)"
            stroke="none" font-size="12" font-family="Roboto,Arial,sans-serif">${item.listed?`[${item.number}]`:item.label}</text>
        </g>`;
      })}
    </svg>
    ${list?html`<section data-hp="dimension-list" aria-label=${title}
      @pointerdown=${stop} @pointermove=${stop} @pointerup=${stop} @click=${stop} @wheel=${stop}
      style=${`position:absolute;pointer-events:auto;left:${list.x}px;top:${list.y}px;width:${list.w}px;max-height:${list.h}px;overflow:auto;box-sizing:border-box;padding:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#444);border:1px solid var(--divider-color,#888);border-radius:5px;font:12px Roboto,Arial,sans-serif;overscroll-behavior:contain`}>
      <strong>${title}</strong>
      ${items.filter(item=>item.listed).map(item=>html`<div data-interval=${item.interval.id}
        style="padding-top:6px;white-space:nowrap">[${item.number}] ${item.label}</div>`)}
    </section>`:nothing}
  </div>`;
}
