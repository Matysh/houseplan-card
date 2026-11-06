/** #1255: native Shift edges during a held rotation, including write/history. */
import{mkdirSync}from'node:fs';import{commitWallSegmentModel}from'../test-build/wall-segment-model.js';import{launch,checkAll,finish}from'./serve.mjs';
const{page,browser}=await launch({width:1400,height:1000});const out={};
const base=await page.evaluate(()=>window.__card._serverCfg.spaces[0]);
const config=commitWallSegmentModel({model_version:10,spaces:[{id:base.id,title:'Rotation fixture',cell_cm:5,view_box:[0,0,1,1],plan_url:base.plan_url,plan_aspect:1,plan_angle:17,rooms:[{id:'rotation-room',name:'Room',poly:[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]}],decor:[{id:'rotation-probe',kind:'rect',x:.4,y:.4,w:.18,h:.12,angle:17,color:'#55606c',opacity:1,fill:false}]}],markers:[],settings:{}}).config;
await page.evaluate(async cfg=>{await window.__hpTest.setServerConfig(cfg);await window.__hpTest.setMode('decor');},config);await page.waitForFunction(()=>{const s=window.__card.shadowRoot.querySelector('.stage');return s?.classList.contains('mode-decor')&&!s.classList.contains('mode-transition');});
for(const kind of ['rect','backdrop']){
 await page.evaluate(async kind=>{const c=window.__card;c._decorTool=kind==='backdrop'?'backdrop':'select';c._decorSel=kind==='rect'?'rotation-probe':null;c._applyView(.8,500,500);c.requestUpdate();await c.updateComplete;await window.__hpTest.settled();},kind);
 const h=await page.evaluate(kind=>{const root=window.__card.shadowRoot;const el=root.querySelector(kind==='rect'?'.dtframe .dtrot':'.bdframe .dtrot');if(!el)throw Error('rotation handle missing: '+kind);const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};},kind);
 await page.mouse.move(h.x,h.y);await page.mouse.down();
 if(!await page.evaluate(kind=>kind==='rect'?!!window.__card._dtDrag:window.__card._editorRuntime.backdropGesture.active,kind)){mkdirSync('artifacts/1255',{recursive:true});await page.screenshot({path:'artifacts/1255/capture-failure.png'});console.log(await page.evaluate(h=>({h,hit:window.__card.shadowRoot.elementFromPoint(h.x,h.y)?.outerHTML?.slice(0,300),mode:window.__card._mode,tool:window.__card._decorTool,selected:window.__card._decorSel}),h));throw Error('native handle did not capture');}
 const target=await page.evaluate(kind=>{const c=window.__card,root=c.shadowRoot,el=root.querySelector(kind==='rect'?'.dtframe .dtrot':'.bdframe .dtrot');let cx,cy,r,a;
 if(kind==='rect'){const d=c._dtDrag;cx=d.ax;cy=d.ay;r=d.r0;a=d.a0;}
 else{const box=c._editorRuntime.backdropGesture.rect;cx=box.x+box.w/2;cy=box.y+box.h/2;const p=new DOMPoint(Number(el.getAttribute('cx')),Number(el.getAttribute('cy'))).matrixTransform(el.getScreenCTM());const q=p.matrixTransform(el.closest('svg').getScreenCTM().inverse());r=Math.hypot(q.x-cx,q.y-cy);a=Math.atan2(q.y-cy,q.x-cx)*180/Math.PI;}
 const theta=(a+12.3)*Math.PI/180,at=new DOMPoint(cx+r*Math.cos(theta),cy+r*Math.sin(theta)).matrixTransform(el.closest('svg').getScreenCTM());return{x:at.x,y:at.y};},kind);
 await page.mouse.move(target.x,target.y,{steps:3});
 const angle=()=>page.evaluate(kind=>{const s=window.__card._curSpaceCfg;return kind==='rect'?s.decor.find(x=>x.id==='rotation-probe').angle:s.plan_angle;},kind);
 out[kind+'-normal-five-degree-preview']=await angle()===30;
 await page.keyboard.down('Shift');out[kind+'-keydown-without-motion']=await angle()===45;
 await page.keyboard.up('Shift');out[kind+'-keyup-without-motion']=await angle()===30;
 await page.keyboard.down('Shift');await page.mouse.up();await page.keyboard.up('Shift');await page.evaluate(()=>window.__hpTest.waitForWrites());
 out[kind+'-commit-matches-preview']=await angle()===45;
 await page.keyboard.press('Control+z');await page.evaluate(()=>window.__hpTest.waitForWrites());out[kind+'-undo-one-operation']=await angle()===17;
 await page.keyboard.press('Control+Shift+z');await page.evaluate(()=>window.__hpTest.waitForWrites());const redone=await angle();out[kind+'-redo-one-operation']=redone===45;if(redone!==45)console.log('REDO',await page.evaluate(()=>({angle:window.__card._curSpaceCfg.plan_angle,toast:window.__card._toast,history:window.__card._geometryHistory?.state,drag:window.__card._editorRuntime.backdropGesture.active}))); 
 const stored=await page.evaluate(async kind=>{const reply=await window.__card.hass.callWS({type:'houseplan/config/get'});const cfg=reply.config||reply;const s=cfg.spaces.find(s=>s.id===window.__card._space);return kind==='rect'?s.decor.find(x=>x.id==='rotation-probe').angle:s.plan_angle;},kind);
 out[kind+'-server-retains-angle']=stored===45;
}
console.log(JSON.stringify(out,null,2));checkAll(out);await finish(browser);




