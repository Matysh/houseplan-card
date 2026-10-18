// #945: approved space settings, real controls and unchanged persistence boundary.
import { launch, watchPage, checkAll, finish } from './serve.mjs';
import {mkdirSync,readFileSync} from 'node:fs';
import {installSettingsSpaceFixture} from './helpers/settings-space-945-fixture.mjs';
const {page,browser} = await launch({width:1280,height:900});
page.setDefaultTimeout(12000);
const out = {}, card=page.locator('houseplan-card');
const dialog=card.locator('hp-dialog[data-kind="space"][settings-layout]');
const tick=()=>page.evaluate(()=>window.__hpTest.settled());
const open=()=>page.evaluate(()=>window.__hpTest.openSpaceDialog('edit','f1').then(()=>null));
const section=async name=>{await dialog.locator(`[data-section-target="${name}"]`).click();await tick();};
const select=async (name,value)=>{await dialog.locator(`select[name="${name}"]`).selectOption(value);await tick();};
const read=()=>page.evaluate(()=>structuredClone(window.__card._spaceDialog));
const saved=()=>page.evaluate(()=>structuredClone(window.__card._serverCfg.spaces.find(s=>s.id==='f1')));
try {
  await installSettingsSpaceFixture(page);
  const context=page.context();
  const reference=watchPage(await context.newPage());
  await reference.setContent('<!doctype html><html><body style="margin:0;color-scheme:light">'+readFileSync('docs/design/settings-dialogs-944/space-settings-v7.html','utf8')+'</body></html>');
  await reference.locator('.hp-after h2').waitFor();
  const expected=await reference.locator('.hp-after').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,nav:el.querySelector('[data-nav]').getBoundingClientRect().width,labels:[...el.querySelectorAll('[data-nav] button')].map(n=>n.textContent.trim())}));
  await open();
  const original=await saved(), initial=await read();
  out.approvedStructure=await dialog.evaluate((el,expected)=>{const box=el.shadowRoot.querySelector('.surface').getBoundingClientRect(),nav=el.querySelector('.hpf-settings-nav');return Math.abs(box.width-expected.width)<2&&Math.abs(box.height-expected.height)<8&&Math.abs(nav.getBoundingClientRect().width-expected.nav)<2&&JSON.stringify([...nav.querySelectorAll('button')].map(n=>n.textContent.trim()))===JSON.stringify(expected.labels);},expected);
  out.headerNamesTheSpace=await dialog.locator('.title-text').textContent().then(text=>text.includes('Пространство · 1 этаж · жилой')&&text.includes('Настройки одного пространства'));
  out.stackedIdentityFields=await dialog.evaluate(el=>{const name=el.querySelector('#space-title').getBoundingClientRect(),scale=el.querySelector('#space-cell-cm').closest('.hpf-unit').getBoundingClientRect();return scale.top>name.bottom+18&&Math.abs(name.width-scale.width)<2;});
  out.singlePlanSource=await dialog.locator('select[name="space-plan-source"]').count()===1&&await dialog.locator('input[name="plansrc"]').count()===0;
  out.savedStatusFirst=await dialog.locator('.hpf-footer').evaluate(el=>el.firstElementChild.classList.contains('hpf-status')&&el.firstElementChild.textContent.includes('Все изменения сохранены'));
  out.legacyRawStillPreservedBeforeSave=original.settings.hide_openings===true&&initial.hideOpenings===false;
  out.fourSections=await dialog.locator('.hpf-settings-pane').count()===4;
  out.cleanSaveDisabled=await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
  await dialog.locator('#space-cell-cm').fill('');await tick();
  out.rawInvalidBlocksSave=(await read()).cellCmInput==='' && await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
  await dialog.locator('#space-cell-cm').fill(initial.cellCmInput);await tick();
  await dialog.locator('#space-title').fill('Space draft 945');await tick();
  out.dirtyStatus=await dialog.locator('.hpf-status').textContent().then(text=>text.includes('несохранённые'));
  await section('appearance');
  const beforeBorders=(await read()).showBorders;
  await dialog.locator('#space-show-borders').click();await tick();
  const changed=await read();
  out.boundariesOwnOpenings=changed.showBorders===!beforeBorders && changed.hideOpenings===beforeBorders;
  await dialog.locator('#space-show-borders').click();await tick();
  const walls=(await read()).zeroWallStyle;
  await select('space-fill-mode','temp');
  out.fillKeepsWallStyle=(await read()).zeroWallStyle===walls;
  await dialog.locator('#space-temp-min').fill('');await dialog.locator('#space-temp-max').fill('');await tick();
  out.twoInvalidTemperatures=await dialog.locator('.hpf-status .hpf-link').textContent().then(t=>t.includes('2')) && await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
  await section('basics');
  await dialog.locator('.hpf-status .hpf-link').click();await tick();
  out.validationRevealsHiddenPane=await dialog.locator('[data-settings-section="appearance"]').isVisible() && await dialog.locator('#space-temp-min').evaluate(el=>el.getRootNode().activeElement===el);
  await dialog.locator('#space-temp-min').fill('20');await dialog.locator('#space-temp-max').fill('24');await tick();
  await section('room-cards');
  out.metricsInTwoColumns=await dialog.locator('.hpf-room-metrics .hpf-toggle').evaluateAll(nodes=>nodes.length===5&&Math.abs(nodes[0].getBoundingClientRect().top-nodes[1].getBoundingClientRect().top)<1&&nodes[1].getBoundingClientRect().left>nodes[0].getBoundingClientRect().right);
  await dialog.locator('#space-show-names').check();await tick();
  await dialog.locator('#space-name-font').fill('150');await dialog.locator('#space-name-font').press('Tab');await tick();
  await dialog.locator('#space-label-font').fill('75');await dialog.locator('#space-label-font').press('Tab');await tick();
  const fonts=await read();
  out.independentFonts=fonts.cardNameScale===1.5 && fonts.cardLabelScale===.75;
  out.previewIndependentFonts=await dialog.locator('.cpname').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)===24);
  await select('space-battery-mode','all');await select('space-show-lqi','off');
  const battery=await read();out.adjacentBatteryAndSignal=battery.deviceBatteryMode==='all'&&battery.showLqiMode==='off';
  const checkbox=dialog.locator('#space-tile-labelCo2');await checkbox.check();await tick();
  out.co2PreviewIsText=await dialog.locator('.cpco2').textContent().then(t=>t.includes('CO₂')) && await dialog.locator('.cpco2 ha-icon').count()===0;
  await section('sun');
  await select('space-bg-mode','');
  out.inheritedBackgroundReadOnly=await dialog.locator('[data-card="sun"] hp-color-opacity').count()===0;
  await select('space-north-mode','custom');
  await dialog.locator('#space-north-deg').fill('400');await tick();
  out.invalidNorthBlocksSave=(await read()).northDegInput==='400' && await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
  await dialog.locator('#space-north-deg').fill('32');await tick();
  out.sharedCompass=await dialog.locator('.hpf-north-dial g').getAttribute('transform')==='rotate(32 74 74)';
  await select('space-sun-rays','0');out.sunFalse=(await read()).sunRays===false;
  await dialog.locator('[data-card="sun"] .hpf-link').last().click();await tick();
  const general=card.locator('hp-dialog[data-kind="settings"][settings-layout]');
  out.generalOpensAtSource=await general.locator('[data-settings-section="sun"]').isVisible();
  await general.locator('.btn[data-hp="dialog-cancel"]').click();await tick();
  out.returnKeepsSpaceDraft=(await read()).title==='Space draft 945' && await dialog.locator('[data-settings-section="sun"]').isVisible();
  out.noWriteWhileEditing=JSON.stringify(await saved())===JSON.stringify(original);
  await dialog.locator('.btn[data-hp="dialog-cancel"]').click();
  const confirm=card.locator('hp-confirm hp-dialog');await confirm.locator('.btn[data-hp="dialog-cancel"]').click();await tick();
  out.keepEditingPreservesDraft=(await read()).northDeg===32;
  await dialog.locator('[data-hp="dialog-confirm"]').click();await page.evaluate(()=>window.__hpTest.waitForWrites());
  const result=await saved();
  out.savedActualKeys=result.settings.card_name_scale===1.5 && result.settings.card_label_scale===.75 && result.settings.show_device_battery_mode==='all'
    && result.settings.show_lqi_mode==='off' && result.settings.north_deg===32 && result.settings.sun_rays===false && result.settings.temp_min===20 && result.settings.temp_max===24;
  await open();
  out.reopensSavedValues=(await read()).cardLabelScale===.75 && (await read()).deviceBatteryMode==='all';
  await section('basics');
  await dialog.locator('#space-title').fill('Discard this');await tick();
  await dialog.locator('.btn[data-hp="dialog-cancel"]').click();await confirm.locator('[data-hp="dialog-confirm"]').click();await tick();
  out.discardDidNotWrite=(await saved()).title==='Space draft 945';
  await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.openRoomEdit('r1');});
  const room=card.locator('hp-dialog[data-kind="room"]');
  await room.locator('#room-name-scale').fill('200');await room.locator('#room-name-scale').press('Tab');await tick();
  await room.locator('#room-label-scale').fill('150');await room.locator('#room-label-scale').press('Tab');await tick();
  out.roomPreviewUsesBothSpaceBases=await room.locator('.cardpreview').evaluate(el=>
    parseFloat(getComputedStyle(el.querySelector('.cpname')).fontSize)===48
    && parseFloat(getComputedStyle(el.querySelector('.cpmeta')).fontSize)===13.5);
  out.roomHintNamesBothSpaceBases=await room.locator('[data-card="sizes"] .hpf-callout').textContent().then(text=>text.includes('150%')&&text.includes('75%'));
  await room.locator('.hpf-footer [data-hp="dialog-cancel"]').click();await confirm.locator('[data-hp="dialog-confirm"]').click();await tick();
  out.roomPreviewCancelKeepsSpace=JSON.stringify(await saved())===JSON.stringify(result);
  await open();
  for (const width of [320,390,1280]) {
    await page.setViewportSize({width,height:800});
    if(width<550)await dialog.locator('.hpf-settings-mobile select').selectOption('basics');else await section('basics');
    out[`imageActions${width}`]=await dialog.locator('.hpf-plan-actions .btn').evaluateAll(nodes=>nodes.length===2&&Math.abs(nodes[0].getBoundingClientRect().top-nodes[1].getBoundingClientRect().top)<1&&Math.abs(nodes[0].getBoundingClientRect().height-nodes[1].getBoundingClientRect().height)<1&&nodes.every(n=>n.getBoundingClientRect().height>=44));
    out[`objectLabels${width}`]=await dialog.locator('.hpf-footer .hpf-action-label').evaluateAll(nodes=>nodes.length===2&&nodes.every(n=>getComputedStyle(n).display!=='none'&&n.getBoundingClientRect().width>20));
    const fit=await page.evaluate(async()=>{
      const c=window.__card,d=c.shadowRoot.querySelector('hp-dialog[data-kind="space"][settings-layout]');
      const mobile=d.querySelector('.hpf-settings-mobile select');let fits=true;
      for(const option of mobile.options){
        mobile.value=option.value;mobile.dispatchEvent(new Event('change',{bubbles:true}));await c.updateComplete;await new Promise(requestAnimationFrame);
        for(const el of d.querySelectorAll('.hpf-settings-pane:not([hidden]) input,.hpf-settings-pane:not([hidden]) hp-settings-select,.hpf-settings-pane:not([hidden]) button')){
          const r=el.getBoundingClientRect();if(r.width>1&&(r.left<0||r.right>innerWidth+1))fits=false;
        }
      }
      const f=d.querySelector('[slot="footer"]').getBoundingClientRect();
      const cancel=d.querySelector('[data-hp="dialog-cancel"]');
      return fits&&f.left>=0&&f.right<=innerWidth+1&&f.bottom<=innerHeight+1&&getComputedStyle(cancel).cursor==='pointer';
    });
    out[`fits${width}`]=fit;
  }
  await reference.close();
  out.liveThemes=await page.evaluate(async()=>{
    const c=window.__card,d=c.shadowRoot.querySelector('hp-dialog[data-kind="space"]'),colors=[];
    for(const [paper,text,accent] of [['#ffffff','#17212b','#007d93'],['#17212b','#ffffff','#5bcce6'],['#f5f0ff','#231235','#a32191']]){
      c.style.setProperty('--card-background-color',paper);c.style.setProperty('--primary-text-color',text);c.style.setProperty('--primary-color',accent);
      await new Promise(requestAnimationFrame);colors.push(getComputedStyle(d.querySelector('.hpf-settings-pane:not([hidden]) .hpf-label')).color);
    }
    return new Set(colors).size===3;
  });
  mkdirSync('artifacts/settings-mobile',{recursive:true});
  await page.setViewportSize({width:390,height:844});
  for(const theme of ['light','dark']){
    await page.evaluate(theme=>{
      const c=window.__card;
      for(const [key,value] of Object.entries(theme==='light'?{'--card-background-color':'#fff','--secondary-background-color':'#eceeef','--primary-text-color':'#17212b','--secondary-text-color':'#586674','--primary-color':'#007d93'}:{'--card-background-color':'#17212b','--secondary-background-color':'#252e39','--primary-text-color':'#fff','--secondary-text-color':'#b5c0cc','--primary-color':'#5bcce6'}))c.style.setProperty(key,value);
    },theme);
    for(const pane of ['basics','appearance','room-cards','sun']){
      await dialog.locator('.hpf-settings-mobile select').selectOption(pane);await tick();
      await page.screenshot({path:`artifacts/settings-mobile/space-${pane}-${theme}.png`});
    }
  }
} catch(error){console.error(error);out.completed=false;}
checkAll(out);await finish(browser,out);
