/** #1516: actual surfaces, same-space isolation, profile events and browser reload. */
import { launch, checkAll, finish } from './serve.mjs';
import { prepareDesktopControls } from './helpers/desktop-controls.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';
const {page,browser}=await launch({width:2050,height:1350},1,[],{},undefined,undefined,'/demo.html?external-screens=1');
try {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await prepareDesktopControls(page);
  const mount = () => page.evaluate(async () => {
    const initial=await window.__mkHass().callWS({type:'houseplan/config/get'});
    const config=initial.config;
    const floor=config.spaces[0], second=config.spaces[1];
    floor.settings={...floor.settings,show_borders:true};
    second.settings={...second.settings,show_borders:true};
    const view={zoom:1,summary:'hide',center_summary:false,icon_scale:null,font_scale:null};
    config.settings={...config.settings,volumetric_view:false,
      external_screens:{version:3,next_id:2,screens:[{id:1,space:null,cycle:0,idle:120,
        default_view:{...view,view:'iso',rotation:315},
        space_views:{[second.id]:{...view,view:'flat',rotation:180}}}]}};
    // Keep the fixture as the input to the actual mocked WS event stream.
    window.__surfaceConfig=config;window.__surfaceWrites=[];
    window.__pushServerConfig(config);
    const hass=window.__mkHass(), call=hass.callWS;
    const wire={...hass,callWS:async message=>{
      if (/^houseplan\/.*(?:set|move|save|delete)$/.test(message.type)) window.__surfaceWrites.push(message.type);
      return call(message);
    }};
    const host=document.getElementById('host');
    host.style.cssText='width:100%;margin:0;padding:12px;display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:10px';
    host.replaceChildren();
    const floorCfg={type:'custom:houseplan-card',floor:floor.id};
    const stage=(id,cfg,panelHost=false,route)=>{
      const instance=document.createElement('houseplan-card');
      instance.dataset.surface=id;instance.layout='panel';instance.narrow=false;
      instance.style.cssText='display:block;width:100%;height:550px;min-height:550px';
      instance.panelHost=panelHost; if(route)instance.routeKiosk=route;
      instance.hass=wire;instance.setConfig(cfg);return instance;
    };
    const panel=stage('main',floorCfg,true), kiosk=stage('kiosk',{type:floorCfg.type},true,
      {enabled:true,profile:1,position:1});
    const dashboard=document.createElement('hui-masonry-view');
    dashboard.style.cssText='display:grid;grid-column:span 3;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px';
    const cards=[
      stage('flat',{...floorCfg,view:'flat',plan_rotation:90}),
      stage('iso',{...floorCfg,view:'iso',plan_rotation:45}),
      stage('duplicate',{...floorCfg,view:'iso',plan_rotation:45}),
    ];
    dashboard.cards=cards;
    for (const card of cards) dashboard.append(card);
    host.append(panel,kiosk,dashboard);
    window.__surfaceCards={panel,kiosk,cards};
  });
  const find=(id)=>page.locator(`houseplan-card[data-surface="${id}"]`);
  const angle=(id,n)=>find(id).locator(`.stage[data-hp-plan-rotation="${n}"]`).waitFor({state:'visible',timeout:25000});
  const iso=(id,n)=>Promise.all([angle(id,n),find(id).locator('[data-projection="iso"]').waitFor({state:'visible',timeout:25000})]);
  await mount();
  await Promise.all([angle('main',0),angle('flat',90),iso('iso',45),iso('duplicate',45),iso('kiosk',315)]);
  const out={independentInitialProjections:await find('main').locator('[data-projection="iso"]').count()===0
    && await find('flat').locator('[data-projection="iso"]').count()===0};
  out.lovelaceEditorDistinguishesAuthoredZeroAndLegacyFallback=await page.evaluate(async()=>{
    const ctor=customElements.get('houseplan-card'), editor=await ctor.getConfigElement();
    const legacy={type:'custom:houseplan-card',rotation:90};
    editor.hass=window.__mkHass();editor.setConfig(legacy);document.body.append(editor);
    const end=performance.now()+5000;
    let form;
    while(!form&&performance.now()<end){
      await editor.updateComplete;
      form=[...editor.renderRoot.querySelectorAll('ha-form')].find(form=>form.schema?.some(field=>field.name==='plan_rotation'));
      if(!form)await new Promise(resolve=>setTimeout(resolve,20));
    }
    if(!form)throw Error('Lovelace presentation form did not mount');
    let saved;editor.addEventListener('config-changed',event=>{saved=event.detail.config;});
    form.dispatchEvent(new CustomEvent('value-changed',{detail:{value:{...form.data,title:'Other setting'}},bubbles:true}));
    const one=saved?.rotation===90 && !Object.hasOwn(saved,'plan_rotation');
    form.dispatchEvent(new CustomEvent('value-changed',{detail:{value:{...form.data,view:'iso',plan_rotation:'0'}},bubbles:true}));
    const two=saved?.rotation===90 && saved?.plan_rotation===0 && saved?.view==='iso';
    editor.remove();return one&&two;
  });
  // Real header click: eighth turn for only the interacted Lovelace placement.
  await find('iso').locator('[data-hp="rotate-right"]').click();
  await Promise.all([iso('iso',90),iso('duplicate',45),angle('flat',90),angle('main',0),iso('kiosk',315)]);
  out.controlsAffectOnlyOneLogicalPlacement=true;
  // A full navigation mounts the same HA installation and logical slots again.
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.__mkHass && customElements.get('houseplan-card'));
  await mount();
  await Promise.all([iso('iso',90),iso('duplicate',45),angle('main',0)]);
  out.sameSlotsRetainIndependentRotationOnReload=true;
  await page.evaluate(()=>{const {cards}=window.__surfaceCards;const card=cards[1];card.setConfig({...card._config,view:'iso',plan_rotation:135});});
  await Promise.all([iso('iso',135),iso('duplicate',45),angle('main',0)]);
  out.explicitAuthoredChangeSupersedesLocalButtonChoice=true;
  await page.evaluate(()=>{
    const {kiosk}=window.__surfaceCards;
    kiosk.routeKiosk={enabled:true,profile:1,position:2,overrides:{rotation:315}};
  });
  await angle('kiosk',0);
  out.flatScreenUsesClockwiseUrlWrap=await find('kiosk').locator('[data-projection="iso"]').count()===0;
  await page.evaluate(()=>{
    const {kiosk}=window.__surfaceCards;
    kiosk.routeKiosk={enabled:true,profile:1,position:1};
  });
  await iso('kiosk',315);
  await page.evaluate(()=>{
    const config=structuredClone(window.__surfaceConfig);
    config.settings.external_screens.screens[0].default_view={...config.settings.external_screens.screens[0].default_view,view:'flat',rotation:180};
    window.__pushServerConfig(config);
  });
  await Promise.all([angle('kiosk',180),angle('main',0),iso('duplicate',45)]);
  out.liveProfileAffectsOnlyExternalScreen=await find('kiosk').locator('[data-projection="iso"]').count()===0;
  await clickHeaderAction(find('main'), 'rotate-left');
  await Promise.all([angle('main',270),angle('kiosk',180),angle('flat',90),iso('duplicate',45)]);
  await page.evaluate(() => {
    const {kiosk,cards} = window.__surfaceCards;
    kiosk.routeKiosk = { enabled:true, position:1 };
    const card = cards[1];
    card.setConfig({type:'custom:houseplan-card',floor:card._space,rotation:0});
  });
  await Promise.all([angle('kiosk',270),angle('iso',270)]);
  await page.evaluate(() => {
    const card = window.__surfaceCards.cards[1];
    card.setConfig({...card._config,rotation:90,plan_rotation:0});
  });
  await angle('iso',0);
  await page.evaluate(() => {
    const card = window.__surfaceCards.cards[1];
    const {plan_rotation, ...legacy} = card._config;
    card.setConfig(legacy);
  });
  await Promise.all([angle('main',270),angle('iso',270),angle('kiosk',270),iso('duplicate',45)]);
  out.legacyCardAndUnprofiledScreenInheritMainRotation=true;
  out.presentationDoesNotSendPlanWrites=await page.evaluate(()=>window.__surfaceWrites.length===0);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.__mkHass && customElements.get('houseplan-card'));
  await mount();
  await Promise.all([angle('main',270),iso('iso',45),iso('duplicate',45),iso('kiosk',315)]);
  out.previousConfigurationDoesNotResurrectItsLocalAngle=true;
  checkAll(out);await finish(browser,out);
}catch(error){
  const scene=await page.evaluate(()=>[...document.querySelectorAll('houseplan-card[data-surface]')].map(card=>({
    id:card.dataset.surface,space:card._space,ready:card._loadOk,borders:card._spaceDisplayForRender().showBorders,
    desired:card._desiredProjection,projection:card._renderProjection,requested:card._requestedPlanRotation,
    rotation:card._rotation,width:card.getBoundingClientRect().width,height:card.getBoundingClientRect().height,
    stage:card.renderRoot.querySelector('.stage')?.getAttribute('class'),
  }))).catch(()=>[]);
  console.error('Rendered surfaces:',JSON.stringify(scene));
  await browser.close();throw error;
}
