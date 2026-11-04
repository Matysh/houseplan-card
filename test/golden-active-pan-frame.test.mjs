import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareActivePanGoldenFrame } from '../demo/golden/ui-lab-1081.mjs';

async function withCard(change, check) {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'window');
  const press={sx:120,sy:240,vx:10,vy:20};let renders=0;
  const card={_panStart:press,_panLock:'pan',_view:{x:30,y:40,w:100,h:120},
    _serverCfg:{spaces:[{id:'f',decor:[{id:'d',x:.2}]}]},
    requestUpdate(){renders++;change?.(card);},updateComplete:Promise.resolve()};
  globalThis.window={__goldenCard:card};
  try{await check({card,page:{evaluate:fn=>fn()},press,renders:()=>renders});}
  finally{if(descriptor)Object.defineProperty(globalThis,'window',descriptor);else delete globalThis.window;}
}
test('#1277 full frame retains the exact held gesture, camera and stored data',async()=>{
  await withCard(null,async({card,page,press,renders})=>{
    const before=structuredClone({_view:card._view,_serverCfg:card._serverCfg});
    assert.deepEqual(await prepareActivePanGoldenFrame(page),{phase:'complete-active-pan-frame',pointerHeld:true,cameraUnchanged:true,configUnchanged:true});
    assert.equal(card._panStart,press);assert.equal(card._panLock,'pan');assert.equal(renders(),1);
    assert.deepEqual({_view:card._view,_serverCfg:card._serverCfg},before);
  });
});
for(const [name,corrupt]of Object.entries({release:c=>c._panStart=null,replacement:c=>c._panStart={...c._panStart},
  swipe:c=>c._panLock='swipe',camera:c=>c._view.x++,data:c=>c._serverCfg.spaces[0].decor[0].x=.3}))
test('#1277 capture refuses '+name+' during the full frame',async()=>{
  await withCard(corrupt,async({page,renders})=>{
    await assert.rejects(prepareActivePanGoldenFrame(page),/changed the active pan/);assert.equal(renders(),1);
  });
});
test('#1277 a settled gesture never becomes an active-pan witness',async()=>{
  await withCard(null,async({card,page,renders})=>{
    card._panStart=null;await assert.rejects(prepareActivePanGoldenFrame(page),/active native pan/);assert.equal(renders(),0);
  });
});
test('#1277 render failure propagates without a replacement capture',async()=>{
  await withCard(()=>{throw Error('render failed');},async({page,renders})=>{
    await assert.rejects(prepareActivePanGoldenFrame(page),/render failed/);assert.equal(renders(),1);
  });
});
