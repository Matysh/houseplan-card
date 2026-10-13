// #872: real card transport/render, native authority, gaps and shared quota.
import { launchColdView, requirePinnedBrowser, checkAll, finish } from './serve.mjs';
requirePinnedBrowser();
const { page, browser } = await launchColdView();
const out = await page.evaluate(async () => {
  const old = window.__card, baseWS = old.hass.callWS.bind(old.hass);
  let trailNotify, serverFormat = 2;
  const baseSubscribe = old.hass.connection.subscribeEvents.bind(old.hass.connection);
  window.__addRegistryEntity('vacuum.fidelity', null, 'cleaning');
  window.__addRegistryEntity('camera.fidelity_map', null, 'idle');
  const run = { route_id: 'fidelity-route', map_id: 'm1', path_format: 2,
    paths: [[[100, 100], [300, 100], [300, 400]], [[400, 500], [600, 500]]],
    points: [[400, 500], [600, 500]], quality: { source: 'native', reason: 'ok', raw_points: 5 },
    final_status: 'unconfirmed', received_at: 1700000000 };
  const server = { e_vacuum_fidelity: { current: run } };
  const hass = { ...old.hass, connection: { ...old.hass.connection,
    subscribeEvents: async (handler, event) => {
      if (event === 'houseplan_trail_updated') { trailNotify = handler; return () => {}; }
      return baseSubscribe(handler, event);
    } }, states: { ...old.hass.states,
    'vacuum.fidelity': { entity_id: 'vacuum.fidelity', state: 'cleaning', attributes: {} },
    'camera.fidelity_map': { entity_id: 'camera.fidelity_map', state: 'idle', attributes: {
      robot_position: {x:900,y:900}, map_name:'m1', path:[[999,999],[888,888]] } } },
    callWS: async (message) => message.type === 'houseplan/trail/get'
      ? { trail_format: serverFormat, trails: server } : baseWS(message) };
  const marker = {id:'e_vacuum_fidelity',binding:'entity:vacuum.fidelity',space:'f1',
    vacuum:{source:'camera.fidelity_map',trail_mode:'always',map_routes:[{
      id:'fidelity-route',source:'camera.fidelity_map',map_id:'m1',space:'f1',calibration:[1,0,0,0,1,0]}]}};
  await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...cfg.markers,marker]}));
  await window.__hpTest.setLayout(layout=>({...layout,e_vacuum_fidelity:{s:'f1',x:.1,y:.1}}));
  const c = document.createElement('houseplan-card');
  c.hass = hass; c.setConfig({type:'custom:houseplan-card'});
  old.replaceWith(c); window.__card = c;
  await window.__hpTest.settled();
  await window.__hpTest.setMode('view');
  c.requestUpdate(); await c.updateComplete;
  await new Promise((r)=>setTimeout(r,100));
  const root=()=>c.renderRoot;
  const path=()=>root().querySelector('.vactrail > path.core')?.getAttribute('d');
  const original=path();
  const results={
    nativeRawEndpoint:original?.endsWith('600 500'),
    nativeGapLiteral:(original?.match(/M /g)||[]).length===2,
    noFabricatedNativeTip:!root().querySelector('.vactrail line.tip'),
    rawHaPathCannotBypassServer:!original?.includes('999 999'),
  };
  const computations=c._vacGeometryCache.computations;
  c.hass={...c.hass,states:{...c.hass.states,'sensor.unrelated':{state:'42',attributes:{}}}};
  await c.updateComplete;
  results.unrelatedGeometryCached=c._vacGeometryCache.computations===computations && path()===original;
  const dense=Array.from({length:100000},(_,i)=>[i%2*10,i*20]);
  server.e_vacuum_fidelity.current={...run,paths:[dense],quality:{source:'native',reason:'ok',raw_points:100000}};
  await trailNotify({data:{}});
  c.requestUpdate(); await c.updateComplete;
  const limited=c._vacTrailDiagnostics(c._devices.find(d=>d.id==='e_vacuum_fidelity'));
  results.rawAll100k=limited.raw===100000 && limited.stored===100000;
  results.shared20kBudget=limited.rendered===20000 && limited.reason==='limited';
  results.limitedNoFalseTail=!root().querySelector('.vactrail line.tip')
    && (path()?.match(/M /g)||[]).length===2
    && path()?.endsWith('M 10 1999980 L 10 1999980');
  results.latestPointUsesRoundCaps=getComputedStyle(root().querySelector('.vactrail > path.core')).strokeLinecap==='round';
  server.e_vacuum_fidelity.current=run;
  await trailNotify({data:{}});
  c.requestUpdate(); await c.updateComplete;
  await window.__hpTest.setVolumetricView(true); await c.updateComplete;
  await new Promise(r=>setTimeout(r,100));
  results.isoSameNativePath=path()===original;
  server.e_vacuum_fidelity.current={...run,quality:{source:'positions',reason:'limited',raw_points:5}};
  await trailNotify({data:{}}); c.requestUpdate(); await c.updateComplete;
  results.positionQuotaNoFalseTip=!root().querySelector('.vactrail line.tip') && path()?.endsWith('600 500');
  server.e_vacuum_fidelity.current=run;
  await trailNotify({data:{}}); c.requestUpdate(); await c.updateComplete;
  await window.__hpTest.setMode('devices'); await c.updateComplete;
  const dev=c._devices.find(d=>d.id==='e_vacuum_fidelity');
  const info=c._vacTrailDiagnostics(dev);
  results.diagnosticsHonest=info.source==='native' && info.raw===5 && info.stored===5 && !info.final;
  serverFormat=1;
  c.hass={...c.hass,states:{...c.hass.states,'camera.fidelity_map':{
    ...c.hass.states['camera.fidelity_map'], attributes:{robot_position:{x:900,y:900},map_name:'m1',
      path:Array.from({length:100001},(_,i)=>[i,0])}}}};
  await trailNotify({data:{}}); c.requestUpdate(); await c.updateComplete;
  results.legacyQuotaReported=c._vacTrailDiagnostics(dev).reason==='limited';
  return results;
});
checkAll(out); await finish(browser);
