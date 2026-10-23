// #866/#1003: native wall capture/release, upright content and unlabelled guide.
import { launch, check, checkAll, finish } from './serve.mjs';
import { mkdirSync,writeFileSync } from 'node:fs';
const {page,browser}=await launch({width:1600,height:1100},1,[],{hasTouch:true});
const input=await page.context().newCDPSession(page),card=page.locator('houseplan-card');
const dir='artifacts/866/walls';mkdirSync(dir,{recursive:true});const results=[];
await page.evaluate(()=>{
  const c=window.__card;window.__wallHidden=c._devices.map(d=>({...d.marker,id:d.id,hidden:true,
    binding:d.marker?.binding||(d.bindingKind==='virtual'?'virtual':`${d.bindingKind}:${d.bindingRef}`)}));
  const original=c.hass.callWS;window.__wallWrites=[];
  c.hass={...c.hass,states:{...c.hass.states,'sensor.contact_value':{entity_id:'sensor.contact_value',state:'26%',attributes:{}}},
    callWS:async m=>{if(m.type==='houseplan/layout/update')window.__wallWrites.push(structuredClone(m));return original(m);}};
});
const settle=async()=>{
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing&&!window.__card._devicePositionBusy);
  await page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
};
const cases=[];
for(const zoom of [.35,.5,1,2])for(const angle of [0,90,30,-30,45,-45,75,-75])for(const side of [-1,1])cases.push({zoom,angle,side,badge:null,lang:'en'});
for(const badge of ['left','right','top','bottom'])cases.push({zoom:1,angle:45,side:1,badge,lang:'ru'});
for(const item of cases){
  console.log(`wall ${JSON.stringify(item)}`);
  const mode=await page.evaluate(()=>window.__card._mode);
  if(mode!=='view'){await card.locator('[data-hp="editor-close"]').first().click();await settle();}
  await page.evaluate(async item=>{
    const c=window.__card,a=item.angle*Math.PI/180,n=[-Math.sin(a)*item.side,Math.cos(a)*item.side],t=[Math.cos(a),Math.sin(a)];
    c.setConfig({...c._config,language:item.lang,icon_size:5});
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.settings={...cfg.settings,volumetric_view:false};
      cfg.spaces=[{id:c._space,title:'Wall',view_box:[0,0,1,1],cell_cm:5,rooms:[],walls:[],wall_segments:[],openings:[],
        partitions:[{id:'contact-wall',a:[.5-.3*t[0],.5-.3*t[1]],b:[.5+.3*t[0],.5+.3*t[1]],cm:36}],
        settings:{show_borders:true,show_names:false}}];
      cfg.markers=[...window.__wallHidden,{id:'wall-mover',binding:'virtual',space:c._space,name:'Wall mover',
        icon:'mdi:thermometer',angle:37,size:40/45,display:item.badge?'badge':'static_icon',
        value_badge:{enabled:!!item.badge,position:item.badge||'right',source:{kind:'entity_state',entity_id:'sensor.contact_value'}}}];return cfg;
    });
    await window.__hpTest.setLayout(layout=>({...layout,'wall-mover':{s:c._space,x:(500+n[0]*100+t[0]*20)/1000,y:(500+n[1]*100+t[1]*20)/1000}}));
  },item);
  await settle();
  await card.locator('[data-hp="mode-tab"][data-mode="devices"]').click();await settle();
  // The editor deliberately owns a different camera from View. Calibrate the
  // actual editor, on empty stage rather than on the fixture's central wall.
  const pinch=await page.evaluate(zoom=>{const c=window.__card,r=c.renderRoot.querySelector('.stage').getBoundingClientRect();return{x:r.right-120,y:r.top+100,ratio:zoom/c._zoom};},item.zoom);
  if(Math.abs(pinch.ratio-1)>.0001){
    const points=d=>[{id:1,x:pinch.x-d/2,y:pinch.y},{id:2,x:pinch.x+d/2,y:pinch.y}];
    await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(100)});
    for(let i=1;i<=8;i++)await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(100*(1+(pinch.ratio-1)*i/8))});
    await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  }
  // Zooming around empty screen space shifts the camera. Pan the fixture back
  // into the viewport, rather than clicking an off-screen projected coordinate.
  for(let pass=0;pass<5;pass++){
    const pan=await page.evaluate(()=>{const c=window.__card,r=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._viewOr(c._baseVb());
      const dx=r.width/2-(500-v.x)/v.w*r.width,dy=r.height/2-(500-v.y)/v.h*r.height;
      return{x:r.right-100,y:r.top+100,dx:Math.max(-r.width*.25,Math.min(r.width*.25,dx)),
        dy:Math.max(-r.height*.25,Math.min(r.height*.25,dy)),done:Math.hypot(dx,dy)<.5};});
    if(pan.done)break;
    await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:3,x:pan.x,y:pan.y}]});
    for(let i=1;i<=6;i++)await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:3,x:pan.x+pan.dx*i/6,y:pan.y+pan.dy*i/6}]});
    await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  }
  const target=await page.evaluate(item=>{
    const c=window.__card,a=item.angle*Math.PI/180,n=[-Math.sin(a)*item.side,Math.cos(a)*item.side];
    const s=c._deviceContacts.scene.shapes.get('wall-mover'),m=s.marker,b=m.box;
    const w=b.right-b.left,h=b.bottom-b.top,r=Math.min(w,h)/2,cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;
    const min=cx*n[0]+cy*n[1]-r-Math.abs(w-h)/2*Math.abs(w>=h?n[0]:n[1])-m.diameter*.009375;
    const expected={x:500+n[0]*(15-min),y:500+n[1]*(15-min)};
    const stage=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._viewOr(c._baseVb()),px=stage.width/v.w,py=stage.height/v.h;
    const project=p=>({x:stage.x+(p.x-v.x)*px,y:stage.y+(p.y-v.y)*py});
    const norm=Math.hypot(n[0]*px,n[1]*py);
    return{expected,to:project(expected),from:project(m),nx:n[0]*px/norm,ny:n[1]*py/norm,writes:window.__wallWrites.length,zoom:c._zoom};
  },item);
  await page.mouse.move(target.from.x,target.from.y);await page.mouse.down();
  const move=async radius=>{await page.mouse.move(target.to.x+target.nx*radius,target.to.y+target.ny*radius,{steps:5});await settle();};
  const state=()=>page.evaluate(()=>{
    const c=window.__card,root=c.renderRoot;
    const labels=[...root.querySelectorAll('[data-device-snap="wall"]')].filter(n=>n.closest('.hp-editor-only-layer')?.style.opacity!=='0');
    return{p:structuredClone(c._layout['wall-mover']),hint:c._deviceDrag?.contact?.hint?.kind||null,
      labels:labels.map(n=>({text:n.textContent.trim(),line:['x1','y1','x2','y2'].map(k=>Number(n.querySelector('line')?.getAttribute(k)))})),
      angle:root.querySelector('[data-id="wall-mover"] .device-core ha-icon')?.style.transform,
      writes:window.__wallWrites.length};
  });
  await move(5.5);const entered=await state();await move(8.5);const held=await state();await move(9.5);const released=await state();
  await move(5.5);await page.mouse.up();await settle();const dropped=await state();
  const exact=p=>Math.hypot(p.x*1000-target.expected.x,p.y*1000-target.expected.y)<.001;
  const result={...item,actualZoom:target.zoom,captured:entered.hint==='wall'&&exact(entered.p),held:held.hint==='wall'&&exact(held.p),
    released:released.hint===null,guide:entered.labels.length===1&&entered.labels[0].text===''
      &&entered.labels[0].line.every(Number.isFinite)&&Math.hypot(entered.labels[0].line[2]-entered.labels[0].line[0],entered.labels[0].line[3]-entered.labels[0].line[1])>0,
    upright:entered.angle==='rotate(37deg)',oneWrite:dropped.writes===target.writes+1,exactDrop:exact(dropped.p),noGuideAfterDrop:!dropped.labels.length};
  checkAll(Object.fromEntries(Object.entries(result).filter(([key])=>!['zoom','actualZoom','angle','side','badge','lang'].includes(key))),{});
  results.push(result);writeFileSync(`${dir}/matrix.json`,JSON.stringify(results,null,2));
  check('native-zoom',Math.abs(target.zoom-item.zoom)<.001,true);
}
await finish(browser,results);
