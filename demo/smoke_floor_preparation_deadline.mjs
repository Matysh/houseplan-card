import assert from 'node:assert/strict';
import { launchPanelCold, checkAll, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const out = {};
for (const projection of ['flat', 'iso']) for (const surface of ['panel', 'card', 'external']) {
    const key = `${surface}/${projection}`;
    if (process.env.HP_DEADLINE_CASE && key !== process.env.HP_DEADLINE_CASE) continue;
    const { page, browser } = await launchPanelCold({ width: 1280, height: 900 });
    try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    const fixture = makeLargeHouseFixture({ floors: 2, roomsPerFloor: 1, devices: 4, openings: 1,
      partitions: 0, columns: 0, stairs: 0, decor: 0 });
    const editorRecovery = key === 'panel/flat';
    if (editorRecovery || key === 'external/iso') {
      fixture.config.spaces[1].decor = makeLargeHouseFixture({ floors: 2, roomsPerFloor: 1,
        devices: 0, openings: 0, partitions: 0, columns: 0, stairs: 0, decor: 260 }).config.spaces[1].decor;
    }
    await page.evaluate(async ({ fixture, projection, surface, editorRecovery }) => {
      const host = document.getElementById('host');
      host.replaceChildren();
      const config = fixture.config;
      config.settings = { ...config.settings, volumetric_view: projection === 'iso',
        external_screens: { version: 1, next_id: 2, screens: [{ id: 1, space: null, rotation: 0,
          cycle: 0, idle: 0, summary: 'local', hidden_devices: 'local', icon_scale: null, font_scale: null }] } };
      const hass = window.__mkHass();
      const call = hass.callWS;
      const wire = { ...hass, user: { id: 'floor-deadline-test', is_admin: editorRecovery }, states: fixture.states,
        callWS: async message => {
          if (message.type === 'houseplan/config/get') return {config: structuredClone(config), rev: 1, can_write: editorRecovery};
          if (message.type === 'houseplan/layout/get') return {layout: structuredClone(fixture.layout), rev: 1};
          return call(message);
        } };
      history.replaceState(null, '', surface === 'external' ? '/houseplan?hpprofile=1' : '/houseplan');
      await import('/assets/houseplan-panel.js');
      await customElements.whenDefined('houseplan-panel');
      if (surface === 'card') {
        const card = document.createElement('houseplan-card');
        await customElements.whenDefined('houseplan-card');
        card.setConfig({ type: 'custom:houseplan-card' }); card.hass = wire;
        host.append(card); window.__deadlineCard = () => card;
      } else {
        const panel = document.createElement('houseplan-panel');
        panel.panel = { component_name: 'houseplan-panel' }; panel.narrow = false;
        panel.route = { prefix: '/houseplan', path: '' }; panel.hass = wire;
        host.append(panel); window.__deadlineCard = () => panel.shadowRoot?.querySelector('houseplan-card');
      }
    }, {fixture, projection, surface, editorRecovery});
    await page.waitForFunction(({ projection, surface }) => {
      const c = window.__deadlineCard();
      return c?._loadOk && !c._booting && !c._bootFading && c._renderProjection === projection
        && c._kiosk === (surface === 'external') && c.renderRoot.querySelector('.stage .dev')
        && !c.renderRoot.querySelector('[data-hp-floor-cache]');
    }, {projection, surface});
    await page.evaluate(() => {
      const card = window.__deadlineCard(), runtime = card._floorPreparation, scheduler = runtime.scheduler;
      runtime.invalidate(); runtime.memory.clear(); scheduler.stopWorker();
      const WorkerClass=window.Worker;
      window.Worker=class extends WorkerClass {
        constructor(url, options) {
          if(options?.name==='houseplan-floor') return {postMessage(){},terminate(){}};
          super(url,options);
        }
      };
      window.__prepareDeadlineFallback=()=>{
        // ISO uses the shared flight's scheduler, not this card's private
        // Flat scheduler. Stall and release the same job the UI is awaiting.
        const active=runtime.sharedGeometry?.scheduler??scheduler;
        const now=active.now,load=active.loadFallback,origin=now();
        window.__deadlineNow=0;
        active.now=()=>origin+window.__deadlineNow;
        active.loadFallback=()=>new Promise(resolve=>{window.__finishRetiredFallback=()=>resolve({
          computeFloorJob(){throw Error('retired fallback executed');},
        });});
        window.__enableHealthyFloorWorker=()=>{
          window.Worker=WorkerClass;active.now=now;active.loadFallback=load;
        };
      };
      card.requestUpdate();
    });
    await page.waitForFunction(() => {
      const c = window.__deadlineCard();
      return c._floorHolding && c._floorPreparation.supportFacts.active === 'worker'
        && c.renderRoot.querySelector('.stage[inert] .dev') && c.renderRoot.querySelector('.editorloading');
    });
    await page.evaluate(() => { window.__prepareDeadlineFallback(); window.__deadlineNow = 15_000; });
    await page.clock.fastForward(15_000);
    await page.waitForFunction(() => window.__deadlineCard()._floorPreparation.supportFacts.active === 'fallback-load'
      && typeof window.__finishRetiredFallback === 'function', null, {timeout: 5_000}).catch(async error => {
      throw Error(key + ': ' + JSON.stringify(await page.evaluate(() => {
        const runtime=window.__deadlineCard()._floorPreparation, scheduler=runtime.scheduler;
        return { facts:runtime.supportFacts, stage:scheduler.stage, metrics:scheduler.metrics,
          fallback:typeof window.__finishRetiredFallback, job:scheduler.active?.job?.kind };
      })),{cause:error});
    });
    await page.evaluate(() => { window.__deadlineNow = 18_000; });
    await page.clock.fastForward(3_000);
    const error = page.locator('.floor-preparation-error');
    await error.waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => {
      const c = window.__deadlineCard(), root = c.renderRoot, runtime = c._floorPreparation;
      return root.querySelector('ha-card')?.dataset.hpState === 'error'
        && !root.querySelector('.dev,.editorloading') && !root.querySelector('.stage')?.inert
        && !runtime.pending && runtime.supportFacts.last_stage === 'fallback-load'
        && runtime.supportFacts.last_result === 'timeout';
    }), true, `${key}: terminal error cannot be interactive/ready`);
    await page.evaluate(() => {
      window.__finishRetiredFallback(); window.__enableHealthyFloorWorker();
    });
    if (editorRecovery) {
      assert.equal(await error.locator('[data-hp="floor-error-support"]').isVisible(), true);
      await page.locator('[data-hp="mode-tab"][data-mode="plan"]').click();
    } else await error.getByRole('button', {name:'Try again'}).click();
    await page.waitForFunction(projection => {
      const c = window.__deadlineCard(), root = c.renderRoot;
      return c._renderProjection === projection && !!root.querySelector('.stage:not([inert]) .dev')
        && !root.querySelector('[data-hp-floor-cache],.editorloading');
    }, projection);
    if (editorRecovery) {
      await page.waitForFunction(() => window.__deadlineCard()._mode === 'plan');
      await page.locator('.modes [data-hp="editor-close"]').click();
      await page.waitForFunction(() => window.__deadlineCard()._mode === 'view');
    }
    out[`${key}: retained frame inert, deadline error, real-worker retry`] = true;
    if (editorRecovery || key === 'external/iso') {
      await page.evaluate(() => {
        const c = window.__deadlineCard(), r = c._floorPreparation;
        r.scheduler.stopWorker();
        const WorkerClass=window.Worker;
        window.Worker=class extends WorkerClass {
          constructor(url, options) {
            if(options?.name==='houseplan-floor') throw Error('Worker unsupported');
            super(url,options);
          }
        };
        c._pickSpace('perf-floor-2');
      });
      await page.waitForFunction(() => {
        const c = window.__deadlineCard(), r = c._floorPreparation;
        return c._space === 'perf-floor-2' && r.canonicalKey && r.key === r.canonicalKey
          && c.renderRoot.querySelector('.stage:not([inert]) svg.plan-svg') && !c.renderRoot.querySelector('[data-hp-floor-cache]');
      }, null, {timeout:12_000}).catch(async error => {
        const facts = await page.evaluate(() => {
          const c = window.__deadlineCard(), r = c._floorPreparation;
          return {space:c._space,mode:c._mode,load:c._loadOk,ready:r.readyKey===r.key,canonical:r.canonicalKey===r.key,
            selected:!!r.selected,decor:r.selected?.input.raw.decor?.length,facts:r.supportFacts};
        });
        throw Error(key + ': ' + JSON.stringify(facts), {cause:error});
      });
      assert.equal(await page.evaluate(() => {
        const c = window.__deadlineCard(), r = c._floorPreparation;
        return c._floorCompleteSpace === 'perf-floor-2' && !r.publicationNeeded && !r.failed && r.readyKey !== r.key;
      }), true, 'completed rejection opens the current larger floor without fake cache readiness');
      out[`${key}: unsupported worker opens the larger floor through canonical readers`] = true;
    }
    checkAll(out);
    } catch (error) {
      checkAll({ [key]: false });
      throw error;
    } finally { await finish(browser, out); }
}
