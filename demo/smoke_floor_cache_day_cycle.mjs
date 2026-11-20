/** #1490: real delayed module-worker, cold backgrounds and cached ISO switches.
 * Synthetic read-only host only; no production flags or real HA access. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,finish} from './serve.mjs';
import {makeLargeHouseFixture} from './fixtures/large-house.mjs';

const fixture=makeLargeHouseFixture({floors:2,roomsPerFloor:3,devices:6,openings:4,partitions:1,columns:1,decor:1,stairs:0});
fixture.config.settings={...fixture.config.settings,volumetric_view:true,moon:false};
for(const floor of fixture.config.spaces)floor.settings={...floor.settings,bg_mode:'daynight',bg_color:'#1b2d50'};
const output='output/1490',label=process.argv.includes('--before')?'before':'after';mkdirSync(output,{recursive:true});
const {page,browser}=await launch({width:1440,height:1000});
try{
  await page.evaluate(async fixture=>{
    window.__card.remove();localStorage.clear();
    const probe=window.__floorLoading={fixture,hold:true,held:[],writes:0,jobs:0};
    const WorkerClass=window.Worker;
    window.Worker=class extends WorkerClass{
      constructor(url,options){super(url,options);this.floor=options?.name==='houseplan-floor';}
      postMessage(message,...rest){
        if(this.floor&&message.job){
          probe.jobs++;
          if(probe.hold){probe.held.push(()=>super.postMessage(message,...rest));return;}
        }
        super.postMessage(message,...rest);
      }
    };
    probe.release=()=>{probe.hold=false;for(const send of probe.held.splice(0))send();};
    probe.mount=(mode,night=false)=>{
      window.__card?.remove();customElements.get('houseplan-card')._warmBootReset();
      probe.hold=true;probe.held=[];
      for(const floor of fixture.config.spaces)floor.settings.bg_mode=mode;
      const hass={...window.__mkHass(),user:{id:'floor-loading-synthetic',is_admin:false},
        devices:fixture.devices,entities:fixture.entities,areas:fixture.areas,
        states:{...fixture.states,'sun.sun':{entity_id:'sun.sun',state:night?'below_horizon':'above_horizon',
          attributes:{elevation:night?-30:40,azimuth:160}}},
        connection:{connected:true,subscribeEvents:async()=>()=>{},subscribeMessage:async()=>()=>{}},
        callWS:async message=>{
          if(message.type==='houseplan/config/get')return{config:structuredClone(fixture.config),rev:1,can_write:false};
          if(message.type==='houseplan/layout/get')return{layout:structuredClone(fixture.layout),rev:1};
          if(message.type==='config/device_registry/list')return Object.values(fixture.devices);
          if(message.type==='config/entity_registry/list')return Object.values(fixture.entities);
          if(/houseplan\/.*(?:set|save|delete)/.test(message.type))probe.writes++;
          return{ok:true};
        },callService:async()=>{probe.writes++;return{};}};
      const card=document.createElement('houseplan-card');window.__card=card;
      card.setConfig({type:'custom:houseplan-card',title:'Loading background witness',language:'en'});
      document.getElementById('host').replaceChildren(card);card.hass=hass;
    };
    probe.snapshot=()=>{
      const root=window.__card.renderRoot,stage=root.querySelector('.stage'),env=stage?.querySelector('.hp-day-cycle-env');
      const active=env?.querySelector('.hp-day-cycle-bg.active');
      return{floor:window.__card._space,pending:!!root.querySelector('[data-hp-floor-cache]'),
        backdrop:stage?getComputedStyle(stage).backgroundColor:null,phase:env?.getAttribute('data-day-cycle-phase')??null,
        gradient:active?getComputedStyle(active).backgroundImage:null,opacity:active?getComputedStyle(active).opacity:null,
        silhouettes:stage?.querySelectorAll('[data-hp-cache-preview] path,[data-hp-cache-preview] polygon').length??0,
        previewDom:!!stage?.querySelector('[data-hp-cache-preview]'),
        iso:!!stage?.querySelector('.iso-walls'),devices:root.querySelectorAll('.dev').length};
    };
  },fixture);
  const pending=()=>page.waitForFunction(()=>window.__floorLoading.held.length>0&&window.__card._floorPassive&&!!window.__card.renderRoot.querySelector('.stage'));
  const ready=()=>page.waitForFunction(()=>{
    const card=window.__card;return card._loadOk&&!card._booting&&!card._bootFading&&!card._floorPassive
      &&!card._floorPreparation.pending&&card._renderProjection==='iso'&&!!card.renderRoot.querySelector('.dev');
  });
  const snapshot=()=>page.evaluate(()=>window.__floorLoading.snapshot());
  const waitPublished=async prior=>page.waitForFunction(n=>window.__card._floorPreparation.diagnostic.store.writes>n,prior);
  const results=[];
  for(const [mode,night]of [['daynight',false],['daynight',true],['static',false]]){
    await page.evaluate(({mode,night})=>window.__floorLoading.mount(mode,night),{mode,night});await pending();
    const before=await snapshot();
    if(mode==='daynight'&&!night)await page.screenshot({path:`${output}/${label}-cold-pending.png`});
    await page.evaluate(()=>window.__floorLoading.release());await ready();
    const after=await snapshot();await waitPublished(0);
    results.push({kind:'cold',mode,night,before,after});
  }
  // Publish both actual floors, then force only the disposable L2 memory out.
  // The real IndexedDB preview remains present for each delayed return.
  await page.evaluate(()=>window.__floorLoading.mount('daynight'));await pending();
  await page.evaluate(()=>window.__floorLoading.release());await ready();await waitPublished(0);
  await page.evaluate(()=>window.__card._pickSpace(window.__floorLoading.fixture.config.spaces[1].id));
  await ready();await waitPublished(1);
  for(const index of [0,1]){
    await page.evaluate(index=>{
      const p=window.__floorLoading;p.hold=true;p.held=[];
      window.__card._floorPreparation.memory.clear();
      window.__card._pickSpace(p.fixture.config.spaces[index].id);
    },index);
    await pending();await page.waitForFunction(()=>!!window.__card._floorPreparation.preview);
    const samples=await page.evaluate(async()=>{
      const samples=[];for(let i=0;i<12;i++){
        await new Promise(requestAnimationFrame);samples.push(window.__floorLoading.snapshot());
      }return samples;
    });
    await page.screenshot({path:`${output}/${label}-switch-${index}-pending.png`});
    await page.evaluate(()=>window.__floorLoading.release());await ready();
    const after=await snapshot();await page.screenshot({path:`${output}/${label}-switch-${index}-ready.png`});
    results.push({kind:'switch',index,samples,after});
  }
  const writes=await page.evaluate(()=>window.__floorLoading.writes);
  writeFileSync(`${output}/${label}-frames.json`,JSON.stringify({results,writes},null,2));
  for(const result of results){
    const samples=result.samples??[result.before];
    for(const before of samples){
      assert.equal(before.pending,true,'a real held worker exercises the pending interval');
      if(result.mode==='static')assert.equal(before.backdrop,'rgb(27, 45, 80)');
      else{
        assert.equal(before.phase,result.after.phase,'loading uses the current day/night phase');
        assert.equal(before.gradient,result.after.gradient,'loading and complete View share the gradient');
        assert.equal(before.opacity,'1','the environment is painted, not a hidden gradient');
      }
      assert.equal(before.previewDom,false,'ISO never paints a simplified L1 silhouette');
      assert.equal(before.devices,0,'pending View never exposes obsolete device targets');
    }
    assert.ok(result.after.iso&&result.after.devices>0,'the complete current 2.5D scene is shown after readiness');
    if(result.mode==='static')assert.equal(result.after.backdrop,'rgb(27, 45, 80)');
  }
  assert.equal(writes,0,'loading and navigation never write config/layout or call a service');
  console.log('PASS #1490',JSON.stringify({cold:3,directions:2,heldFrames:24,writes}));
}finally{await finish(browser);}
