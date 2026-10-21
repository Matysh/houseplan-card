// #1002: authentic HA controls with synthetic robots; never connects to live HA.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from 'playwright/test';
import { createLabServer } from './server.mjs';
import { attestLaunchedBrowser } from '../../scripts/browser-attestation.mjs';
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';

const { values } = parseArgs({ options: { 'ha-cache': { type: 'string' } } });
const fixture = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const space = fixture.config.spaces[0].id;
for (const [id, color, opacity] of [['lab_robot', null, null], ['second_robot', '#FA6688', 0.5]]) {
  if (id !== 'lab_robot') {
    fixture.devices[id] = { ...fixture.devices.lab_robot, id, name: 'Second robot', name_by_user: null };
    fixture.entities[`vacuum.${id}`] = { ...fixture.entities['vacuum.lab_robot'], entity_id: `vacuum.${id}`, device_id: id };
    fixture.states[`vacuum.${id}`] = structuredClone(fixture.states['vacuum.lab_robot']);
    fixture.layout[id] = { s: space, x: 0.3, y: 0.3 };
    fixture.config.markers.push({ id, binding: `device:${id}`, space, tap_action: 'more-info' });
  }
  fixture.states[`vacuum.${id}`].state = 'cleaning';
  fixture.states[`camera.${id}_map`] = { entity_id: `camera.${id}_map`, state: 'idle', attributes: {
    friendly_name: `${id} map`, map_name: 'm1', robot_position: { x: 700, y: id === 'lab_robot' ? 300 : 650 },
    rooms: { 1: { name:'Kitchen-living room', x:250, y:250 } },
  } };
  fixture.entities[`camera.${id}_map`] = { entity_id: `camera.${id}_map`, device_id:id, platform:'dreame_vacuum', disabled_by:null };
  fixture.config.markers.find(m=>m.id===id).vacuum = { source:`camera.${id}_map`, trail_mode:'always',
    calibration:{ m1:[1,0,0,0,1,0] }, ...(color ? {trail_color:color,trail_opacity:opacity} : {}) };
}
const dir = mkdtempSync(join(tmpdir(), 'houseplan-vacuum-1002-'));
const file = join(dir, 'fixture.json');
writeFileSync(file, JSON.stringify(fixture));
const output = new URL('../../artifacts/vacuum-ui-1002/', import.meta.url);
mkdirSync(output, { recursive: true });
const server = createLabServer({ port:0, fixture:file, ...(values['ha-cache'] ? {haCache:values['ha-cache']} : {}) });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const checks = [], errors = [], external = [];
let page;
try {
  await attestLaunchedBrowser(browser, {reason:'#1002 synthetic vacuum settings and trails'});
  const context = await browser.newContext({viewport:{width:712,height:884}});
  await context.route('**/*', route=>{
    const u = new URL(route.request().url());
    if(u.origin===origin || ['data:','blob:'].includes(u.protocol)) return route.continue();
    external.push(u.origin+u.pathname); return route.abort();
  });
  page = await context.newPage(); page.on('pageerror', e=>errors.push(e.message));
  const mount = async(scenario=null)=>{
    await page.goto(origin);
    await page.waitForFunction(()=>window.__lab?.card?._devices?.length>0);
    await assertFreshDemoBundle(page);
    await page.evaluate(async(scenario)=>{
      const old=window.__lab.card, base=old.hass.callWS.bind(old.hass);
      const state=window.__vacuumProof={calls:[],fail:false};
      const trails={};
      for(const [id,y] of [['lab_robot',300],['second_robot',650]]) {
        const run={map_id:'m1',path_format:2,paths:[[[200,y],[300,y],[300,y+100],[500,y+100],[600,y]]],
          quality:{source:'positions',reason:'sampled',raw_points:5,stored_points:5}};
        trails[id]={current:run,previous:{...run,paths:[[[200,y-80],[500,y-80]]]}};
      }
      const c=document.createElement('houseplan-card'); c.setConfig({type:'custom:houseplan-card',language:'ru'});
      c.hass={...old.hass,callWS:async message=>{
        state.calls.push(message.type);
        if(message.type==='houseplan/trail/get') return {trail_format:2,trails};
        if(message.type==='houseplan/config/set'&&state.fail) throw {code:'save_failed',message:'Synthetic write refusal'};
        const result=await base(message);
        if(message.type==='houseplan/config/get') {
          if(scenario) {
            const marker=result.config.markers.find(m=>m.id==='lab_robot');
            marker.vacuum={...marker.vacuum,calibration:null,...scenario};
          }
          return {...result,vacuum_dock_restart_api:1};
        }
        return result;
      }};
      old.replaceWith(c); window.__lab.card=c;
    },scenario);
    await page.waitForFunction(()=>window.__lab.card._devices?.some(d=>d.id==='lab_robot'));
    if(!scenario) await expect(page.locator('.vactrail > path[data-vacuum-owner="lab_robot"]').first()).toBeAttached();
  };
  const check=async(name,fn)=>{await fn();checks.push(name);console.log(`PASS ${name}`);};
  const ink=id=>page.locator(`.vactrail > path[data-vacuum-owner="${id}"]`).first();
  const appearance=async id=>ink(id).evaluate(e=>{const c=getComputedStyle(e);return {stroke:c.stroke,alpha:c.strokeOpacity,width:c.strokeWidth,effect:c.vectorEffect};});
  const open=async()=>{
    await page.evaluate(()=>{const c=window.__lab.card;c._openMarkerDialog(c._devices.find(d=>d.id==='lab_robot'));});
    const shell=page.locator('hp-dialog[data-kind="marker"]'); await expect(shell).toBeVisible();
    await shell.getByRole('button',{name:'Пылесос',exact:true}).click();
    await expect(shell.locator('.vacuum-trail-color')).toBeVisible(); return shell;
  };
  const change=async(shell,hex,opacity)=>{
    const picker=shell.locator('.vacuum-trail-color hp-color-opacity');
    await picker.locator('.trigger').click();
    await picker.locator('.picker input[type=text]').fill(hex);
    await picker.locator('.picker input[type=number]').fill(String(opacity));
    await picker.locator('.picker input[type=number]').press('Tab');
    await picker.locator('.picker button').last().click();
    await expect(picker.locator('.picker')).toHaveCount(0);
  };
  await mount();
  await check('AC1 defaults, independent robots, no casing, previous and tip ink',async()=>{
    assert.deepEqual(await appearance('lab_robot'),{stroke:'rgb(100, 181, 246)',alpha:'0.7',width:'0.9px',effect:'non-scaling-stroke'});
    assert.equal((await appearance('second_robot')).stroke,'rgb(250, 102, 136)');
    await expect(page.locator('.vactrail .case')).toHaveCount(0);
    const previous=page.locator('.vactrail g.prev[data-vacuum-owner="lab_robot"]');
    assert.equal(await previous.evaluate(e=>getComputedStyle(e).opacity),'0.4');
    const tips=page.locator('.vactrail line.tip'); assert.ok(await tips.count()>0);
    assert.ok(await tips.evaluateAll(es=>es.every(e=>getComputedStyle(e).strokeWidth==='0.9px'&&getComputedStyle(e).vectorEffect==='non-scaling-stroke')));
    await page.screenshot({path:fileURLToPath(new URL('trails.png',output))});
  });
  await check('AC2 real picker preview is local and does not write config',async()=>{
    const second=await context.newPage();await second.goto(origin);
    await second.waitForFunction(()=>window.__lab?.card?._serverCfg?.markers?.some(m=>m.id==='lab_robot'));
    const shell=await open();
    await expect(shell.locator('.vacuum-source-status')).toContainText('Статус:');
    assert.equal(await shell.locator('.vacuum-trail-color .trigger').getAttribute('title'),null);
    const count=await page.evaluate(()=>window.__vacuumProof.calls.filter(x=>x==='houseplan/config/set').length);
    await change(shell,'#22AA44',40);
    await expect(shell.locator('.vacuum-trail-readout')).toHaveText('#22AA44 · прозрачность 60%');
    assert.equal((await appearance('lab_robot')).stroke,'rgb(34, 170, 68)');
    assert.equal((await appearance('lab_robot')).alpha,'0.4');
    assert.equal((await appearance('second_robot')).stroke,'rgb(250, 102, 136)');
    assert.equal(await page.evaluate(()=>window.__vacuumProof.calls.filter(x=>x==='houseplan/config/set').length),count);
    assert.equal(await second.evaluate(()=>window.__lab.card._serverCfg.markers.find(m=>m.id==='lab_robot').vacuum.trail_color),undefined);
    await second.close();
    await page.screenshot({path:fileURLToPath(new URL('picker-result.png',output))});
  });
  await check('AC2 refused save keeps draft, retry commits, reload retains',async()=>{
    const shell=page.locator('hp-dialog[data-kind="marker"]');
    await page.evaluate(()=>window.__vacuumProof.fail=true);
    await shell.locator('[data-hp="dialog-confirm"]').click();
    await expect(shell.locator('[data-hp="dialog-confirm"]')).toBeEnabled();
    await expect(shell.locator('.vacuum-trail-readout')).toContainText('#22AA44');
    assert.equal(await page.evaluate(()=>window.__lab.card._serverCfg.markers.find(m=>m.id==='lab_robot').vacuum.trail_color),undefined);
    await page.evaluate(()=>window.__vacuumProof.fail=false);
    await shell.locator('[data-hp="dialog-confirm"]').click(); await expect(shell).toHaveCount(0);
    await mount(); assert.equal((await appearance('lab_robot')).stroke,'rgb(34, 170, 68)');
    assert.equal((await appearance('lab_robot')).alpha,'0.4');
  });
  await check('AC2 alpha endpoints, keep editing and discard restore persisted ink',async()=>{
    const shell=await open();
    await change(shell,'#FFFFFF',0);assert.equal((await appearance('lab_robot')).alpha,'0');
    await change(shell,'#FFFFFF',100);assert.equal((await appearance('lab_robot')).alpha,'1');
    await shell.getByRole('button',{name:'Отмена',exact:true}).click();
    const confirm=page.locator('hp-dialog.discard-confirm-dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button',{name:'Вернуться',exact:true}).click();
    await expect(shell.locator('.vacuum-trail-readout')).toContainText('#FFFFFF');
    await shell.getByRole('button',{name:'Отмена',exact:true}).click();
    await confirm.getByRole('button',{name:'Не сохранять',exact:true}).click();
    await expect(shell).toHaveCount(0);
    assert.equal((await appearance('lab_robot')).stroke,'rgb(34, 170, 68)');
    assert.equal((await appearance('lab_robot')).alpha,'0.4');
  });
  await check('AC4 independent Help, map disclosure and accessible responsive controls',async()=>{
    const shell=await open();
    await shell.locator('.vacuum-source-controls hp-help').click();
    assert.equal(await shell.locator('details.vacpicker').evaluate(e=>e.open),false);
    await shell.locator('.vacuum-trail-color').click();
    await shell.locator('.hpf-profile-maproutes').scrollIntoViewIfNeeded();
    await expect(shell.locator('.vacroute').first()).toContainText('Первая карта');
    await expect(shell.locator('.vacuum-add-reason')).toContainText('уже добавлена');
    await shell.locator('.hpf-profile-diagnostics > summary').click();
    await expect(shell.locator('.hpf-profile-diagnostics .vacdiag')).toBeVisible();
    await page.screenshot({path:fileURLToPath(new URL('maps.png',output))});
    for(const theme of ['light','dark']) for(const width of [390,712,1280]) {
      await page.setViewportSize({width,height:884});
      await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.__lab.card.hass={...window.__lab.card.hass,themes:{...window.__lab.card.hass.themes,darkMode:theme==='dark'}};},theme);
      assert.equal(await shell.locator('dialog').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,`${theme} ${width} overflow`);
      assert.equal(await shell.locator('.vacuum-profile').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,`${theme} ${width} profile overflow`);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await expect(shell.locator('.vacuum-trail-color')).toBeAttached();
    await shell.getByRole('button',{name:'Отмена',exact:true}).click();
  });
  await check('AC5 zero, multiple, missing and ambiguous map cards retain truthful diagnostics',async()=>{
    await mount({map_routes:[]});
    let shell=await open();await expect(shell.locator('.vacroute')).toHaveCount(0);
    await expect(shell.locator('.vacroute-add-current')).toBeEnabled();
    const route={id:'one',source:'camera.lab_robot_map',map_id:'m1',space,calibration:[1,0,0,0,1,0]};
    await mount({map_routes:[route,{...route,id:'two',map_id:'m2',calibration:null},{...route,id:'lost',map_id:'m3',space:'deleted'}]});
    shell=await open();
    await expect(shell.locator('.vacroute')).toHaveCount(3);
    await expect(shell.locator('[data-route-id=one]')).toContainText('Первая карта');
    await expect(shell.locator('[data-route-id=two]')).toContainText('Карта 2');
    await expect(shell.locator('[data-route-id=two] .vacroute-status')).toContainText('калибров');
    await expect(shell.locator('[data-hp="vacuum-route-missing-group"]')).toContainText('Карта 3');
    await shell.locator('.hpf-profile-diagnostics > summary').click();
    await expect(shell.locator('.hpf-profile-diagnostics')).toContainText('m2');
    const name=fixture.config.spaces.find(s=>s.id===space).title;
    assert.ok(name);
    await expect(shell.locator('[data-route-id=one] hp-settings-select')).toContainText(name);
    await mount({map_routes:[route,{...route,id:'duplicate'}]});
    shell=await open();
    await expect(shell.locator('.vacroute-status').first()).not.toContainText('Готова');
    await expect(shell.locator('.vacroute')).toHaveCount(2);
    await mount({map_routes:null,calibration:{m1:[1,0,0,0,1,0],m2:[1,0,0,0,1,0]}});
    shell=await open();
    await expect(shell.locator('.vacroute')).toHaveCount(2);
    await shell.locator('.hpf-profile-diagnostics > summary').click();
    await expect(shell.locator('.hpf-profile-diagnostics')).toContainText('m2');
    await page.setViewportSize({width:390,height:884});
    assert.equal(await shell.locator('.vacuum-profile').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'legacy diagnostics overflow');
  });
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(`PASS #1002 ${checks.length} checks`);
} catch(error) {
  if(page) await page.screenshot({path:fileURLToPath(new URL('failure.png',output))}).catch(()=>{});
  throw error;
} finally {
  writeFileSync(new URL('results.json',output),JSON.stringify({checks,errors,external},null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
