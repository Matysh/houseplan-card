import assert from 'node:assert/strict';
import { launchPanelCold, check, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';
import { join } from 'node:path';

const { page, browser } = await launchPanelCold({ width: 1440, height: 1000 });
const fixture = makeLargeHouseFixture({ floors:2, roomsPerFloor:8, devices:24, openings:10,
  partitions:3, columns:2, decor:12, stairs:2 });
const results = {};
const serverPackets = new Map();
const readPreviewView = async img => {
  const image = await (await fetch(img.src)).blob();
  if (image.type === 'image/webp') {
    const card = window.__startupFixture(), stored = card._startupStyle.value;
    const { x, y, w, h } = card._presentationView(stored.view, stored.zoom, stored.fit.base);
    return `${x} ${y} ${w} ${h}`;
  }
  const doc = new DOMParser().parseFromString(await image.text(), 'image/svg+xml');
  return doc.documentElement.getAttribute('viewBox');
};
await page.exposeFunction('startupFixtureServer', ({ type, packet, ...address }) => {
  const key = JSON.stringify(address);
  if (type.endsWith('/put')) { serverPackets.set(key, packet); return { stored:true }; }
  return { packet:serverPackets.get(key) ?? null };
});
const serverFixture = makeLargeHouseFixture({ floors:2, roomsPerFloor:4, devices:4, openings:2,
  partitions:1, columns:0, decor:0, stairs:0 });
try {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const mount = async ({ projection, surface, user = 'startup-fixture', rev = 1, hold = false, silent = false,
    server = false, browserMiss = false, serverDelay = false, trace = false, brokenBackdrop = null }) => {
    await page.goto('http://demo.local/demo.html?panel-cold=1', { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__mkHass === 'function');
    await page.evaluate(async ({ fixture, projection, surface, user, rev, hold, silent, server, browserMiss, serverDelay, trace, brokenBackdrop }) => {
      if (browserMiss) await new Promise((resolve,reject) => {
        const request = indexedDB.deleteDatabase('houseplan-static-view-v1');
        request.onsuccess = resolve;
        request.onerror = request.onblocked = () => reject(Error('Cannot clear the synthetic browser preview cache'));
      });
      const config = fixture.config, host = document.getElementById('host');
      const floor = config.spaces[0], rotation = projection === 'iso' ? 45 : 0;
      floor.settings.wall_fill = {c:'#476277',a:1};
      const contact = 'binary_sensor.startup_door_contact';
      const door = floor.openings.find(opening => opening.type === 'door');
      if (door) door.contact = contact;
      fixture.states[contact] = {entity_id:contact,state:'off',attributes:{},last_changed:new Date(0).toISOString()};
      config.settings = { ...config.settings, volumetric_view: surface === 'external' ? projection !== 'iso' : projection === 'iso',
        external_screens: { version:3, next_id:2, screens:[{ id:1,space:floor.id,cycle:0,idle:0,
          default_view:{ view:projection, rotation, zoom:1.15, summary:'hide', center_summary:false,
            icon_scale:null, font_scale:null }, space_views:{} }] } };
      // Locally available synthetic raster: no application-owner plan is used.
      const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
      const paint = canvas.getContext('2d'); paint.fillStyle = '#d0dddf'; paint.fillRect(0,0,8,8);
      const missingBackdrop = '/api/houseplan/content/plans/_/startup-missing-'+user+'.png';
      if (!server) floor.plan_url = brokenBackdrop ? missingBackdrop : canvas.toDataURL('image/png');
      if (brokenBackdrop) floor.plan_aspect = 1;
      window.__startupSignAttempts = 0;
      const asset = 'a'.repeat(64);
      const svgAsset = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#9aa4b9"/></svg>');
      if (!server) floor.decor.push({ id:'startup-owned-image',kind:'image',asset_id:asset,x:.2,y:.2,w:.04,h:.04,opacity:.75 });
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
      let releaseServer;
      const heldServer = serverDelay ? new Promise(resolve => { releaseServer = resolve; }) : null;
      window.__releaseStartupServer = releaseServer;
      window.__readStartupServer = false;
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
            return {config:structuredClone(config),rev,can_write:false,external_screens_api:3,
              ...(server ? {startup_floor_source:'a'.repeat(64)} : {})};
          }
          if (message.type === 'houseplan/layout/get') {
            await held;
            return {layout:structuredClone(fixture.layout),rev,
              ...(server ? {startup_floor_source:'b'.repeat(64)} : {})};
          }
          if (brokenBackdrop && message.type === 'houseplan/content/sign' && message.paths.includes(missingBackdrop)) {
            window.__startupSignAttempts++;
            return { urls:brokenBackdrop === 'unsigned' ? {} : {[missingBackdrop]: missingBackdrop+'?authSig=fixture'} };
          }
          if (server && message.type.startsWith('houseplan/startup_floor/')) {
            if (message.type.endsWith('/get')) {
              window.__readStartupServer = true;
              await heldServer;
            }
            return window.startupFixtureServer(message);
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
        window.__startupStageCount = 0;
        const countVisibleTree = () => {
          window.__startupStageCount = Math.max(window.__startupStageCount,card.renderRoot.querySelectorAll('.stage').length);
        };
        new MutationObserver(countVisibleTree).observe(card.renderRoot,{childList:true,subtree:true});
        countVisibleTree();
        card._decorAssets.set(asset, {asset_id:asset,url:svgAsset,mime:'image/svg+xml',name:'Synthetic tile',width:8,height:8,bytes:90});
        card.requestUpdate();
      };
      requestAnimationFrame(installImage);
      if (trace) {
        window.__startupTrace = [];
        const start = performance.now();
        let firstImage;
        const sample = () => {
          const card = window.__startupFixture();
          const stage = card?.renderRoot.querySelector('.stage');
          if (stage) {
            const img = stage.querySelector('img.hp-startup-view');
            const wrap = stage.querySelector(':scope > .zoomwrap');
            const style = wrap && getComputedStyle(wrap);
            if (img) firstImage ??= img;
            window.__startupTrace.push({ t:performance.now()-start,
              source:img?.dataset.hpStartupSource ?? null, sameImage:!img || img === firstImage,
              previewOpacity:img ? +getComputedStyle(img).opacity : 0,
              interactive:!stage.inert && !!wrap && !wrap.inert && stage.querySelector('.dev') !== null,
              opacity:style?.visibility === 'visible' ? +style.opacity : 0,
              status:stage.querySelectorAll('.floor-preparation-status').length,
              fade:stage.hasAttribute('data-hp-startup-finish'),
              view:wrap?.querySelector('svg.plan-svg')?.getAttribute('viewBox') ?? null });
          }
          if (performance.now()-start < 18_000) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }
    }, {fixture:server ? serverFixture : fixture, projection, surface, user, rev, hold, silent,
      server, browserMiss, serverDelay, trace, brokenBackdrop});
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
    assert.equal(await page.evaluate(() => window.__startupStageCount),1,label + ': no second stage during offscreen capture');
    await mount({projection,surface,hold:true});
    await page.waitForTimeout(160);
    assert.equal(await snapshot.count(), 0, label + ' never read from cold hint alone');
    await page.evaluate(() => window.__releaseStartupFixture());
    await snapshot.waitFor({state:'visible',timeout:6_000});
    const observed = await page.evaluate(async projection => {
      const c = window.__startupFixture(), img = c.renderRoot.querySelector('.hp-startup-view');
      const stage = img.closest('.stage'), pill = stage.querySelector('.floor-preparation-status');
      const bounds = stage.getBoundingClientRect(), status = pill.getBoundingClientRect();
      const image = await (await fetch(img.src)).blob();
      const text = projection === 'flat' ? await image.text() : null;
      const svg = text ? new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
        : document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      if (projection === 'iso') {
        const stored = c._startupStyle.value;
        const view = c._presentationView(stored.view, stored.zoom, stored.fit.base);
        svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
        svg.setAttribute('preserveAspectRatio', 'none');
      }
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
      const bitmap = projection === 'iso' ? await createImageBitmap(image) : null;
      const validBitmap = !!bitmap && image.type === 'image/webp' && bitmap.width > 0 && bitmap.height > 0;
      bitmap?.close();
      return { imageOnly: validBitmap || !!text && svg.localName === 'svg' && !svg.querySelector('foreignObject, script, [data-hp], [tabindex]')
        && !text.includes('sensor.') && !text.includes('424242') && !text.includes('startup_door_contact')
        && svg.querySelectorAll('image[href^="data:image/png"]').length >= 2,
        status: status.left >= bounds.left && status.left < bounds.left + 36 && status.top >= bounds.top && status.top < bounds.top + 36,
        view: svg.getAttribute('viewBox'), bytes: image.size, anchors,
        clip:{x:bounds.left,y:bounds.top,width:bounds.width,height:bounds.height} };
    }, projection);
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
  const cameraCase = process.env.HP_STARTUP_CASE;
  for (const projection of ['flat','iso']) {
    if (cameraCase && cameraCase !== 'camera/'+projection) continue;
    const surface = 'card', user = 'camera-'+projection;
    const savedStorage = await page.evaluate(() => localStorage.getItem('houseplan_card_zoom_v1'));
    const camera = () => page.evaluate(async () => {
      const c = window.__startupFixture(), sel = c._startupSelection();
      const packet = await c._startupFloor.store.read(sel);
      return { view:c._view, zoom:c._zoom, saved:c._zoomBySpace[c._space], variant:sel.variant,
        packet:packet && {view:packet.view,zoom:packet.zoom,zoomHint:packet.zoomHint},
        svg:c.renderRoot.querySelector('.stage svg.plan-svg')?.getAttribute('viewBox'),
        facts:c.houseplanStartupFloorDiagnostics() };
    });
    const storedZoom = async zoom => {
      let state;
      for(let attempt=0;attempt<85;attempt++){
        state=await camera();
        if(state.packet?.zoomHint===zoom) return state;
        await page.waitForTimeout(90);
      }
      throw Error('snapshot was not stored at confirmed centred zoom '+zoom+': '+JSON.stringify(state));
    };
    const cmp = (a,b) => a.trim().split(/\s+/).map(Number).every((n,i)=>Math.abs(n-b.trim().split(/\s+/).map(Number)[i]) <= .001);
    try {
      await mount({projection,surface,user}); await ready(projection,surface);
      const initial = await storedZoom(1);
      const stage = page.locator('.stage');
      const box = await stage.boundingBox();
      await page.mouse.move(box.x+box.width*.77,box.y+box.height*.79);
      await page.mouse.wheel(0,-175);
      await page.waitForFunction(() => {
        const c = window.__startupFixture(); return c._zoomBySpace[c._space] > 1.1 && !c._cameraTransition.active;
      });
      const offCentre = await camera();
      assert.notEqual(offCentre.svg,initial.svg,'wheel uses an off-centre anchor');
      assert.equal(offCentre.variant,initial.variant,'wheel does not allocate another variant');
      await page.waitForTimeout(1_250);
      assert.deepEqual((await camera()).packet,initial.packet,'off-centre interaction cannot replace the stored camera');

      await mount({projection,surface,user,hold:true});
      await page.evaluate(() => window.__releaseStartupFixture());
      await ready(projection,surface);
      const fresh = await camera();
      assert.equal(fresh.facts.shown,0);
      assert.ok(['miss','camera-miss'].includes(fresh.facts.status),
        'incompatible zoom must not paint a stale snapshot: '+JSON.stringify({fresh,initial}));
      assert.notEqual(fresh.svg,offCentre.svg,'a normal reload centres the saved zoom');
      assert.equal(fresh.zoom,offCentre.saved);
      const centred = await storedZoom(offCentre.saved);
      assert.equal(centred.variant,initial.variant,'the new canonical snapshot replaces the same slot');
      assert.deepEqual(centred.view,centred.packet.view);

      const panBox = await page.locator('.stage').boundingBox();
      await page.mouse.move(panBox.x+panBox.width*.62,panBox.y+panBox.height*.82);
      await page.mouse.down();
      await page.mouse.move(panBox.x+panBox.width*.77,panBox.y+panBox.height*.86,{steps:5});
      await page.mouse.up();
      const panned = await camera();
      assert.notEqual(panned.svg,centred.svg,'pan really moved live camera at the same zoom');
      assert.equal(panned.zoom,centred.zoom);
      assert.deepEqual(panned.packet,centred.packet);
      await mount({projection,surface,user,hold:true});
      await page.evaluate(() => window.__releaseStartupFixture());
      await snapshot.waitFor({state:'visible',timeout:6_000});
      const previewView = await snapshot.evaluate(readPreviewView);
      await ready(projection,surface);
      assert.ok(cmp(previewView,centred.svg) && cmp(previewView,(await camera()).svg),
        'saved centred camera is identical in the passive image and the real repaint');
      check(projection+' cold camera after native wheel and pan',true);
    } finally {
      await page.evaluate(value=>{
        if(value===null) localStorage.removeItem('houseplan_card_zoom_v1');
        else localStorage.setItem('houseplan_card_zoom_v1',value);
      },savedStorage);
    }
  }
  const done = () => page.waitForFunction(() => {
    const c = window.__startupFixture();
    return c.houseplanStartupFloorDiagnostics()?.live > 0 && !c._bootFading
      && !c.renderRoot.querySelector('.floor-preparation-status');
  });
  if (!process.env.HP_STARTUP_CASE || process.env.HP_STARTUP_CASE === 'motion/browser') {
    const opts = {projection:'flat',surface:'panel',user:'startup-motion'};
    await mount(opts);
    await ready(opts.projection,opts.surface);
    await page.waitForFunction(() => window.__startupFixture().houseplanStartupFloorDiagnostics().capture === 'stored');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await mount({...opts,hold:true,trace:true});
    await page.evaluate(() => window.__releaseStartupFixture());
    await snapshot.waitFor({state:'visible',timeout:6000});
    await done();
    const frames = await page.evaluate(() => window.__startupTrace);
    const first = frames.findIndex(f => f.source);
    const shown = frames.slice(first).filter(f => f.source);
    assert.ok(first >= 0 && shown.every(f => f.source === 'browser' && f.sameImage && f.status === 1));
    assert.ok(shown.some(f => f.fade && f.interactive && f.opacity > 0 && f.opacity < 1 && f.previewOpacity === 1),
      'same decoded browser image remains beneath the interactive live fade');
    assert.ok(frames.slice(first).every(f => f.source || f.opacity > 0),
      'a decoded browser image carries the plan across the pending/live templates');
    const box = await page.locator('.stage').boundingBox();
    await mount({...opts,hold:true,trace:true});
    await page.evaluate(() => window.__releaseStartupFixture());
    await snapshot.waitFor({state:'visible',timeout:6000});
    await page.mouse.move(box.x+box.width*.61,box.y+box.height*.72);
    await page.evaluate(() => {
      const card = window.__startupFixture();
      const observe = (event) => {
        const stage = card.renderRoot.querySelector('.stage');
        const wrap = stage.querySelector(':scope > .zoomwrap');
        window.__startupInput = { trusted:event.isTrusted, duringFade:stage.hasAttribute('data-hp-startup-finish'),
          preview:!!stage.querySelector('.hp-startup-view'), view:wrap.querySelector('.plan-svg').getAttribute('viewBox') };
      };
      card.renderRoot.addEventListener('wheel',observe,{once:true,capture:true});
    });
    await page.waitForFunction(() => {
      const stage = window.__startupFixture().renderRoot.querySelector('.stage[data-hp-startup-finish]:not([inert])');
      return !!stage?.querySelector('.hp-startup-view');
    });
    await page.mouse.wheel(0,-120);
    await page.waitForFunction(() => {
      const c = window.__startupFixture(), d = window.__startupInput;
      const stage = c.renderRoot.querySelector('.stage');
      return d?.trusted && !stage.querySelector('.hp-startup-view')
        && stage.querySelector('.plan-svg')?.getAttribute('viewBox') !== d.view;
    });
    const cancelled = await page.evaluate(() => {
      const samples = window.__startupTrace;
      const lastWithImage = samples.findLastIndex(f=>f.source);
      return { input:window.__startupInput, after:samples[lastWithImage+1] };
    });
    assert.ok(cancelled.input.duringFade && cancelled.input.preview,
      'the native wheel event was handled during the preview fade');
    assert.ok(cancelled.after && !cancelled.after.fade && cancelled.after.opacity === 1,
      'the first frame after invalidating the image is already fully opaque');
    check('native wheel input during the fade cancels the obsolete image in the same frame', true);
    await page.emulateMedia({reducedMotion:'reduce'});
  }
  for (const projection of ['flat','iso']) {
    if (process.env.HP_STARTUP_CASE && process.env.HP_STARTUP_CASE !== 'server/'+projection) continue;
    const opts = {projection,surface:'panel',user:'startup-server-'+projection,server:true};
    await mount(opts);
    await ready(projection,'panel');
    await page.waitForFunction(() => window.__startupFixture().houseplanStartupFloorDiagnostics().remote === 'stored',
      undefined,{timeout:12_000});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await mount({...opts,hold:true,browserMiss:true,trace:true});
    await page.evaluate(() => window.__releaseStartupFixture());
    const serverImage = page.locator('img[data-hp-startup-source=server]');
    await serverImage.waitFor({state:'visible',timeout:8000});
    const referenceView = await serverImage.evaluate(readPreviewView);
    await done();
    const frames = await page.evaluate(() => window.__startupTrace);
    const first = frames.findIndex(f => f.source === 'server');
    const shown = frames.slice(first).filter(f => f.source);
    const live = frames.find(f => f.interactive && f.fade);
    assert.ok(first >= 0 && shown.every(f => f.source === 'server' && f.sameImage && f.status === 1));
    assert.ok(live && shown.some(f => f.fade && f.interactive && f.opacity > 0 && f.opacity < 1 && f.previewOpacity === 1),
      projection+': same decoded server image remains beneath the interactive live fade');
    assert.ok(frames.slice(first).every(f => f.source || f.opacity > 0),
      projection+': server preview carries the plan across the pending/live templates');
    const a = referenceView.trim().split(/\s+/).map(Number), b = live.view.trim().split(/\s+/).map(Number);
    assert.ok(a.length === 4 && a.every((n,i)=>Math.abs(n-b[i]) < .001), projection+': preview and live agree on camera');
    results['server/'+projection] = {status:frames.find(f=>f.status)?.t, preview:shown[0].t, live:live.t};
    check(projection+' server hits from empty browser cache survive live handoff',true);
    // A delayed server reply cannot join a scene that was already published.
    await mount({...opts,browserMiss:true,serverDelay:true,trace:true});
    await page.waitForFunction(() => window.__readStartupServer);
    await done();
    await page.evaluate(() => window.__releaseStartupServer());
    await page.waitForTimeout(350);
    const late = await page.evaluate(() => ({ facts:window.__startupFixture().houseplanStartupFloorDiagnostics(),
      frames:window.__startupTrace }));
    assert.ok(late.facts.live > 0 && late.facts.shown === 0 && late.frames.every(f=>!f.source),
      projection+': late reply cannot replace or delay a published scene');
    await page.emulateMedia({reducedMotion:'reduce'});
  }
  if (!process.env.HP_STARTUP_CASE || process.env.HP_STARTUP_CASE === 'unavailable-backdrop') {
    await page.route('**/api/houseplan/content/plans/_/startup-missing-*.png*', route => route.fulfill({status:404}));
    for (const [brokenBackdrop,surface,projection] of [['unsigned','card','flat'],['404','external','iso']]) {
      await mount({brokenBackdrop,surface,projection,user:'unavailable-'+brokenBackdrop});
      await ready(projection,surface).catch(async cause => {
        const state=await page.evaluate(() => {
          const c=window.__startupFixture(), stage=c?.renderRoot.querySelector('.stage');
          return { ready:c?._loadOk, booting:c?._booting, projection:c?._renderProjection,kiosk:c?._kiosk,
            pending:c?._floorPreparation?.supportFacts, startup:c?.houseplanStartupFloorDiagnostics(),
            sameStage:!!stage, inert:stage?.inert, device:!!stage?.querySelector('.dev'), phase:c?._continuity.state,
            screen:!!c?._screenReference, startupWait:c?._startupAssetWait, signAttempts:window.__startupSignAttempts, tries:c?._loadTries, model:c?._model?.length };
        });
        throw new Error(brokenBackdrop+' backdrop: '+JSON.stringify(state),{cause});
      });
      await done();
      const observed = await page.evaluate(() => {
        const c=window.__startupFixture(), stage=c.renderRoot.querySelector('.stage');
        return {signed:window.__startupSignAttempts > 0, complete:c._continuity.hasCompleteFrame,
          interactive:!stage.inert && stage.querySelector('.dev') !== null,
          capture:c.houseplanStartupFloorDiagnostics().capture};
      });
      assert.deepEqual(observed,{signed:true,complete:false,interactive:true,capture:'idle'});
      check(brokenBackdrop+' backdrop cannot hold the live plan or seed a preview',true);
    }
  }
  if (!process.env.HP_STARTUP_CASE) {
    // The passive image can lead a cold opening, but must neither cover an
    // explicit #1521 deadline error nor leave the retry controls inert.
    // The server matrix previously started from an empty browser cache.
    await mount({projection:'flat',surface:'panel'});
    await ready('flat','panel');
    await page.waitForFunction(() =>
      ['stored','cached'].includes(window.__startupFixture().houseplanStartupFloorDiagnostics().capture));
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
  check('startup preview matrix completed', false);
  throw error;
} finally { await finish(browser, results); }
