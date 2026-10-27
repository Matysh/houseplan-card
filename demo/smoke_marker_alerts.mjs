import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { settingsSection } from './helpers/settings-section.mjs';
requirePinnedBrowser('device threshold controls and confirmed causes');
const { page, browser } = await launch({ width: 1280, height: 1100 });
const out = {};
const root = page.locator('#host > houseplan-card');
const dialog = root.locator('hp-dialog[data-kind="marker"]');
const constructor = root.locator('hp-dialog[data-kind="alarm-constructor"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const pick = async (id, value) => {
  const select = constructor.locator(`#${id}`);
  const label = await select.locator('option').evaluateAll((nodes,value) => nodes.find(node => node.value === value)?.label, value);
  if (!label) throw new Error(`missing actual option ${id}: ${value}`);
  const control = select.locator('..'); await control.locator('button').click();
  await control.getByRole('option', { name: label, exact: true }).click(); await settle();
};
try {
  await page.evaluate(async () => {
    const card=window.__card,original=card.hass.callWS,originalFormat=card.hass.formatEntityState;card.setConfig({...card._config,language:'en'});window.__hp1000Calls=[];window.__hp1000Conflict=false;
    card.hass={...card.hass,language:'ru',locale:{...card.hass.locale,language:'ru'},formatEntityState:row=>row.entity_id==='binary_sensor.hp1000_open'&&['on','off'].includes(row.state)?row.state==='on'?'Открыто':'Закрыто':originalFormat(row),callWS:async message=>{window.__hp1000Calls.push(structuredClone(message));if(message.type==='houseplan/config/set'&&window.__hp1000Conflict){window.__hp1000Conflict=false;throw Object.assign(new Error('Synthetic stale revision'),{code:'conflict'});}return original(message);}};
    window.__addRegistryEntity('sensor.hp1000_co2', null, '1500', 'demo', { device_id:'d_light1', name:'CO₂' }, {unit_of_measurement:'ppm', reading:1500});
    window.__addRegistryEntity('binary_sensor.hp1000_open', null, 'on', 'demo', {device_id:'d_light1',name:'Window'}, {device_class:'door'});
    window.__addRegistryEntity('select.hp1000_enum', null, '123', 'demo', {device_id:'d_light1',name:'Mode'}, {options:['123','456']});
    window.__addRegistryEntity('sensor.hp1000_foreign', null, '9999', 'demo', {device_id:'d_temp',name:'Foreign'}, {});
    await window.__hpTest.setServerConfig(cfg => {cfg.markers=cfg.markers.filter(m=>m.id!=='d_light1');cfg.markers.push({id:'d_light1',binding:'device:d_light1',tap_action:'info'});return cfg;});
    await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('d_light1');
  });
  await settingsSection(dialog,'alarms'); await settle();
  const before = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
  out.emptyTable = await dialog.locator('.alarm-empty').textContent().then(s => s.includes('No alarms yet'));
  await dialog.locator('[data-hp="alarm-create"]').click();
  out.defaultAttention = await constructor.locator('#alarm-level').inputValue() === 'attention';
  out.foreignNotOffered = await constructor.locator('#alarm-source option').evaluateAll(nodes=>!nodes.some(n=>n.value.includes('hp1000_foreign')));
  await page.keyboard.press('Escape'); await settle();
  out.nestedEscapeKeepsOuter = await constructor.count() === 0 && await dialog.count() === 1;
  out.nestedEscapeReturnsFocus = await root.evaluate(node => node.shadowRoot.activeElement?.getAttribute('data-hp') === 'alarm-create');
  out.nestedCancelNoWrite = await page.evaluate(before=>JSON.stringify(window.__card._serverCfg)===before && window.__card._markerDialog.alertSources===undefined,before);
  await dialog.locator('[data-hp="alarm-create"]').click();
  await pick('alarm-source',JSON.stringify(['binary_sensor.hp1000_open',null]));
  out.binaryHasNoFreeText = await constructor.locator('input#alarm-value').count()===0 && await constructor.locator('select#alarm-value').count()===1;
  await pick('alarm-value','on');
  out.localizedBinaryLabelKeepsRawOption = await constructor.locator('#alarm-value').locator('..').locator('button').textContent().then(text=>text.includes('Открыто'));
  await constructor.locator('[data-hp="alarm-ok"]').click(); await settle();
  out.rawBinarySavedOnlyInOuterDraft = await page.evaluate(before=>{
    const c=window.__card,r=c._markerDialog.alertSources?.[0];return r?.value==='on' && r.level==='attention' && r.type==='threshold' && JSON.stringify(c._serverCfg)===before;
  },before);
  await dialog.locator('[data-hp="alarm-add"]').click();
  await pick('alarm-source',JSON.stringify(['select.hp1000_enum',null]));await pick('alarm-value','123');await constructor.locator('[data-hp="alarm-ok"]').click();await settle();
  out.numericLookingEnumStaysString = await page.evaluate(()=>window.__card._markerDialog.alertSources?.[1]?.value === '123');
  await dialog.locator('[data-hp="alarm-edit"]').nth(1).click();
  await page.evaluate(()=>{const c=window.__card,id='select.hp1000_enum';c.hass={...c.hass,states:{...c.hass.states,[id]:{...c.hass.states[id],attributes:{...c.hass.states[id].attributes,options:['456']}}}};});await settle();
  out.lostOptionVisibleAndCannotCommit = await constructor.locator('[data-hp="alarm-ok"]').isDisabled()
    && await constructor.locator('#alarm-value').locator('..').locator('button').textContent().then(text=>text.includes('123')&&text.includes('Unavailable'))
    && await constructor.locator('input#alarm-value').count()===0;
  await constructor.locator('[data-hp="alarm-cancel"]').click();
  await page.evaluate(()=>{const c=window.__card,id='select.hp1000_enum';c.hass={...c.hass,states:{...c.hass.states,[id]:{...c.hass.states[id],attributes:{...c.hass.states[id].attributes,options:['123','456']}}}};});await settle();
  await dialog.locator('[data-hp="alarm-add"]').click();
  await pick('alarm-source',JSON.stringify(['sensor.hp1000_co2','reading']));
  await pick('alarm-operator','gt'); await constructor.locator('#alarm-value').fill('1000');await pick('alarm-level','alarm');
  await constructor.locator('[data-hp="alarm-ok"]').click(); await settle();
  out.maximumThree = await dialog.locator('[data-hp="alarm-add"]').isDisabled() && await dialog.locator('[data-alert-rule]').count()===3;
  await page.evaluate(()=>{window.__hp1000Conflict=true;});
  await dialog.locator('[data-hp="dialog-confirm"]').click();await settle();
  await page.waitForFunction(()=>window.__card._markerDialog?.busy===false);
  out.refusedSaveRetainsUnsavedRules = await page.evaluate(before=>window.__card._markerDialog?.alertSources?.length===3&&JSON.stringify(window.__card._serverCfg)===before,before);
  await dialog.locator('[data-hp="dialog-confirm"]').click();await settle();
  out.persistedDefinitionsOnly = await page.evaluate(()=>{
    const r=window.__card._serverCfg.markers.find(m=>m.id==='d_light1').alert_sources;
    return r.length===3 && r[2].value===1000 && r[2].attribute==='reading' && r.every(x=>!('active'in x)&&!('pending'in x));
  });
  await page.evaluate(()=>window.__hpTest.setMode('view'));await settle();
  const device=root.locator('[data-hp="device"][data-id="d_light1"]').first();
  await page.waitForFunction(()=>window.__card.shadowRoot.querySelector('[data-hp="device"][data-id="d_light1"]').classList.contains('alarm'),{timeout:6000});
  out.confirmedAlarmHasNoCompetingAttention = await device.locator('.device-attention').count()===0;
  await device.click(); await settle();
  out.threeDistinctCauses = await root.locator('.device-issue[data-source^="binary_sensor.hp1000"],.device-issue[data-source^="select.hp1000"],.device-issue[data-source^="sensor.hp1000"]').count()===3;
  out.attentionIsSeparateGroup = await root.locator('.device-issues.attention').count()===1;
  out.actualAttributeCondition = await root.locator('.device-issues.alarm').textContent().then(text=>text.includes('reading > 1000') && !text.includes('1000 ppm'));
  await page.evaluate(()=>window.__hpTest.close());
  await page.evaluate(async()=>{await window.__hpTest.setMode('devices');await window.__hpTest.openMarkerDialog('d_light1');});
  await settingsSection(dialog,'appearance');await settle();
  out.unchangedPreviewUsesAcceptedReasonsImmediately = await dialog.locator('hp-device-preview .device-issue').count()===3;
  await settingsSection(dialog,'alarms');const persisted=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg));
  await dialog.locator('[data-hp="alarm-remove"]').first().click();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await root.locator('hp-confirm hp-dialog [data-hp="dialog-confirm"]').click();await dialog.waitFor({state:'detached'});
  out.outerCancelPreservesSavedRules = await page.evaluate(value=>JSON.stringify(window.__card._serverCfg)===value,persisted);
  await page.setViewportSize({width:390,height:900});
  await page.evaluate(()=>window.__hpTest.openMarkerDialog('d_light1'));await settingsSection(dialog,'alarms');
  await dialog.locator('[data-hp="alarm-edit"]').nth(1).click();
  const narrowControl=constructor.locator('#alarm-value').locator('..');await narrowControl.locator('button').click();
  out.narrowDropdownFitsViewport = await narrowControl.locator('[role="listbox"]').evaluate(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&node.scrollWidth<=node.clientWidth+1;});
  await page.keyboard.press('Escape');await settle();
  out.narrowEscapeKeepsConstructor = await constructor.count()===1&&await narrowControl.locator('button').getAttribute('aria-expanded')==='false';
  await constructor.locator('[data-hp="alarm-cancel"]').click();await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await settle();
  await page.setViewportSize({width:1280,height:1100});
  await page.evaluate(()=>window.__hpTest.openMarkerDialog('d_light1'));await settingsSection(dialog,'alarms');
  const writeCursor=await page.evaluate(()=>window.__hp1000Calls.length);
  while(await dialog.locator('[data-hp="alarm-remove"]').count()){
    await dialog.locator('[data-hp="alarm-remove"]').first().click();await settle();
  }
  await dialog.locator('[data-hp="dialog-confirm"]').click();await settle();await dialog.waitFor({state:'detached'});
  out.lastRuleSaveOmitsOptionalField=await page.evaluate(cursor=>{
    const writes=window.__hp1000Calls.slice(cursor).filter(message=>message.type==='houseplan/config/set');
    const sent=writes[0]?.config.markers.find(marker=>marker.id==='d_light1');
    const saved=window.__card._serverCfg.markers.find(marker=>marker.id==='d_light1');
    return writes.length===1&&!!sent&&!!saved&&!Object.hasOwn(sent,'alert_sources')&&!Object.hasOwn(saved,'alert_sources');
  },writeCursor);
  out.noHaActions = await page.evaluate(()=>window.__serviceCalls.length===0);
  checkAll(out);
} catch(error) { console.error(error); out.completed = false; checkAll(out); }
await finish(browser,out);
