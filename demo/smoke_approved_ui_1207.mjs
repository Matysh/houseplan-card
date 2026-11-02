import {mkdir} from 'node:fs/promises';
import {launch,checkAll,finish,requirePinnedBrowser} from './serve.mjs';
requirePinnedBrowser('#1207 approved shared controls and physical camera');
const {page,browser}=await launch({width:1440,height:1000});
page.on('console',message=>{if(/^(Growth|Rapid)/.test(message.text()))console.log(message.text());});
const out={};
const card=page.locator('houseplan-card').first();
const settle=async()=>{
 await page.waitForFunction(()=>!window.__card._modeTransitionBusy);
 await page.evaluate(()=>window.__hpTest.settled());
};
const mode=async value=>{await page.evaluate(value=>window.__hpTest.setMode(value),value);await settle();};
await page.evaluate(()=>{document.querySelector('#host').style.cssText='width:100%;padding:0;margin:0';});
await page.waitForTimeout(250);await mode('plan');
await page.evaluate(()=>window.__hpTest.setTool('draw'));await settle();
const wall=card.locator('input[data-field="wall-thickness"]');
await wall.fill('1.5');await wall.press('End');await wall.press('7');
out.wallInsertionBounded=await wall.inputValue()==='1.5';
await wall.fill('1234');out.wallReplacementBounded=await wall.inputValue()==='1.5';
await page.evaluate(()=>{const c=window.__card;c._drawWallField='125.5';c.requestUpdate();});
await page.waitForFunction(()=>window.__card.renderRoot.querySelector('input[data-field=wall-thickness]')?.value==='125.5');
out.legacyWallValuePreserved=await wall.inputValue()==='125.5';
await wall.fill('15');
const junction=await page.evaluate(()=>{
 const line=window.__card.renderRoot.querySelector('.plan-snap-line');
 const point=new DOMPoint((line.x1.baseVal.value+line.x2.baseVal.value)/2,(line.y1.baseVal.value+line.y2.baseVal.value)/2).matrixTransform(line.getScreenCTM());
 return {x:point.x,y:point.y};
});
await page.mouse.move(junction.x,junction.y);
await card.locator('.plan-snap-node.dynamic[data-active="true"]').waitFor({state:'visible'});
out.proposedNodeMatchesExisting=await card.locator('.plan-snap-overlay').evaluate(overlay=>{
 const proposed=overlay.querySelector('.plan-snap-node.dynamic'),existing=overlay.querySelector('.plan-snap-node[data-kind=endpoint]');
 window.__existingNodeRadius=existing.getAttribute('r');window.__existingNodeOutline=getComputedStyle(existing).strokeWidth;
 return proposed.getAttribute('r')===existing.getAttribute('r')&&getComputedStyle(proposed).strokeWidth===getComputedStyle(existing).strokeWidth;
});
out.unitInsideSharedBorder=await wall.evaluate(input=>input.parentElement.classList.contains('hpf-unit')
 &&input.parentElement.children.length===2&&input.parentElement.lastElementChild.textContent.trim().length>0);
await mode('decor');await page.evaluate(()=>window.__hpTest.setTool('line'));await settle();
const line=card.locator('input[data-field="decor-stroke-width"]');
await line.fill('1.5');await line.press('End');await line.press('7');
out.lineInsertionBounded=await line.inputValue()==='1.5';
out.lineShiftHint=await card.locator('.editor-secondary').textContent().then(text=>/Shift.*45/.test(text));
await page.evaluate(()=>window.__hpTest.setTool('select'));await settle();
out.lineHintRetires=await card.locator('.editor-secondary').textContent().then(text=>!/Shift.*45/.test(text));
await mode('plan');
out.headerTooltips=await card.locator('.head').evaluate(head=>!head.querySelector('[title]')
 &&[...head.querySelectorAll('[data-hp="mode-tab"],[data-hp="editor-close"],.tab')].every(button=>!!button.dataset.hpTooltip));
out.toastVisiblePlan=await page.evaluate(async()=>{
 const c=window.__card;c._showToast('Synthetic save completed','toast.synthetic.saved');
 await new Promise(resolve=>setTimeout(resolve,220));
 const stage=c.renderRoot.querySelector('.stage').getBoundingClientRect(),toast=c.renderRoot.querySelector('[data-hp=toast]').getBoundingClientRect();
 return Math.abs((toast.left+toast.right)/2-(stage.left+stage.right)/2)<1
   &&Math.abs(toast.bottom-(Math.min(innerHeight,stage.bottom)-22))<1;
});
out.toastPriority=await page.evaluate(()=>{
 const p=window.__card._toastPresentation;p.showHint('Create a room','room-face');p.clearHint('room-face');
 return window.__card.renderRoot.querySelector('[data-hp=toast]')?.dataset.id==='toast.synthetic.saved';
});
out.toastTracksScrolledVisibleStage=await page.evaluate(async()=>{
 const spacer=document.createElement('div');spacer.style.height='350px';document.body.prepend(spacer);
 scrollTo(0,160);dispatchEvent(new Event('resize'));
 await new Promise(resolve=>setTimeout(resolve,220));
 const c=window.__card;c._showToast('Synthetic clipped stage','toast.synthetic.clipped');
 await new Promise(resolve=>setTimeout(resolve,220));
 const stage=c.renderRoot.querySelector('.stage').getBoundingClientRect(),toast=c.renderRoot.querySelector('[data-hp=toast]').getBoundingClientRect();
 const left=Math.max(0,stage.left),right=Math.min(innerWidth,stage.right),bottom=Math.min(innerHeight,stage.bottom);
 const pass=right>left&&Math.abs((toast.left+toast.right)/2-(left+right)/2)<1
   &&Math.abs(toast.bottom-(bottom-22))<1;
 spacer.remove();scrollTo(0,0);dispatchEvent(new Event('resize'));
 await new Promise(resolve=>setTimeout(resolve,180));return pass;
});
await mkdir('demo/out/approved-ui-1207',{recursive:true});
await page.screenshot({path:'demo/out/approved-ui-1207/plan.png',fullPage:true});

// Native rotate controls + server layout adoption reproduce frame growth;
// no geometry/frame constant is frozen to make this pass.
out.frameGrowth=await page.evaluate(async()=>{
 const c=window.__card,ui=window.__hpTest,results=[];
 const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const wait=async()=>{await ui.settled();const start=performance.now();while(c._modeTransitionBusy||c._continuity.state!=='steady'){
   if(performance.now()-start>3000)throw Error('Growth fixture did not finish adopting');await frame();}await ui.settled();};
 const read=()=>{const svg=c.renderRoot.querySelector('.plan-svg'),v=c._view;return {ppu:svg.getBoundingClientRect().width/svg.viewBox.baseVal.width,
   cx:v.x+v.w/2,cy:v.y+v.h/2,base:[...c._baseVb()]};};
 c._showFar=true;c._frame=null;c.requestUpdate();await wait();
 const id=c._displayDevices.find(device=>device.space===c._space&&!device.hidden)?.id;
 if(!id)throw Error('No visible device for growth fixture');
 for(let rotation=0;rotation<4;rotation++){
  if(rotation){c.renderRoot.querySelector('[data-hp=rotate-right]').click();await new Promise(resolve=>setTimeout(resolve,300));await wait();}
  const before=read();
  await ui.setLayout({...c._layout,[id]:{s:c._space,x:3+rotation*2,y:2+rotation*3}});await wait();
  const after=read();
  results.push({before,after,pass:Math.abs(before.ppu-after.ppu)<1e-5&&Math.hypot(before.cx-after.cx,before.cy-after.cy)<1e-5
    &&JSON.stringify(before.base)!==JSON.stringify(after.base)});
 }
 console.log('Growth observations',JSON.stringify(results));return results.every(item=>item.pass);
});
await mode('view');
await page.waitForFunction(()=>window.__card._continuity.state==='steady');
out.motion=await page.evaluate(async()=>{
 const c=window.__card,root=c.renderRoot,frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const requests=[],request=c.requestUpdate.bind(c);c.requestUpdate=(...args)=>{if(c._modeTransition.active)requests.push({name:String(args[0]),stack:new Error().stack.split('\n').slice(1,5)});return request(...args);};
 const original=c.render.bind(c);let runningRenders=0;c.render=(...args)=>{if(c._modeTransition.active)runningRenders++;return original(...args);};
 const initial=root.querySelector('.plan-svg'),ppu=initial.getBoundingClientRect().width/initial.viewBox.baseVal.width;
 const samples=[];
 c._setMode('plan');await frame();await frame();c._setMode('devices');await frame();c._setMode('decor');
 const start=performance.now();
 while(c._modeTransitionBusy&&performance.now()-start<2500){await frame();const svg=root.querySelector('.plan-svg');samples.push(svg.getBoundingClientRect().width/svg.viewBox.baseVal.width);}
 await c.updateComplete;await frame();
 const stage=root.querySelector('.stage');
 console.log('Rapid observations',JSON.stringify({ppu,samples,runningRenders,requests}));return {rapidSettled:!c._modeTransitionBusy&&!stage.inert,
   scaleKept:samples.every(value=>Math.abs(value-ppu)<1e-5),
   noFullRenderPerFrame:runningRenders===0,
   sceneStylesRetired:!root.querySelector('.zoomwrap').style.width&&!stage.style.width};
});
for(const [name,value] of Object.entries(out.motion))out[name]=value;
delete out.motion;
// An unassigned enclosed wall face has one scoped hint throughout its hover.
await page.evaluate(async()=>{
 await window.__hpTest.setServerConfig({model_version:10,markers:[],spaces:[{id:'closed-1207',title:'Closed contour',cell_cm:5,rooms:[],partitions:[
  {id:'top',a:[.2,.2],b:[.8,.2],cm:15},{id:'right',a:[.8,.2],b:[.8,.8],cm:15},
  {id:'bottom',a:[.8,.8],b:[.2,.8],cm:15},{id:'left',a:[.2,.8],b:[.2,.2],cm:15}]}]});
});
await mode('plan');await page.evaluate(()=>window.__hpTest.setTool('select'));await settle();
const contour=await page.evaluate(()=>{
 const svg=window.__card.renderRoot.querySelector('.plan-svg'),p=new DOMPoint(500,500).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};
});
await page.mouse.move(contour.x,contour.y);
await card.locator('[data-hp=toast][data-id="room-face"]').waitFor({state:'visible'});
await page.evaluate(()=>{window.__hintText=window.__card.renderRoot.querySelector('[data-hp=toast]').firstChild;});
await page.mouse.move(contour.x+5,contour.y+4);
out.contourHintDoesNotRestart=await page.evaluate(()=>window.__card.renderRoot.querySelector('[data-hp=toast]').firstChild===window.__hintText);
await page.mouse.move(10,10);await page.waitForTimeout(180);
out.contourHintRetires=await card.locator('[data-hp=toast][data-id="room-face"]').count()===0;
await page.evaluate(()=>window.__hpTest.setServerConfig({model_version:10,markers:[],spaces:[{id:'empty-1207',title:'Empty plan',cell_cm:5,rooms:[],partitions:[]}]}));
await page.evaluate(()=>window.__hpTest.setTool('draw'));await settle();
const empty=await page.evaluate(()=>{const svg=window.__card.renderRoot.querySelector('.plan-svg'),matrix=svg.getScreenCTM();
 const first=new DOMPoint(500,500).matrixTransform(matrix),next=new DOMPoint(600,600).matrixTransform(matrix);return {first:{x:first.x,y:first.y},next:{x:next.x,y:next.y}};});
await page.mouse.click(empty.first.x,empty.first.y);await page.mouse.move(empty.next.x,empty.next.y);
await card.locator('.active-vertex').waitFor({state:'visible'});
out.emptyPlanUsesSameNodeMetric=await card.locator('.active-vertex').evaluate(node=>node.getAttribute('r')===window.__existingNodeRadius&&getComputedStyle(node).strokeWidth===window.__existingNodeOutline);
await page.keyboard.press('Escape');
checkAll(out);await finish(browser,out);
