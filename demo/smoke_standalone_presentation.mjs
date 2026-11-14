// #1422: actual plan UI with local presentation, no HA frontend or hass.
// Synthetic storage only; domain validation/portable format belongs to #1423/core.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { launchPanelCold, finish, requirePinnedBrowser } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';
import { buildStandalonePresentationProbe } from './helpers/standalone-presentation-build.mjs';
import { currentGraphFixture } from './helpers/graph-fixture.mjs';
import { PLAN_ONLY_CAPABILITIES } from '../test-build/plan-capabilities.js';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';

requirePinnedBrowser('smoke_standalone_presentation');
const dir = resolve('artifacts/standalone-presentation'); mkdirSync(dir, { recursive: true });
await buildStandalonePresentationProbe(resolve(dir, 'bundle'));
const poly = [[.1,.1],[.9,.1],[.9,.8],[.1,.8]];
const config = currentGraphFixture({ spaces: [{ id:'local', title:'Local plan', cell_cm:5,
  plan_url:'/local/houseplan/plans/_/fixture.png',view_box:[0,0,1,1],rooms:[{id:'room',name:'Room',poly}],
  walls:poly.map((a,i)=>({a,b:poly[(i+1)%poly.length],cm:20})), wall_segments:[],
  partitions:[{id:'wall',a:[.2,.65],b:[.8,.65],cm:12}],
  openings:[{id:'door',type:'door',x:.4,y:.65,angle:0,length:.075,host:{kind:'partition',id:'wall',t:1/3}}],
  wall_columns:[{id:'column',shape:'square',center:[.7,.3],cm:50,angle:0}],
  decor:[{id:'text',kind:'text',x:.35,y:.4,text:'Local text',size:1,color:'#718b82',opacity:1}],
  stairs:[{id:'stairs',kind:'straight',x:.6,y:.5,width:.15,length:.2,angle:0,direction:'forward'}],
}], markers:[], settings:{ filter_seeded:true } });
const { page, browser } = await launchPanelCold({ width:1280,height:900 });
const evidence = { checks:[], surfaces:[], requests:[], external:[], pageErrors:[] };
let releaseFrench, languageHeld=true;
const frenchReady=new Promise(resolve=>{releaseFrench=resolve;});
page.on('pageerror',error=>evidence.pageErrors.push(error.message));
try {
  await page.route('**/standalone-test', route => route.fulfill({ contentType:'text/html', body:
    '<!doctype html><meta name="viewport" content="width=device-width"><style>body{margin:0}#host{min-height:900px}</style><button id="outside">Outside</button><main id="host"></main>' }));
  await page.route('**/standalone-probe/**', async route => {
    const name = new URL(route.request().url()).pathname.slice('/standalone-probe/'.length);
    if(languageHeld && /(?:^|\/)fr-[^/]+\.js$/.test(name))await frenchReady;
    const path = resolve(dir,'bundle',name), rel = relative(resolve(dir,'bundle'),path);
    if (rel.startsWith('..') || !existsSync(path)) return route.fulfill({status:404,body:'missing'});
    return route.fulfill({contentType:'text/javascript',body:readFileSync(path)});
  });
  await page.goto('http://demo.local/standalone-test');
  page.on('request', request => {
    const url=new URL(request.url()); evidence.requests.push(url.pathname);
    if(!['data:','blob:'].includes(url.protocol)&&url.origin!=='http://demo.local')evidence.external.push(url.origin);
  });
  await page.evaluate(async ({config,capabilities}) => {
    const ui = window.__standaloneUi = await import('/standalone-probe/standalone-presentation.js');
    const host = document.querySelector('#host');
    window.__presentation = ui.createStandalonePresentation(host, {language:'fr',darkMode:false}, context => {
      window.__planHostLab?.presentation(context);
    });
    await import('/standalone-probe/houseplan-card.js');
    const {createPlanHostFixture} = await import('/plan-host-fixture.js');
    const lab = window.__planHostLab = createPlanHostFixture(config, { capabilities,presentation:window.__presentation.context });
    const card = document.createElement('houseplan-card'); card.planHost = lab.host;
    card.setConfig({ type:'custom:houseplan-card' }); host.append(card); window.__card = card;
  },{config,capabilities:PLAN_ONLY_CAPABILITIES});
  await page.waitForFunction(()=>window.__card.inert && window.__card.getAttribute('aria-busy')==='true'
    && window.__card.shadowRoot.querySelector('ha-circular-progress[active]'));
  assert.ok(await page.evaluate(()=>{
    const progress=window.__card.shadowRoot.querySelector('ha-circular-progress');
    return progress.getBoundingClientRect().width>0 && !!progress.shadowRoot?.querySelector('circle') && progress.tabIndex<0;
  }),'actual cold-language gate uses the visible local nonfocusable progress');
  languageHeld=false;releaseFrench();
  await page.waitForFunction(()=>!window.__card.inert && !window.__card.hasAttribute('aria-busy'));
  await page.evaluate(()=>window.__presentation.update({language:'en'}));
  evidence.checks.push('real-cold-language-progress-and-authority-release');
  await installHpTestOnPage(page);
  await page.waitForFunction(()=>window.__card?._loadOk && !window.__card._booting);
  assert.equal(await page.evaluate(()=>globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__),sourceFingerprint());
  assert.equal(await page.evaluate(()=>window.__card.hass),undefined);
  const card = page.locator('houseplan-card');
  const settle = () => page.evaluate(()=>window.__hpTest.settled());
  const audit = async name => {
    await settle();
    await waitForUiKitPaint(page);
    const result = await page.evaluate(()=>{
      const elements = [], walk = root => { for(const el of root.querySelectorAll('*')){elements.push(el);if(el.shadowRoot)walk(el.shadowRoot);} };
      walk(document.querySelector('houseplan-card').shadowRoot);
      return { undefined: [...new Set(elements.filter(el=>el.localName.includes('-')&&!customElements.get(el.localName)).map(el=>el.localName))],
        fallbacks: elements.filter(el=>el.hasAttribute('data-hp-standalone-fallback')).map(el=>el.getAttribute('icon')||el.icon),
        haBranches:['ha-dialog','ha-switch','ha-slider','home-assistant'].filter(name=>customElements.get(name)),
        forbidden:window.__planHostLab.forbiddenReads,
        clipped:elements.filter(el=>el.localName==='hp-dialog'&&!el.inert).map(el=>{
          const surface=el.shadowRoot.querySelector('.surface'), box=surface?.getBoundingClientRect();
          const body=el.querySelector('.body');
          return {native:!!el.shadowRoot.querySelector('dialog:modal'),fits:!!box&&box.left>=-1&&box.right<=innerWidth+1,
            bodyFits:!body||body.scrollWidth<=body.clientWidth+1};
        }) };
    });
    assert.deepEqual(result.undefined,[],`${name}: undefined elements`);
    assert.deepEqual(result.fallbacks,[],`${name}: unexpected finite-icon fallback`);
    assert.deepEqual(result.haBranches,[]); assert.deepEqual(result.forbidden,[]);
    assert.ok(result.clipped.every(d=>d.native&&d.fits&&d.bodyFits),`${name}: genuine native modal fits the viewport: ${JSON.stringify(result.clipped)}`);
    evidence.surfaces.push(name);
  };
  const close = async () => {
    await page.keyboard.press('Escape'); await settle();
    await card.locator('hp-dialog:not([inert])').waitFor({state:'detached'});
  };
  await audit('cold-view');
  for (const width of [1280,390]) for(const darkMode of [false,true]) {
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({colorScheme:darkMode?'dark':'light'});
    await page.evaluate(darkMode=>window.__presentation.update({darkMode}),darkMode);
    await settle();
    assert.deepEqual(await page.evaluate(()=>({dark:window.__card.planHost.environment.presentation.themes.darkMode,
      scheme:getComputedStyle(document.querySelector('#host')).colorScheme})),{dark:darkMode,scheme:darkMode?'dark':'light'});
    await clickHeaderAction(card,'settings');
    await card.locator('hp-dialog[data-kind="settings"]').waitFor();
    await audit(`general-${width}-${darkMode?'dark':'light'}`);
    if(width===390) assert.ok(await card.locator('hp-dialog[data-kind="settings"] .hpf-settings-mobile').evaluate(el=>el.getBoundingClientRect().height)<90,
      'native mobile navigation keeps its natural control height, not a stretched empty row');
    await page.screenshot({path:resolve(dir,`general-${width}-${darkMode?'dark':'light'}.png`)});
    await close();
  }
  await page.setViewportSize({width:1280,height:900});
  for (const language of ['ru','de','fr']) {
    await page.evaluate(language=>window.__presentation.update({language}),language); await settle();
    await clickHeaderAction(card,'settings');
    const dialog=card.locator('hp-dialog[data-kind="settings"]'); await dialog.waitFor();
    const expected={ru:'Закрыть',de:'Schließen',fr:'Fermer'}[language];
    await dialog.getByRole('button',{name:expected,exact:true}).waitFor();
    await audit(`localized-${language}`); await close();
  }
  await page.evaluate(()=>window.__presentation.update({language:'en'})); await settle();
  const storedBefore=await page.evaluate(()=>JSON.stringify(window.__planHostLab.saved()));
  await clickHeaderAction(card,'settings');
  const general=card.locator('hp-dialog[data-kind="settings"]'); await general.waitFor();
  const save=general.locator('[data-hp="dialog-confirm"]');
  assert.equal(await save.isDisabled(),true);await save.evaluate(el=>el.click());
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__planHostLab.saved())),storedBefore,'disabled Save cannot write');
  const checkbox=general.locator('#gs-room-tooltip');
  const checked=await checkbox.isChecked(); await checkbox.click();
  assert.equal(await checkbox.isChecked(),!checked,'real native checkbox updates the draft');
  await page.keyboard.press('Escape');
  const discard=card.locator('hp-dialog[data-kind="confirm"]'); await discard.waitFor();
  await audit('dirty-discard-confirm');
  await page.keyboard.press('Escape'); await settle();
  assert.equal(await general.isVisible(),true,'Escape cancels discard, not the parent draft');
  assert.equal(await checkbox.isChecked(),!checked); await checkbox.click();
  for(const key of [...Array(12).fill('Tab'),...Array(12).fill('Shift+Tab')]){
    await page.keyboard.press(key);
    assert.equal(await general.evaluate(dialog=>{
      let active=document.activeElement;while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;
      for(let node=active;node;node=node.parentNode||node.getRootNode()?.host)if(node===dialog)return true;
      return false;
    }),true,'native modal contains keyboard focus');
  }
  await general.locator('[data-hp="settings-section"][data-section="plan"]').click();
  const select=general.locator('hp-settings-select:has(select[name="gs-bg-mode"])');
  await select.locator('[data-hp="select-trigger"]').click();
  await page.keyboard.press('Escape'); await settle();
  assert.equal(await general.isVisible(),true,'first Escape only closes nested select');
  const color=general.locator('hp-color-opacity[data-field="gs-bg-color"]');
  await color.locator('[data-field="colour-open"]').click();
  await color.locator('[data-field="colour-hex"]').waitFor();
  await page.keyboard.press('Escape'); await settle();
  assert.equal(await general.isVisible(),true,'first Escape only closes nested color');
  await audit('nested-select-color-focus'); await close();
  await page.waitForFunction(()=>window.__card.shadowRoot.activeElement?.dataset.hp==='settings');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__planHostLab.saved())),storedBefore,'cancelled drafts do not write');
  await page.evaluate(()=>window.__hpTest.openSpaceDialog('edit','local'));
  await audit('space');
  const space=card.locator('hp-dialog[data-kind="space"]'), scale=space.locator('input[id$="-cell-cm"]');
  const scaleBefore=await scale.inputValue();await scale.fill('8');
  assert.equal(await page.evaluate(()=>window.__card._spaceDialog.cellCm),8);
  await scale.fill(scaleBefore);
  await space.locator('[data-hp="settings-section"][data-section="room-cards"]').click();
  const slider=space.locator('input[type="range"]').first(), rangeBefore=await slider.inputValue();
  await slider.focus();await page.keyboard.press('ArrowRight');
  assert.equal(Number(await slider.inputValue()),Number(rangeBefore)+5);
  assert.equal(await page.evaluate(()=>window.__card._spaceDialog.cardNameScale),(Number(rangeBefore)+5)/100);
  await page.keyboard.press('ArrowLeft');
  const showNames=space.locator('input[id$="-show-names"]'), namesBefore=await showNames.isChecked();
  await showNames.click();assert.equal(await page.evaluate(()=>window.__card._spaceDialog.showNames),!namesBefore);
  await showNames.click();await audit('native-number-range-disabled');await close();
  await page.evaluate(()=>window.__hpTest.setMode('plan')); await settle();
  await page.evaluate(()=>window.__hpTest.setTool('select')); await settle();
  await card.locator('[data-hp="zoom-fit"]').click(); await settle();
  await page.evaluate(()=>window.__hpTest.openRoomEdit('room'));
  await audit('room'); await close();
  await card.locator('[data-hp="opening"][data-id="door"] .op-hit').dblclick();
  await card.locator('hp-dialog[data-kind="opening"]').waitFor();
  await audit('opening'); await close();
  await card.locator('[data-hp="wall-column"][data-id="column"]').dblclick();
  await card.locator('hp-dialog[data-kind="physical"]').waitFor();
  await audit('column'); await close();
  await card.locator('[data-hp="stair"][data-id="stairs"]').dblclick();
  await card.locator('hp-dialog[data-kind="stairs"]').waitFor();
  await audit('stairs'); await close();
  await page.evaluate(()=>window.__hpTest.setMode('decor')); await settle();
  await page.evaluate(()=>window.__hpTest.setTool('select')); await settle();
  await card.locator('[data-hp="decor"][data-id="text"]').dblclick();
  await card.locator('hp-dialog[data-kind="decor"]').waitFor();
  await audit('decor-text'); await close();
  await page.evaluate(()=>window.__hpTest.setTool('image')); await settle();
  await card.locator('.imagepalette').waitFor(); await audit('decor-image-library');
  await card.locator('[data-hp="action"][data-action="image-palette-close"]').click();
  await page.evaluate(()=>window.__hpTest.setTool('backdrop')); await settle();
  const backdrop=card.locator('[data-hp="backdrop"]'), backdropBox=await backdrop.boundingBox();
  await backdrop.dblclick({position:{x:backdropBox.width*.95,y:backdropBox.height*.95}});
  await card.locator('hp-dialog[data-kind="decor"]').waitFor();
  await audit('backdrop-properties'); await close();
  await clickHeaderAction(card,'settings');
  await card.locator('[data-hp="settings-section"][data-section="data"]').click();
  await card.locator('[data-action="backup-export-open"]').click();
  await card.locator('hp-dialog[data-kind="backup"]').waitFor();
  await audit('plan-export');
  await page.mouse.click(4,880); await settle();
  await card.locator('hp-dialog[data-kind="backup"]').waitFor({state:'detached'});
  await clickHeaderAction(card,'settings');
  await card.locator('[data-hp="settings-section"][data-section="data"]').click();
  // Deliberately opaque wire-preview fixture, NOT a portable-file/core proof.
  await card.locator('[data-field="backup-file"]').setInputFiles({name:'synthetic-preview.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({kind:'space',config}))});
  await card.locator('hp-dialog[data-kind="backup"]').waitFor();
  await audit('plan-import-preview'); await close();
  await clickHeaderAction(card,'settings');
  await card.locator('[data-hp="settings-section"][data-section="data"]').click();
  await card.locator('[data-action="plan-optimize"]').click();
  await page.waitForFunction(()=>window.__card.shadowRoot.querySelectorAll('hp-dialog[data-kind="settings"]').length===2);
  await audit('optimize-preview');
  const optimize=await card.locator('hp-dialog[data-kind="settings"]').last().elementHandle();
  await card.locator('hp-dialog[data-kind="settings"]').last().getByRole('button',{name:'Cancel',exact:true}).click();
  await page.waitForFunction(el=>!el.isConnected,optimize); await close();
  await clickHeaderAction(card,'pdf');
  await card.locator('hp-pdf-dialog hp-dialog').waitFor();
  await audit('print'); await close();
  // Negative names must use a safe local path, never an injected subtree.
  const fallback=await page.evaluate(async()=>{
    const el=document.createElement('ha-icon'); el.icon='<img src=x onerror=alert(1)>';
    document.querySelector('#host').append(el); await el.updateComplete;
    const result={fallback:el.hasAttribute('data-hp-standalone-fallback'),svg:!!el.shadowRoot.querySelector('svg path'),
      injected:!!el.shadowRoot.querySelector('img,script')}; el.remove(); return result;
  });
  assert.deepEqual(fallback,{fallback:true,svg:true,injected:false});
  const progress=await page.evaluate(async()=>{
    const el=document.createElement('ha-circular-progress'); el.setAttribute('active','');
    document.querySelector('#host').append(el); await el.updateComplete;
    const r=el.getBoundingClientRect(); return {w:r.width,h:r.height,svg:!!el.shadowRoot.querySelector('circle'),tab:el.tabIndex};
  });
  assert.ok(progress.w>0&&progress.h>0&&progress.svg&&progress.tab<0);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('ha-circular-progress').shadowRoot.querySelector('svg')).animationName),'none');
  evidence.checks.push('no-hass','theme-inputs-and-presentation-aligned','local-close-labels','finite-local-icons','unknown-safe-fallback','real-progress','reduced-motion');
  assert.ok(evidence.requests.every(path=>!path.includes('ha-bootstrap')&&!path.includes('mdi-icon-data')&&!path.includes('ha-modules')));
  assert.deepEqual(evidence.external,[],'UI never requests an external origin');
  const lifecycle=await page.evaluate(async()=>{
    const api=window.__standaloneUi, host=document.querySelector('#host');
    const names=['ha-icon','ha-card','ha-circular-progress'], before=names.map(name=>customElements.get(name));
    api.registerStandalonePresentation();
    const idempotent=names.every((name,i)=>customElements.get(name)===before[i]);
    let duplicate=false;try{api.createStandalonePresentation(host,{language:'en',darkMode:false},()=>{});}catch{duplicate=true;}
    const other=document.createElement('div'); other.style.setProperty('--primary-color','#123456');host.after(other);
    let failed=false;try{api.createStandalonePresentation(other,{language:'en',darkMode:false},()=>{throw Error('publication refused');});}catch{failed=true;}
    const rolledBack=other.style.getPropertyValue('--primary-color')==='#123456';
    const second=api.createStandalonePresentation(other,{language:'en',darkMode:false},()=>{});
    window.__card.remove();await new Promise(requestAnimationFrame);
    host.style.setProperty('--warning-color','#abcdef');
    window.__presentation.dispose();window.__presentation.dispose();
    let retired=false;try{window.__presentation.update({darkMode:false});}catch{retired=true;}
    const independent=other.style.getPropertyValue('--primary-text-color')==='#212121';
    const preserved=host.style.getPropertyValue('--warning-color')==='#abcdef';
    second.dispose();other.remove();
    return {idempotent,duplicate,failed,rolledBack,retired,independent,preserved,
      listeners:window.__planHostLab.listenerCount};
  });
  assert.deepEqual(lifecycle,{idempotent:true,duplicate:true,failed:true,rolledBack:true,retired:true,independent:true,preserved:true,listeners:0});
  // The existing product intentionally retains config/layout subscriptions
  // for a 2s short-return grace; the presentation adapter must not change it.
  await page.waitForFunction(()=>window.__planHostLab.subscriptionCount===0,undefined,{timeout:4000});
  evidence.checks.push('publication-rollback','independent-theme-roots','dispose-and-reject-old-controller','host-disconnect-releases-leases');
  // Fresh documents: importing the opt-in module has no side effects. Each
  // forbidden name/root independently prevents the whole registration series.
  for(const collision of ['ha-icon','ha-card','ha-circular-progress','ha-dialog','ha-switch','ha-slider','home-assistant','root']){
    await page.goto('http://demo.local/standalone-test');
    const result=await page.evaluate(async collision=>{
      if(collision==='root')document.body.append(document.createElement('home-assistant'));
      else customElements.define(collision,class extends HTMLElement{});
      const names=['ha-icon','ha-card','ha-circular-progress'], before=names.map(name=>customElements.get(name));
      const api=await import('/standalone-probe/standalone-presentation.js');
      const inertImport=names.every((name,i)=>customElements.get(name)===before[i]);
      let rejected=false;try{api.registerStandalonePresentation();}catch{rejected=true;}
      return {inertImport,rejected,unchanged:names.every((name,i)=>customElements.get(name)===before[i])};
    },collision);
    assert.deepEqual(result,{inertImport:true,rejected:true,unchanged:true},`document collision ${collision}`);
  }
  evidence.checks.push('eight-atomic-registry-collisions','no-eager-registration');
  assert.deepEqual(evidence.pageErrors,[],'no uncaught browser errors');
  evidence.completed=true; console.log(JSON.stringify({...evidence,requests:evidence.requests.length}));
} catch(error) {
  await page.screenshot({path:resolve(dir,'failure.png')});
  console.error('standalone diagnostic',await page.evaluate(()=>({dialogs:[...document.querySelector('houseplan-card')?.shadowRoot?.querySelectorAll('hp-dialog')||[]].map(el=>el.getAttribute('data-kind')),
    text:document.querySelector('houseplan-card')?.shadowRoot?.textContent?.slice(-1200)})));
  throw error;
} finally {
  releaseFrench();
  writeFileSync(resolve(dir,'evidence.json'),JSON.stringify(evidence,null,2)); await finish(browser);
}
