/** #871: native held-input frames, not a private camera write or settled-only check. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchColdView, requirePinnedBrowser, checkAll, finish } from './serve.mjs';

requirePinnedBrowser();
const { page, browser } = await launchColdView({ width: 1200, height: 900 }, 1, [], { hasTouch: true });
const out = {}, evidence = [];
const settle = () => page.evaluate(() => window.__hpTest.settled());
try {
  await page.evaluate(async () => {
    const c = window.__card;
    for (const suffix of ['robo', 'second', 'local']) {
      window.__addRegistryEntity(`vacuum.${suffix}`, null, 'cleaning');
      window.__addRegistryEntity(`camera.${suffix}_map`, null, 'idle');
    }
    const server = { e_vacuum_second: {
      current: { map_id:'m1', started:10, ended:null, points:[[220,280],[320,280],[400,400],[500,450]] },
      previous: { map_id:'m1', started:1, ended:10, points:[[300,900],[500,900],[600,800]] },
    }};
    const baseWS = c.hass.callWS.bind(c.hass);
    const states = {...c.hass.states};
    for (const suffix of ['robo','second','local']) {
      states[`vacuum.${suffix}`] = {entity_id:`vacuum.${suffix}`,state:'cleaning',attributes:{friendly_name:suffix}};
      states[`camera.${suffix}_map`] = {entity_id:`camera.${suffix}_map`,state:'idle',attributes:{
        vacuum_position:{x:950,y:1150},map_name:'m1',
        ...(suffix==='robo'?{path:{path:[[{x:500,y:400},{x:700,y:400}],
          [{x:800,y:700},{x:850,y:800},{x:950,y:1150}]]}}:{}),
      }};
    }
    const hass = {...c.hass,states,callWS:async m=>m.type==='houseplan/trail/get'?{trails:server}:baseWS(m)};
    c.hass = hass;
    await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...cfg.markers,
      ...['robo','second','local'].map(suffix=>({id:`e_vacuum_${suffix}`,binding:`entity:vacuum.${suffix}`,space:'f1',
        vacuum:{source:`camera.${suffix}_map`,trail_mode:'always',map_routes:[
          {id:`${suffix}-one`,source:`camera.${suffix}_map`,map_id:'m1',space:'f1',calibration:[.5,0,0,0,.5,0]},
          {id:`${suffix}-two`,source:`camera.${suffix}_map`,map_id:'m2',space:'garden',calibration:[.5,0,0,0,.5,0]},
        ]},
      }))]}));
    await window.__hpTest.setLayout(layout=>({...layout,...Object.fromEntries(
      ['robo','second','local'].map((s,i)=>[`e_vacuum_${s}`,{s:'f1',x:.1+i*.07,y:.1}]))}));
    // A genuine fresh mount loads trails through the real HA transport boundary.
    const fresh = document.createElement('houseplan-card');
    fresh.setConfig({type:'custom:houseplan-card',title:'Vacuum camera witness',language:'en'});
    fresh.hass=hass; c.replaceWith(fresh); window.__card=fresh;
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => window.__card.renderRoot.querySelectorAll('.vacpuck').length===3);
  // Local fallback receives ordinary HA samples, preserving runtime recording.
  for (const [x,y] of [[500,500],[600,500],[700,600],[800,650]]) {
    await page.evaluate(([x,y])=>{
      const c=window.__card, old=c.hass.states['camera.local_map'];
      c.hass={...c.hass,states:{...c.hass.states,'camera.local_map':{...old,
        attributes:{...old.attributes,vacuum_position:{x,y}}}}};
    },[x,y]);
    // The real recorder samples on its 250 ms tick. Let each HA coordinate
    // reach it; four synchronous replacements are just one observed sample.
    await page.waitForTimeout(300);
    await settle();
  }
  await page.waitForFunction(() => window.__card.renderRoot.querySelectorAll('.vactrail line.tip.core').length===2);
  out.sourceVariantsAndPrevious = await page.evaluate(() => {
    const r=window.__card.renderRoot, paths=[...r.querySelectorAll('.vactrail > path.core')];
    return paths.length===3 && !!r.querySelector('.vactrail g.prev path.core')
      && paths.some(p=>(p.getAttribute('d').match(/M /g)||[]).length===2);
  });
  await page.waitForTimeout(1300); // CSS puck interpolation completes before the static-source witness.
  await page.evaluate(()=>{
    const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
    window.__vacRafProof={pending:new Set(),maxPending:0,frames:new Map(),scheduled:0};
    window.requestAnimationFrame=callback=>{
      if(!new Error().stack?.includes('_vacRafLoop'))return request(callback);
      const proof=window.__vacRafProof;
      const id=request(at=>{
        proof.pending.delete(id);proof.frames.set(at,(proof.frames.get(at)||0)+1);callback(at);
      });
      proof.pending.add(id);proof.scheduled++;proof.maxPending=Math.max(proof.maxPending,proof.pending.size);
      return id;
    };
    window.cancelAnimationFrame=id=>{window.__vacRafProof.pending.delete(id);cancel(id);};
  });

  async function beginSamples(label) {
    await page.evaluate(label=>{
      window.__vacCameraEvidence={label,samples:[],commits:new Set(),rafIds:new Set()};
      const sample=()=>{
        const c=window.__card,r=c.renderRoot,e=window.__vacCameraEvidence;
        const plan=r.querySelector('.plan-svg'), paths=[...r.querySelectorAll('.vactrail path.core')];
        const pathErrors=paths.map(path=>{
          const p=path.getPointAtLength(0), a=p.matrixTransform(path.getScreenCTM()),b=p.matrixTransform(plan.getScreenCTM());
          return Math.hypot(a.x-b.x,a.y-b.y);
        });
        const tipErrors=[...r.querySelectorAll('.vactrail line.tip.core')].map(tip=>{
          const puck=[...r.querySelectorAll('.vacpuck')].find(p=>p.dataset.mid===tip.dataset.mid);
          if(!puck)return Infinity;
          const p=new DOMPoint(+tip.getAttribute('x2'),+tip.getAttribute('y2')).matrixTransform(tip.getScreenCTM());
          const box=puck.getBoundingClientRect();
          return Math.hypot(p.x-box.left-box.width/2,p.y-box.top-box.height/2);
        });
        const svg=r.querySelector('.vactrail'),box=svg?.getBoundingClientRect();
        const clip=getComputedStyle(svg).clipPath;
        e.commits.add(c.updateComplete); // one Promise per scheduled Lit update, read-only.
        if(c._vacRaf)e.rafIds.add(c._vacRaf); // resource assertion only, never a private writer.
        e.samples.push({at:performance.now(),pathErrors,tipErrors,d:paths.map(p=>p.getAttribute('d')),
          matrix:svg?Array.from(['a','b','c','d','e','f'],k=>svg.getScreenCTM()[k]):null,
          viewBox:svg?.getAttribute('viewBox'),clip,box:box?{w:box.width,h:box.height}:null,
          stage:{w:r.querySelector('.stage').clientWidth,h:r.querySelector('.stage').clientHeight},
          parentTransform:svg?.parentElement.style.transform,sceneTransform:svg?.style.transform});
        window.__vacCameraSampleRaf=requestAnimationFrame(sample);
      };
      window.__vacCameraSampleRaf=requestAnimationFrame(sample);
    },label);
  }
  async function stopSamples({ changingSource=false }={}) {
    const e=await page.evaluate(()=>{
      cancelAnimationFrame(window.__vacCameraSampleRaf);
      const e=window.__vacCameraEvidence;
      return {...e,commits:e.commits.size,rafIds:e.rafIds.size};
    });
    evidence.push(e);
    out[`${e.label}:landmarks`] = e.samples.length>=3 && e.samples.every(s=>s.pathErrors.length>=3 && s.pathErrors.every(n=>n<=1));
    // Native integration geometry keeps its real endpoint; only sampled
    // server/local paths receive the animated position connector (#872).
    out[`${e.label}:tips`] = e.samples.every(s=>s.tipErrors.length===2 && s.tipErrors.every(n=>n<=1));
    out[`${e.label}:noDoubleCamera`] = e.samples.every(s=>!s.sceneTransform);
    if(!changingSource) out[`${e.label}:sourceUnchanged`] = e.samples.every(s=>JSON.stringify(s.d)===JSON.stringify(e.samples[0].d));
    out[`${e.label}:noRenderPerMove`] = e.commits<e.samples.length/2;
    out[`${e.label}:boundedPaintWindow`] = e.samples.every(s=>{
      if(s.clip==='none')return !s.parentTransform;
      const values=s.clip.match(/-?[\d.e+]+(?=%)/g)?.map(Number);
      if(!values||values.length<1||values.length>4)return false;
      // Computed CSS serializes the inset as 1–4 values, like margin shorthand.
      const v=[values[0],values[1]??values[0],values[2]??values[0],values[3]??values[1]??values[0]];
      const w=s.box.w*(1-(v[1]+v[3])/100),h=s.box.h*(1-(v[0]+v[2])/100);
      return w<=s.stage.w*1.85+1 && h<=s.stage.h*1.85+1;
    });
  }
  async function nativePan(label,touch=false,telemetry=false,cancel=false) {
    await beginSamples(label);
    const stage=await page.locator('.stage').boundingBox(),x=stage.x+stage.width*.88,y=stage.y+stage.height*.85;
    const cdp=touch?await page.context().newCDPSession(page):null;
    if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    else {await page.mouse.move(x,y);await page.mouse.down();}
    for(const [index,[dx,dy,pause]] of [[-35,0,35],[-90,-25,135],[-30,20,40],[-210,-60,30]].entries()){
      if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy,id:1}]});
      else await page.mouse.move(x+dx,y+dy);
      if(telemetry&&index===1)await page.evaluate(()=>{
        const c=window.__card,old=c.hass.states['camera.robo_map'];
        c.hass={...c.hass,states:{...c.hass.states,'camera.robo_map':{...old,
          attributes:{...old.attributes,vacuum_position:{x:900,y:1080}}}}};
      });
      await page.waitForTimeout(pause);
    }
    if(touch){await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});await cdp.detach();}
    else await page.mouse.up();
    await settle();await stopSamples({changingSource:telemetry});
  }
  async function nativePinch(label) {
    await beginSamples(label);
    const rect=await page.locator('.stage').boundingBox(),x=rect.x+rect.width*.5,y=rect.y+rect.height*.75;
    const cdp=await page.context().newCDPSession(page);
    const points=d=>[{x:x-d,y,id:1},{x:x+d,y,id:2}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(45)});
    for(const d of [55,80,65,100]){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(d)});
      await page.waitForTimeout(65);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    await settle();await stopSamples();
  }
  for(const kiosk of [false,true]){
    if(kiosk)await page.evaluate(async()=>{
      const c=window.__card;
      c.setConfig({type:'custom:houseplan-card',kiosk:true,cycle:0,language:'en'});
      await window.__hpTest.settled();
    });
    for(const iso of [false,true]){
    const mode=`${kiosk?'kiosk':'view'}-${iso?'iso':'flat'}`;
    await page.evaluate(on=>window.__hpTest.setVolumetricView(on),iso);
    await nativePan(`${mode}-mouse`,false);
    await nativePan(`${mode}-touch`,true);
    await nativePan(`${mode}-cancel`,true,false,true);
    await nativePan(`${mode}-telemetry`,false,true);
    await nativePinch(`${mode}-pinch`);
    // Wheel/Fit are public controls; keep sampling all intermediate camera frames.
    await beginSamples(`${mode}-zoom`);
    const rect=await page.locator('.stage').boundingBox();
    await page.mouse.move(rect.x+rect.width*.8,rect.y+rect.height*.8);await page.mouse.wheel(0,-180);
    await page.waitForTimeout(300);
    if(!kiosk)await page.locator('[data-hp="zoom-fit"]').click();
    await page.waitForTimeout(300);
    await stopSamples();
    }
  }
  out.singleVacuumRaf=await page.evaluate(()=>{
    const p=window.__vacRafProof;
    return p.scheduled>10&&p.maxPending===1&&[...p.frames.values()].every(n=>n===1);
  });
  // Labelled lifecycle boundary injection, not a trusted gesture or real-GPU proof.
  out.hiddenStopsWrites=await page.evaluate(async()=>{
    const c=window.__card,lines=[...c.renderRoot.querySelectorAll('line.tip')];
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
    const before=lines.map(n=>n.getAttribute('x2')+':'+n.getAttribute('y2'));
    await new Promise(r=>setTimeout(r,50));
    return c._vacRaf===0&&lines.every((n,i)=>n.getAttribute('x2')+':'+n.getAttribute('y2')===before[i]);
  });
  await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.__card._vacRaf>0);
  out.visibleRestarts=true;
  // Real HA registry disable/reactivation cannot leave the robot's trail behind.
  await page.evaluate(()=>{
    window.__setRegistryDisabled('entity','vacuum.second','user');
    const c=window.__card;c.hass={...c.hass};
  });
  await page.waitForFunction(()=>!window.__card.renderRoot.querySelector('.vacpuck[data-mid="e_vacuum_second"]'));
  out.haDisabled = await page.evaluate(()=>!window.__card.renderRoot.querySelector('line.tip[data-mid="e_vacuum_second"]'));
  await page.evaluate(()=>{
    window.__setRegistryDisabled('entity','vacuum.second',null);
    const c=window.__card;c.hass={...c.hass,states:{...c.hass.states}};
  });
  await settle();
  // Re-enabled entities resume through normal HA state delivery after registry refresh.
  await page.waitForTimeout(250);
  await page.evaluate(()=>{
    const c=window.__card,old=c.hass.states['camera.second_map'];
    c.hass={...c.hass,states:{...c.hass.states,'camera.second_map':{...old,
      attributes:{...old.attributes,vacuum_position:{x:905,y:1080}}}}};
  });
  await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('line.tip.core[data-mid="e_vacuum_second"]'));
  out.haReactivated=true;
  // Dispose the actual current DOM; retired lines must never receive another tip write.
  out.disposal = await page.evaluate(async()=>{
    const c=window.__card,lines=[...c.renderRoot.querySelectorAll('line.tip')];
    const before=lines.map(l=>[l.getAttribute('x2'),l.getAttribute('y2')]);
    c.remove();await new Promise(r=>setTimeout(r,60));
    return c._vacRaf===0&&lines.every((l,i)=>l.getAttribute('x2')===before[i][0]&&l.getAttribute('y2')===before[i][1]);
  });
  await page.evaluate(async()=>{document.getElementById('host').append(window.__card);await window.__hpTest.settled();});
  await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('line.tip.core[data-mid="e_vacuum_second"]')&&window.__card._vacRaf>0);
  out.remountRecovers=true;
  for(const patch of [{hidden:true},{hidden:false,display:'static_icon'},
    {hidden:false,display:'badge',vacuum:{source:'camera.second_map',trail_mode:'never',calibration:{m1:[.5,0,0,0,.5,0]}}}]){
    await page.evaluate(patch=>window.__hpTest.setServerConfig(cfg=>({...cfg,markers:cfg.markers.map(m=>
      m.id==='e_vacuum_second'?{...m,...patch}:m)})),patch);
    const name=patch.hidden?'hidden':patch.display==='static_icon'?'static':'never';
    out[`disabledOverlay-${name}`] = await page.evaluate(()=>
      !window.__card.renderRoot.querySelector('line.tip[data-mid="e_vacuum_second"]'));
  }
  await page.evaluate(()=>window.__hpTest.switchSpace('garden'));
  out.oldFloorRetired = await page.evaluate(()=>!window.__card.renderRoot.querySelector('.vactrail')&&window.__card._vacRaf===0);
} finally {
  mkdirSync('demo/out/vacuum-camera-871',{recursive:true});
  writeFileSync('demo/out/vacuum-camera-871/frames.json',JSON.stringify({browser:browser.version(),out,evidence},null,2));
  console.log(JSON.stringify(out,null,1));
  checkAll(out);
  await finish(browser,out);
}
