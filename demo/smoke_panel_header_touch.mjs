import {launchColdView,check,finish,requirePinnedBrowser} from './serve.mjs';
import {assertFreshDemoBundleUnlessAllowed} from './bundle-freshness.mjs';
requirePinnedBrowser('#1120 hidden zoom keeps native touch gestures');
const {page,browser}=await launchColdView({width:390,height:844},1,[],{hasTouch:true,isMobile:true});
const cdp=await page.context().newCDPSession(page);
const card=page.locator('houseplan-panel houseplan-card');
const wait=async()=>{
  await page.waitForFunction(()=>{
    const root=window.__card.shadowRoot;
    return root.querySelector('ha-card[data-hp-state=ready]')&&!root.querySelector('.stage')?.inert;
  });
  await page.evaluate(()=>window.__hpTest.settled());
};
const point=p=>card.locator('.decorlayer').evaluate((ink,p)=>{
  const q=new DOMPoint(p[0],p[1]).matrixTransform(ink.getScreenCTM());return{x:q.x,y:q.y};
},p);
const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({
  id:p.id,x:p.x,y:p.y,radiusX:5,radiusY:5,force:1,
}))});
try {
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(async()=>{
  await window.__hpTest.setServerConfig({
   spaces:[{id:'native-panel-touch',title:'Touch floor',cell_cm:5,
    rooms:[{id:'room-touch',name:'Touch room',poly:[[.1,.2],[.9,.2],[.9,.7],[.1,.7]]}],decor:[]}],
   markers:[],settings:{filter_seeded:true,known_devices:[],new_device_ids:[]},
  });
  const host=document.getElementById('host');host.style.cssText='width:320px;height:100vh;margin:0;padding:0';
  history.replaceState(null,'','/houseplan');
  const panel=document.createElement('houseplan-panel');
  panel.panel={component_name:'houseplan-panel'};panel.route={prefix:'/houseplan',path:''};
  panel.narrow=true;panel.hass={...window.__mkHass(),kioskMode:false,dockedSidebar:'auto'};
  host.replaceChildren(panel);await import('/assets/houseplan-panel.js');
  await customElements.whenDefined('houseplan-panel');
  for(let i=0;i<30&&!panel.shadowRoot?.querySelector('houseplan-card');i++)await new Promise(requestAnimationFrame);
  window.__card=panel.shadowRoot.querySelector('houseplan-card');
 });
 await wait();await assertFreshDemoBundleUnlessAllowed(page);
 await page.waitForFunction(()=>{
  const root=window.__card.shadowRoot,zoom=root.querySelector('[data-hp=zoom-in]');
  return root.querySelector('[data-hp=space-select]')&&zoom?.getBoundingClientRect().width===0;
 });
 check('panelTouchZoomButtonsHidden',await card.locator('[data-hp^=zoom-]').evaluateAll(nodes=>
  nodes.length===3&&nodes.every(e=>e.getBoundingClientRect().width===0)));
 const stage=await card.locator('.stage').boundingBox(),before=await point([500,500]);
 const start={id:1,x:stage.x+stage.width*.5,y:stage.y+stage.height*.9};
 await touch('touchStart',[start]);
 for(let n=1;n<=8;n++)await touch('touchMove',[{id:1,x:start.x+45*n/8,y:start.y-25*n/8}]);
 await touch('touchEnd',[]);await wait();
 const after=await point([500,500]);
 check('hiddenZoomNativePanScreenAxes',Math.abs(after.x-before.x-45)<2&&Math.abs(after.y-before.y+25)<2);
 const center={x:stage.x+stage.width/2,y:stage.y+stage.height/2};
 const anchor=await card.locator('.decorlayer').evaluate((ink,center)=>{
  const p=new DOMPoint(center.x,center.y).matrixTransform(ink.getScreenCTM().inverse());return[p.x,p.y];
 },center);
 const widthBefore=await card.locator('.plan-svg').evaluate(e=>e.viewBox.baseVal.width);
 await touch('touchStart',[{id:11,x:center.x-45,y:center.y},{id:12,x:center.x+45,y:center.y}]);
 for(let n=1;n<=8;n++)await touch('touchMove',[
  {id:11,x:center.x-45*(1+n/16),y:center.y},{id:12,x:center.x+45*(1+n/16),y:center.y},
 ]);
 await touch('touchEnd',[]);await wait();
 const widthAfter=await card.locator('.plan-svg').evaluate(e=>e.viewBox.baseVal.width),held=await point(anchor);
 check('hiddenZoomNativePinchKeepsWorldAnchor',widthBefore/widthAfter>1.3&&widthBefore/widthAfter<1.7
  &&Math.hypot(held.x-center.x,held.y-center.y)<2);
 check('touchPlanFillsRemainingPanel',await card.evaluate(e=>{
  const root=e.shadowRoot,stage=root.querySelector('.stage').getBoundingClientRect(),hdr=root.querySelector('.hdr').getBoundingClientRect();
  return stage.height>0&&Math.abs(stage.height+hdr.height-e.getBoundingClientRect().height)<=1;
 }));
}catch(error){check('nativeTouchCompletes',false);throw error;}
finally{await finish(browser);}
