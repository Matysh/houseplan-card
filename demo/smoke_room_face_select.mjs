/** #1176: real panel, native Select/Walls input, shared hover paint and cached topology. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual as equal } from 'node:util';
import { launchPanelCold, check, finish, requirePinnedBrowser } from './serve.mjs';
import { applyUiKitTheme } from './helpers/ui-kit-theme.mjs';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';
requirePinnedBrowser('#1176 Select room candidates');
const fixture=JSON.parse(readFileSync(new URL('../test/fixtures/1166-two-contours.json',import.meta.url),'utf8'));
const config={...fixture.payload.config,model_version:fixture.model_version};
const folder='artifacts/1176-room-candidates';mkdirSync(folder,{recursive:true});
const {page,browser}=await launchPanelCold({width:1280,height:960});
page.setDefaultTimeout(12000);
const card=page.locator('houseplan-panel houseplan-card');
const settle=()=>page.evaluate(async()=>{await window.__hpTest.waitForWrites();await window.__hpTest.settled();});
const tool=async id=>{await page.evaluate(id=>window.__hpTest.setTool(id),id);await waitForUiKitPaint(page);};
const screen=point=>card.locator('.decorlayer').evaluate((ink,p)=>{
 const q=new DOMPoint(...p).matrixTransform(ink.getScreenCTM());return {x:q.x,y:q.y};
},point);
const move=async point=>{const p=await screen(point);await page.mouse.move(p.x,p.y);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const click=async point=>{const p=await screen(point);await page.mouse.click(p.x,p.y);};
const state=()=>page.evaluate(()=>({
 cfg:structuredClone(window.__card._serverCfg),roomDialog:window.__card._roomDialog,path:window.__card._path.length,
 hover:window.__card._editorRuntime.roomFaceHoverPaths,
 painted:!!window.__card.renderRoot.querySelector('[data-hp-live-room-hover="outline"]:not([hidden])')?.getAttribute('d'),
}));
const geometry=v=>v.spaces.map(s=>({rooms:s.rooms,wall_segments:s.wall_segments,partitions:s.partitions,openings:s.openings}));
const history=async action=>{await card.locator(`[data-action="geometry-${action}"]`).click();await settle();};
const paint=()=>card.evaluate(c=>Object.fromEntries(['fill','halo','outline'].map(role=>{
 const s=getComputedStyle(c.renderRoot.querySelector(`[data-hp-live-room-hover="${role}"]`));
 return [role,{fill:s.fill,fillOpacity:s.fillOpacity,stroke:s.stroke,strokeWidth:s.strokeWidth,strokeOpacity:s.strokeOpacity}];
})));
const evidence={themes:{},large:{}};
try{
 await page.evaluate(cfg=>{
  window.__pushServerConfig(cfg);window.__pushServerLayout({});
  history.replaceState(null,'','/houseplan');
  const host=document.getElementById('host');host.style.cssText='width:100%;height:100vh;margin:0;padding:0';
  const panel=document.createElement('houseplan-panel');window.__panel1176=panel;
  panel.panel={component_name:'houseplan-panel'};panel.route={prefix:'/houseplan',path:''};
  panel.narrow=false;panel.hass=window.__mkHass();host.replaceChildren(panel);
 },config);
 await page.evaluate(()=>import('/assets/houseplan-panel.js'));
 await page.waitForFunction(()=>{
  const c=window.__panel1176.shadowRoot?.querySelector('houseplan-card');
  if(!c?.renderRoot.querySelector('ha-card[data-hp-state="ready"]'))return false;
  window.__card=c;return !c._booting;
 });
 await page.evaluate(()=>window.__hpTest.setMode('plan'));await waitForUiKitPaint(page);
 await tool('select');await settle();
 const original=(await state()).cfg;
 for(const [i,point]of [[350,400],[-200,1240]].entries()){
  await move(point);let s=await state();
  check(`contour${i}: Select paints exact free candidate`,s.painted&&!!s.hover&&!s.roomDialog&&s.path===0);
  for(const theme of ['light','dark']){
   await applyUiKitTheme(page,theme);await move(point);await waitForUiKitPaint(page);
   evidence.themes[`${i}-${theme}`]=await paint();
   await page.screenshot({path:`${folder}/contour-${i}-${theme}.png`});
  }
  await tool('draw');s=await state();check(`contour${i}: tool change clears candidate`,!s.painted&&!s.hover);
  await click(point);s=await state();check(`contour${i}: Walls starts freely inside contour`,s.path===1&&!s.roomDialog&&!s.painted);
  await click([point[0]+40,point[1]]);await settle();s=await state();
  check(`contour${i}: Walls continues inside contour`,s.path===2&&!s.roomDialog);
  await history('undo');await page.keyboard.press('Escape');await settle();
  check(`contour${i}: wall Undo preserves original geometry`,equal(geometry((await state()).cfg),geometry(original)));
  await tool('select');await move(point);await click(point);
  const dialog=card.locator('hp-dialog[data-kind="room"]');await dialog.waitFor();await waitForUiKitPaint(page);
  check(`contour${i}: click opens the hovered face`,await page.evaluate(()=>{
   const r=window.__card._editorRuntime,c=r._roomFaceCache;
   return window.__card._wallFaceBatch.candidates[0]===[...c.candidates.values()].find(v=>v?.key===window.__card._wallFaceBatch.candidates[0].key);
  }));
  await dialog.locator('[data-hp="dialog-cancel"]').click();await settle();
  check(`contour${i}: Cancel preserves geometry`,equal(geometry((await state()).cfg),geometry(original)));
  await move(point);await click(point);await dialog.waitFor();await waitForUiKitPaint(page);
  await dialog.locator('#room-name').fill(`Select room ${i}`);
  await dialog.locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();await settle();
  const created=(await state()).cfg;
  check(`contour${i}: room saved once`,created.spaces[0].rooms.length===1);
  await move(point);check(`contour${i}: occupied face is not offered`,!(await state()).hover);
  await history('undo');check(`contour${i}: room Undo restores original`,equal(geometry((await state()).cfg),geometry(original)));
  await move(point);check(`contour${i}: Undo restores free offer`,!!(await state()).hover);
  await history('redo');check(`contour${i}: Redo restores exact room identities`,equal(geometry((await state()).cfg),geometry(created)));
  // Compare actual computed candidate paint with the real View hover in both themes.
  await page.evaluate(()=>window.__hpTest.setMode('view'));await waitForUiKitPaint(page);
  for(const theme of ['light','dark']){
   await applyUiKitTheme(page,theme);await move(point);
   await page.waitForFunction(()=>!!window.__card._hoverRoom);
   check(`contour${i}: ${theme} paint matches View`,equal(await paint(),evidence.themes[`${i}-${theme}`]));
  }
  await page.evaluate(()=>window.__hpTest.setMode('plan'));await waitForUiKitPaint(page);
  await history('undo');await settle();await tool('select');
 }
 // Object input wins over the face beneath the wall or its node.
 const node=card.locator('[data-hp="wall-node"]').first();
 await node.waitFor();await node.hover();check('node hover never offers a room',!(await state()).hover);
 await node.click();check('node click never opens a room',!(await state()).roomDialog);
 const wall=card.locator('.physical-hit').first();await wall.hover();
 check('wall hover keeps object ownership',!(await state()).hover);
 await wall.click();check('wall click keeps object ownership',!(await state()).roomDialog);
 const partitions=[];
 for(let y=0;y<10;y++)for(let x=0;x<10;x++){
  const a=.02+x*.09,b=.02+y*.09,q=[[a,b],[a+.06,b],[a+.06,b+.06],[a,b+.06]];
  for(let n=0;n<4;n++)partitions.push({id:`large-${x}-${y}-${n}`,a:q[n],b:q[(n+1)%4],cm:15});
 }
 partitions.push(...[{a:[.93,.2],b:[.98,.2]},{a:[.98,.2],b:[.98,.26]},{a:[.98,.26],b:[.93,.26]}].map((p,i)=>({...p,id:`open-${i}`,cm:15})));
 const large={model_version:10,spaces:[{id:'large-select',title:'Large Select',cell_cm:5,view_box:[0,0,1,1],rooms:[],wall_segments:[],partitions,openings:[]}],markers:[],settings:{}};
 await page.evaluate(async cfg=>{await window.__hpTest.setServerConfig(cfg);await window.__hpTest.switchSpace(cfg.spaces[0].id);},large);
 await settle();await tool('select');await move([50,50]);
 check('large plan has a real candidate',!!(await state()).hover);
 await page.evaluate(()=>{
  const r=window.__card._editorRuntime,original=r._wallFaceGraph;
  window.__graphCalls1176=0;r._wallFaceGraph=function(...args){window.__graphCalls1176++;return original.apply(this,args);};
 });
 const started=performance.now();
 for(let n=0;n<20;n++)await move([45+n%5,45+Math.floor(n/5)]);
 await page.evaluate(async()=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states}};await c.updateComplete;});
 await move([50,50]);
 evidence.large={partitions:partitions.length,samples:21,elapsedMs:performance.now()-started,graphCalls:await page.evaluate(()=>window.__graphCalls1176)};
 check('large plan moves and HA ticks never rebuild warm graph',evidence.large.graphCalls===0);
 await move([955,230]);check('unclosed face is not offered',!(await state()).hover);
 await click([955,230]);check('unclosed face click never creates a room',!(await state()).roomDialog);
 await move([910,900]);check('exterior is not offered',!(await state()).hover);
 await move([50,50]);
 const opened=structuredClone(large);opened.spaces[0].partitions=opened.spaces[0].partitions.filter(p=>p.id!=='large-0-0-0');
 await page.evaluate(cfg=>window.__hpTest.setServerConfig(cfg),opened);await settle();
 check('changed geometry hides stale hover before next move',!(await state()).painted);
 await move([50,50]);check('changed graph no longer offers removed face',!(await state()).hover);
 await tool('draw');await move([140,50]);check('Walls never paints an existing face',!(await state()).painted);
 await page.evaluate(()=>window.__hpTest.setMode('view'));await waitForUiKitPaint(page);
 check('View has no candidate hover',!await page.evaluate(()=>!!window.__card._editorRuntime.roomFaceHoverPaths));
 writeFileSync(`${folder}/observations.json`,JSON.stringify(evidence,null,2)+'\n');
}catch(error){await page.screenshot({path:`${folder}/failure.png`}).catch(()=>{});throw error;}
finally{await finish(browser);}