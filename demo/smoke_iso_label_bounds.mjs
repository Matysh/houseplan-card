// Native contract: bounded paint must not alter room placement, independent
// hover/focus, furniture alpha, live invalidation, or resource lifetime.
import { check, finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const {page,browser}=await startIsoPaintScene();
const snapshot=()=>page.evaluate(()=>{
  const card=window.__isoPaint,root=card.renderRoot,stage=root.querySelector('.stage');
  return {config:JSON.stringify(card._serverCfg),layout:JSON.stringify(card._layout),
    resources:root.querySelectorAll('[id^="hp-room-label-wall-mask-"]').length,
    labels:[...root.querySelectorAll('.iso-room-label-plane')].map(plane=>{
      const label=plane.querySelector('.roomlabel'),r=label.getBoundingClientRect(),p=plane.getBoundingClientRect();
      return {id:label.dataset.id,bounded:plane.hasAttribute('data-hp-label-bounded'),
        inside:r.left>=p.left-1&&r.top>=p.top-1&&r.right<=p.right+1&&r.bottom<=p.bottom+1,
        fraction:plane.offsetWidth*plane.offsetHeight/(stage.clientWidth*stage.clientHeight),
        alpha:plane.style.opacity,mask:getComputedStyle(plane).maskImage,width:plane.offsetWidth};
    }),builds:card._isoStructuralBuildCount};
});
try {
  const original=await snapshot();
  check('eight independent bounded labels/masks',original.resources===8&&original.labels.length===8&&original.labels.every(label=>label.bounded&&label.inside&&label.fraction<.35));
  for(const rotation of [0,90,180,270]) {
    await zoomIsoPaint(page,1);
    const before=await snapshot();
    const stage=await page.locator('.stage:not([inert])').first().boundingBox();
    await page.mouse.move(stage.x+20,stage.y+20);await page.mouse.down();
    await page.mouse.move(stage.x+110,stage.y+65,{steps:4});await page.mouse.up();await settleIsoPaint(page);
    const after=await snapshot();
    check(`camera ${rotation}: bounded masks remain aligned without structural rebuild`,
      after.labels.every(label=>label.inside)&&after.resources===8&&before.builds===after.builds);
    await page.locator('[data-hp="rotate-right"]').first().click();await settleIsoPaint(page);
  }
  await zoomIsoPaint(page,1);
  const beforeText=await snapshot();
  await page.evaluate(async()=>{const c=window.__isoPaint,next=structuredClone(c._serverCfg);next.spaces[0].rooms[0].name='A much longer fictional room name for live paint bounds';c._serverCfg=next;await c.updateComplete;});
  await settleIsoPaint(page);
  const afterText=await snapshot();
  check('live long label grows its paint bounds without leaking masks',afterText.labels[0].width>beforeText.labels[0].width&&afterText.labels.every(label=>label.inside)&&afterText.resources===8);
  await page.locator('.roomlabel .rlfit').first().focus();
  const focused=await snapshot();
  check('native focus unmasks only its own label',focused.labels[0].mask==='none'&&focused.labels.slice(1).every(label=>label.mask!=='none'));
  await page.keyboard.press('Tab');await page.mouse.move(5,5);
  await page.evaluate(async()=>{const c=window.__isoPaint,id=c._serverCfg.spaces[0].rooms[0].id;
    c._layout={...c._layout,['rl_'+id]:{s:c._space,x:1.8,y:1.8}};await c.updateComplete;});
  await settleIsoPaint(page);
  const independent=await snapshot();
  check('uncovered label never inherits furniture alpha from its neighbours',
    independent.labels[0].alpha===''&&independent.labels.slice(1).some(label=>label.alpha==='0.3'));
  await page.evaluate(async saved=>{const c=window.__isoPaint;c._layout=JSON.parse(saved);await c.updateComplete;},original.layout);
  await page.evaluate(async()=>{const c=window.__isoPaint,next=structuredClone(c._serverCfg);next.spaces[0].rooms[0].name='Room 1.1';c._serverCfg=next;await c.updateComplete;});
  await settleIsoPaint(page);
  const end=await snapshot();
  check('paint/navigation never changes persisted layout or invokes writers',end.layout===original.layout&&await page.evaluate(()=>window.__isoPaintWrites.length===0));
  await page.evaluate(async()=>{
    const c=window.__isoPaint,next=structuredClone(c._serverCfg),source=next.spaces[0];
    const empty={...source,id:'iso-paint-empty',title:'Empty fixture floor',rooms:[],walls:[],
      wall_segments:[],openings:[],partitions:[],wall_columns:[],decor:[],stairs:[]};
    next.spaces.push(empty);c._serverCfg=next;
    window.__isoOldPlanes=[...c.renderRoot.querySelectorAll('.iso-room-label-plane')];
    await c.updateComplete;
  });
  await page.locator('[data-hp="space-tab"][data-space="iso-paint-empty"]').click();await settleIsoPaint(page);
  check('floor change retires old label planes and mask resources',await page.evaluate(()=>{
    const c=window.__isoPaint;return c._space==='iso-paint-empty'
      &&c.renderRoot.querySelectorAll('[id^="hp-room-label-wall-mask-"]').length===0
      &&window.__isoOldPlanes.every(plane=>!plane.isConnected);
  }));
  await page.locator('[data-hp="space-tab"]').first().click();await settleIsoPaint(page);
  check('returning to the floor recreates only its eight bounded resources',(await snapshot()).resources===8);
  check('all resources belong to the disconnected scene',await page.evaluate(async()=>{
    const card=window.__isoPaint,planes=[...card.renderRoot.querySelectorAll('.iso-room-label-plane')];
    card.remove();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return planes.length===8&&planes.every(plane=>!plane.isConnected);
  }));
  await page.evaluate(()=>document.getElementById('host').append(window.__isoPaint));await settleIsoPaint(page);
  const reconnected=await snapshot();
  check('reconnect resumes observers without duplicating masks',reconnected.resources===8&&reconnected.labels.every(label=>label.inside));
} finally {await finish(browser,{});}
