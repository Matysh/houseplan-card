import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const {PNG}=createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

// Independent lettering oracle: render the notice's text and computed typography
// in an oracle-owned manual popover, after capturing the unmodified product.
// This shares the document's actual loaded fonts, not a guessed font fallback.
// Only foreground glyph pixels are compared;
// a visible box, orange border or DOM presence cannot pass a covered message.
export async function toastPaint(page,notice,path){
 // Measure settled pixels without suppressing real presentation. Composed
 // ancestors include the actual HA/native modal containing the toast portal.
 await notice.evaluate(async element=>{
  await document.fonts.ready;
  const animations=[];
  for(let node=element;node;){
   if(node instanceof Element)animations.push(...node.getAnimations());
   node=node.assignedSlot||node.parentNode||(node instanceof ShadowRoot?node.host:null);
  }
  await Promise.allSettled(animations.filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });
 const spec=await notice.evaluate(n=>{
  const r=n.getBoundingClientRect(),s=getComputedStyle(n);
  return {text:n.textContent,css:[...s].map(k=>[k,s.getPropertyValue(k)]),
   fg:s.color.match(/[\d.]+/g).slice(0,3).map(Number),
   bg:s.backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number),
   box:{x:r.x,y:r.y,width:r.width,height:r.height}};
 });
 const {box}=spec,viewport=page.viewportSize();
 if(box.x<0||box.y<0||box.x+box.width>viewport.width+.5||box.y+box.height>viewport.height+.5)
  throw new Error('Notice is outside the viewport: '+JSON.stringify(box));
 const clip={x:Math.floor(box.x),y:Math.floor(box.y),width:Math.ceil(box.x+box.width)-Math.floor(box.x),height:Math.ceil(box.y+box.height)-Math.floor(box.y)};
 const actualBytes=await page.screenshot({clip});
 let expectedBytes,reference;
 try{
  reference=await notice.evaluateHandle((source,{text,css,box})=>{
   const n=document.createElement('div');n.popover='manual';n.textContent=text;
   for(const [k,v] of css)n.style.setProperty(k,v);
   Object.assign(n.style,{position:'fixed',left:box.x+'px',top:box.y+'px',right:'auto',bottom:'auto',transform:'none',margin:'0'});
   source.parentElement.append(n);n.showPopover();return n;
  },spec);
  expectedBytes=await page.screenshot({clip});
 }finally{if(reference){await reference.evaluate(n=>n.remove());await reference.dispose();}}
 const match=toastInkMatch(actualBytes,expectedBytes,spec.fg,spec.bg);
 mkdirSync('artifacts/956',{recursive:true});
 writeFileSync(path+'-actual.png',actualBytes);writeFileSync(path+'-reference.png',expectedBytes);writeFileSync(path+'-ink.png',match.diff);
 return {...match,diff:undefined,text:spec.text,box};
}

export function toastInkMatch(actualBytes,expectedBytes,fg,bgColor){
 const a=PNG.sync.read(actualBytes),e=PNG.sync.read(expectedBytes),diff=new PNG({width:a.width,height:a.height});
 let ink=0,matched=0;
 const luminance=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 const bg=luminance(bgColor),contrast=luminance(fg)-bg;
 for(let y=7;y<e.height-7;y++)for(let x=7;x<e.width-7;x++){
  const i=(y*e.width+x)*4;
  if(fg.every((c,k)=>Math.abs(e.data[i+k]-c)<18)){
   ink++;let pass=false;
   // The genuine HA modal may be on a composited fractional transform. Allow
   // one physical pixel of glyph raster phase, never a blank box/background.
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const j=((y+dy)*a.width+x+dx)*4;
    // Native/HA compositing can choose LCD rather than grayscale glyph AA.
    // Compare actual ink contrast, not RGB equality to a grayscale reference.
    if(Math.abs(contrast)>80&&(luminance(a.data.subarray(j,j+3))-bg)/contrast>.5)pass=true;
   }
   if(pass)matched++;
   diff.data.set(pass?[0,180,0,255]:[255,0,0,255],i);
  }
 }
 return {ink,matched,ratio:matched/ink,painted:ink>20&&matched/ink>.92,diff:PNG.sync.write(diff)};
}
