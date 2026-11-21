/** #1512: actual form clicks, transport round trip and exact layout preservation. */
import {launch,checkAll,finish} from './serve.mjs';
import {settingsSection} from './helpers/settings-section.mjs';
const {page,browser}=await launch({width:1100,height:1000});
const out={};
try{
 const root=page.locator('#host > houseplan-card'),dialog=root.locator('hp-dialog[data-kind="marker"]');
 const settle=()=>page.evaluate(()=>window.__hpTest.settled());
 const open=async()=>{await page.evaluate(async()=>{window.__card._openMarkerDialog(window.__card._devices.find(d=>d.id==='d_temp'));await window.__card.updateComplete;});};
 for(const [name,change] of [['action','more-info'],['size09',.9],['size08',.8]]){
  await page.evaluate(async()=>{await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...cfg.markers.filter(m=>m.id!=='d_temp'),{id:'d_temp',binding:'device:d_temp',space:'deleted-space',area:'living_room',tap_action:'info',size:1,hidden:false}]}));});await settle();
  const before=await page.evaluate(()=>structuredClone(window.__card._layout));
  await open();
  if(name==='action'){await settingsSection(dialog,'actions');await dialog.locator('#marker-tap-action').selectOption(change);}
  else{await settingsSection(dialog,'appearance');await dialog.locator('#marker-size').fill(String(change));await dialog.locator('#marker-size').press('Tab');}
  await dialog.locator('[data-hp="dialog-confirm"]').click();await dialog.waitFor({state:'detached'});await settle();
  const result=await page.evaluate(async()=>{const c=window.__card,stored=await c.planHost.request({type:'houseplan/config/get'});return {marker:stored.config.markers.find(m=>m.id==='d_temp'),layout:structuredClone(c._layout)};});
  out[name+'Stored']=result.marker.space==='f1'&&(name==='action'?result.marker.tap_action===change:result.marker.size===change);
  out[name+'ExactPositionAndForeignLayout']=JSON.stringify(result.layout)===JSON.stringify(before);
  await open();out[name+'Reopened']=await page.evaluate(change=>change==='more-info'?window.__card._markerDialog.tapAction===change:window.__card._markerDialog.size===change,change);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await settle();
 }
 await open();await settingsSection(dialog,'light');
 await page.evaluate(()=>{const c=window.__card;c._markerDialog={...c._markerDialog,lightRole:'always',lightRoleTouched:true};});await settle();
 await dialog.locator('#marker-glow-radius').fill('0.01');await settingsSection(dialog,'actions');
 out.invalidHiddenFieldBlocksSave=await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
 out.hiddenFieldHasAction=await dialog.locator('[data-action="review-fields"]').isVisible();
 await dialog.locator('[data-action="review-fields"]').click();await settle();
 out.errorRevealsCorrectTab=await dialog.locator('[data-settings-section="light"]').isVisible();
 out.errorExplainsRadius=/0[.,]1.*100/.test(await dialog.locator('[data-settings-section="light"] .hpf-error').textContent());
 out.invalidDraftRetained=await dialog.locator('#marker-glow-radius').inputValue()==='0.01';
 await dialog.locator('#marker-glow-radius').fill('');
 await dialog.locator('#marker-glow-radius').pressSequentially('1e');await settingsSection(dialog,'actions');
 out.nativeBadInputSurvivesTab=await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
 await dialog.locator('[data-action="review-fields"]').click();await settle();
 out.nativeBadInputIsExplained=await dialog.locator('#marker-glow-radius').evaluate(input=>input.validity.badInput)
   && await dialog.locator('[data-settings-section="light"] .hpf-error').isVisible();
 await dialog.locator('#marker-glow-radius').fill('');await settingsSection(dialog,'details');
 await dialog.locator('#marker-description').fill('x'.repeat(4001));await settingsSection(dialog,'actions');
 out.hiddenDescriptionBlocksSave=await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
 await dialog.locator('[data-action="review-fields"]').click();await settle();
 out.descriptionRevealed=await dialog.locator('[data-settings-section="details"]').isVisible()&&/4000/.test(await dialog.locator('[data-settings-section="details"] .hpf-error').textContent());
 await dialog.locator('#marker-description').fill('valid');await settle();
 out.fixedFieldsAllowSave=await dialog.locator('[data-hp="dialog-confirm"]').isEnabled();
 await dialog.locator('[data-hp="dialog-confirm"]').click();await dialog.waitFor({state:'detached'});

 // Opening and saving unrelated metadata must not round a valid boundary radius
 // outside the server range (10 cm used to become 0.3 ft -> 9 cm).
 await page.evaluate(()=>{const c=window.__card;c.hass={...c.hass,config:{...c.hass.config,unit_system:{...c.hass.config?.unit_system,length:'mi'}}};});await settle();
 for(const cm of [10,11,9999,10000]){
  await page.evaluate(async cm=>{await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:cfg.markers.map(m=>m.id==='d_temp'?{...m,glow_radius_cm:cm,description:'radius '+cm}:m)}));},cm);await settle();
  const before=await page.evaluate(()=>structuredClone(window.__card._layout));
  await open();await settingsSection(dialog,'details');
  await dialog.locator('#marker-description').fill('saved radius '+cm);await settle();
  out['imperial'+cm+'AllowsMetadataSave']=await dialog.locator('[data-hp="dialog-confirm"]').isEnabled();
  await dialog.locator('[data-hp="dialog-confirm"]').click();await dialog.waitFor({state:'detached'});await settle();
  out['imperial'+cm+'RetainsRadiusAndPosition']=await page.evaluate(async({cm,before})=>{const c=window.__card,stored=await c.planHost.request({type:'houseplan/config/get'});return stored.config.markers.find(m=>m.id==='d_temp').glow_radius_cm===cm&&JSON.stringify(c._layout)===JSON.stringify(before);},{cm,before});
 }
 checkAll(out);await finish(browser,out);
}catch(error){await browser.close();throw error;}
