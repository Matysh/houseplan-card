import assert from 'node:assert/strict';
import { launchPanelCold, check, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';
import { join } from 'node:path';

const { page, browser } = await launchPanelCold({ width: 1440, height: 1000 });
const fixture = makeLargeHouseFixture({ floors:2, roomsPerFloor:8, devices:24, openings:10,
  partitions:3, columns:2, decor:12, stairs:2 });
const results = {};
try {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mount = async ({ projection, surface, user = 'startup-fixture', rev = 1, hold = false, silent = false }) => {
    await page.goto('http://demo.local/demo.html?panel-cold=1', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__mkHass === 'function');
    await page.evaluate(async ({ fixture, projection, surface, user, rev, hold, silent }) => {
      const config = fixture.config, host = document.getElementById('host');
      const floor = config.spaces[0], rotation = projection === 'iso' ? 45 : 0;
      floor.settings.wall_fill = {c:'#476277',a:1};
      const contact = 'binary_sensor.startup_door_contact';
      const door = floor.openings.find(opening => opening.type === 'door');
      door.contact = contact;
      fixture.states[contact] = {entity_id:contact,state:'off',attributes:{},last_changed:new Date(0).toISOString()};
      config.settings = { ...config.settings, volumetric_view: surface === 'external' ? projection !== 'iso' : projection === 'iso',
        external_screens: { version:3, next_id:2, screens:[{ id:1,space:floor.id,cycle:0,idle:0,
          default_view:{ view:projection, rotation, zoom:1, summary:'hide', center_summary:false,
            icon_scale:null, font_scale:null }, space_views:{} }] } };
      // Locally available synthetic raster: no application-owner plan is used.
      const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
      const paint = canvas.getContext('2d'); paint.fillStyle = '#d0dddf'; paint.fillRect(0,0,8,8);
      floor.plan_url = canvas.toDataURL('image/png');
      const asset = 'a'.repeat(64);
      floor.decor.push({ id:'startup-owned-image',kind:'image',asset_id:asset,x:.2,y:.2,w:.04,h:.04,opacity:.75 });
      floor.decor.push({ id:'startup-volume',kind:'furniture',symbol:'table',x:.2,y:.28,w:.12,h:.08,
        color:'#344759',opacity:1,angle:0 });
      const sensor = 'sensor.startup_reading';
      fixture.states[sensor] = {entity_id:sensor,state:'424242',attributes:{},last_changed:new Date(0).toISOString()};
      fixture.entities[sensor] = {entity_id:sensor,platform:'demo'};
      floor.decor.push({id:'startup-live-label',kind:'text',text:'Reading {' + sensor + '}',x:.28,y:.37,
        size_cm:12,color:'#48576e',opacity:1});
      let release;
      const held = hold ? new Promise(resolve => { release = resolve; }) : null;
      window.__releaseStartupFixture = release;
      if (hold) {
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
          constructor(url, options) { super(url, options); this.floor = options?.name === 'houseplan-floor'; }
          postMessage(...args) {
            if (!this.floor) return super.postMessage(...args);
            if (silent) return;
            setTimeout(() => super.postMessage(...args), 1_000);
          }
        };
      }
      const hass = window.__mkHass(), nativeCall = hass.callWS;
      const wire = { ...hass, user:{ id:user,is_admin:false }, states:fixture.states, entities:fixture.entities,
        callWS: async message => {
          if (message.type === 'houseplan/config/get') {
            await held;
            return {config:structuredClone(config),rev,can_write:false,external_screens_api:3};
          }
          if (message.type === 'houseplan/layout/get') {
            await held;
            return {layout:structuredClone(fixture.layout),rev};
          }
          return nativeCall(message);
        },
      };
      history.replaceState(null,'',surface === 'external' ? '/houseplan?hpprofile=1' : '/houseplan');
      await import('/assets/houseplan-panel.js');
      await customElements.whenDefined('houseplan-panel');
      if (surface === 'card') {
        const card = document.createElement('houseplan-card');
        await customElements.whenDefined('houseplan-card');
        card.setConfig({type:'custom:houseplan-card', floor:floor.id, view:projection, plan_rotation:rotation});
        card.hass = wire; host.append(card); window.__startupFixture = () => card;
      } else {
        const panel = document.createElement('houseplan-panel');
        panel.panel = {component_name:'houseplan-panel'}; panel.hass = wire; panel.narrow = false;
        panel.route = {prefix:'/houseplan',path:''}; host.append(panel);
        window.__startupFixture = () => panel.shadowRoot?.querySelector('houseplan-card');
      }
      // Supply an already-authorized raster to the capture caller. The actual
      // HA asset transport/ACL is covered by smoke_decor_images and HA E2E.
      const installImage = () => {
        const card = window.__startupFixture();
        if (!card?._loadOk) { requestAnimationFrame(installImage); return; }
        card._decorAssets.set(asset, {asset_id:asset,url:floor.plan_url,mime:'image/png',name:'Synthetic tile',width:8,height:8,bytes:90});
        card.requestUpdate();
      };
      requestAnimationFrame(installImage);
    }, {fixture, projection, surface, user, rev, hold, silent});
  };
  const ready = (projection, surface) => page.waitForFunction(({projection,surface}) => {
    const c = window.__startupFixture(), root = c?.renderRoot;
    return !!c?._loadOk && c._kiosk === (surface === 'external') && c._renderProjection === projection
      && c.houseplanStartupFloorDiagnostics?.()?.live > 0 && !!root.querySelector('.stage:not([inert]) .dev');
  }, {projection,surface}, {timeout:20_000});
  const snapshot = page.locator('.hp-startup-view');
  for (const projection of ['flat','iso']) for (const surface of ['panel','card','external']) {
    const label = surface + '/' + projection;
    if (process.env.HP_STARTUP_CASE && label !== process.env.HP_STARTUP_CASE) continue;
    await mount({projection,surface});
    await ready(projection,surface);
    await page.waitForFunction(() => !['idle','queued','working'].includes(window.__startupFixture().houseplanStartupFloorDiagnostics().capture),
      undefined, {timeout:8_000}).catch(async error => {
      const state = await page.evaluate(() => {
        const c = window.__startupFixture();
        return { startup:c.houseplanStartupFloorDiagnostics(), projection:c._renderProjection, rotation:c._rotation,
          source:!!c._startupSource, view:c._view, continuity:c._continuity.state,
          scope:!!c._startupSelection(), ready:!!c._screenReference, size:c._lastValidStageSize };
      });
      throw Error(label + ': ' + JSON.stringify(state), {cause:error});
    });
    const seed = await page.evaluate(() => window.__startupFixture().houseplanStartupFloorDiagnostics());
    assert.ok(['stored','cached'].includes(seed.capture), label + ' seed failed: ' + JSON.stringify(seed));
    await mount({projection,surface,hold:true});
    await page.waitForTimeout(160);
    assert.equal(await snapshot.count(), 0, label + ' never read from cold hint alone');
    await page.evaluate(() => window.__releaseStartupFixture());
    await snapshot.waitFor({state:'visible',timeout:6_000});
    const observed = await page.evaluate(async () => {
      const c = window.__startupFixture(), img = c.renderRoot.querySelector('.hp-startup-view');
      const stage = img.closest('.stage'), pill = stage.querySelector('.floor-preparation-status');
      const bounds = stage.getBoundingClientRect(), status = pill.getBoundingClientRect();
      const text = await (await fetch(img.src)).text();
      const svg = new DOMParser().parseFromString(text,'image/svg+xml').documentElement;
      // Measure the actual SVG coordinate transform inside the image box.
      // The witness is an empty SVG: no scene content or executable nodes from storage enter the DOM.
      window.__startupAnchor = (viewport, width, height) => {
        const witness = document.createElementNS('http://www.w3.org/2000/svg','svg');
        for (const field of ['viewBox','preserveAspectRatio']) {
          if (viewport.hasAttribute(field)) witness.setAttribute(field, viewport.getAttribute(field));
        }
        witness.setAttribute('style', `position:absolute;visibility:hidden;left:0;top:0;width:${width}px;height:${height}px`);
        stage.append(witness);
        const m = witness.getScreenCTM(), v = witness.viewBox.baseVal;
        const controls = [[v.x,v.y],[v.x+v.width,v.y+v.height],[v.x+v.width*0.25,v.y+v.height*0.7]];
        witness.remove();
        return controls.map(([x,y]) => new DOMPoint(x,y).matrixTransform(m)).map(({x,y})=>[x,y]);
      };
      const anchors = window.__startupAnchor(svg, img.clientWidth, img.clientHeight);
      window.__startupFrames = [];
      const sample = () => {
        const current = c.renderRoot.querySelector('.stage');
        const still = current?.querySelector('.hp-startup-view');
        const live = current?.querySelector('.zoomwrap');
        const liveVisible = !!live && getComputedStyle(live).visibility === 'visible' && !!live.querySelector('.plan-svg');
        window.__startupFrames.push([!!still, liveVisible, !!still && liveVisible]);
        if (still && window.__startupFrames.length < 250) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      return { imageOnly: svg.localName === 'svg' && !svg.querySelector('foreignObject, script, [data-hp], [tabindex]')
        && !text.includes('sensor.') && !text.includes('424242') && !text.includes('startup_door_contact')
        && svg.querySelectorAll('image[href^="data:image/png"]').length >= 2,
        status: status.left >= bounds.left && status.left < bounds.left + 36 && status.top >= bounds.top && status.top < bounds.top + 36,
        view: svg.getAttribute('viewBox'), bytes: text.length, anchors,
        clip:{x:bounds.left,y:bounds.top,width:bounds.width,height:bounds.height} };
    });
    assert.ok(observed.imageOnly, label + ': static, no entity/action data');
    assert.ok(observed.status, label + ': loading status inside top-left of plan');
    if (process.env.HP_STARTUP_SCREENSHOTS) await page.screenshot({
      path:join(process.env.HP_STARTUP_SCREENSHOTS, surface+'-'+projection+'-snapshot.png'),
      clip:observed.clip,
    });
    await ready(projection,surface);
    const live = await page.evaluate(() => {
      const c = window.__startupFixture();
      const svg = c.renderRoot.querySelector('.stage svg.plan-svg'), m = svg.getScreenCTM(), v = svg.viewBox.baseVal;
      const anchors = [[v.x,v.y],[v.x+v.width,v.y+v.height],[v.x+v.width*0.25,v.y+v.height*0.7]]
        .map(([x,y]) => new DOMPoint(x,y).matrixTransform(m)).map(({x,y})=>[x,y]);
      return { view:svg.getAttribute('viewBox'), anchors, frames:window.__startupFrames,
        visibleSnapshot:!!c.renderRoot.querySelector('.hp-startup-view'),
        fading:!!c.renderRoot.querySelector('[data-hp-startup-finish]'), facts:c.houseplanStartupFloorDiagnostics() };
    });
    assert.equal(live.visibleSnapshot,false,label + ': handoff completed');
    const coords = value => value.trim().split(/\s+/).map(Number);
    assert.ok(coords(observed.view).every((n,i) => Math.abs(n-coords(live.view)[i]) <= .001),
      label + ': camera shifted from ' + observed.view + ' to ' + live.view);
    const anchorDelta = Math.max(...observed.anchors.flatMap(([x,y],i) => [
      Math.abs(x-live.anchors[i][0]), Math.abs(y-live.anchors[i][1])]));
    assert.ok(anchorDelta <= .5, label + ': camera anchor moved ' + anchorDelta + ' CSS px');
    assert.ok(!live.fading && live.frames.length > 1 && live.frames.every(([preview,scene,both]) => (preview || scene) && !both),
      label + ': reduced-motion transition must never paint a blank or double scene');
    if (process.env.HP_STARTUP_SCREENSHOTS) await page.locator('.stage').screenshot({
      path:join(process.env.HP_STARTUP_SCREENSHOTS, surface+'-'+projection+'-live.png'),
    });
    results[label] = { bytes:observed.bytes, lead:live.facts.live-live.facts.shown, anchorDelta, frames:live.frames.length };
    check(label, results[label].lead > 0);
  }
  if (!process.env.HP_STARTUP_CASE) {
    await mount({projection:'flat',surface:'card'});
    await ready('flat','card');
    const limits = await page.evaluate(async () => {
      const c=window.__startupFixture(), store=c._startupFloor.store, sel=c._startupSelection();
      const original=await store.read(sel);
      if(!original) return { original:false };
      const bound = index => ({...sel, scope:'isolated-startup-lru',variant:String(index).padStart(64,'0')});
      for(let index=0;index<9;index++) {
        if(!await store.write(bound(index),original,()=>true)) return { write:false };
      }
      const first=await store.read(bound(0)), last=await store.read(bound(8));
      const value=new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>'],{type:'image/svg+xml'});
      const poisoned=await store.write(sel,{...original,image:value},()=>true);
      const oversized=await store.write(bound(10),{...original,image:new Blob([new Uint8Array(4*1024**2+1)],
        {type:'image/svg+xml'})},()=>true);
      return { limits:!first && !!last && !oversized, preparedCorruption:poisoned };
    });
    assert.deepEqual(limits,{limits:true,preparedCorruption:true});
    await mount({projection:'flat',surface:'card',hold:true});
    await page.waitForTimeout(160);
    await page.evaluate(() => window.__releaseStartupFixture());
    await ready('flat','card');
    const invalid = await page.evaluate(() => window.__startupFixture().houseplanStartupFloorDiagnostics());
    check('invalid persisted SVG never becomes a first frame', invalid.shown === 0 && invalid.status === 'invalid');
    check('store enforces the per-floor and per-packet limits', limits.limits);
  }
  for (const changed of process.env.HP_STARTUP_CASE ? [] : [{ user:'other-account' },{rev:2}]) {
    await mount({projection:'flat',surface:'card',...changed});
    await ready('flat','card');
    const facts = await page.evaluate(() => window.__startupFixture().houseplanStartupFloorDiagnostics());
    check('never shows mismatched ' + Object.keys(changed)[0], facts.shown === 0);
  }
  if (!process.env.HP_STARTUP_CASE) {
    // The passive image can lead a cold opening, but must neither cover an
    // explicit #1521 deadline error nor leave the retry controls inert.
    await page.clock.install();
    await mount({projection:'flat',surface:'panel',hold:true,silent:true});
    await page.evaluate(() => window.__releaseStartupFixture());
    await snapshot.waitFor({state:'visible',timeout:6_000});
    await page.evaluate(() => {
      window.__startupFixture()._floorPreparation.scheduler.loadFallback = () => new Promise(() => {});
    });
    await page.clock.fastForward(15_000);
    await page.waitForFunction(() => window.__startupFixture()._floorPreparation.supportFacts.active === 'fallback-load');
    await page.clock.fastForward(3_000);
    await page.locator('.floor-preparation-error').getByRole('button',{name:'Try again'}).waitFor({state:'visible'});
    const terminal = await page.evaluate(() => {
      const c = window.__startupFixture(), root = c.renderRoot, stage = root.querySelector('.stage');
      return root.querySelector('ha-card')?.dataset.hpState === 'error' && stage && !stage.inert
        && !stage.querySelector('.hp-startup-view,.dev,.editorloading');
    });
    check('terminal preparation failure retires the image and exposes recovery', terminal);
    assert.ok(terminal, 'terminal preparation error must replace the passive preview');
  }
} catch (error) {
  check('startup SVG matrix completed', false);
  throw error;
} finally { await finish(browser, results); }
