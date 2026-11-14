import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clickHeaderAction } from '../helpers/header-actions.mjs';
import { waitForUiKitPaint } from '../helpers/ui-kit-paint.mjs';

export async function resourceProbes(page,capabilities,evidence,dir){
  const fresh=async(language='en')=>{
    await page.goto('http://demo.local/standalone-test');
    await page.evaluate(async({capabilities,language})=>{
      window.__mountApi=await import('/standalone-dist/houseplan-standalone.js');
      const {createCorePlanHost}=await import('/standalone-host.js');window.__lab=createCorePlanHost(capabilities);
      window.__mount=window.__mountApi.mountHouseplan(document.querySelector('#host'),window.__lab.host,{language,darkMode:false});
      window.__mountState='pending';
      void window.__mount.ready.then(card=>{window.__card=card;window.__mountState='ready';},
        error=>{window.__mountState='failed';window.__mountError=error.code||error.message;});
    },{capabilities,language});
    await page.waitForFunction(()=>window.__mountState!=='pending');
    assert.equal(await page.evaluate(()=>window.__mountState),'ready',await page.evaluate(()=>window.__mountError));
    await page.waitForFunction(()=>window.__card._loadOk&&!window.__card._booting&&!window.__card.inert);
  };
  await page.route('**/fonts/Roboto-Regular-*.ttf',route=>route.abort());
  await fresh();await waitForUiKitPaint(page);
  assert.equal(await page.evaluate(()=>document.fonts.check('400 14px Roboto')),false);
  await clickHeaderAction(page.locator('houseplan-card'),'settings');
  await page.locator('hp-dialog[data-kind="settings"]').getByRole('button',{name:'Close',exact:true}).waitFor();
  await page.screenshot({path:resolve(dir,'missing-font-fallback.png')});
  await page.unroute('**/fonts/Roboto-Regular-*.ttf');
  evidence.checks.push('missing-local-font-usable-system-fallback');
  const localeFailures=[];
  const locale='**/fr-*.js*';await page.route(locale,route=>{localeFailures.push(route.request().url());return route.abort();});
  await fresh('fr');await waitForUiKitPaint(page);
  assert.equal(await page.locator('houseplan-card').getAttribute('lang'),'en');
  assert.ok(localeFailures.length>=2,'original and independent retry locale requests both failed');
  await page.unroute(locale);evidence.checks.push('missing-locale-retries-then-english-without-stuck-inert');
  const editor='**/houseplan-editor-runtime-*.js*',failures=[];
  await page.route(editor,route=>{failures.push(route.request().url());return route.abort();});
  await fresh();const card=page.locator('houseplan-card');await clickHeaderAction(card,'mode-plan');
  await card.locator('[data-hp="toast"]').filter({hasText:'Could not load the editor.'}).waitFor();
  assert.equal(await page.evaluate(()=>!!window.__card._editorRuntime),false);
  assert.ok(failures.length>=2,'editor failed on original and retry paths');
  await page.unroute(editor);await clickHeaderAction(card,'mode-plan');
  await card.locator('[data-hp="tool"][data-tool="draw"]').waitFor();
  evidence.checks.push('missing-editor-visible-error-and-recovery-with-versioned-retry');
  await page.evaluate(()=>window.__mount.dispose());
  const entry='**/standalone-dist/houseplan-standalone.js';await page.route(entry,route=>route.abort());
  await page.route('**/standalone-loader.js',route=>route.fulfill({contentType:'text/javascript',body:readFileSync('demo/standalone/loader.js')}));
  await page.goto('http://demo.local/standalone-test');
  const copy=JSON.parse(readFileSync('src/i18n/en.json','utf8'))['standalone.host_error'];
  await page.evaluate(async({capabilities,copy})=>{
    const {createCorePlanHost}=await import('/standalone-host.js');const {loadStandaloneReference}=await import('/standalone-loader.js');
    const lab=createCorePlanHost(capabilities);window.__failedMount=await loadStandaloneReference(document.querySelector('#host'),
      '/standalone-dist/houseplan-standalone.js',lab.host,{language:'en',darkMode:false},copy);
  },{capabilities,copy});
  assert.equal(await page.locator('#host [role="alert"]').textContent(),copy);
  await page.unroute(entry);evidence.checks.push('missing-entry-reference-embedder-shows-readable-failure');
  await fresh();await page.evaluate(()=>window.__lab.connection(false));
  await page.waitForFunction(()=>!window.__card.planHost.environment.connected);
  const offline=await page.evaluate(async()=>{try{await window.__card.planHost.request({type:'houseplan/config/set',config:{}});return 'accepted';}catch(error){return error.code;}});
  assert.equal(offline,'not_ready');await page.evaluate(()=>window.__lab.connection(true));
  await page.waitForFunction(()=>window.__card.planHost.environment.connected);
  await page.evaluate(()=>window.__mount.dispose());
  assert.deepEqual(await page.evaluate(()=>[window.__lab.listenerCount,window.__lab.subscriptionCount]),[0,0]);
  evidence.checks.push('disconnected-host-rejects-write-and-can-reconnect');
}
