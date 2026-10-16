// #866 AC1: frozen designer renderer versus actual production renderer.
import { launch, check, finish } from './serve.mjs';
import { requirePinnedBrowser } from '../scripts/browser-attestation.mjs';
import { designerContactCases, designerReferencePaths } from './fixtures/device-contact-designer-866.mjs';
import { markerSVG } from '../test/fixtures/866-designer/marker.mjs';
import { face, clusters } from '../test/fixtures/866-designer/geometry.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
requirePinnedBrowser('#866 frozen designer comparison');
const {page,browser}=await launch({width:1600,height:1100},1,[],{hasTouch:true});
const input=await page.context().newCDPSession(page);
const ref=await browser.newPage({viewport:{width:1000,height:600},deviceScaleFactor:1});
const dir=process.env.HP_CONTACT_ARTIFACTS || 'artifacts/866/designer'; mkdirSync(dir,{recursive:true});
const frozen=new URL('../test/fixtures/866-designer/',import.meta.url);
const styles=['demo.css','review.css'].map(f=>readFileSync(new URL(f,frozen),'utf8')).join('\n');
const glyphs=JSON.parse(readFileSync(new URL('devices.json',frozen),'utf8'));
const matrix=[];
writeFileSync(`${dir}/material.json`,JSON.stringify({fingerprint:await page.evaluate(()=>globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__),
  browser:browser.version(),deviceScaleFactor:1,headless:true,realGpu:false,
  archiveSha256:'d03cf880dbfc4482eac38d51b3f5b386c88e94204baa3a1390bcb93a2e59482b',
  frozenGeometrySha256:createHash('sha256').update(readFileSync(new URL('geometry.mjs',frozen))).digest('hex')},null,2));
await page.evaluate(async()=>{
  const c=window.__card, originals=c._devices.filter(d=>!d.id.startsWith('designer-'));
  window.__designerHidden=originals.map(d=>({...d.marker,id:d.id,
    binding:d.marker?.binding||(d.bindingKind==='virtual'?'virtual':`${d.bindingKind}:${d.bindingRef}`),hidden:true}));
  c.setConfig({...c._config,icon_size:5});
  c.hass={...c.hass,themes:{darkMode:false},entities:{...c.hass.entities,'sensor.designer_value':{entity_id:'sensor.designer_value',platform:'demo'}},
    states:{...c.hass.states,'sensor.designer_value':{entity_id:'sensor.designer_value',state:'26%',attributes:{}}}};
  await window.__hpTest.setServerConfig(cfg=>{
    cfg.spaces=[{id:c._space,title:'Reference',view_box:[0,0,1,1],cell_cm:5,rooms:[],walls:[],wall_segments:[],partitions:[],openings:[],settings:{show_borders:true,show_names:false}}];
    cfg.markers=window.__designerHidden;return cfg;
  });
  const v=c._viewOr(c._baseVb()), rect=c.renderRoot.querySelector('.stage').getBoundingClientRect();
  window.__designerScale=v.w/rect.width;
});
for(const control of [32,56,96]) for(const scene of designerContactCases){
  const factor=control/96;
  console.log(`designer ${scene.id} @ ${control}`);
  await page.evaluate(async({scene,factor})=>{
    const c=window.__card, space=c._space, k=window.__designerScale, ox=100,oy=100;
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.spaces=[{id:space,title:'Designer reference',view_box:[0,0,1,1],cell_cm:5,rooms:[],walls:[],wall_segments:[],openings:[],
        partitions:scene.walls.map(w=>w.w<=w.h?{id:w.id,a:[(ox+(w.x+w.w/2)*factor*k)/1000,(oy+w.y*factor*k)/1000],
          b:[(ox+(w.x+w.w/2)*factor*k)/1000,(oy+w.bottom*factor*k)/1000],cm:w.w*factor*k*1.2}
          :{id:w.id,a:[(ox+w.x*factor*k)/1000,(oy+(w.y+w.h/2)*factor*k)/1000],
          b:[(ox+w.right*factor*k)/1000,(oy+(w.y+w.h/2)*factor*k)/1000],cm:w.h*factor*k*1.2}),
        settings:{show_borders:true,show_names:false,fill_mode:'none'}}];
      cfg.markers=[...window.__designerHidden,...scene.devices.map(d=>({id:d.id,binding:'virtual',space,name:d.id,
        icon:d.badge!=='none'?'mdi:thermometer':scene.id==='grid'?'mdi:power-socket':'mdi:power-plug',
        display:d.badge==='none'?'static_icon':'badge',tap_action:'info',size:(80/103*d.size*factor*k)/45,
        value_badge:{enabled:d.badge!=='none',position:d.badge==='none'?'right':d.badge,
          source:{kind:'entity_state',entity_id:'sensor.designer_value'}}}))]; return cfg;
    });
    await window.__hpTest.setLayout(layout=>({...layout,...Object.fromEntries(scene.devices.map(d=>[d.id,
      {s:space,x:(ox+d.x*factor*k)/1000,y:(oy+d.y*factor*k)/1000}]))}));
    await c.updateComplete;
  },{scene,factor});
  await page.waitForFunction(()=>!!window.__card._deviceContacts?.scene?.shapes.has('designer-0'));
  // Actual native pinch calibrates the whole plane to one CSS px per reference
  // unit. This is camera input, not a private zoom setter or per-marker fit.
  const camera=await page.evaluate(()=>{const c=window.__card,r=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._viewOr(c._baseVb());
    return{x:r.right-100,y:r.top+100,ratio:1/(r.width/v.w*window.__designerScale)};});
  if(Math.abs(camera.ratio-1)>.0001){
    const points=(distance)=>[{id:1,x:camera.x-distance/2,y:camera.y},{id:2,x:camera.x+distance/2,y:camera.y}];
    await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(100)});
    for(let i=1;i<=8;i++)await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(100*(1+(camera.ratio-1)*i/8))});
    await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  }
  // Keep the entire reference rectangle inside the actual stage. A numerically
  // correct path hidden underneath the header is not a visual witness.
  for(let pass=0;pass<4;pass++){
    const pan=await page.evaluate(factor=>{
      const c=window.__card,r=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._viewOr(c._baseVb()),k=window.__designerScale;
      const dx=r.width/2-(100+224*factor*k-v.x)/v.w*r.width,dy=r.height/2-(100+107*factor*k-v.y)/v.h*r.height;
      return{x:r.x+r.width/2,y:r.y+r.height/2,dx:Math.max(-r.width*.3,Math.min(r.width*.3,dx)),
        dy:Math.max(-r.height*.3,Math.min(r.height*.3,dy)),done:Math.hypot(dx,dy)<.1};
    },factor);
    if(pan.done)break;
    await input.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:3,x:pan.x-pan.dx/2,y:pan.y-pan.dy/2}]});
    for(let i=1;i<=6;i++)await input.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:3,x:pan.x-pan.dx/2+pan.dx*i/6,y:pan.y-pan.dy/2+pan.dy*i/6}]});
    await input.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  }
  const actual=await page.evaluate(()=>{
    const c=window.__card,k=window.__designerScale,root=c.renderRoot,stage=root.querySelector('.stage'),rect=stage.getBoundingClientRect(),v=c._viewOr(c._baseVb());
    const world=(x,y)=>[(x-rect.left)/rect.width*v.w+v.x-100,(y-rect.top)/rect.height*v.h+v.y-100];
    const paths=[...root.querySelectorAll('.device-contact-contour')].map(p=>p.getAttribute('d'));
    const free=[...root.querySelectorAll('.dev[data-id^="designer-"]:not([data-hp-device-contact]) .device-shell-frame')].map(el=>{
      const b=el.getBoundingClientRect(),a=world(b.left,b.top),z=world(b.right,b.bottom),r=Math.min(z[0]-a[0],z[1]-a[1])/2;
      return `M${a[0]+r} ${a[1]} H${z[0]-r} A${r} ${r} 0 0 1 ${z[0]} ${a[1]+r} V${z[1]-r} A${r} ${r} 0 0 1 ${z[0]-r} ${z[1]} H${a[0]+r} A${r} ${r} 0 0 1 ${a[0]} ${z[1]-r} V${a[1]+r} A${r} ${r} 0 0 1 ${a[0]+r} ${a[1]} Z`;
    });
    // Contact paths are world coordinates; free CSS capsules already registered.
    const samples=[]; const ns='http://www.w3.org/2000/svg';
    for(const [index,d] of [...paths,...free].entries()){
      const p=document.createElementNS(ns,'path');p.setAttribute('d',d);const length=p.getTotalLength();
      for(let i=0;i<2000;i++){const q=p.getPointAtLength(length*i/2000);samples.push([(q.x-(index<paths.length?100:0))/k,(q.y-(index<paths.length?100:0))/k]);}
    }
    const cores=[...root.querySelectorAll('.dev[data-id^="designer-"]')].map(el=>{
      const b=el.querySelector('.device-core').getBoundingClientRect();return{id:el.dataset.id,center:world(b.x+b.width/2,b.y+b.height/2).map(x=>x/k),d:b.width/rect.width*v.w/k};
    });
    const glyphs=[...root.querySelectorAll('.dev[data-id^="designer-"] .device-core ha-icon')];
    return{samples,cores,paths,free,scale:rect.width/v.w*k,stage:rect.toJSON(),glyphs:glyphs.length,
      paintedGlyphs:glyphs.every(el=>!!el.shadowRoot?.querySelector('path')?.getAttribute('d')),
      clip:{x:rect.left+(100-v.x)/v.w*rect.width,y:rect.top+(100-v.y)/v.h*rect.height}};
  });
  const groups=clusters(scene.devices),byId=new Map(groups.flatMap(g=>g.map(d=>[d.id,g])));
  const refs=designerReferencePaths(scene);
  const shells=refs.map(p=>`<g transform="translate(${p.x} ${p.y})"><path class="group-shell" d="${p.path}"/></g>`).join('');
  const nodes=scene.devices.map(d=>{const b=face(d),glyph=glyphs.find(g=>g.id===(d.badge!=='none'?'device-32':scene.id==='grid'?'device-15':'device-39')).glyph;
    return `<div class="device" data-state="idle" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px">${markerSVG({...d,glyph},scene.devices,byId.get(d.id),scene.walls)}</div>`;}).join('');
  await ref.setContent(`<style>${styles}</style><div class="picture" style="width:448px;height:214px;transform:scale(${factor});transform-origin:0 0">
    <svg viewBox="0 0 448 214">${scene.walls.map(w=>`<rect x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}" fill="#d0d2d3"/>`).join('')}</svg>
    <svg class="group-layer" viewBox="0 0 448 214">${shells}</svg>${nodes}</div>`);
  const expected=await ref.evaluate(factor=>[...document.querySelectorAll('.group-shell')].flatMap(p=>{
    const length=p.getTotalLength(),m=p.getCTM(),out=[];
    for(let i=0;i<2000;i++){const q=p.getPointAtLength(length*i/2000),t=new DOMPoint(q.x,q.y).matrixTransform(m);out.push([t.x*factor,t.y*factor]);}return out;
  }),factor);
  const directed=(from,to)=>Math.sqrt(from.reduce((max,p)=>Math.max(max,to.reduce((best,q)=>Math.min(best,(p[0]-q[0])**2+(p[1]-q[1])**2),Infinity)),0));
  const error=Math.max(directed(actual.samples,expected),directed(expected,actual.samples));
  const coreError=Math.max(...actual.cores.map(a=>{const d=scene.devices.find(d=>d.id===a.id);return Math.max(Math.abs(a.d-d.size*factor*80/103),Math.hypot(a.center[0]-d.x*factor,a.center[1]-d.y*factor));}));
  const name=`${scene.id}-${control}`;
  // All frames use the same measured scene scale, no per-marker registration.
  const crop={...actual.clip,width:448*factor*actual.scale,height:214*factor*actual.scale};
  await page.screenshot({path:`${dir}/${name}-production.png`,clip:crop});
  await ref.screenshot({path:`${dir}/${name}-reference.png`,clip:{x:0,y:0,width:448*factor,height:214*factor}});
  matrix.push({scene:scene.id,title:scene.title,control,boundaryError:error,coreError,productionScale:actual.scale,
    production:`${name}-production.png`,reference:`${name}-reference.png`,pass:error<=1&&coreError<=1,actualPaths:actual.paths,free:actual.free});
  writeFileSync(`${dir}/comparison.json`,JSON.stringify(matrix,null,2));
  check(`${name}:boundary<=1CSSpx`,error<=1,true); check(`${name}:core<=1CSSpx`,coreError<=1,true);
  check(`${name}:control-size`,Math.abs(actual.scale-1)<=.01,true);
  check(`${name}:glyphs-painted`,actual.paintedGlyphs&&actual.glyphs===scene.devices.length,true);
  check(`${name}:whole-production-frame-visible`,crop.x>=actual.stage.left-.5&&crop.y>=actual.stage.top-.5
    &&crop.x+crop.width<=actual.stage.right+.5&&crop.y+crop.height<=actual.stage.bottom+.5,true);
}
await ref.close(); await finish(browser,matrix);
