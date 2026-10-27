// #1093/#1000: observe authority while hidden, paint only the demanded frame.
import assert from 'node:assert/strict';

export async function runAlertDemandWitnesses({page,card}) {
  const saved=await page.evaluate(()=>structuredClone(window.__card._serverCfg));
  const originalState=await page.evaluate(()=>window.__card.hass.states['sensor.load_1'].state);
  const visibility=await page.evaluate(()=>document.visibilityState);
  const result={};
  const tick=()=>page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const state=async value=>{await page.evaluate(value=>{const c=window.__card,id='sensor.load_1';c.hass={...c.hass,states:{...c.hass.states,[id]:{...c.hass.states[id],state:value}}};},value);await tick();};
  const demand=async value=>{await page.evaluate(value=>{Object.defineProperty(document,'visibilityState',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));},value);await tick();};
  const work=()=>page.evaluate(()=>({snapshot:window.__card._liveRt.work(),floor:{...window.__card._floorCacheBuilds},models:window.__card._spaceModels.work.builds}));
  const pick=async id=>{const tab=card.locator(`[data-hp="space-tab"][data-id="${id}"]`);if(await tab.count())await tab.click();else await card.locator('[data-hp="space-select-value"]').selectOption(id);await page.waitForFunction(()=>!window.__card._slide);await tick();};
  const attention=()=>card.locator('[data-hp="device"][data-id="load-1"] .device-attention');
  try {
    if(await page.evaluate(()=>window.__card._mode!=='view'))await card.locator('[data-hp="editor-close"]:visible').first().click();await pick('f1');
    await state('10');
    await page.evaluate(()=>window.__hpTest.setServerConfig(config=>{const marker=config.markers.find(m=>m.id==='load-1');marker.display='value';marker.alert_sources=[{id:'demand',type:'threshold',level:'attention',entity_id:'sensor.load_1',operator:'gt',value:50}];return config;}));
    await page.waitForFunction(()=>!!window.__card._alerts);await tick();
    await demand('hidden');const before=await work();await state('80');
    await page.waitForTimeout(3150);
    const after=await work();assert.deepEqual(after,before,'hidden confirmation does not build frames/physics');
    assert.equal(await attention().count(),0,'hidden surface has not published the new alert');
    await demand('visible');await attention().waitFor({timeout:1000});
    result.document={before,after,latestConfirmedOnReveal:true};
    // Deactivation is also continuous across an inactive floor. Reveal must
    // use the observed latest truth, rather than restart its three-second hold.
    await pick('f2');const floorBefore=await work();await state('10');await page.waitForTimeout(3150);
    const floorAfter=await work();assert.deepEqual(floorAfter,floorBefore,'inactive alert does not rebuild the shown floor');
    await pick('f1');assert.equal(await attention().count(),0,'mature inactive recovery is reflected in the first shown frame');
    result.inactive={before:floorBefore,after:floorAfter,latestRecoveryOnReveal:true};
  } finally {
    await demand(visibility);
    await page.evaluate(config=>window.__hpTest.setServerConfig(()=>config),saved);
    await state(originalState);await pick('f1');
  }
  return result;
}
