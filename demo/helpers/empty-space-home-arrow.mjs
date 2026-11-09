import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {waitForUiKitPaint} from './ui-kit-paint.mjs';
import {clickHeaderAction} from './header-actions.mjs';

/** #1329: genuine create dialogs, pointer pan and Fit. The server-event fixture
 * owns content changes; only observations read internal camera/frame state. */
export async function emptySpaceHomeArrow(page) {
  await page.evaluate(()=>{
    const config={model_version:11,spaces:[],markers:[],settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}};
    window.__card.remove();localStorage.clear();window.__pushServerConfig(config);
    const hass=window.__mkHass(),call=hass.callWS.bind(hass);
    hass.user={id:'empty-home',name:'Synthetic admin',is_admin:true};
    hass.devices={};hass.entities={};hass.areas={};hass.floors={};hass.states={};
    window.__emptyHomeWrites=[];
    hass.callWS=message=>{
      if(/registry\/list$/.test(message.type))return Promise.resolve([]);
      if(/^houseplan\/(?:config\/set|layout\/(?:set|update|delete))$/.test(message.type))window.__emptyHomeWrites.push(message.type);
      return call(message);
    };
    const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card',language:'en'});
    document.querySelector('#host').replaceChildren(card);window.__card=card;card.hass=hass;
  });
  await page.locator('hp-dialog[data-kind="onboarding"]').waitFor();
  await page.evaluate(()=>{
    const card=window.__card;
    window.__emptyHomeFlashes=[];
    const sample=()=>{
      const space=card._serverCfg?.spaces?.find(s=>s.id===card._space);
      const empty=space&&!space.plan_url&&![space.rooms,space.partitions,space.wall_segments,space.decor,space.stairs,space.openings,space.plan_graph?.edges]
        .some(list=>list?.length);
      if(empty&&space.title.startsWith('Empty 1329')&&card._frame?.id===space.id&&card.renderRoot.querySelector('.homearrow'))
        window.__emptyHomeFlashes.push({space:space.id,view:{...card._view}});
    };
    window.__emptyHomeObserver=new MutationObserver(sample);
    window.__emptyHomeObserver.observe(card.renderRoot,{subtree:true,childList:true,attributes:true});
  });
  const create=async(title,first)=>{
    if(!first)await clickHeaderAction(page.locator('houseplan-card').first(),'space-add');
    const dialog=page.locator(`hp-dialog[data-kind="${first?'onboarding':'space'}"]:not([inert])`);
    await dialog.locator(first?'input[data-field$="-title"]':'#space-title').fill(title);
    if(first)await dialog.locator('input[name="plansrc"][data-value="draw"]').check();
    await dialog.locator('[data-hp="dialog-confirm"]').click();
    await page.waitForFunction(title=>{
      const c=window.__card;return c._curSpaceCfg?.title===title&&c._mode==='plan'&&!c._modeTransitionBusy;
    },title);
    await page.evaluate(()=>window.__hpTest.settled());await waitForUiKitPaint(page);
    assert.equal(await page.locator('houseplan-card .homearrow').count(),0);
  };
  const snapshot=()=>page.evaluate(()=>({id:window.__card._space,view:{...window.__card._view},
    frame:window.__card._frame&&{id:window.__card._frame.id,rect:window.__card._frame.rect,grow:window.__card._frame.grow},
    arrow:!!window.__card.renderRoot.querySelector('.homearrow'),writes:window.__emptyHomeWrites.length}));
  const pan=async()=>{
    // This helper mounts a new cold card. The boot refit may still replace
    // its camera after onboarding; start navigation only on the revealed,
    // settled frame, as a user does. Keep the observer above active through
    // that reveal so the no-flash create assertion still covers it.
    await page.waitForFunction(()=>{
      const c=window.__card;return !c._booting&&!c._cameraTransition.active
        &&!c._modeTransitionBusy&&!c._refitRaf;
    });
    await waitForUiKitPaint(page);
    const stage=page.locator('houseplan-card .stage'),b=await stage.boundingBox();assert.ok(b);
    for(let i=0;i<2;i++){
      await page.mouse.move(b.x+b.width*.85,b.y+b.height*.8);await page.mouse.down();
      await page.mouse.move(b.x+b.width*.15,b.y+b.height*.8,{steps:8});await page.mouse.up();
    }
    await page.evaluate(()=>window.__hpTest.settled());
    await page.waitForFunction(()=>!window.__card._suppressClick && !window.__card._modeTransitionBusy);
  };
  const pushLine=async(on)=>page.evaluate(async on=>{
    await window.__hpTest.setServerConfig(cfg=>{
      const space=cfg.spaces.find(s=>s.id===window.__card._space);
      space.plan_graph={version:1,nodes:on?[{id:'a',p:['l','0','0']},{id:'b',p:['l','240','0']}]:[],
        edges:on?[{kind:'partition',id:'standalone',from:'a',to:'b',cm:15}]:[],rooms:[],dependencies:[]};
      space.partitions=on?[{id:'standalone',a:[0,0],b:[1,0],cm:15}]:[];
    });
  },on);
  const evidence=[];
  await create('Empty 1329 first',true);evidence.push({name:'first',...await snapshot()});
  await page.evaluate(()=>window.__hpTest.setMode('view'));await waitForUiKitPaint(page);
  const before=await snapshot();await pan();const emptyPan=await snapshot();
  assert.notDeepEqual(emptyPan.view,before.view,'native pan really changes the empty camera');
  assert.equal(emptyPan.arrow,false);assert.equal(emptyPan.writes,before.writes,'camera and arrow do not save config/layout');
  evidence.push({name:'panned-empty',...emptyPan});
  await pushLine(true);await pan();
  await page.locator('houseplan-card .homearrow').waitFor({state:'visible'});
  const positive=await snapshot();evidence.push({name:'roomless-positive',...positive});
  await page.locator('houseplan-card .homearrow').click();
  await page.waitForFunction(()=>!window.__card._cameraTransition.active&&!window.__card.renderRoot.querySelector('.homearrow'));
  assert.equal((await snapshot()).writes,positive.writes,'Fit is presentation only');
  await pan();await clickHeaderAction(page.locator('houseplan-card').first(),'mode-plan');
  await page.waitForFunction(()=>window.__card._mode==='plan' && !window.__card._modeTransitionBusy);await waitForUiKitPaint(page);
  await pushLine(false);
  const removed=await snapshot();assert.equal(removed.frame.grow,true);assert.equal(removed.arrow,false,'grown frame is not content');
  evidence.push({name:'last-object-removed',...removed});
  await pushLine(true);await page.evaluate(()=>window.__hpTest.setMode('view'));await pan();
  await create('Empty 1329 second',false);evidence.push({name:'second-after-panned-content',...await snapshot()});
  assert.equal(await page.evaluate(()=>window.__emptyHomeFlashes.length),0,'no false arrow in native create transitions');
  await page.evaluate(()=>window.__emptyHomeObserver.disconnect());
  mkdirSync('artifacts/empty-space-home-arrow',{recursive:true});
  writeFileSync('artifacts/empty-space-home-arrow/evidence.json',JSON.stringify(evidence,null,2));
  await page.screenshot({path:'artifacts/empty-space-home-arrow/empty-created.png'});
  return{emptySpaceHomeArrowFirstAndSecond:true,emptySpaceHomeArrowPanWithoutWrites:true,
    emptySpaceHomeArrowRoomlessFit:true,emptySpaceHomeArrowAfterLastObject:true,emptySpaceHomeArrowNoCreateFlash:true};
}
