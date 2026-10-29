/** #1132: native editor/focus/print path and actual LQI text occlusion pixels. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,check,finish,requirePinnedBrowser} from './serve.mjs';
requirePinnedBrowser('#1132 approved UI integration');
const {page,browser}=await launch({width:1200,height:900});
const card=page.locator('#host > houseplan-card'),output='artifacts/ui-polish-1132';
mkdirSync(output,{recursive:true});
const evidence=[];
let completed=false;
const settle=async()=>{
 await page.evaluate(()=>window.__hpTest.settled());
 await page.waitForFunction(()=>!window.__card._continuity.overlayVisible&&!window.__card.shadowRoot.querySelector('.stage')?.inert);
};
try {
 await page.evaluate(async()=>{
  window.__card.panelHost=true;
  document.getElementById('host').style.cssText='width:100%;height:100vh;margin:0;padding:0';
  const c=window.__card;
  c.hass={...c.hass,states:{...c.hass.states,'sensor.living_temp':{
   ...c.hass.states['sensor.living_temp'],attributes:{...c.hass.states['sensor.living_temp'].attributes,linkquality:148}}}};
  await window.__hpTest.setServerConfig(cfg=>{
   cfg.spaces[0].rooms[0].name='MMMMMMMMMMMMMMMM';
   cfg.spaces[0].settings={...cfg.spaces[0].settings,show_names:true,label_temp:true,label_light:true};
   cfg.settings.show_lqi=true;
   cfg.markers=cfg.markers.map(m=>m.id==='d_temp'?{...m,display:'badge'}:m);
  });
 });
 await settle();
 const tab=card.locator('[data-hp=mode-tab][data-mode=devices]');
 await tab.hover();
 check('editorPointerHoverHasTransition',await tab.evaluate(e=>getComputedStyle(e).transitionDuration.split(',').some(v=>parseFloat(v)>0)));
 await tab.click();await settle();await page.keyboard.press('Escape');await settle();
 check('escapeReturnsViewWithKitFocus',await tab.evaluate(e=>e.getRootNode().querySelector('ha-card').dataset.hpMode==='view'
  &&e.getRootNode().activeElement===e&&getComputedStyle(e).outlineColor!=='rgb(255, 255, 255)'));
 await page.emulateMedia({reducedMotion:'reduce'});
 check('editorReducedMotion',await tab.evaluate(e=>getComputedStyle(e).transitionDuration.split(',').every(v=>parseFloat(v)===0)));
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const projection of ['flat','isometric']){
  await page.evaluate(async projection=>{await window.__hpTest.setVolumetricView(projection==='isometric');},projection);
  await settle();
  for(const theme of ['light','dark']){
   for(const textLayer of ['name','metrics']){
   await page.evaluate(async theme=>{
    const c=window.__card;
    c.hass={...c.hass,themes:{...c.hass.themes,darkMode:theme==='dark'}};
    await window.__hpTest.settled();
   },theme);
   const placement=await card.evaluate((c,textLayer)=>{
    const r=c.shadowRoot,line=r.querySelector('.dev[data-id=d_temp] .lqi'),label=r.querySelector('.roomlabel:has(.rlmetrics)');
    if(!line||!label)throw Error('LQI/room fixture missing');
    const originalStyle=label.getAttribute('style');
    label.style.transform='none';label.style.left='0px';label.style.top='0px';
    label.style.fontSize='24px';label.querySelector('.rlname').style.fontSize='24px';
    const a=line.getBoundingClientRect(),b=label.querySelector(textLayer==='name'?'.rlfit':'.rlm').getBoundingClientRect();
    label.style.transform=`translate(${a.x-b.x-8}px,${a.y-b.y-2}px)`;
    const q=label.querySelector(textLayer==='name'?'.rlfit':'.rlm').getBoundingClientRect();
    return{clip:{x:Math.floor(a.x),y:Math.floor(a.y),width:Math.ceil(a.width),height:Math.ceil(a.height)},
     intersection:a.x<q.right&&a.right>q.x&&a.y<q.bottom&&a.bottom>q.y,color:getComputedStyle(line).color,
     owner:line.closest('.dev').dataset.id,originalStyle};
   },textLayer);
   check(projection+theme+textLayer+'RealTextBoundsIntersect',placement.intersection);
   const captures={};
   for(const [name,signal,label] of [['blank',false,false],['signal',true,false],['label',false,true],['both',true,true]]){
    await card.evaluate((c,{signal,label})=>{
     const r=c.shadowRoot;r.querySelector('.dev[data-id=d_temp] .lqi').style.visibility=signal?'visible':'hidden';
     r.querySelector('.roomlabel').style.visibility=label?'visible':'hidden';
    },{signal,label});
    captures[name]=(await page.screenshot({clip:placement.clip})).toString('base64');
   }
   const pixels=await page.evaluate(async({captures,color})=>{
    const decode=async base64=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
     const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
     const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,cv.width,cv.height).data;};
    const [blank,signal,label,both]=await Promise.all(['blank','signal','label','both'].map(n=>decode(captures[n])));
    const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number);let ink=0,collisions=0,preserved=0;
    for(let i=0;i<signal.length;i+=4){
     if(!rgb.every((v,k)=>Math.abs(signal[i+k]-v)<=2))continue;
     ink++;if(rgb.every((v,k)=>Math.abs(both[i+k]-v)<=5))preserved++;
     if([0,1,2].some(k=>Math.abs(label[i+k]-blank[i+k])>15))collisions++;
    }
    return{ink,collisions,preserved};
   },{captures,color:placement.color});
   evidence.push({projection,theme,textLayer,...placement,...pixels});
   check(projection+theme+textLayer+'LqiInkSurvivesRoomText',pixels.ink>=3&&pixels.collisions>=1&&pixels.preserved===pixels.ink);
   writeFileSync(`${output}/${projection}-${theme}-${textLayer}-overlap.png`,Buffer.from(captures.both,'base64'));
   await card.evaluate((c,originalStyle)=>{const r=c.shadowRoot;r.querySelector('.roomlabel:has(.rlmetrics)').setAttribute('style',originalStyle);
    r.querySelector('.roomlabel:has(.rlmetrics) .rlname').style.removeProperty('font-size');
    r.querySelector('.dev[data-id=d_temp] .lqi').style.removeProperty('visibility');c.requestUpdate();},placement.originalStyle);
   await settle();
   }
  }
 }
 await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(false);});await settle();
 await card.locator('[data-hp=pdf]').click();
 const pdf=card.locator('hp-pdf-dialog'),close=pdf.locator('hp-dialog').locator('.close');
 await close.hover();
 check('printCloseUsesPointerAnimation',await pdf.locator('hp-dialog').evaluate(e=>e.hasAttribute('data-pointer-hover')
  &&getComputedStyle(e).getPropertyValue('--hp-dialog-close-hover-transform').includes('rotate')));
 await page.emulateMedia({reducedMotion:'reduce'});
 check('printCloseReducedMotion',await pdf.locator('hp-dialog').evaluate(e=>getComputedStyle(e).getPropertyValue('--hp-dialog-close-hover-transform').trim()==='none'));
 await close.click();await pdf.waitFor({state:'detached'});
 check('printCloseReturnsToPlan',await card.locator('.plan-svg').isVisible());
 completed=true;
} finally {
 writeFileSync(output+'/report.json',JSON.stringify(evidence,null,2));
 console.log('HP_UI_1132_PIXELS '+JSON.stringify(evidence));
 check('integratedPathCompleted',completed);
 await finish(browser);
}
