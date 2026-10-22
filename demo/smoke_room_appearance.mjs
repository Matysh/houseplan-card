// #1037: real shared pickers, drafts, accepted writes and rendered colours.
import {launch,checkAll,finish} from './serve.mjs';
import {installSettingsSpaceFixture} from './helpers/settings-space-945-fixture.mjs';
const {page,browser}=await launch({width:1400,height:1000});
const out={};
try {
  await installSettingsSpaceFixture(page);
  Object.assign(out,await page.evaluate(async()=>{
    const hp=window.__hpTest,c=window.__card,root=c.renderRoot,o={};
    const original=c.hass.callWS.bind(c.hass);let rejectNext=false,rejections=0;
    c.hass={...c.hass,callWS:async m=>{if(m.type==='houseplan/config/set'&&rejectNext){rejectNext=false;rejections++;
      throw Object.assign(new Error('appearance-save-rejected'),{code:'unknown_error'});}return original(m);}};
    const settle=()=>hp.settled(),q=s=>root.querySelector(s);
    const saved=()=>structuredClone(c._serverCfg);
    const floor=()=>c._serverCfg.spaces.find(s=>s.id==='f1');
    const select=async(d,id,v)=>{const n=d.querySelector(`[data-field="${id}"]`);n.value=v;n.dispatchEvent(new Event('change',{bubbles:true}));await settle();};
    const reveal=async(n)=>{const section=n.closest('[data-settings-section]');
      if(section)n.closest('hp-dialog').querySelector(`[data-section-target="${section.dataset.settingsSection}"]`)?.click();await settle();};
    const color=async(d,id,hex,a)=>{
      const picker=d.querySelector(`[data-field="${id}"]`);await reveal(picker);
      picker.shadowRoot.querySelector('[data-field="colour-open"]').click();await settle();
      await hp.input(picker.shadowRoot.querySelector('[data-field="colour-hex"]'),hex);
      const alpha=picker.shadowRoot.querySelector('input[type="number"][data-field="colour-opacity"]');
      if(alpha)await hp.input(alpha,String(a*100));
      picker.shadowRoot.querySelector('[data-action="colour-confirm"]').click();await settle();
    };
    const discard=async(d)=>{const result=await hp.close(d,{via:'cancel'});if(result.confirm){result.confirm.querySelector('[data-hp="dialog-confirm"]').click();await settle();}};
    const caption=id=>{const n=q(`[data-hp="room-label"][data-id="${id}"]`),s=getComputedStyle(n);
      return {color:s.color,opacity:Number(s.opacity),metrics:[...n.querySelectorAll('.rlm:not(.lit)')].every(m=>getComputedStyle(m).color===s.color)};};
    await hp.setServerConfig(cfg=>{
      // Retired empty legacy segment arrays are removed by the ordinary writer;
      // this fixture starts canonical so unrelated-floor identity is meaningful.
      for(const s of cfg.spaces)delete s.segments;
      cfg.settings={...cfg.settings,fill_colors:{wall_fill:{c:'#8899aa',a:0.6}}};
      const s=cfg.spaces.find(s=>s.id==='f1');s.plan_url=null;s.settings={...s.settings,fill_mode:'custom',custom_fill:{c:'#ddeeff',a:.2},glow_enabled:false};
      delete s.settings.name_color;delete s.settings.wall_fill;
    });
    const roomId=floor().rooms.find(r=>r.name).id;
    await hp.setMode('view');
    o.legacyCaptionAlpha=caption(roomId).opacity===0.95;
    o.legacyWallFill=q('.stage').style.getPropertyValue('--wall-fill')==='#8899aa';
    // General Save may be the very first write after upgrade. Materialise from
    // the old palette before replacing general settings, without opening Space.
    q('[data-hp="settings"]').click();await settle();
    const general=q('hp-dialog[data-kind="settings"]'),radius=general.querySelector('[data-field="gs-glow-radius"]');
    await reveal(radius);await hp.input(radius,'4');general.querySelector('[data-hp="dialog-confirm"]').click();
    await hp.waitForWrites();await settle();
    o.generalSaveFirstPreservesLegacy=caption(roomId).opacity===.95&&q('.stage').style.getPropertyValue('--wall-fill')==='#8899aa'
      &&saved().spaces.every(s=>s.settings.wall_fill.c==='#8899aa'&&s.settings.wall_fill.a===.6);
    const otherBefore=JSON.stringify(saved().spaces.filter(s=>s.id!=='f1'));
    const before=JSON.stringify(saved());
    let d=await hp.openSpaceDialog('edit','f1');
    o.fourColourFields=['space-border-color','space-name-color','space-fill-color','space-wall-fill'].every(id=>!!d.querySelector(`[data-field="${id}"]`));
    const custom=d.querySelector('[data-field="space-fill-color"]'),wall=d.querySelector('[data-field="space-wall-fill"]');
    o.wallImmediatelyFollowsCustom=!!(custom.closest('.hpf-section')?.nextElementSibling?.contains(wall));
    await color(d,'space-name-color','#aa1122',.4);
    o.livePreviewAndMetrics=caption(roomId).color==='rgb(170, 17, 34)'&&caption(roomId).opacity===.4&&caption(roomId).metrics;
    await discard(d);o.cancelNoWrites=JSON.stringify(saved())===before;
    d=await hp.openSpaceDialog('edit','f1');
    await color(d,'space-border-color','#223344',.7);await color(d,'space-name-color','#aa1122',.4);await color(d,'space-wall-fill','#556677',.3);
    await select(d,'space-fill-mode','temp');o.wallFillAlwaysAvailable=!!d.querySelector('[data-field="space-wall-fill"]')&&!d.querySelector('[data-field="space-fill-color"]');
    const acceptedBefore=JSON.stringify(saved());rejectNext=true;d.querySelector('[data-hp="dialog-confirm"]').click();
    for(let i=0;i<50&&(rejections!==1||c._spaceDialog?.busy);i++){await new Promise(r=>setTimeout(r,20));await settle();}
    o.failedSaveKeepsAcceptedAndDraft=JSON.stringify(saved())===acceptedBefore&&d.isConnected
      &&d.querySelector('[data-field="space-name-color"]').color==='#aa1122'&&!d.querySelector('[data-hp="dialog-confirm"]').disabled;
    d.querySelector('[data-hp="dialog-confirm"]').click();await hp.waitForWrites();await settle();
    o.savedIndependent=JSON.stringify(floor().settings.name_color)===JSON.stringify({c:'#aa1122',a:.4})
      &&floor().settings.room_color==='#223344'&&floor().settings.wall_fill.c==='#556677';
    o.otherSpaceUnchanged=JSON.stringify(saved().spaces.filter(s=>s.id!=='f1'))===otherBefore;
    await hp.setMode('plan');d=await hp.openRoomEdit(roomId);
    await select(d,'room-name-color-mode','own');await color(d,'room-name-color','#1122cc',0);
    o.zeroAlphaPreview=caption(roomId).opacity===0;
    d.querySelector('[data-hp="dialog-confirm"]').click();await hp.waitForWrites();await settle();
    o.roomOverrideSaved=floor().rooms.find(r=>r.id===roomId).settings.name_color.a===0;
    d=await hp.openSpaceDialog('edit','f1');await color(d,'space-name-color','#11aa22',.8);
    d.querySelector('[data-hp="dialog-confirm"]').click();await hp.waitForWrites();await settle();
    o.spaceChangeRetainsRoomOverride=caption(roomId).opacity===0;
    d=await hp.openRoomEdit(roomId);await select(d,'room-name-color-mode','inherit');
    o.resetPreview=caption(roomId).color==='rgb(17, 170, 34)'&&caption(roomId).opacity===.8;
    d.querySelector('[data-hp="dialog-confirm"]').click();await hp.waitForWrites();await settle();
    o.resetDeletesOnlyOverride=!('name_color' in (floor().rooms.find(r=>r.id===roomId).settings||{}));
    await hp.setMode('view');await hp.setVolumetricView(true);
    o.isoCaptionAndWall=caption(roomId).color==='rgb(17, 170, 34)'&&q('.stage').style.getPropertyValue('--wall-fill')==='#556677';
    await hp.setVolumetricView(false);
    await hp.setServerConfig(saved());
    o.reloadRetainsColours=caption(roomId).color==='rgb(17, 170, 34)'&&q('.stage').style.getPropertyValue('--wall-fill')==='#556677';
    await customElements.whenDefined('houseplan-space-card');
    const staticCard=document.createElement('houseplan-space-card'),copy=saved();
    staticCard.setConfig({type:'custom:houseplan-space-card',space:'f1'});
    staticCard.hass={...c.hass,callWS:async m=>m.type==='houseplan/config/get'?{config:copy,rev:100}:original(m)};
    document.body.appendChild(staticCard);
    for(let i=0;i<80&&!staticCard.renderRoot?.querySelector('[data-hp="room-label"]');i++)await new Promise(r=>setTimeout(r,30));
    const staticLabel=staticCard.renderRoot.querySelector(`[data-hp="room-label"][data-id="${roomId}"]`);
    const staticStage=staticCard.renderRoot.querySelector('.hp-static-stage');
    o.staticMatches=!!staticLabel&&getComputedStyle(staticLabel).color==='rgb(17, 170, 34)'
      &&Number(getComputedStyle(staticLabel).opacity)===.8&&staticStage.style.getPropertyValue('--wall-fill')==='#556677';
    staticCard.remove();
    q('[data-hp="settings"]').click();await settle();d=q('hp-dialog[data-kind="settings"]');
    o.generalHasNoWallControl=!d.querySelector('[data-field="gs-wall-fill"]');await discard(d);
    return o;
  }));
  await page.setViewportSize({width:390,height:850});
  for(const dark of [false,true]){
    await page.emulateMedia({colorScheme:dark?'dark':'light'});
    await page.evaluate(async dark=>{const c=window.__card;c.hass={...c.hass,themes:{...c.hass.themes,darkMode:dark}};
      const palette=dark?{'--card-background-color':'#17212b','--secondary-background-color':'#252e39','--primary-text-color':'#fff','--secondary-text-color':'#b5c0cc','--primary-color':'#5bcce6'}
        :{'--card-background-color':'#fff','--secondary-background-color':'#eceeef','--primary-text-color':'#17212b','--secondary-text-color':'#586674','--primary-color':'#007d93'};
      for(const [key,value]of Object.entries(palette))c.style.setProperty(key,value);
      await window.__hpTest.openSpaceDialog('edit','f1');},dark);
    const d=page.locator('houseplan-card hp-dialog[data-kind="space"]');
    await d.locator('select[data-field="settings-section"]').selectOption('appearance');
    out[`narrow-${dark?'dark':'light'}-noOverflow`]=await d.evaluate(d=>{
      const body=d.querySelector('.body');return body.scrollWidth<=body.clientWidth+1
        &&[...d.querySelectorAll('[data-settings-section="appearance"] hp-color-opacity')].every(p=>p.getBoundingClientRect().width>0);});
    await page.screenshot({path:`artifacts/room-appearance-${dark?'dark':'light'}-1037.png`});
    await page.evaluate(()=>window.__hpTest.close(document.querySelector('houseplan-card').renderRoot.querySelector('hp-dialog[data-kind="space"]'),{via:'cancel'}));
  }
  checkAll(out);await finish(browser,out);
} catch(error){await browser.close();throw error;}
