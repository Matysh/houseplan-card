// Both proposals augment the real plan; no alternate page, scene or fixture.
const {card}=window.__lab;
globalThis.__hpNativePrototypes=true;
if(new URL(location).searchParams.has('prototype')){const url=new URL(location);url.searchParams.delete('prototype');history.replaceState(null,'',url);}
await card._ensureEditorRuntime();
window.__nativeProposalCard=card;
// The old native labels cover only the grabbed room. Retain the accepted
// geometry passed to their builder so this layer can measure both owners.
let resizeFrame;
const nativeResizeLabels=card._editorRuntime._rszEdgeLabels;
card._editorRuntime._rszEdgeLabels=function(result,plan,...args){
  const labels=nativeResizeLabels.call(this,result,plan,...args);
  resizeFrame={plan,polys:result.polys};
  return labels;
};

// Freeze the same physical reference used by static selection before the
// first move, including a drag that starts without a preceding selection click.
const nativeOpeningDown=card._editorRuntime._opPointerDown;
card._editorRuntime._opPointerDown=function(...args){
  const result=nativeOpeningDown.apply(this,args);
  if(card._opDrag&&!card._opDrag.moved)this.properties.reference(this.properties.target());
  return result;
};
// The native angle badge keeps its current position and exact-45 indication;
// only its linear measurement moves into the shared dimension renderer.
for(let proto=card;proto;proto=Object.getPrototypeOf(proto)){
  const measure=Object.getOwnPropertyDescriptor(proto,'_decorMeasure');
  if(!measure?.get)continue;
  Object.defineProperty(card,'_decorMeasure',{configurable:true,get(){
    const value=measure.get.call(this);
    return value&&this._decorDraft?.kind==='line'?{...value,text:value.text.split(' · ').at(-1)}:value;
  }});
  break;
}

const ns='http://www.w3.org/2000/svg';
const layer=document.createElementNS(ns,'svg');layer.dataset.labNativeDimensions='1381';
layer.style.cssText='position:fixed;pointer-events:none;z-index:8;overflow:hidden;display:none';
card.shadowRoot.append(layer);
const style=document.createElement('style');
// Permanent for this prototype: native paint can precede the dimension overlay
// by a frame on pointerdown/up. Never re-enable the retired axis decoration.
style.textContent=`.rszmeasurehalo,.rszmeasureink,[data-hp=resize-length-label],.opening-dimensions,.opshoulder,.spacingguides{visibility:hidden!important}
/* Retire only the selected opening's old reference rail and end circle.
   Its dashed selection, pivot and door hinge remain native. */
.hp-prop-selection:has(>path[stroke-dasharray="4 3"])>path[d*="l"],
.hp-prop-selection:has(>path[stroke-dasharray="4 3"]):has(>path[d*="l"])>circle:last-of-type{visibility:hidden!important}`;
card.shadowRoot.append(style);
const norm=1000;
const point=p=>[p[0]*norm,p[1]*norm];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const mul=(a,k)=>[a[0]*k,a[1]*k];
const length=a=>Math.hypot(...a);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function screenSide(u){const n=[u[1],-u[0]];return n[1]>1e-6||Math.abs(n[1])<1e-6&&n[0]>0?mul(n,-1):n;}
const openingDimension=ref=>({a:ref.from,b:ref.to,normal:ref.labelNormal,direction:ref.axis,distance:ref.distance,role:'opening-gap'});
const visible=el=>{const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0';};
let previousKey='',ringCache,edgeCache=[];
function boundaryEdges(geom){
  if(geom===ringCache)return edgeCache;
  ringCache=geom;edgeCache=[];
  for(const polygon of geom||[])for(const ring of polygon||[])for(let i=1;i<ring.length;i++){
    if(length(sub(ring[i],ring[i-1]))>.001)edgeCache.push([ring[i-1],ring[i]]);
  }
  return edgeCache;
}
function pathEdges(d){
  const tokens=(d||'').match(/[MLZmlz]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)||[];
  const edges=[];let previous,first;
  for(let i=0;i<tokens.length;){
    const token=tokens[i++];if(/[mMlL]/.test(token)){
      const p=[Number(tokens[i++]),Number(tokens[i++])];
      if(token.toUpperCase()==='M')first=p;else if(previous)edges.push([previous,p]);previous=p;
    }else if(token.toUpperCase()==='Z'&&first&&previous){edges.push([previous,first]);previous=null;}
  }
  return edges;
}
function transverseBounds(wall,walls,dist){
  const a=wall.a,b=wall.b,len=length(sub(b,a)),u=mul(sub(b,a),1/len),n=[-u[1],u[0]];
  const origin=add(a,mul(n,dist)),bounds=[0,len];
  for(const other of walls||[]){
    const size=length(sub(other.b,other.a));if(size<.01||!(other.cm>0))continue;
    const v=mul(sub(other.b,other.a),1/size),normal=[-v[1],v[0]],denom=dot(u,normal);
    if(Math.abs(denom)<.1)continue;
    const half=other.cm/card._cellCm*card._gridPitch/2;
    const center=dot(sub(other.a,origin),normal)/denom,extent=half/Math.abs(denom);
    for(const [index,end] of [a,b].entries()){
      const t=dot(sub(end,other.a),v);
      if(Math.abs(dot(sub(end,other.a),normal))>.1||t<-.1||t>size+.1)continue;
      bounds[index]=index===0?Math.min(bounds[0],center-extent):Math.max(bounds[1],center+extent);
    }
  }
  return bounds;
}
function sideIntervals(wall,edges,walls){
  const a=wall.a,b=wall.b,len=length(sub(b,a));if(len<.01)return[];
  const u=mul(sub(b,a),1/len),n=[-u[1],u[0]],half=wall.cm/card._cellCm*card._gridPitch/2;
  const sides=[];
  for(const sign of [-1,1]){
    const bounds=transverseBounds(wall,walls,sign*half);
    if(sign===wall.outerSign&&half>0){
      const origin=add(a,mul(n,sign*half));
      sides.push({from:bounds[0],to:bounds[1],a:add(origin,mul(u,bounds[0])),b:add(origin,mul(u,bounds[1])),normal:mul(n,sign),axis:false,outer:true});
      continue;
    }
    const candidates=[];
    if(half>0)for(const [p,q] of edges){
      const delta=sub(q,p),size=length(delta);
      if(Math.abs(cross(u,delta))/size>.001)continue;
      const dist=dot(sub(p,a),n);if(Math.abs(dist-sign*half)>Math.max(.07,half*.015))continue;
      const pa=dot(sub(p,a),u),pb=dot(sub(q,a),u),low=Math.min(pa,pb),high=Math.max(pa,pb);
      // Join patches can lie entirely beyond an axis endpoint. Keep their
      // collinear face so the dimension starts at the visible mitred corner.
      if(wall.contourFace ? high<-.1||low>len+.1 : high<bounds[0]||low>bounds[1])continue;
      // Bound a continuous facade by the OUTER faces of both transverse walls,
      // using each transverse wall's own thickness (never the measured wall's).
      // Draw and node moves supply the actual joined silhouette, including mitres
      // and butt-end trims. Do not reconstruct or clamp its corners by axes.
      const lo=wall.contourFace?low:Math.max(low,bounds[0]),hi=wall.contourFace?high:Math.min(high,bounds[1]);
      if(hi-lo<.001)continue;
      candidates.push({from:lo,to:hi,a:add(add(a,mul(u,lo)),mul(n,dist)),b:add(add(a,mul(u,hi)),mul(n,dist)),normal:mul(n,sign),axis:false});
    }
    candidates.sort((x,y)=>x.from-y.from);
    if(candidates.length===1&&candidates[0].to-candidates[0].from<len*.15)candidates.length=0;
    const merged=[];
    for(const c of candidates){
      const last=merged.at(-1);
      // An opening interrupts the visible face but not its overall dimension.
      // A solid junction does interrupt it: never bridge through another wall.
      const openingGap=last&&c.from>last.to+.1&&wall.containsMasonry&&last.to>=0&&c.from<=len
        &&[.25,.5,.75].every(t=>!wall.containsMasonry(add(add(a,mul(u,last.to+(c.from-last.to)*t)),mul(n,sign*half))));
      if(last&&(c.from<=last.to+.1||openingGap)){if(c.to>last.to){last.to=c.to;last.b=c.b;}}else merged.push(c);
    }
    if(!merged.length){const offset=mul(n,sign*half);merged.push({a:add(a,offset),b:add(b,offset),normal:mul(n,sign),axis:true});}
    sides.push(...merged);
  }
  return sides;
}
const records=sp=>[...(sp?.wall_segments||[]),...(sp?.partitions||[])].filter(w=>w.a&&w.b);
const spacingChainCache=new WeakMap();
function spacingChain(row){
  let gaps=spacingChainCache.get(row);if(gaps)return gaps;
  // The native target stores the far reference gap and the new end gap of
  // one continuous equal-step row. Expand its presentation across the entire
  // existing chain; the magnet's targets and captured position stay untouched.
  const ends=row.gaps.flat(),from=Math.min(...ends),to=Math.max(...ends);
  const count=Math.round((to-from)/row.d);
  gaps=Number.isFinite(count)&&count>0&&Math.abs(count*row.d-(to-from))<1e-6
    ?Array.from({length:count},(_,i)=>[from+i*row.d,from+(i+1)*row.d]):row.gaps;
  spacingChainCache.set(row,gaps);return gaps;
}
function readContext(){
  const r=card._editorRuntime;if(!r||card._openingDialog||card._roomDialog||card._editorSecondaryDialogBlocked)return null;
  if(card._mode==='decor'){
    if(card._decorDraft?.kind!=='line')return null;
    const line=[...card.shadowRoot.querySelectorAll('line.ddraft')].filter(visible).at(-1);if(!line)return null;
    const a=[+line.getAttribute('x1'),+line.getAttribute('y1')],b=[+line.getAttribute('x2'),+line.getAttribute('y2')];
    const size=length(sub(b,a));if(size<.001)return null;
    const direction=mul(sub(b,a),1/size);
    return {kind:'decor-line',dimensions:[{a,b,direction,normal:screenSide(direction),distance:size,role:'line-length'}]};
  }
  if(card._mode==='devices'){
    const drag=card._deviceDrag,magnet=drag?.spacing;
    if(!drag?.moved||drag.contact?.hint||!magnet?.hint.length||!(magnet.scale>0))return null;
    return {kind:'device-spacing',dimensions:magnet.hint.flatMap(row=>spacingChain(row).map(([a,b])=>({
      a:row.axis==='h'?[a,row.line]:[row.line,a],b:row.axis==='h'?[b,row.line]:[row.line,b],
      direction:row.axis==='h'?[1,0]:[0,1],normal:row.axis==='h'?[0,-1]:[-1,0],
      distance:row.d,clearance:magnet.clear,role:'device-center-gap'})))};
  }
  if(card._mode!=='plan'||r.physicalGesture?.drag)return null;
  if(card._opDrag?.moved){
    const drag=card._opDrag,target=r.properties.target();
    if(target?.kind!=='opening'||target.value.id!==drag.id)return null;
    const reference=r.properties.reference({...target,value:drag.preview||target.value});
    if(!reference||!Number.isFinite(reference.distance)||reference.distance<0)return null;
    return {kind:'opening-drag',openingId:drag.id,reference,dimensions:[openingDimension(reference)]};
  }
  if(card._tool==='opening'){
    const dimensions=card._openingPreview?.measure?.labels.flatMap(label=>label.dimension?[openingDimension(label.dimension)]:[])||[];
    return dimensions.length?{kind:'opening-place',dimensions}:null;
  }
  const node=r.nodeMove?.session;
  if(node?.moved&&node.candidate){
    if(node.invalid||node.outline)return null;
    const preview=globalThis.__hpLabNodeGeometry;
    if(!preview)return null;
    const before=new Map(records(node.plan.source).map(w=>[w.id,w]));
    const walls=records(preview.source).filter(w=>{const old=before.get(w.id);return !old||JSON.stringify([old.a,old.b])!==JSON.stringify([w.a,w.b]);});
    // roomGeom excludes standalone partitions. Their joined corners are in
    // the same native preview's masonry paths (exclude the old ghost copy).
    const body=card.shadowRoot.querySelector('[data-hp-node-live="2"] > .wallbodies');
    const paths=[...body?.querySelectorAll(':scope > path')||[]];
    const paintedEdges=paths.flatMap(p=>pathEdges(p.getAttribute('d')));
    const containsMasonry=p=>paths.some(path=>path.isPointInFill(new DOMPoint(...p)));
    // Mixing room-only masonry with the final union resurrects faces buried
    // by a partition at a multi-wall joint. Measure only the visible union.
    return {kind:'node',walls:walls.map(w=>({...w,a:point(w.a),b:point(w.b),contourFace:true,containsMasonry})),supports:[],edges:paintedEdges};
  }
  if(card._tool==='draw'&&card._measureAnchor&&card._cursorPt){
    const visible=el=>{const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none';};
    // Cursor state can be one frame ahead of native ink. Read the active axis
    // from the SAME painted frame as its faces, never from the live pointer.
    const axis=[...card.shadowRoot.querySelectorAll('.active-axis')].filter(visible).at(-1);
    if(!axis)return null;
    const a=[+axis.getAttribute('x1'),+axis.getAttribute('y1')],b=[+axis.getAttribute('x2'),+axis.getAttribute('y2')];
    // Native live paint hides the retained previous frame. Reading both layers
    // mixed old caps with the current corner, especially on the next turn.
    const paths=[...card.shadowRoot.querySelectorAll('.drawwall-preview-fill')].filter(visible);
    const edges=paths.flatMap(p=>pathEdges(p.getAttribute('d')));
    return {kind:'draw',walls:[{a,b,cm:card._drawWallCm||0,contourFace:true}],supports:[],edges};
  }
  const labels=card._resize?.liveLabels?.filter(l=>l.kind==='length');
  if(card._tool==='resize'&&labels?.length){
    const source=(card._spaceWalls||[]).filter(w=>w.a&&w.b).map(w=>({...w,a:point(w.a),b:point(w.b)}));
    const plan=card._resize.plan;
    if(resizeFrame?.plan!==plan)return null;
    const measured=plan.roomIds.flatMap(roomId=>{
      const poly=resizeFrame.polys[roomId],moving=plan.edgeByRoom[roomId];
      if(!poly?.length||moving==null)return [];
      const winding=Math.sign(poly.reduce((sum,p,i)=>sum+cross(p,poly[(i+1)%poly.length]),0));
      return [(moving-1+poly.length)%poly.length,(moving+1)%poly.length].map(edge=>({roomId,a:poly[edge],b:poly[(edge+1)%poly.length],winding}));
    });
    const walls=measured.map(({roomId,a,b,winding})=>{
      const len=length(sub(b,a)),u=mul(sub(b,a),1/len);
      const matching=source.filter(w=>Math.abs(cross(u,sub(w.b,w.a)))<.1&&Math.abs(cross(u,sub(w.a,a)))<.1)
        .map(w=>({w,overlap:Math.min(len,Math.max(dot(sub(w.a,a),u),dot(sub(w.b,a),u)))-Math.max(0,Math.min(dot(sub(w.a,a),u),dot(sub(w.b,a),u)))}))
        .filter(x=>x.overlap>.1).sort((x,y)=>y.overlap-x.overlap);
      return {roomId,a,b,cm:matching[0]?.w.cm??0,outerSign:winding?-winding:undefined};
    });
    return {kind:'resize',walls,supports:source,geom:globalThis.__hpLabResizeGeometry||card._wallUnionGeometry()?.roomGeom};
  }
  const target=r.properties.target();
  if(card._tool==='select'&&target?.kind==='opening'){
    const reference=r.properties.reference(target);
    if(!reference||!Number.isFinite(reference.distance)||reference.distance<0)return null;
    return {kind:'opening',openingId:target.value.id,reference,
      dimensions:[openingDimension(reference)]};
  }
  if(card._tool==='select'&&['contour','partition'].includes(target?.kind))return {kind:'select',walls:[{...target.value,a:point(target.value.a),b:point(target.value.b)}],geom:card._wallUnionGeometry()?.roomGeom};
  return null;
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const segment=(a,b)=>`<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}"/>`;
function paint(){
  const ctx=readContext(),svg=card.shadowRoot.querySelector('svg.plan-svg[data-hp=stage]');
  if(!ctx||!svg){layer.style.display='none';card.removeAttribute('data-lab-dimensions');previousKey='';return;}
  const rotation=svg.querySelector('[data-hp-plan-rotation-frame]')||svg,matrix=rotation.getScreenCTM();if(!matrix)return;
  const rect=svg.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
  const key=JSON.stringify([ctx.kind,ctx.openingId,ctx.dimensions,ctx.walls,ctx.supports,ctx.geom,ctx.edges,matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f,rect.x,rect.y,rect.width,rect.height]);if(key===previousKey&&layer.isConnected)return;previousKey=key;
  card.setAttribute('data-lab-dimensions','');
  const toScreen=p=>[matrix.a*p[0]+matrix.c*p[1]+matrix.e-rect.left,matrix.b*p[0]+matrix.d*p[1]+matrix.f-rect.top];
  const edges=ctx.edges||boundaryEdges(ctx.geom);
  const supports=ctx.dimensions?[]:ctx.supports||(card._spaceWalls||[]).filter(w=>w.a&&w.b).map(w=>({...w,a:point(w.a),b:point(w.b)}));
  const dims=ctx.dimensions||ctx.walls.flatMap(w=>sideIntervals(w,edges,supports));
  const ink=card._spaceDisplayForRender?.().color||'#444';
  const uniq=new Set(),occupied=[];let output=`<g fill="none" stroke="${escape(ink)}" stroke-width="1">`,text='';
  for(const el of card.shadowRoot.querySelectorAll('.hp-prop-selection text,.rszarealabel,.hp-node-layer text,.dmeasure')){if(!visible(el))continue;const b=el.getBoundingClientRect();occupied.push({x:b.x-rect.x-4,y:b.y-rect.y-4,w:b.width+8,h:b.height+8});}
  const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  for(const d of dims){
    const cm=(d.distance??length(sub(d.b,d.a)))*card._cellCm/card._gridPitch;if(!Number.isFinite(cm)||(ctx.dimensions?cm<0:cm<=.01))continue;
    const identity=JSON.stringify([d.a,d.b,d.normal]);if(uniq.has(identity))continue;uniq.add(identity);
    const a=toScreen(d.a),b=toScreen(d.b),delta=sub(b,a),len=length(delta);if(len<.01&&!d.direction)continue;
    const direction=len<.01?sub(toScreen(add(d.a,d.direction)),a):delta;
    const u=mul(direction,1/length(direction)),transformed=sub(toScreen(add(d.a,d.normal)),a),n=mul(transformed,1/length(transformed));
    const formatted=card.hass?.config?.unit_system?.length==='mi'?card._fmtLen(d.a,d.b):`${(cm/100).toFixed(3)} m`;
    const label=formatted;
    const tw=label.length*6.3+8;
    let offset=12+(d.clearance?length(sub(toScreen(add(d.a,mul(d.normal,d.clearance))),a)):0),ta,tb,mid,box;
    for(let attempt=0;attempt<6;attempt++){
      ta=add(a,mul(n,offset));tb=add(b,mul(n,offset));
      mid=mul(add(ta,tb),.5);box={x:mid[0]-tw/2,y:mid[1]-8,w:tw,h:16};
      if(!occupied.some(o=>intersects(box,o)))break;offset+=16;
    }
    occupied.push(box);
    // Every witness starts at the exact measured corner and stays normal to
    // its wall. Never shorten the rail by sliding its endpoints along the wall.
    const leader=(p,t)=>segment(p,add(t,mul(n,4)));
    output+=leader(a,ta)+leader(b,tb)+`<path class="lab-dimension-rail" stroke="var(--accent-color,var(--primary-color,#03a9f4))" d="M${ta[0]} ${ta[1]}L${tb[0]} ${tb[1]}"/>`;
    d.rail={a:ta,b:tb};
    for(const p of [ta,tb])output+=segment(sub(p,mul(add(u,n),2)),add(p,mul(add(u,n),2)));
    if(len<tw+8){const moved=add(mid,mul(n,18));output+=segment(mid,moved);mid=moved;box.y+=n[1]*18;box.x+=n[0]*18;}
    text+=`<rect x="${mid[0]-tw/2}" y="${mid[1]-8}" width="${tw}" height="16" rx="2" fill="var(--card-background-color,#fff)" fill-opacity=".94"/><text x="${mid[0]}" y="${mid[1]+4}" text-anchor="middle" font-size="12" font-family="Roboto,Arial,sans-serif" fill="var(--primary-text-color,#444)">${escape(label)}</text>`;
  }
  layer.style.cssText=`position:fixed;pointer-events:none;z-index:8;overflow:hidden;display:block;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
  layer.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);layer.innerHTML=output+'</g>'+text;
  if(!layer.isConnected)card.shadowRoot.append(layer);
  window.__hpLabDimensions={context:ctx.kind,count:uniq.size,segments:dims,...(ctx.reference?{openingId:ctx.openingId,reference:ctx.reference}:{}),...(ctx.kind==='resize'?{rooms:[...new Set(ctx.walls.map(w=>w.roomId))],measuredWalls:ctx.walls}:{})};
}
function safePaint(){try{paint();}catch(error){console.warn('Local dimension prototype:',error);layer.style.display='none';}}
// Paint dimensions after each native DOM commit, before that frame reaches the
// screen. Native scene layers use several SVGs; observe their shared stage.
// The dimension overlay is outside it, so its writes cannot loop.
const drawObserver=new MutationObserver(safePaint);
let observedStage;
function tick(){
  const stage=card.shadowRoot.querySelector('.stage');
  if(stage!==observedStage){drawObserver.disconnect();observedStage=stage;if(stage)drawObserver.observe(stage,{subtree:true,childList:true,attributes:true,attributeFilter:['d','points','x1','y1','x2','y2','style','transform','viewBox']});}
  safePaint();setTimeout(()=>requestAnimationFrame(tick),32);
}
tick();
