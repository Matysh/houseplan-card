/** UI-062: presentation tones only; no saved colours or live light inputs change. */
import { colorLuma, parseCssColor, type Rgb } from './iso-materials';

const hex = (c: readonly number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const mix = (c: Rgb, target: number, amount: number) => hex(c.map(v => v + (target-v)*amount));

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
