/** #1176: real panel, native Select/Walls input, shared hover paint and cached topology. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual as equal } from 'node:util';
import { launchPanelCold, check, finish, requirePinnedBrowser } from './serve.mjs';
import { applyUiKitTheme } from './helpers/ui-kit-theme.mjs';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';
import { currentGraphFixture } from './helpers/graph-fixture.mjs';
requirePinnedBrowser('#1176 Select room candidates');
const fixture=JSON.parse(readFileSync(new URL('../test/fixtures/1166-two-contours.json',import.meta.url),'utf8'));
const config=currentGraphFixture({...fixture.payload.config,model_version:fixture.model_version});
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
  await click([point[0]+100,point[1]]);await settle();s=await state();
  check(`contour${i}: Walls continues inside contour`,s.path===2&&!s.roomDialog);
  await history('undo');await page.keyboard.press('Escape');await settle();
  check(`contour${i}: wall Undo preserves original geometry`,equal(geometry((await state()).cfg),geometry(original)));
  await tool('select');await move(point);await click(point);
  const dialog=card.locator('hp-dialog[data-kind="room"]');await dialog.waitFor();await waitForUiKitPaint(page);
  check(`contour${i}: click opens the hovered face`,await page.evaluate(()=>{
   const r=window.__card._editorRuntime,c=r._roomFaceCache;
   return window.__card._wallFaceBatch.candidates[0]===[...c.candidates.values()].find(v=>v?.key===window.__card._wallFaceBatch.candidates[0].key);
  }));
  await dialog.locator('button.btn[data-hp="dialog-cancel"]').click();await settle();
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
   await applyUiKitTheme(page,theme);
   // The room label is a separate input owner; enter actual clear floor.
   await page.mouse.move(5,70);await move([point[0],point[1]-70]);
   await page.waitForFunction(()=>!!window.__card._hoverRoom);
   check(`contour${i}: ${theme} paint matches View`,equal(await paint(),evidence.themes[`${i}-${theme}`]));
  }
  await page.evaluate(()=>window.__hpTest.setMode('plan'));await waitForUiKitPaint(page);
  await history('undo');await settle();await tool('select');
 }
 // Object input wins over the face beneath the wall or its node.
 const nodes=card.locator('[data-hp="wall-node"]');
 let node;
 const viewport=page.viewportSize();
 for(let i=0;i<await nodes.count();i++){
  const candidate=nodes.nth(i),box=await candidate.boundingBox();
  if(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height){node=candidate;break;}
 }
 if(!node)throw new Error('no native wall-node target inside the visible viewport');
 await node.waitFor();await node.hover();check('node hover never offers a room',!(await state()).hover);
 await node.click();check('node click never opens a room',!(await state()).roomDialog);
 const wallPoint=await card.evaluate(c=>{
  const p=c._spaceModel().partitions[0];return [(p.a[0]+p.b[0])*500,(p.a[1]+p.b[1])*500];
 });
 // Overlapping wall hit regions may choose either saved wall, never the face.
 await move(wallPoint);check('wall hover keeps object ownership',!(await state()).hover);
 await click(wallPoint);check('wall click keeps object ownership',!(await state()).roomDialog);
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
 // Cross six different faces, then revisit them: graph-only sampling would
 // miss a boolean union rebuilt on every entry (review1 of #1176).
 await page.evaluate(()=>{
  const r=window.__card._editorRuntime,build=r._buildRoomFacePaths;
  window.__faceClipBuilds1176=0;window.__facePaths1176=new Map();
  r._buildRoomFacePaths=function(...args){window.__faceClipBuilds1176++;return build.apply(this,args);};
  window.__unionBuilds1176=window.__card._floorCacheBuilds.wallUnion;
 });
 const route=Array.from({length:6},(_,n)=>[50+n*90,50]);
 for(const point of route){
  await move(point);await page.evaluate(()=>{
   const h=window.__card._editorRuntime._roomFaceHover;
   if(h)window.__facePaths1176.set(h.face.key,h.paths);
  });
 }
 const firstClips=await page.evaluate(()=>window.__faceClipBuilds1176);
 let retained=true;
 for(const point of [...route].reverse()){
  await move(point);retained&&=await page.evaluate(()=>{
   const h=window.__card._editorRuntime._roomFaceHover;
   return !!h&&window.__facePaths1176.get(h.face.key)===h.paths;
  });
 }
 evidence.large.faceTransitions=await page.evaluate(firstClips=>({
  uniqueFaces:window.__facePaths1176.size,firstClipBuilds:firstClips,
  revisitClipBuilds:window.__faceClipBuilds1176-firstClips,
  graphCalls:window.__graphCalls1176,wallUnionBuilds:window.__card._floorCacheBuilds.wallUnion-window.__unionBuilds1176,
 }),firstClips);
 check('large plan really visits six faces',evidence.large.faceTransitions.uniqueFaces===6&&firstClips===5);
 check('returning across faces retains paths without clipping or unions',retained
  &&evidence.large.faceTransitions.revisitClipBuilds===0&&evidence.large.faceTransitions.graphCalls===0
  &&evidence.large.faceTransitions.wallUnionBuilds===0);
 await move([955,230]);check('unclosed face is not offered',!(await state()).hover);
 await click([955,230]);check('unclosed face click never creates a room',!(await state()).roomDialog);
 await move([910,900]);check('exterior is not offered',!(await state()).hover);
 await move([50,50]);
 const opened=structuredClone(large);opened.spaces[0].partitions=opened.spaces[0].partitions.filter(p=>p.id!=='large-0-0-0');
 await page.evaluate(cfg=>window.__hpTest.setServerConfig(cfg),opened);await settle();
 check('changed geometry hides stale hover before next move',!(await state()).painted);
 await move([50,50]);check('changed graph no longer offers removed face',!(await state()).hover);
 await tool('draw');await move([140,50]);check('Walls never paints an existing face',!(await state()).painted);
 // Normal multi-room flow: the first room consumes the shared partition.
 const adjacent={model_version:10,spaces:[{id:'adjacent',title:'Adjacent rooms',cell_cm:5,view_box:[0,0,1,1],rooms:[],wall_segments:[],openings:[],partitions:[
  {id:'adj-top',a:[.1,.1],b:[.9,.1],cm:20},
  {id:'adj-right',a:[.9,.1],b:[.9,.7],cm:20},
  {id:'adj-bottom',a:[.9,.7],b:[.1,.7],cm:20},
  {id:'adj-left',a:[.1,.7],b:[.1,.1],cm:20},
  {id:'adj-shared',a:[.5,.1],b:[.5,.7],cm:20},
 ]}],markers:[],settings:{}};
 await page.evaluate(async cfg=>{await window.__hpTest.setServerConfig(cfg);await window.__hpTest.switchSpace(cfg.spaces[0].id);},adjacent);
 await settle();await tool('select');await click([100,400]);
 await click([300,400]);
 const room=card.locator('hp-dialog[data-kind="room"]');await room.waitFor();await waitForUiKitPaint(page);
 check('room creation retires the previous object selection',await card.evaluate(c=>!c._physicalSel&&!c._editorRuntime.properties.identity));
 await room.locator('#room-name').fill('Adjacent left');
 await room.locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();await settle();
 check('adjacent room consumes the shared partition',await card.evaluate(c=>c._serverCfg.spaces[0].rooms.length===1
  &&c._serverCfg.spaces[0].wall_segments.some(w=>w.a[0]===.5&&w.b[0]===.5)));
 await move([700,400]);
 evidence.adjacent=await card.evaluate(c=>{
  const path=c.renderRoot.querySelector('[data-hp-live-room-hover="outline"]'),box=path.getBBox();
  return {x:box.x,width:box.width,expectedMinX:500+c._cmToUnits(20)/2,painted:!path.hasAttribute('hidden')};
 });
 console.log(JSON.stringify({observation:'1176 adjacent room',...evidence.adjacent}));
 check('adjacent free hover is clipped beyond shared room masonry',evidence.adjacent.painted
  &&evidence.adjacent.x>=evidence.adjacent.expectedMinX-.05);
 for(const theme of ['light','dark']){
  await applyUiKitTheme(page,theme);await move([700,400]);await waitForUiKitPaint(page);
  await page.screenshot({path:`${folder}/adjacent-room-${theme}.png`});
 }
 await page.evaluate(()=>window.__hpTest.setMode('view'));await waitForUiKitPaint(page);
 check('View has no candidate hover',!await page.evaluate(()=>!!window.__card._editorRuntime.roomFaceHoverPaths));
 writeFileSync(`${folder}/observations.json`,JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({observation:'1176 native hover',...evidence.large}));
}catch(error){await page.screenshot({path:`${folder}/failure.png`}).catch(()=>{});throw error;}
finally{await finish(browser);}
