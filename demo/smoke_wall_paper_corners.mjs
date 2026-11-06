/** #1327: paper and visible masonry agree at both mixed room/partition corners. */
import {readFileSync,mkdirSync} from 'node:fs';
import {launch,checkAll,finish} from './serve.mjs';
const cfg=JSON.parse(readFileSync(new URL('./fixtures/wall-paper-corners-1327.json',import.meta.url)));
const{page,browser}=await launch({width:1500,height:1250},1);
const out=await page.evaluate(async cfg=>{
 const c=window.__card,root=()=>c.shadowRoot||c.renderRoot;
 c._serverCfg=cfg;c._layout={};c._space=cfg.spaces[0].id;c._cfgEpoch++;c._modelCache=null;c._frame=null;c._wallUnionCache=null;
 const before=JSON.stringify(cfg.spaces[0].plan_graph),out={};
 for(const mode of ['view','plan']){
  c._setMode(mode);c.requestUpdate();await c.updateComplete;
  for(const zoom of [1,2.65]){
   c._applyView(zoom,2250,-850);c.requestUpdate();await c.updateComplete;
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const papers=[...root().querySelectorAll('.hp-paperg .hp-paper')],walls=[...root().querySelectorAll('.wallbody')];
   const fill=(elements,x,y)=>elements.some(e=>e.isPointInFill(new DOMPoint(x*1000,y*1000)));
   out[`${mode}-${zoom}-paper-and-masonry-exist`]=papers.length>0&&walls.length>0;
   for(const[i,p]of [[2.2227876402597895,-1.3552284971734196],[2.647000431438182,-.8069645555876516]].entries())
    out[`${mode}-${zoom}-corner-${i+1}-no-exposed-paper`]=!fill(papers,...p)||fill(walls,...p);
   out[`${mode}-${zoom}-room-floor-remains`]=fill(papers,1.48,-.94);
   out[`${mode}-${zoom}-triangle-void-remains`]=!fill(papers,2.26,-.81);
  }
 }
 out.graphUnchanged=JSON.stringify(c._serverCfg.spaces[0].plan_graph)===before;
 return out;
},cfg);
mkdirSync('artifacts/1327',{recursive:true});await page.screenshot({path:'artifacts/1327/card-fixed.png'});
console.log(JSON.stringify(out,null,2));checkAll(out);await finish(browser);
