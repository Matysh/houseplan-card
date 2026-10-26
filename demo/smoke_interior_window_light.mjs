import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { launch,finish,requirePinnedBrowser } from './serve.mjs';
import { makeInteriorWindowFixture } from './fixtures/interior-window-light.mjs';

requirePinnedBrowser('smoke_interior_window_light');
const dir=new URL('../artifacts/interior-window-light/',import.meta.url);
mkdirSync(dir,{recursive:true});
const {page,browser}=await launch({width:1100,height:1000});
const evidence={checks:[]};
try {
  const settle=async()=>{await page.evaluate(()=>window.__hpTest.settled());await page.waitForTimeout(650);};
  const seed=async options=>{
    const fixture=makeInteriorWindowFixture(options);
    await page.evaluate(async fixture=>{
      const card=window.__card;
      const off=Object.fromEntries(Object.entries(card.hass.states).map(([id,state])=>[id,
        id.startsWith('light.')?{...state,state:'off'}:state]));
      card.hass={...card.hass,states:{...off,...fixture.states}};
      await window.__hpTest.setServerConfig(()=>fixture.config);
      await window.__hpTest.setLayout(()=>fixture.layout);
      await window.__hpTest.setMode('view');
    },fixture);
    await page.locator('houseplan-card [data-hp="zoom-fit"]').click();await settle();
    return fixture.windowLightProbes;
  };
  const light=async state=>{
    await page.evaluate(state=>{
      const c=window.__card,s=c.hass.states['light.ceiling'];
      c.hass={...c.hass,states:{...c.hass.states,'light.ceiling':{...s,state}}};
    },state);await settle();
  };
  const inspect=(probes,{staticCard=false,led=false}={})=>page.evaluate(({probes,staticCard,led})=>{
    const c=staticCard?document.querySelector('houseplan-space-card'):window.__card,root=c.shadowRoot;
    const pool=root.querySelector(led?'.led-field-bands':'[data-glow-source="light.ceiling"] .glow-pool');
    const id=pool?.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1];
    const paths=id?[...root.querySelectorAll(`clipPath[id="${id}"] path`)]:[];
    const has=point=>paths.some(path=>path.isPointInFill(new DOMPoint(point[0]*1000,point[1]*1000)));
    const screen=point=>{
      const matrix=root.querySelector('.wallbody')?.getScreenCTM();
      const p=matrix&&new DOMPoint(point[0]*1000,point[1]*1000).matrixTransform(matrix);
      return p?{x:p.x,y:p.y}:null;
    };
    return {pool:!!pool,paths:paths.length,target:has(probes.target),shadow:has(probes.shadow),
      clip:paths.map(path=>path.getAttribute('d')),targetScreen:screen(probes.target),shadowScreen:screen(probes.shadow)};
  },{probes,staticCard,led});
  const mountStatic=()=>page.evaluate(async()=>{
    await customElements.whenDefined('houseplan-space-card');
    const host=document.createElement('div');host.style.width='800px';document.body.append(host);
    const c=document.createElement('houseplan-space-card');
    c.setConfig({type:'custom:houseplan-space-card',space:'f1',light_pools:true,live_states:true});
    c.hass=window.__card.hass;host.append(c);
  });
  const probes=await seed();
  const stored=()=>page.evaluate(()=>JSON.stringify([window.__card._serverCfg,window.__card._layout,
    window.__card._cfgRev,window.__card._layoutRev]));
  const before=await stored();
  await light('off');
  const dark=await page.screenshot({path:new URL('lamp-off.png',dir).pathname});
  await light('on');
  const flat=await inspect(probes);
  assert.ok(flat.pool&&flat.paths>0&&flat.target&&!flat.shadow,'real lamp clip crosses glass and keeps the column shadow');
  const bright=await page.screenshot({path:new URL('lamp-on.png',dir).pathname});
  const pixels=await page.evaluate(async({off,on,points})=>{
    const decode=async value=>{const image=new Image();image.src='data:image/png;base64,'+value;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height);};
    const [a,b]=await Promise.all([decode(off),decode(on)]);
    return points.map(p=>{let delta=0;for(let y=Math.round(p.y)-3;y<=Math.round(p.y)+3;y++)
      for(let x=Math.round(p.x)-3;x<=Math.round(p.x)+3;x++){const i=(y*a.width+x)*4;
        delta+=Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2]);}
      return delta/147;});
  },{off:dark.toString('base64'),on:bright.toString('base64'),points:[flat.targetScreen,flat.shadowScreen]});
  assert.ok(pixels[0]>5,'receiving-room pixels really brighten');
  assert.ok(pixels[1]<1,'column shadow pixels remain dark');
  evidence.pixels={receivingDelta:pixels[0],shadowDelta:pixels[1]};
  await page.evaluate(()=>{const c=window.__card,s=c.hass.states['binary_sensor.window'];
    c.hass={...c.hass,states:{...c.hass.states,'binary_sensor.window':{...s,state:'on'}}};});
  await settle();assert.deepEqual((await inspect(probes)).clip,flat.clip,'opening glass leaves light unchanged');
  await page.evaluate(()=>{window.__windowLightCache=window.__card._lightBarrierCache;});
  await page.mouse.move(600,850);await page.mouse.down();await page.mouse.move(640,875,{steps:5});await page.mouse.up();
  await settle();
  assert.equal(await page.evaluate(()=>window.__windowLightCache===window.__card._lightBarrierCache),true,'pan reuses barriers');
  assert.equal(await stored(),before,'HA state and camera reads do not write configuration/layout/revisions');
  await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{
    for(const room of cfg.spaces[0].rooms)room.settings={...room.settings,sun_transparent:true};
  }));await settle();
  assert.deepEqual((await inspect(probes)).clip,flat.clip,'#1078 sunlight flags cannot change real artificial-light transport');
  await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(true);});await settle();
  assert.deepEqual((await inspect(probes)).clip,flat.clip,'2.5D uses the same transport region');
  await page.screenshot({path:new URL('lamp-iso.png',dir).pathname});
  await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(false);});await settle();
  await mountStatic();
  await page.waitForFunction(()=>document.querySelector('houseplan-space-card')?.shadowRoot
    ?.querySelector('[data-glow-source="light.ceiling"] .glow-pool'));
  await settle();
  const stat=await inspect(probes,{staticCard:true});
  assert.ok(stat.target&&!stat.shadow,'supported static card shares the window and column');
  await page.evaluate(()=>document.querySelector('houseplan-space-card').parentElement.remove());
  evidence.checks.push('lamp-flat-pixels','closed-and-open-contact','column-shadow','pan-cache','no-writes','iso','static','sun-flag-independent-glow');
  for(const options of [{partition:true},{oblique:true}]){
    const p=await seed(options),s=await inspect(p);
    assert.ok(s.target&&!s.shadow,`window variant ${JSON.stringify(options)}`);
    evidence.checks.push(JSON.stringify(options));
    await page.screenshot({path:new URL(options.partition?'partition.png':'oblique.png',dir).pathname});
  }
  const ledProbes=await seed({led:true});
  await page.waitForFunction(()=>window.__card.renderRoot.querySelector('.led-field-bands'));
  const led=await inspect(ledProbes,{led:true});
  assert.ok(led.target&&!led.shadow,'LED transport uses the same internal window and distant column');
  await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{
    for(const room of cfg.spaces[0].rooms)room.settings={...room.settings,sun_transparent:true};
  }));await settle();
  assert.deepEqual((await inspect(ledProbes,{led:true})).clip,led.clip,'#1078 sunlight flags cannot change real LED transport');
  await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(true);});await settle();
  const isoLed=await inspect(ledProbes,{led:true});
  assert.ok(isoLed.target&&!isoLed.shadow,'2.5D LED shares the same transport');
  await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(false);});await settle();
  await mountStatic();
  await page.waitForFunction(()=>document.querySelector('houseplan-space-card')?.shadowRoot?.querySelector('.led-field-bands'));
  const statLed=await inspect(ledProbes,{staticCard:true,led:true});
  assert.ok(statLed.target&&!statLed.shadow,'static LED shares the same transport');
  await page.evaluate(()=>document.querySelector('houseplan-space-card').parentElement.remove());
  evidence.checks.push('led','led-iso','led-static','sun-flag-independent-led');
  await page.screenshot({path:new URL('led.png',dir).pathname});
  await seed();
  await page.evaluate(()=>window.__hpTest.setLayout(layout=>({...layout,d_light1:{s:'f1',x:.08,y:.5}})));
  await settle();
  assert.equal((await inspect(probes)).pool,false,'source inside exterior window stays fail-dark');
  evidence.checks.push('exterior-source-fail-dark');
  await page.evaluate(async()=>{
    window.__windowLightBeforeEdit=window.__card._lightBarrierCache;
    await window.__hpTest.setServerConfig(cfg=>({...cfg,spaces:cfg.spaces.map(space=>({...space,
      openings:space.openings.filter(opening=>opening.id!=='inner-glass')}))}));
    await window.__hpTest.setLayout(layout=>({...layout,d_light1:{s:'f1',x:.28,y:.5}}));
  });await settle();
  const changed=await inspect(probes);
  assert.ok(changed.pool&&!changed.target,'removing the window restores the opaque wall');
  assert.equal(await page.evaluate(()=>window.__windowLightBeforeEdit===window.__card._lightBarrierCache),false);
  evidence.checks.push('geometry-invalidates-barriers');
  evidence.completed=true;console.log(JSON.stringify(evidence));
} finally {
  writeFileSync(new URL('evidence.json',dir),JSON.stringify(evidence,null,2));await finish(browser);
}
