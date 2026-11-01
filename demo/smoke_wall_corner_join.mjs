/** #1169: actual panel/static SVG stroke; independent generated geometry, no owner data. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {launchPanelCold,check,finish,requirePinnedBrowser} from './serve.mjs';
import {applyUiKitTheme} from './helpers/ui-kit-theme.mjs';
import {waitForUiKitPaint} from './helpers/ui-kit-paint.mjs';
import {wallCornerJoinSpace} from './fixtures/wall-corner-join.mjs';
import {spaceModels,GRID_PITCH} from '../test-build/space-geometry.js';
import {linearWallJoinPatches,wallCmToUnits} from '../test-build/wall-thickness.js';
requirePinnedBrowser('#1169 wall corner join');
const config={model_version:10,spaces:[wallCornerJoinSpace()],markers:[],settings:{filter_seeded:true}};
const model=spaceModels(config)[0],patch=linearWallJoinPatches(model.partitions.map(p=>({a:p.a,b:p.b,halfDepth:wallCmToUnits(p.cm,1,GRID_PITCH)/2})))[0];
const samples=[patch[1],patch[3]].map(p=>[(p[0]+patch[0][0])/2,(p[1]+patch[0][1])/2]);
const folder=process.env.HP_CORNER_ARTIFACTS||'artifacts/1169-wall-corner';mkdirSync(folder,{recursive:true});
const {page,browser}=await launchPanelCold({width:1400,height:1050});
page.setDefaultTimeout(12000);
const card=page.locator('houseplan-panel houseplan-card');
const evidence={source:'independent generated pair',samples,checks:[]};
const settle=()=>page.evaluate(async()=>{await window.__hpTest.waitForWrites();await window.__hpTest.settled();});
const stored=()=>page.evaluate(()=>JSON.stringify({config:window.__card._serverCfg,layout:window.__card._layout,configRev:window.__card._cfgRev,layoutRev:window.__card._layoutRev}));
const inspect=async(name,staticCard=false)=>{
 const result=await page.evaluate(({samples,staticCard})=>{
  const root=(staticCard?window.__cornerStatic:window.__card).renderRoot;
  const paths=[...root.querySelectorAll('.wallbody')].filter(p=>p.getAttribute('d'));
  const stroke=p=>paths.some(path=>path.isPointInStroke(new DOMPoint(...p)));
  const fill=p=>paths.some(path=>path.isPointInFill(new DOMPoint(...p)));
  return {paths:paths.length,seams:samples.map(stroke),solid:samples.map(fill),freeCap:stroke([450,-380]),outside:fill([700,700]),d:paths.map(p=>p.getAttribute('d'))};
 },{samples,staticCard});
 check(`${name}: actual wall paths exist`,result.paths>0);
 check(`${name}: neither full cap paints an internal seam`,result.seams,[false,false]);
 check(`${name}: joining material retained`,result.solid,[true,true]);
 check(`${name}: real free cap retained`,result.freeCap);
 check(`${name}: outside stays empty`,!result.outside);
 evidence.checks.push({name,...result});
};
try{
 await page.evaluate(cfg=>{
  window.__pushServerConfig(cfg);window.__pushServerLayout({});history.replaceState(null,'','/houseplan');
  const host=document.getElementById('host');host.style.cssText='width:100%;height:100vh;margin:0;padding:0';
  const panel=document.createElement('houseplan-panel');window.__cornerPanel=panel;
  panel.panel={component_name:'houseplan-panel'};panel.route={prefix:'/houseplan',path:''};panel.narrow=false;panel.hass=window.__mkHass();host.replaceChildren(panel);
 },config);
 await page.evaluate(()=>import('/assets/houseplan-panel.js'));
 await page.waitForFunction(()=>{
  const c=window.__cornerPanel.shadowRoot?.querySelector('houseplan-card');
  if(!c?.renderRoot.querySelector('ha-card[data-hp-state="ready"]'))return false;window.__card=c;return !c._booting;
 });
 await card.locator('[data-hp="zoom-fit"]').click();await settle();
 const before=await stored();
 for(const mode of ['view','plan']){
  await page.evaluate(mode=>window.__hpTest.setMode(mode),mode);await waitForUiKitPaint(page);
  for(const theme of ['light','dark']){
   await applyUiKitTheme(page,theme);await waitForUiKitPaint(page);await inspect(`${mode}-${theme}`);
   await page.screenshot({path:`${folder}/${mode}-${theme}.png`});
  }
 }
 check('View/Plan/theme/fit do not write plan',await stored(),before);
 await page.evaluate(()=>window.__hpTest.setMode('view'));await settle();
 await page.evaluate(async()=>{
  await customElements.whenDefined('houseplan-space-card');
  const c=window.__card,cfg=structuredClone(c._serverCfg),base=c.hass.callWS.bind(c.hass);
  const staticCard=document.createElement('houseplan-space-card');window.__cornerStatic=staticCard;
  staticCard.style.cssText='display:block;width:1100px;height:800px';
  staticCard.setConfig({type:'custom:houseplan-space-card',space:c._space,show_button:false});
  staticCard.hass={...c.hass,callWS:async m=>m.type==='houseplan/config/get'?{config:cfg,rev:1}:m.type==='houseplan/layout/get'?{layout:{},rev:1}:base(m)};
  document.body.appendChild(staticCard);
 });
 await page.waitForFunction(()=>window.__cornerStatic.renderRoot?.querySelector('.wallbody')&&window.__cornerStatic._stageWidth>0);
 for(const theme of ['light','dark']){
  await applyUiKitTheme(page,theme);
  await page.evaluate(()=>{
   const c=window.__card,s=window.__cornerStatic;
   for(const key of c.style)s.style.setProperty(key,c.style.getPropertyValue(key));
   s.hass={...s.hass,themes:structuredClone(c.hass.themes)};s.requestUpdate();return s.updateComplete;
  });
  await inspect(`static-${theme}`,true);await page.locator('houseplan-space-card').screenshot({path:`${folder}/static-${theme}.png`});
 }
 await page.evaluate(()=>window.__cornerStatic.remove());
 await page.evaluate(()=>window.__hpTest.setMode('plan'));await settle();
 await page.evaluate(()=>window.__hpTest.setTool('draw'));await waitForUiKitPaint(page);
 const screen=point=>card.locator('.decorlayer').evaluate((layer,p)=>{const q=new DOMPoint(...p).matrixTransform(layer.getScreenCTM());return {x:q.x,y:q.y};},point);
 const a=await screen([450,-380]),b=await screen([650,-380]);
 await page.mouse.click(a.x,a.y);await page.mouse.move(b.x,b.y);await waitForUiKitPaint(page);
 const preview=await card.evaluate(c=>[...c.renderRoot.querySelectorAll('.drawwall-preview-fill')].map(p=>p.getAttribute('d')));
 check('Draw next to existing wall has real raw join preview',preview.length>=2);
 check('Raw join preview has no support triangle overlay',preview.slice(1).every(d=>(d.match(/M /g)||[]).length===1&&(d.match(/ L /g)||[]).length===3));
 evidence.preview=preview;
 await page.screenshot({path:`${folder}/draw-preview.png`});
 await page.keyboard.press('Escape');await settle();
 check('Preview and cancel do not write plan',await stored(),before);
 evidence.completed=true;
}finally{
 writeFileSync(`${folder}/observations.json`,JSON.stringify(evidence,null,2));await finish(browser,evidence);
}