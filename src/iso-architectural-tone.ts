/** UI-062: presentation tones only; no saved colours or live light inputs change. */
import { colorLuma, parseCssColor, type Rgb } from './iso-materials';

const hex = (c: readonly number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const mix = (c: Rgb, target: number, amount: number) => hex(c.map(v => v + (target-v)*amount));

export function architecturalWallTone(rgb: Rgb, light: number): string {
  const luma=colorLuma(rgb), t=Math.max(0,Math.min(1,light));
  // White still has a shadow face; near-black still has a lit face.
  const darkBlend=Math.max(0,Math.min(1,(.35-luma)/.25));
  const shadow=.16*(1-t)+.015*t;
  const lift=.015*(1-t)+.11*t;
  return hex(rgb.map(v => v*(1-shadow*(1-darkBlend)) + (255-v)*lift*darkBlend));
}

export function architecturalFloorTone(color: string, wall: string, staticFill: boolean): string {
  if (!staticFill) return color;
  const rgb=parseCssColor(color), other=parseCssColor(wall);
  if (!rgb || !other) return color;
  const distance=Math.hypot(...rgb.map((v,i)=>v-other[i]));
  const similarity=Math.max(0,1-distance/75);
  if (!similarity) return color;
  const luma=colorLuma(rgb);
  return luma<.3 ? mix(rgb,255,.055*similarity) : mix(rgb,0,.065*similarity);
}
