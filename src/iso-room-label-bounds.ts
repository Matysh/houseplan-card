import type { PlanPoint, ViewRect } from './iso-projection';

/** Paint bounds only: the room anchor, floor transform and native hit target
 * remain unchanged. Padding includes the invisible touch floor/focus outline. */
export function isoRoomLabelBounds(
  anchor: PlanPoint, view: ViewRect, viewport: readonly [number, number],
  size: readonly [number, number], matrix: readonly number[], origin: readonly [number, number],
  content: readonly [number, number, number, number] = [0,0,size[0],size[1]],
) {
  const [width, height] = viewport, [w, h] = size;
  if (![...anchor, ...Object.values(view), width, height, w, h, ...matrix, ...origin, ...content].every(Number.isFinite) ||
      !(width > 0 && height > 0 && view.w > 0 && view.h > 0 && w > 0 && h > 0) || matrix.length !== 6) return;
  const x = (anchor[0]-view.x)/view.w*width, y = (anchor[1]-view.y)/view.h*height;
  const [a,b,c,d,e,f] = matrix, [ox,oy] = origin;
  const [leftContent,topContent,contentWidth,contentHeight] = content;
  const points = [[leftContent,topContent],[leftContent+contentWidth,topContent],
    [leftContent+contentWidth,topContent+contentHeight],[leftContent,topContent+contentHeight]].map(([px,py])=>
    [x+ox+a*(px-ox)+c*(py-oy)+e,y+oy+b*(px-ox)+d*(py-oy)+f]);
  const padding = 32;
  const left = Math.min(...points.map(p=>p[0]))-padding;
  const top = Math.min(...points.map(p=>p[1]))-padding;
  const boxWidth = Math.max(...points.map(p=>p[0]))+padding-left;
  const boxHeight = Math.max(...points.map(p=>p[1]))+padding-top;
  const scene = { x:view.x+left/width*view.w, y:view.y+top/height*view.h,
    w:boxWidth/width*view.w, h:boxHeight/height*view.h };
  return {left,top,width:boxWidth,height:boxHeight,labelX:x-left,labelY:y-top,scene};
}
