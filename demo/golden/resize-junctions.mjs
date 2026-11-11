// Real pointer gestures; regression and golden share this scene preparation.
export async function resizeJunctionPointer(page, from=.5, to=.6, release=true) {
  const point=await page.evaluate(({from,to})=>{
    const card=window.__goldenCard;
    const h=[...card.renderRoot.querySelectorAll('.rszhandle')].find(h=>h.getAttribute('aria-disabled')==='false'
      &&Math.abs(+h.getAttribute('cx')-from*1000)<.01&&Math.abs(+h.getAttribute('cy')-300)<.01);
    if(!h)throw Error(`Resize junction handle missing at ${from}`);
    const ctm=h.getScreenCTM();
    const a=new DOMPoint(from*1000,300).matrixTransform(ctm),b=new DOMPoint(to*1000,300).matrixTransform(ctm);
    return {a:{x:a.x,y:a.y},b:{x:b.x,y:b.y}};
  },{from,to});
  await page.mouse.move(point.a.x,point.a.y);await page.mouse.down();
  await page.mouse.move(point.b.x,point.b.y,{steps:4});
  await page.evaluate(()=>window.__goldenCard._editorRuntime._whenLiveEditorSettled());
  const observed=await page.evaluate(()=>{
    const c=window.__goldenCard;
    return {delta:c._resize.delta,dragging:c._resize.dragging,preview:!!c._resize.preview,
      doorX:c._resize.preview?.sp?.openings?.find(o=>o.id==='moving-door')?.x,
      toast:c._toast,limit:c._rszLimitViolation};
  });
  if(Math.abs(Math.abs(observed.delta)-Math.abs(to-from)*1000)>.02||!observed.preview||Math.abs(observed.doorX-to)>1e-8)
    throw Error(`Resize pointer did not reach its target: ${JSON.stringify(observed)}`);
  if(release){
    await page.mouse.up();await waitResizeJunctionSaved(page,to);
    const result=await page.evaluate(async()=>{
      const c=window.__goldenCard,r=await c.hass.callWS({type:'houseplan/config/get'});
      return {savedX:r.config.spaces[0].openings.find(o=>o.id==='moving-door').x,
        clientX:c._serverCfg.spaces[0].openings.find(o=>o.id==='moving-door').x,toast:c._toast,
        writes:window.__resizeJunctionWrites?.map(m=>({rev:m.expected_rev,x:m.config.spaces[0].openings.find(o=>o.id==='moving-door')?.x}))};
    });
    if(Math.abs(result.savedX-to)>1e-8)throw Error(`Resize release failed: ${JSON.stringify(result)}`);
  }
}
export async function waitResizeJunctionSaved(page,x) {
  // The config writer is debounced; updateComplete/_writeChain alone can
  // precede that timer. Wait for the backend ACK's document, not a timeout.
  await page.evaluate(async x=>{
    const started=performance.now();
    for(;;){
      const c=window.__goldenCard,r=await c.hass.callWS({type:'houseplan/config/get'});
      const actual=r.config.spaces[0].openings.find(o=>o.id==='moving-door').x;
      if(Math.abs(actual-x)<1e-8)return;
      if(performance.now()-started>7000)throw Error(`Resize ACK ${actual}, wanted ${x}; ${c._toast}`);
      await new Promise(r=>requestAnimationFrame(r));
    }
  },x);
  await settleResizeJunction(page);
}
export async function settleResizeJunction(page) {
  await page.evaluate(async()=>{
    const card=window.__goldenCard;await card.updateComplete;await card._writeChain;
    await card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  });
}
export async function resizeJunctionPaintProbe(page) {
  return page.evaluate(()=>{
    const root=window.__goldenCard.renderRoot;
    const visible=path=>{
      for(let e=path;e&&e!==root;e=e.parentElement){
        const s=getComputedStyle(e);if(s.visibility==='hidden'||s.display==='none'||+s.opacity===0)return false;
      }
      return true;
    };
    const paths=[...root.querySelectorAll('.wallbodies path.wallbody')].filter(visible);
    const inside=(x,y)=>paths.some(p=>p.isPointInFill(new DOMPoint(x*1000,y*1000)));
    const stroke=(x,y)=>paths.some(p=>p.isPointInStroke(new DOMPoint(x*1000,y*1000)));
    return {oldWallGone:!inside(.5,.18),newWall:inside(.6,.18),
      staleSnapGone:![...root.querySelectorAll('.plan-snap-line')].some(p=>visible(p)&&p.isPointInStroke(new DOMPoint(500,180))),
      openingClear:!inside(.6,.3),teeHasNoInternalStroke:!stroke(.6,.5),cornerHasNoInternalStroke:!stroke(.1,.1)};
  });
}
export async function prepareResizeJunctions(page,scenario) {
  if(!await page.locator('[data-hp="tool"][data-tool="resize"]').count())
    await page.locator('[data-hp="tool"][data-tool="rooms"]').click();
  await page.locator('[data-hp="tool"][data-tool="resize"]').click();
  await page.waitForFunction(()=>!window.__goldenCard._modeTransitionBusy);
  await settleResizeJunction(page);
  if(scenario.resizeJunction.phase!=='before')
    await resizeJunctionPointer(page,.5,.6,scenario.resizeJunction.phase==='after');
  const result=await page.evaluate(()=>{
    const card=window.__goldenCard;
    return {dragging:card._resize.dragging,delta:card._resize.delta,
      liveWalls:!!card.renderRoot.querySelector('.hp-live-resize .wallbodies'),
      openings:card._serverCfg.spaces.find(s=>s.id===card._space).openings.length};
  });
  if(scenario.resizeJunction.phase!=='before'){
    result.paint=await resizeJunctionPaintProbe(page);
    if(Object.values(result.paint).some(value=>!value))throw Error(`Resize junction paint: ${JSON.stringify(result.paint)}`);
    if(scenario.resizeJunction.phase==='during'&&(!result.dragging||Math.abs(Math.abs(result.delta)-100)>.01))
      throw Error(`Resize did not hold requested preview: ${JSON.stringify(result)}`);
    if(scenario.resizeJunction.phase==='after'){
      const x=await page.evaluate(async()=>{
        const c=window.__goldenCard,r=await c.hass.callWS({type:'houseplan/config/get'});
        return r.config.spaces[0].openings.find(o=>o.id==='moving-door').x;
      });
      if(Math.abs(x-.6)>1e-8)throw Error(`Resize did not persist requested room: ${x}`);
    }
  }
  return result;
}
