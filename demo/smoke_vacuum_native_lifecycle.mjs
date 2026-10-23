// #1048: visible current/retained/empty native values in View and kiosk.
import {launchColdView, requirePinnedBrowser, checkAll, finish} from './serve.mjs';

requirePinnedBrowser();
const {page, browser} = await launchColdView();
const out = {};
try {
  await page.evaluate(async () => {
    const old = window.__card;
    const baseWS = old.hass.callWS.bind(old.hass);
    const baseSubscribe = old.hass.connection.subscribeEvents.bind(old.hass.connection);
    window.__addRegistryEntity('vacuum.native1048', null, 'cleaning');
    window.__addRegistryEntity('camera.native1048', null, 'idle');
    const marker = {id:'e_native1048', binding:'entity:vacuum.native1048', space:'f1',
      vacuum:{source:'camera.native1048', trail_mode:'always', map_routes:[{
        id:'route1048', source:'camera.native1048', map_id:'floor', space:'f1', calibration:[1,0,0,0,1,0],
      }]}};
    await window.__hpTest.setServerConfig(cfg => ({...cfg, markers:[...cfg.markers, marker]}));
    await window.__hpTest.setLayout(layout => ({...layout, [marker.id]:{s:'f1', x:.1, y:.1}}));
    const run = {route_id:'route1048', map_id:'floor', path_format:2,
      paths:[[[100,100],[300,100],[600,500]]], points:[[100,100],[300,100],[600,500]],
      quality:{source:'native', reason:'ok', raw_points:3, stored_points:3}, received_at:100, revision:'old'};
    const fixture = window.__native1048 = {cards:[], listeners:new Set(), sequence:0,
      book:{[marker.id]:{current:run, previous:{...run,
        paths:[[[40,40],[80,40]]], points:[[40,40],[80,40]], revision:'previous'}}}};
    const hass = {...old.hass,
      connection:{...old.hass.connection, subscribeEvents:async (handler, event) => {
        if (event === 'houseplan_trail_updated') {
          fixture.listeners.add(handler);
          return () => fixture.listeners.delete(handler);
        }
        return baseSubscribe(handler, event);
      }},
      states:{...old.hass.states,
        'vacuum.native1048':{entity_id:'vacuum.native1048', state:'cleaning', attributes:{}},
        'camera.native1048':{entity_id:'camera.native1048', state:'idle', attributes:{map_name:'floor',
          robot_position:{x:900,y:900}, path:[[888,888],[999,999]]}}},
      callWS:async message => message.type === 'houseplan/trail/get'
        ? {trail_format:2, trails:structuredClone(fixture.book)} : baseWS(message),
    };
    for (const kiosk of [false, true]) {
      const card = document.createElement('houseplan-card');
      card.hass = hass;
      card.setConfig({type:'custom:houseplan-card', language:'en', kiosk});
      if (!kiosk) {old.replaceWith(card); window.__card = card;}
      else {card.style.cssText='display:block;width:1000px;height:700px'; document.body.append(card);}
      fixture.cards.push(card);
    }
    fixture.publish = async (paths, reason='ok') => {
      const count = paths.reduce((n, fragment) => n + fragment.length, 0);
      fixture.book[marker.id].current = {...run, paths, points:paths.at(-1)||[],
        revision:String(++fixture.sequence), received_at:fixture.sequence + 100,
        quality:{source:'native', reason:paths.length ? reason : 'empty_integration',
          raw_points:count, stored_points:count}};
      await Promise.all([...fixture.listeners].map(listener => listener({data:{}})));
      await Promise.all(fixture.cards.map(card => card.updateComplete));
      await window.__hpTest.settled();
    };
    fixture.frames = () => fixture.cards.map(card => {
      const root = card.renderRoot;
      const device = card._devices.find(item => item.id === marker.id);
      return {current:root.querySelector('.vactrail > path.core')?.getAttribute('d')||'',
        previous:root.querySelector('.vactrail .prev path.core')?.getAttribute('d')||'',
        tip:!!root.querySelector('.vactrail line.tip'),
        puck:!!root.querySelector('.vacpuck[data-mid="e_native1048"]'),
        info:device ? card._vacTrailDiagnostics(device) : null};
    });
  });
  await page.waitForFunction(() => window.__native1048.cards.every(card => card._loadOk
    && card._vacSrvTrails.e_native1048?.current));
  for (const iso of [false, true]) {
    await page.evaluate(value => window.__hpTest.setVolumetricView(value), iso);
    await page.evaluate(() => window.__native1048.publish([[[100,100],[300,100],[600,500]]]));
    const before = await page.evaluate(() => window.__native1048.frames());
    await page.evaluate(() => window.__native1048.publish([[[20,20],[70,20]],[[90,90],[90,160]]]));
    const fresh = await page.evaluate(() => window.__native1048.frames());
    out[`fresh_${iso}_view_kiosk`] = fresh.every((frame, i) => frame.current !== before[i].current
      && frame.current.includes('70 20') && frame.current.includes('90 160')
      && !frame.current.includes('600 500') && !frame.current.includes('999 999')
      && frame.previous === before[i].previous && frame.puck && !frame.tip
      && frame.info.raw === 4 && frame.info.stored === 4 && frame.info.rendered > 0
      && frame.info.display === 'vac.trail_display_visible');
    await page.evaluate(() => window.__native1048.publish([[[20,20],[70,20]],[[90,90],[90,160]]], 'coordinates_unverified'));
    const retained = await page.evaluate(() => window.__native1048.frames());
    out[`retained_${iso}_honest`] = retained.every((frame, i) => frame.current === fresh[i].current
      && frame.info.reason === 'coordinates_unverified' && frame.info.display === 'vac.trail_display_retained');
    await page.evaluate(() => window.__native1048.publish([]));
    const empty = await page.evaluate(() => window.__native1048.frames());
    out[`empty_${iso}_no_old_current`] = empty.every((frame, i) => !frame.current && !frame.tip
      && frame.previous === before[i].previous && frame.puck && frame.info.raw === 0
      && frame.info.stored === 0 && frame.info.rendered === 0);
  }
  await page.evaluate(async () => {
    await window.__native1048.publish([[[20,20],[70,20]]], 'stale');
    await window.__hpTest.setMode('devices');
    await window.__hpTest.openMarkerDialog('e_native1048');
  });
  const dialog = page.locator('houseplan-card hp-dialog[data-kind="marker"]');
  await dialog.locator('[data-section-target="vacuum"]').click();
  await dialog.getByText('Map and route diagnostics', {exact:true}).click();
  out.dialog_explains_retained = await dialog.getByText(
    'Showing the last accepted path; new data has not been accepted', {exact:true}).isVisible();
  await page.evaluate(() => window.__native1048.publish([[[20,20],[70,20]]]));
  out.dialog_recovers = !(await dialog.getByText(
    'Showing the last accepted path; new data has not been accepted', {exact:true}).count());
  await dialog.getByRole('button', {name:'Cancel', exact:true}).click();
  checkAll(out);
} catch (error) {
  checkAll({scenario_completed:false});
  throw error;
} finally {
  await finish(browser);
}
