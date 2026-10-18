// #945: global → actual device space → marker, through full/static/kiosk/preview.
import { launch, checkAll, finish } from './serve.mjs';
import { installBatteryFixture, setBatteryState, patchBatteryMarker } from './helpers/device-battery-fixture.mjs';
const {page,browser}=await launch({width:1280,height:900});
const out={};
try {
  await installBatteryFixture(page);
  await page.evaluate(async()=>{
    const c=window.__card;
    for(const tag of ['houseplan-card','houseplan-space-card']){
      const node=document.createElement(tag);
      node.dataset.policyPeer=tag;
      node.setConfig(tag==='houseplan-card'?{type:'custom:houseplan-card',kiosk:true}:{type:'custom:houseplan-space-card',space:'f1'});
      node.hass=c.hass;document.body.append(node);
    }
  });
  const wait=async visible=>page.waitForFunction(visible=>{
    const cards=[window.__card,...document.querySelectorAll('[data-policy-peer]')];
    return cards.every(c=>!!c.shadowRoot?.querySelector('[data-id="d_temp"]')
      && !!c.shadowRoot.querySelector('[data-id="d_temp"] .device-battery')===visible);
  },visible);
  const policy=async own=>page.evaluate(async own=>{
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.settings.show_device_battery=false;
      const space=cfg.spaces.find(s=>s.id==='f1');
      space.settings={...space.settings,show_device_battery_mode:own};
    });
  },own);
  await wait(true);
  await policy('all');await wait(true);out.localAllWinsGlobalOff=true;
  await page.evaluate(async()=>{await window.__hpTest.setVolumetricView(true);});await wait(true);
  out.isometricUsesSpacePolicy=true;
  await policy('low');await wait(false);out.lowFiltersNormal=true;
  await setBatteryState(page,'15');
  await page.evaluate(()=>{for(const peer of document.querySelectorAll('[data-policy-peer]'))peer.hass=window.__card.hass;});
  await wait(true);out.lowShowsLow=true;
  await policy('off');await wait(false);out.localOffHidesLow=true;
  await policy('inherit');await wait(false);out.inheritFollowsGlobalOff=true;
  await policy('all');await wait(true);
  await page.evaluate(async()=>{await window.__hpTest.setMode('devices');await window.__hpTest.openMarkerDialog('d_temp');});
  await page.waitForFunction(()=>window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.device-battery'));
  out.previewUsesActualSpace=true;
  await page.evaluate(()=>window.__hpTest.close(undefined,{via:'cancel'}));
  await patchBatteryMarker(page,{hide_battery:true});await wait(false);out.markerOnlyHides=true;
  await patchBatteryMarker(page,{hide_battery:false});await wait(true);out.markerFalseRestoresResolvedAll=true;
  await policy('off');await wait(false);out.markerFalseCannotEnableLocalOff=true;
}catch(error){console.error(error);out.completed=false;}
checkAll(out);await finish(browser,out);
