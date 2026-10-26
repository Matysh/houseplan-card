// #1070 AC8: genuine Chromium touch input on rotated View and kiosk surfaces.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser();
const { page, browser } = await launch({width:390,height:844}, 1, [], {hasTouch:true,isMobile:true});
const cdp = await page.context().newCDPSession(page);
const card = page.locator('houseplan-card');
await page.emulateMedia({reducedMotion:'reduce'});
const wait = async () => {
  await page.waitForFunction(() => { const c=window.__card; return !c._booting && !c._bootSoft && !c._cameraTransition.active && !c._refitRaf && !c._pendingRefitSize; });
  await page.evaluate(() => window.__hpTest.settled());
};
const point = p => card.locator('.decorlayer').evaluate((ink,p) => {
  const q=new DOMPoint(p[0],p[1]).matrixTransform(ink.getScreenCTM()); return {x:q.x,y:q.y};
},p);
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({id:p.id,x:p.x,y:p.y,radiusX:5,radiusY:5,force:1}))});
try {
  await page.evaluate(async () => {
    const floor=id=>({id,title:id,cell_cm:5,rooms:[{id:`room-${id}`,name:'Touch room',poly:[[.1,.2],[.9,.2],[.9,.7],[.1,.7]]}],decor:[]});
    await window.__hpTest.setServerConfig({spaces:[floor('f1'),floor('f2')],markers:[],settings:{filter_seeded:true,known_devices:[],new_device_ids:[]}});
    await window.__hpTest.switchSpace('f1');
  }); await wait();
  const button=await card.locator('[data-hp="rotate-right"]').boundingBox();
  // Mobile viewport coordinates round a CSS 44px box by ~0.00001px.
  check('rotation controls retain a 44px touch target', button.width>=43.999 && button.height>=43.999);
  await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2); await wait();
  check('native touch selects clockwise rotation', (await page.evaluate(()=>window.__hpTest.viewFrameSnapshot())).rotation===90);
  for(const kiosk of [false,true]) {
    if(kiosk) {
      await page.evaluate(()=>{
        const previous=window.__card,c=document.createElement('houseplan-card');
        c.setConfig({type:'custom:houseplan-card',floor:'f2',kiosk:true,rotation:270});
        previous.remove(); document.getElementById('host').append(c);window.__card=c;c.hass=window.__mkHass();
      }); await wait();
    }
    const stage=await card.locator('.stage').boundingBox(), before=await point([500,500]);
    const start={id:1,x:stage.x+stage.width*.5,y:stage.y+stage.height*.9};
    await touch('touchStart',[start]);
    for(let n=1;n<=8;n++) await touch('touchMove',[{id:1,x:start.x+45*n/8,y:start.y-25*n/8}]);
    await touch('touchEnd',[]);await wait();
    const after=await point([500,500]);
    check(`${kiosk?'kiosk270':'View90'} native touch pan follows screen axes`, Math.abs(after.x-before.x-45)<2 && Math.abs(after.y-before.y+25)<2);
    const center={x:stage.x+stage.width/2,y:stage.y+stage.height/2};
    const anchor=await card.locator('.decorlayer').evaluate((ink,center)=>{
      const p=new DOMPoint(center.x,center.y).matrixTransform(ink.getScreenCTM().inverse());return[p.x,p.y];
    },center);
    const zoomBefore=await page.evaluate(()=>window.__hpTest.viewFrameSnapshot().camera.zoom);
    await touch('touchStart',[{id:11,x:center.x-45,y:center.y},{id:12,x:center.x+45,y:center.y}]);
    for(let n=1;n<=8;n++) await touch('touchMove',[{id:11,x:center.x-45*(1+n/16),y:center.y},{id:12,x:center.x+45*(1+n/16),y:center.y}]);
    await touch('touchEnd',[]);await wait();
    const zoomAfter=await page.evaluate(()=>window.__hpTest.viewFrameSnapshot().camera.zoom),held=await point(anchor);
    check(`${kiosk?'kiosk270':'View90'} native pinch zooms around the held world point`, zoomAfter>zoomBefore*1.3 && zoomAfter<zoomBefore*1.7
      && Math.hypot(held.x-center.x,held.y-center.y)<2);
    check(`${kiosk?'kiosk270':'View90'} touch leaves orientation unchanged`, (await page.evaluate(()=>window.__hpTest.viewFrameSnapshot())).rotation===(kiosk?270:90));
  }
}finally{await browser.close();finish();}
