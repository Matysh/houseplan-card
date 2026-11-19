// Raised room labels must keep their camera anchors, independent actions,
// live updates and scene lifetime through interaction.
import { check, finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const {page,browser}=await startIsoPaintScene();
await page.evaluate(()=>{
  const testPoint=CanvasRenderingContext2D.prototype.isPointInPath;
  window.__wallLightSamples=0;
  CanvasRenderingContext2D.prototype.isPointInPath=function(...args){
    window.__wallLightSamples++;
    return testPoint.apply(this,args);
  };
});
const snapshot=()=>page.evaluate(()=>{
  const card=window.__isoPaint,root=card.renderRoot;
  const layer=root.querySelector('.devlayer').getBoundingClientRect();
  return {layout:JSON.stringify(card._layout),
    labels:[...root.querySelectorAll('.iso-room-label-plane .roomlabel')].map(label=>{
      const plane=label.parentElement,r=label.getBoundingClientRect();
      const x=layer.left+parseFloat(label.style.left)*layer.width/100;
      const y=layer.top+parseFloat(label.style.top)*layer.height/100;
      return {error:Math.max(Math.abs((r.left+r.right)/2-x),Math.abs((r.top+r.bottom)/2-y)),
        width:r.width,mask:getComputedStyle(plane).maskImage,opacity:getComputedStyle(plane).opacity};
    }),builds:card._isoStructuralBuildCount,wallLightSamples:window.__wallLightSamples,
    wallLights:root.querySelectorAll('.iso-wall-light').length};
});
const aligned=({labels})=>labels.length===8&&labels.every(row=>row.error<=1&&row.mask==='none'&&row.opacity==='1');
try {
  const original=await snapshot();
  check('eight raised room labels stay readable above walls and furniture',aligned(original));
  check('the padded marker surface owns the projection while labels stay live',await page.evaluate(()=>{
    const root=window.__isoPaint.renderRoot;
    const surface=root.querySelector('[data-hp-marker-surface-active]');
    const layer=surface?.querySelector('.devlayer');
    return !!surface?.style.transform && !!layer && !layer.style.transform
      && getComputedStyle(surface).contain==='paint';
  }));
  check('each caption shadow blurs inside its own paint bounds', await page.evaluate(() => {
    const shadows = [...window.__isoPaint.renderRoot.querySelectorAll('.iso-room-label-shadow')];
    return shadows.length === 8 && shadows.every(node => node.getAttribute('filter') === 'url(#hp-iso-label-penumbra)'
      && !node.parentElement.hasAttribute('filter'));
  }));
  check('lit walls mount beside the original floor light',original.wallLights>0);
  for(const rotation of [0,90,180,270]) {
    await zoomIsoPaint(page,1);
    const before=await snapshot();
    const stage=await page.locator('.stage:not([inert])').first().boundingBox();
    await page.mouse.move(stage.x+20,stage.y+20);await page.mouse.down();
    await page.mouse.move(stage.x+110,stage.y+65,{steps:4});await page.mouse.up();await settleIsoPaint(page);
    const after=await snapshot();
    check(`camera ${rotation}: raised labels remain aligned without structural rebuild`,
      aligned(after)&&before.builds===after.builds);
    check('panning reuses the wall-light profile',
      before.wallLightSamples===after.wallLightSamples&&before.wallLights===after.wallLights);
    await page.locator('[data-hp="rotate-right"]').first().click();await settleIsoPaint(page);
  }
  await zoomIsoPaint(page,1);
  const beforeText=await snapshot();
  await page.evaluate(async()=>{const c=window.__isoPaint,next=structuredClone(c._serverCfg);next.spaces[0].rooms[0].name='A much longer fictional room name for live paint bounds';c._serverCfg=next;await c.updateComplete;});
  await settleIsoPaint(page);
  const afterText=await snapshot();
  check('live long label stays anchored',afterText.labels[0].width>beforeText.labels[0].width&&aligned(afterText));
  await page.locator('.roomlabel .rlfit').first().focus();
  check('room-fit remains keyboard focusable',await page.locator('.roomlabel .rlfit').first().evaluate(
    target=>target.getRootNode().activeElement===target));
  await page.keyboard.press('Tab');await page.mouse.move(5,5);
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
  check('floor change retires old label planes',await page.evaluate(()=>{
    const c=window.__isoPaint;return c._space==='iso-paint-empty'
      &&window.__isoOldPlanes.every(plane=>!plane.isConnected);
  }));
  await page.locator('[data-hp="space-tab"]').first().click();await settleIsoPaint(page);
  check('returning to the floor restores all raised labels',aligned(await snapshot()));
  check('all resources belong to the disconnected scene',await page.evaluate(async()=>{
    const card=window.__isoPaint,labels=[...card.renderRoot.querySelectorAll('.iso-room-label-plane .roomlabel')];
    card.remove();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return labels.length===8&&labels.every(label=>!label.isConnected);
  }));
  await page.evaluate(()=>document.getElementById('host').append(window.__isoPaint));await settleIsoPaint(page);
  const reconnected=await snapshot();
  check('reconnect restores the raised labels',aligned(reconnected));

  // Keep the first settled frame witness for animated navigation (#1470).
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>!window.__isoPaint._reducedMotion);
  await zoomIsoPaint(page,2.18);
  await page.evaluate(()=>{
    const c=window.__isoPaint,settle=c._settleCameraTransition;
    window.__isoAnimatedSettles=[];
    c._settleCameraTransition=function(state) {
      settle.call(this,state);
      requestAnimationFrame(()=>{
        const layer=c.renderRoot.querySelector('.devlayer').getBoundingClientRect();
        const rows=[...c.renderRoot.querySelectorAll('.iso-room-label-plane .roomlabel')].map(label=>{
          const r=label.getBoundingClientRect();
          const x=layer.left+parseFloat(label.style.left)*layer.width/100;
          const y=layer.top+parseFloat(label.style.top)*layer.height/100;
          return {error:Math.max(Math.abs((r.left+r.right)/2-x),Math.abs((r.top+r.bottom)/2-y))};
        });
        window.__isoAnimatedSettles.push({reason:state.reason,duration:state.duration,rows});
      });
    };
  });
  for(const [index,command] of ['zoom','fit','room'].entries()) {
    if(command==='zoom')await page.locator('[data-hp="zoom-in"]').first().click();
    if(command==='fit')await page.locator('[data-hp="zoom-fit"]').first().click();
    if(command==='room') {
      await page.locator('.roomlabel .rlfit').first().focus();await page.keyboard.press('Enter');
    }
    await page.waitForFunction(count=>window.__isoAnimatedSettles.length>count,index);
    const frame=await page.evaluate(index=>window.__isoAnimatedSettles[index],index);
    check(`animated ${command}: first settled frame has current anchors`,frame.duration>0&&frame.rows.length===8
      &&frame.rows.every(row=>row.error<=1));
    console.log('animated-first-frame',JSON.stringify({command,...frame}));
    await settleIsoPaint(page);
  }
  check('animated commands settle with eight aligned labels',aligned(await snapshot()));
} finally {await finish(browser,{});}
