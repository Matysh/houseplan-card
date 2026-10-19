import {createRequire} from 'node:module';
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

/** Measure visible button lettering separately from its typographic line box. */
export async function buttonPaint(button) {
 const geometry=await button.evaluate(b=>{
  const r=b.getBoundingClientRect(),walker=document.createTreeWalker(b,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.textContent.trim()&&!n.parentElement.closest('ha-icon')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});let n,text;
  while(n=walker.nextNode()){text=document.createRange();text.selectNodeContents(n);}const t=text.getBoundingClientRect();
  const svg=root=>root.querySelector('svg')||[...root.querySelectorAll('*')].flatMap(n=>n.shadowRoot?[svg(n.shadowRoot)]:[]).find(Boolean);
  const icon=b.querySelector('ha-icon'),i=icon&&svg(icon.shadowRoot||icon)?.getBoundingClientRect();
  const label=b.querySelector('.hpf-save-label')?.getBoundingClientRect();
  return {left:t.left-r.left,right:t.right-r.left,height:r.height,iconOffset:i?(i.top+i.bottom-r.top-r.bottom)/2:null,labelOffset:label?(label.top+label.bottom-r.top-r.bottom)/2:null};
 });
 const png=PNG.sync.read(await button.screenshot()),sample=(4*png.width+Math.floor(png.width/2))*4,bg=[...png.data.slice(sample,sample+3)];
 let top=png.height,bottom=-1;
 for(let y=3;y<png.height-3;y++)for(let x=Math.ceil(geometry.left);x<Math.floor(geometry.right);x++){
  if([0,1,2].some(k=>Math.abs(png.data[(y*png.width+x)*4+k]-bg[k])>35)){top=Math.min(top,y);bottom=Math.max(bottom,y);}
 }
 return {height:geometry.height,iconOffset:geometry.iconOffset,labelOffset:geometry.labelOffset,textInkOffset:bottom<top?null:(top+bottom+1-png.height)/2};
}

// #963's frozen prototype supersedes #955's optical translation. Keep actual
// lettering present and centre the unshifted label beside the check. The paired
// frozen-reference smoke independently compares PNG ink in four locales/themes.
export function approvedSavePaint(paint) {
 return paint.height>=44&&paint.textInkOffset!==null&&paint.labelOffset!==null
   &&Math.abs(paint.labelOffset)<=.25&&Math.abs(paint.iconOffset)<=.25;
}
