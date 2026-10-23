// #1003: mounted production renderer, synthetic data only. No product patches.
import {launch,check,checkAll,finish} from './serve.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
const dir=process.env.HP_CONTACT_ARTIFACTS||'artifacts/1003/reflow';
mkdirSync(dir,{recursive:true});
const lateFont=readFileSync(new URL('../src/pdf/pdf-font.generated.ts',import.meta.url),'utf8')
  .match(/PDF_FONT_BASE64 = "([^"]+)"/)[1];
for(const [name,width,height,dpr] of [['desktop',1400,1000,1],['tablet',900,1100,2],['mobile',390,844,3]]){
  const {page,browser}=await launch({width,height},dpr,[],{hasTouch:true});
  try{
    await page.addStyleTag({content:'#host{width:calc(100% - 16px);max-width:100%;}'});
    await page.evaluate(async()=>{
      const c=window.__card,space=c._space;
      c.hass={...c.hass,entities:{...c.hass.entities,
        'sensor.row_a':{entity_id:'sensor.row_a',disabled_by:null},
        'sensor.row_b':{entity_id:'sensor.row_b',disabled_by:null}},states:{...c.hass.states,
        'sensor.row_a':{entity_id:'sensor.row_a',state:'23.1',attributes:{unit_of_measurement:'°C'}},
        'sensor.row_b':{entity_id:'sensor.row_b',state:'52',attributes:{unit_of_measurement:'%'}}}};
      await window.__hpTest.setServerConfig(cfg=>{
        cfg.spaces=cfg.spaces.filter(s=>s.id===space);
        Object.assign(cfg.spaces[0],{rooms:[],wall_segments:[],walls:[],partitions:[],openings:[],wall_columns:[],decor:[]});
        delete cfg.spaces[0].plan_url;
        cfg.settings={...cfg.settings,bg_mode:'static',volumetric_view:false};
        cfg.markers=['a','b'].map(id=>({id:'lg_sensor.row_'+id,binding:'entity:sensor.row_'+id,space,name:'Synthetic row '+id,
          icon:id==='a'?'mdi:thermometer':'mdi:water-percent',display:'icon',tap_action:'info',
          value_badge:{enabled:true,position:'right',source:{kind:'entity_state',entity_id:'sensor.row_'+id}}}));
        return cfg;
      });
      await window.__hpTest.setLayout({'lg_sensor.row_a':{s:space,x:.4,y:.4},'lg_sensor.row_b':{s:space,x:.4,y:.65}});
    });
    await page.waitForFunction(()=>window.__card._deviceContacts?.scene?.shapes.has('lg_sensor.row_a'));
    await page.evaluate(async()=>{
      const c=window.__card,a=c._deviceContacts.scene.shapes.get('lg_sensor.row_a').marker;
      await window.__hpTest.setLayout(l=>({...l,'lg_sensor.row_b':{...l['lg_sensor.row_b'],y:(a.y+a.diameter*1.125)/1000}}));
      const original=c.hass.callWS;window.__contactWrites=[];
      c.hass={...c.hass,callWS:async m=>{
        if(/houseplan\/(config|layout)\/(set|update|delete)$/.test(m.type))window.__contactWrites.push(m);
        return original(m);
      }};
    });
    const settle=async()=>{await page.evaluate(async()=>{await window.__card.updateComplete;await document.fonts.ready;
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});};
    await settle();
    const state=()=>page.evaluate(()=>{
      const c=window.__card,scene=c._deviceContacts.scene,path=c.renderRoot.querySelector('.device-contact-contour');
      const shapes=['lg_sensor.row_a','lg_sensor.row_b'].map(id=>scene.shapes.get(id)),length=path?.getTotalLength()??0;
      const stage=c.renderRoot.querySelector('.stage').getBoundingClientRect(),view=c._viewOr(c._baseVb());
      const registration=shapes.map(s=>{
        const r=c.renderRoot.querySelector(`[data-id="${s.marker.id}"]`).getBoundingClientRect();
        const x=stage.left+(s.marker.x-view.x)/view.w*stage.width;
        const y=stage.top+(s.marker.y-view.y)/view.h*stage.height;
        return Math.hypot(r.x+r.width/2-x,r.y+r.height/2-y);
      });
      // Inspect actual SVG ink at each row centre, not unexpanded text boxes.
      const points=Array.from({length:2001},(_,i)=>path?.getPointAtLength(length*i/2000));
      const edge=shapes.map(s=>Math.max(...points.filter(p=>p&&Math.abs(p.y-s.marker.y)<.5).map(p=>p.x)));
      return {members:scene.component('lg_sensor.row_a'),edge,step:Math.abs(edge[0]-edge[1]),registration,
        dash:path?.getAttribute('stroke-dasharray'),path:path?.getAttribute('d'),
        markers:shapes.map(s=>s.marker),work:{...c._deviceContacts.work},
        layout:structuredClone(c._layout),writes:window.__contactWrites.length,history:c._devicePositionHistory.size,
        text:[...c.renderRoot.querySelectorAll('.dev[data-id^="lg_sensor.row_"] .value-badge')].map(n=>n.textContent.trim())};
    });
    const before=await state();
    checkAll({[name+':connected']:before.members.length===2,[name+':physical-solid']:before.dash==='none'});
    for(const value of ['123.1','-123.1','unavailable','23.1']){
      await page.evaluate(value=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
        'sensor.row_a':{...c.hass.states['sensor.row_a'],state:value}}};},value);
      await page.waitForFunction(value=>{
        const text=window.__card.renderRoot.querySelector('[data-id="lg_sensor.row_a"] .value-badge')?.textContent??'';
        return value==='unavailable'?text.includes('—'):text.includes(value);
      },value);
      await settle();const after=await state();
      checkAll({[`${name}:${value}:no-step`]:after.members.length===2&&Number.isFinite(after.step)&&after.step<.01,
        [`${name}:${value}:no-write`]:after.writes===before.writes,
        [`${name}:${value}:no-history`]:after.history===before.history,
        [`${name}:${value}:authored-unchanged`]:JSON.stringify(after.layout)===JSON.stringify(before.layout)});
    }
    check(name+':no-drift',(await state()).markers,before.markers);
    await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
      'sensor.row_a':{...c.hass.states['sensor.row_a'],state:'123.1'}}};});
    await page.waitForFunction(()=>window.__card.renderRoot.querySelector('[data-id="lg_sensor.row_a"] .value-badge')?.textContent.includes('123.1'));
    await settle();
    if(name==='desktop'){
      await page.evaluate(()=>{const c=window.__card;c.style.fontFamily='HouseplanContactLate, monospace';c.requestUpdate();});
      await settle();const fallback=await state();
      await page.evaluate(async base64=>{
        const font=new FontFace('HouseplanContactLate',`url(data:font/ttf;base64,${base64})`);
        document.fonts.add(font);await document.fonts.load('20px HouseplanContactLate');await document.fonts.ready;
      },lateFont);await settle();const loaded=await state();
      checkAll({'late-font-remeasures':loaded.work.measurements>fallback.work.measurements,
        'late-font-keeps-common-edge':loaded.members.length===2&&loaded.step<.01,
        'late-font-no-write':loaded.writes===fallback.writes});
      await page.evaluate(()=>{const c=window.__card;c.style.fontFamily='';c.hass={...c.hass,themes:{...c.hass.themes,darkMode:true}};});
      await settle();
    }
    const cameraBase=await state();
    let wheelStep=0;
    const stage=await page.locator('houseplan-card').locator('.stage').boundingBox();
    await page.mouse.move(stage.x+stage.width/2,stage.y+stage.height/2);
    for(const targetStep of [-5,-1,0,5]){
      while(wheelStep!==targetStep){const direction=Math.sign(targetStep-wheelStep);await page.mouse.wheel(0,-direction*100);wheelStep+=direction;await settle();}
      const zoom=+(1.15**targetStep).toFixed(3);
      await settle();const after=await state();
      checkAll({[`${name}:${zoom}:same-ink`]:after.path===cameraBase.path,
        [`${name}:${zoom}:no-measure`]:after.work.measurements===cameraBase.work.measurements,
        [`${name}:${zoom}:no-rebuild`]:after.work.rebuilds===cameraBase.work.rebuilds});
    }
    await page.locator('houseplan-card').locator('[data-hp="zoom-fit"]').click();await settle();
    await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
    writeFileSync(`${dir}/${name}.json`,JSON.stringify({before,after:await state(),viewport:{width,height,dpr}},null,2));
    if(name==='desktop'){
      await page.evaluate(()=>window.__hpTest.setMode('devices'));await settle();
      await page.evaluate(()=>window.__hpTest.openMarkerDialog('lg_sensor.row_a'));
      const dialog=page.locator('hp-dialog[data-kind="marker"]');
      await dialog.locator('[data-section-target="appearance"]').click();
      const savedBefore=await state();
      await dialog.locator('#marker-size').fill('1.2');
      await dialog.locator('#marker-size').dispatchEvent('change');
      check('size-draft-does-not-write',(await state()).writes,savedBefore.writes);
      await dialog.locator('.btn[data-hp="dialog-cancel"]').click();
      await page.locator('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]').click();
      await page.waitForFunction(()=>!window.__card._markerDialog);await settle();
      check('size-cancel-does-not-write',(await state()).writes,savedBefore.writes);
      await page.evaluate(()=>window.__hpTest.openMarkerDialog('lg_sensor.row_a'));
      await dialog.locator('[data-section-target="appearance"]').click();
      await dialog.locator('#marker-size').fill('1.2');await dialog.locator('#marker-size').dispatchEvent('change');
      await dialog.locator('[data-hp="dialog-confirm"]').click();
      await page.waitForFunction(()=>!window.__card._markerDialog);
      await page.evaluate(()=>window.__hpTest.waitForWrites());await settle();
      writeFileSync(`${dir}/size-save.json`,JSON.stringify(await page.evaluate(()=>({
        config:window.__card._serverCfg,layout:window.__card._layout,
        ids:[...window.__card._deviceContacts.scene.shapes.keys()],
        writes:window.__contactWrites,
      })),null,2));
      const saved=await state();
      checkAll({'size-save-materialises-both-bases':['lg_sensor.row_a','lg_sensor.row_b'].every(id=>saved.layout[id].contact_basis?.v===1),
        'size-save-one-pair-write':saved.writes===savedBefore.writes+1,
        'size-save-core-registered':saved.registration.every(error=>error<.1)});
      // A new card must not depend on the previous instance's measured graph.
      await page.evaluate(()=>{
        const old=window.__card,next=document.createElement('houseplan-card');
        next.setConfig({...old._config});next.hass=old.hass;old.remove();
        document.getElementById('host').append(next);window.__card=next;
      });
      await page.waitForFunction(()=>window.__card._loadOk&&window.__card._deviceContacts?.scene?.shapes.has('lg_sensor.row_a'));
      await settle();const cold=await state();
      checkAll({'size-cold-same-layout':isDeepStrictEqual(cold.layout,saved.layout),
        'size-cold-same-geometry':JSON.stringify(cold.markers)===JSON.stringify(saved.markers),
        'size-cold-no-write':cold.writes===saved.writes});
    }
    if(name==='mobile'){
      const target=await page.evaluate(()=>{const n=window.__card.renderRoot.querySelector('[data-id="lg_sensor.row_b"]'),r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
      await page.touchscreen.tap(target.x,target.y);await settle();
      check('mobile:own-core-action',await page.evaluate(()=>window.__card._infoCard?.id),'lg_sensor.row_b');
      await page.keyboard.press('Escape');
    }
  } finally {await finish(browser);}
}
