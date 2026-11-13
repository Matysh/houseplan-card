import {gridVisualScale} from './grid-scale';

interface BackdropBox {x:number;y:number;w:number;h:number;angle?:number}
/** Keep the image decoder and SVG tessellator in the historical 5cm paint
 * space. Equivalent grid calibration must not change font hinting inside an
 * imported SVG. This is presentation only; planRect and saved data stay world-space. */
export function backdropPaintBox(box:BackdropBox,cellCm:unknown) {
  const scale=gridVisualScale(cellCm),angle=box.angle||0;
  const transform=[angle?`rotate(${angle} ${box.x+box.w/2} ${box.y+box.h/2})`:'',
    scale!==1?`scale(${scale})`:''].filter(Boolean).join(' ')||null;
  return{x:box.x/scale,y:box.y/scale,w:box.w/scale,h:box.h/scale,scale,transform};
}
