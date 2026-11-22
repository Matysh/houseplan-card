/** #1454 native module-worker + IndexedDB and real card consumer journey.
 * This is a synthetic host, not an ACL test of the owner's real HA. */
import { launch, check, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';
import { totalCleanFloorAreaM2 } from '../test-build/summary-panel-metrics.js';
import { spaceModels } from '../test-build/space-geometry.js';
const fixture = makeLargeHouseFixture({ floors: 3, roomsPerFloor: 4, devices: 12, openings: 6,
  partitions: 2, columns: 1, decor: 4, stairs: 3 });
const isometric = process.argv.includes('--iso');
if (isometric) fixture.config.settings = { ...fixture.config.settings, volumetric_view: true };
const contact='binary_sensor.cache_opening';
fixture.config.spaces[0].openings[1].contact=contact;
fixture.states[contact]={entity_id:contact,state:'off',attributes:{device_class:'door'},last_changed:new Date(0).toISOString()};
fixture.entities[contact]={entity_id:contact,platform:'demo'};
const expectedArea = totalCleanFloorAreaM2(fixture.config, spaceModels(fixture.config));
const changed = structuredClone(fixture.config);
changed.spaces[1].stairs = [{ ...changed.spaces[0].stairs[0], id: 'new-summary-stair' }];
const expectedChanged = totalCleanFloorAreaM2(changed, spaceModels(changed));
const { page, browser } = await launch({ width: process.argv.includes('--narrow') ? 640 : 1440, height: 1000 }, 2);
await page.emulateMedia({ reducedMotion: 'reduce' });
page.on('worker', worker => worker.on('close', () => {}));
page.on('console', message => { if (message.type() === 'error') console.log('BROWSER', message.text()); });
await page.exposeFunction('__breakFloorWorkerAsset', async () => { await page.route('**/floor-worker-*.js', route => route.abort());return true; });
try {
  const result = await page.evaluate(async ({ fixture, expectedArea, expectedChanged, contact }) => {
    window.__card?.remove?.(); localStorage.clear();
    const databases = await indexedDB.databases();
    for (const db of databases) if (db.name === 'houseplan-derived-floors-v1') await new Promise(resolve => {
      const request = indexedDB.deleteDatabase(db.name); request.onsuccess = request.onerror = request.onblocked = resolve;
    });
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const until = async (predicate, label) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > 20_000) throw new Error(label + ': ' + JSON.stringify(window.__cacheCard?._floorPreparation?.diagnostic));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };
    let delay = 0, source = fixture, writes = 0, activeUser = 'cache-fixture';
    const mount = async () => {
      window.__cacheCard?.remove();
      const card = document.createElement('houseplan-card'); window.__cacheCard = card;
      const hass = { language: 'en', locale: { language: 'en' },
        user: { id: activeUser, is_admin: false }, states: source.states,
        devices: source.devices, entities: source.entities, areas: source.areas,
        connection: { connected: true, subscribeEvents: async () => () => {}, subscribeMessage: async () => () => {} },
        callWS: async message => {
          if (message.type === 'houseplan/config/get' || message.type === 'houseplan/layout/get') {
            if (delay) await new Promise(resolve => setTimeout(resolve, delay));
            return message.type === 'houseplan/config/get' ? { config: structuredClone(source.config), rev: 1, can_write: false, summary_panel_api: 1 }
              : { layout: structuredClone(source.layout), rev: 1 };
          }
          if (message.type === 'config/device_registry/list') return Object.values(source.devices);
          if (message.type === 'config/entity_registry/list') return Object.values(source.entities);
          if (/houseplan\/.*(?:set|save|delete)/.test(message.type)) writes++;
          return { ok: true };
        }, callService: async () => { writes++; }, localize: () => null,
        formatEntityState: state => state.state, config: { unit_system: { length: 'km' } } };
      card.hass = hass; card.setConfig({ type: 'custom:houseplan-card', title: 'Cache fixture', icon_size: 3.4 });
      document.getElementById('host').replaceChildren(card); return card;
    };
    const settle = async card => {
      await until(() => card._loadOk && card._floorPreparation && !card._floorPreparation.pending
        && !card._booting && !card._bootFading && card.renderRoot.querySelector('.stage.mode-view')
        && !card.renderRoot.querySelector('[data-hp-floor-cache="pending"]'), 'full View');
      await frame();
    };
    let card = await mount(); await settle(card);
    const cold = structuredClone(card._floorPreparation.diagnostic);
    // Accepted source is published only through the production paint barrier.
    card.requestUpdate(); await until(() => card._floorPreparation.diagnostic.store.writes > 0, 'IDB publication');
    const firstFrame = { base: card._baseVb(), frame: card._frameOf(), builds: { ...card._floorCacheBuilds } };
    const savedWrites = writes;
    delay = 2500; card = await mount();
    await until(() => card._floorPreparation?.diagnostic.diskHits > 0 && !card._floorPreparation.pending
      && card.renderRoot.querySelector('.dev'), 'cached full before fresh response');
    const cachedBeforeFresh = !card._loadOk;
    const disk = structuredClone(card._floorPreparation.diagnostic);
    await settle(card);
    const sameFit = JSON.stringify(firstFrame.base) === JSON.stringify(card._baseVb());
    const diskBuilds = { ...card._floorCacheBuilds };
    const projection = card._renderProjection, isoBuilds = card._isoStructuralBuildCount;
    const quarterTurnBuilds = [];
    if (projection === 'iso') for (const rotation of [45, 90, 135, 180, 225, 270, 315, 0]) {
      card._rotatePlan(1);
      await until(() => card._rotation === rotation && !card._rotationMotion.running, 'actual ISO turn');
      await settle(card); quarterTurnBuilds.push(card._isoStructuralBuildCount);
    }
    delay = 0;
    const second = source.config.spaces[1].id;
    card._pickSpace(second); await settle(card);
    card._pickSpace(source.config.spaces[0].id); await settle(card);
    const warm = structuredClone(card._floorPreparation.diagnostic);
    const memoryReturned = card._space === source.config.spaces[0].id;
    const initialAccepted=card._floorSourceAccepted(), configName=card._serverCfg.spaces[0].name,
      hadName=Object.prototype.hasOwnProperty.call(card._serverCfg.spaces[0],'name');
    card._serverCfg.spaces[0].name='not-yet-accepted';
    const rejectedConfig=!card._floorSourceAccepted();
    if(hadName)card._serverCfg.spaces[0].name=configName;else delete card._serverCfg.spaces[0].name;
    card._layout.__unaccepted_test={x:.1,y:.2};
    const rejectedLayout=!card._floorSourceAccepted();delete card._layout.__unaccepted_test;
    card._saveConfigDebounced();const rejectedDeferred=!card._floorSourceAccepted();card._saveConfigDebounced.cancel();
    const publicationSource=initialAccepted&&rejectedConfig&&rejectedLayout&&rejectedDeferred&&card._floorSourceAccepted();
    if (projection === 'iso') {
      const priorWrites=card._floorPreparation.diagnostic.store.writes;
      card._rotatePlan(1);
      await until(()=>card._rotation===45&&!card._rotationMotion.running,'direct-view preview profile');await settle(card);
      card.requestUpdate();await until(()=>card._floorPreparation.diagnostic.store.writes>priorWrites,'rotated fit publication');
    }
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker { postMessage(...args) { setTimeout(() => super.postMessage(...args), 650); } };
    let preview;
    try {
      card = await mount();
      await until(() => projection === 'iso'
        ? card._floorPassive && !!card._floorPreparation?.preview
          && card.renderRoot.querySelector('[data-hp-floor-cache="preparing"]')
        : card._floorPreparation?.diagnostic.firstPreview > 0
          && card.renderRoot.querySelector('[data-hp-floor-cache="preview"]'), 'passive fit readiness');
      await frame();
      const root = card.renderRoot.querySelector('[data-hp-cache-preview]');
      const before = { ...card._viewOr(card._baseVb()) };
      const passive = !root?.querySelector('foreignObject,image,use,a,script,style,animate')
        && !card.renderRoot.querySelector('.dev,.roomlabel,.vactrail,.oplock');
      const shapeCount = root?.querySelectorAll('path,polygon,rect,line,polyline,circle,ellipse').length ?? 0;
      const sample = [...(root?.querySelectorAll('path') ?? [])].find(path => path.getAttribute('d'));
      const d = sample?.getAttribute('d');
      const project = element => [new DOMPoint(0,0),new DOMPoint(100,100)]
        .map(point => { const screen=point.matrixTransform(element.getScreenCTM());return [screen.x,screen.y]; });
      const screenBefore = sample ? project(sample) : null;
      const oldLight=card._floorCacheSelection().light.fingerprint;
      const nextStates={...card.hass.states,[contact]:{...card.hass.states[contact],state:'on'}};
      card.hass={...card.hass,states:nextStates};
      await settle(card);
      const currentLight=card._floorCacheSelection().light.fingerprint;
      const original = [...card.renderRoot.querySelectorAll('.stage path')].find(path => path.getAttribute('d') === d);
      const screenAfter = original ? project(original) : null;
      const after = card._viewOr(card._baseVb()), pixels = card._stageEl.clientWidth / after.w;
      preview = { passive, shapeCount, previewDom: !!root, camera: Math.abs(before.w - after.w) / after.w <= .0001
        && Math.abs(before.x + before.w / 2 - after.x - after.w / 2) * pixels <= 1
        && Math.abs(before.y + before.h / 2 - after.y - after.h / 2) * pixels <= 1,
        before, after, screenBefore, screenAfter,
        screenCamera: !!screenBefore && !!screenAfter && screenBefore.every((point,i) => point.every((value,j) => Math.abs(value-screenAfter[i][j])<=1)),
        freshLight: oldLight!==currentLight&&card._lightBarrierCache?.value.fingerprint===currentLight,
        phases: structuredClone(card._floorPreparation.diagnostic) };
    } finally { window.Worker = NativeWorker; }
    source = structuredClone(source);
    source.config.settings.summary_panel = { version: 1, title: 'Worker area', show_on_mobile: true, blocks: [{
      id: 'all-area', title: 'Area', visible: true, scope: { type: 'all' },
      values: [{ id: 'area', label: 'Total', source: { type: 'system', key: 'total_area' } }],
    }] };
    const mainBefore = card.houseplanFloorCacheDiagnostics().main;
    const scheduler = card._floorPreparation.scheduler, worker = scheduler.worker, held = [];
    const send = worker.postMessage.bind(worker);
    worker.postMessage = function(message, ...args) {
      if(message.job.kind === 'area') held.push(() => send(message, ...args)); else send(message, ...args);
    };
    card._read.defer(); await card._loadFromServer(); await settle(card);
    await until(() => card.renderRoot.querySelector('[data-hp="summary-toggle"]'), 'summary control');
    const toggle = card.renderRoot.querySelector('[data-hp="summary-toggle"]');
    if(toggle.getAttribute('aria-pressed') !== 'true') toggle.click();
    await until(() => held.length > 0, 'held demanded area');
    card._pickSpace(source.config.spaces[1].id); card._pickSpace(source.config.spaces[2].id);
    await settle(card);
    const navigatedBeforeAreaRelease = card._space === source.config.spaces[2].id;
    for (const release of held) release(); // terminated old port has no authority
    const areaReady = () => card._summary?.areaMemo?.cfgEpoch === card._cfgEpoch
      && typeof card._summary.areaMemo.value === 'number';
    await until(areaReady, 'worker summary area'); await frame();
    const area = card._summary.areaMemo.value;
    const areaRows = async () => {
      const db = await new Promise((resolve,reject) => { const r=indexedDB.open('houseplan-derived-floors-v1',1);
        r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error); });
      try { return await new Promise((resolve,reject) => { const r=db.transaction('area').objectStore('area').getAll();
        r.onsuccess=()=>resolve(r.result.filter(row=>row.scope === card.planHost.cacheScope));r.onerror=()=>reject(r.error); }); }
      finally { db.close(); }
    };
    await until(() => card.renderRoot.querySelector('.summary-value strong'), 'painted summary projection');
    let rows = await areaRows();
    for(let i=0;rows.length<3&&i<50;i++){await frame();rows=await areaRows();}
    const scalarPublished = rows.length >= 3;
    const summaryProducers = structuredClone(card._floorPreparation.diagnostic.producers);
    const mainAfter = card.houseplanFloorCacheDiagnostics().main;
    card = await mount(); await settle(card); await until(areaReady, 'restored scalar summary');
    const scalarHit = card._summary.areaMemo.value === area
      && card._floorPreparation.diagnostic.producers.every(p => p.counts.wallBodiesGeometry === 0)
      && card._floorPreparation.memory.size === 1;
    source.config.spaces[1].stairs = [{ ...source.config.spaces[0].stairs[0], id: 'new-summary-stair' }];
    card._read.defer(); await card._loadFromServer(); await settle(card); await until(areaReady, 'changed foreign-floor stairs'); await frame();
    const summary = { area, expectedArea, changed: card._summary.areaMemo.value, expectedChanged,
      scalarPublished, scalarHit, navigatedBeforeAreaRelease, summaryProducers,
      noMainUnion: mainAfter.wallBodiesGeometry === mainBefore.wallBodiesGeometry && mainAfter.floorFootprintGeometry === mainBefore.floorFootprintGeometry };
    // Hold a real old-user geometry job, then replace the HA authority while
    // its fresh pair is deliberately slow. Neither L1 nor a late worker reply
    // may reveal that previous user's scene.
    const oldPort = card._floorPreparation.scheduler.worker, sendOld = oldPort.postMessage.bind(oldPort), oldJobs = [];
    oldPort.postMessage = function(message, ...args) {
      if(message.job.kind === 'geometry') oldJobs.push(()=>sendOld(message,...args)); else sendOld(message,...args);
    };
    source.config.spaces[2].walls[0].cm += 1;
    card._read.defer(); await card._loadFromServer();
    await until(()=>oldJobs.length>0,'old-user geometry job');
    const stageBlocked = card.renderRoot.querySelector('.stage')?.hasAttribute('inert') === true;
    const diskHitsBefore = card._floorPreparation.diagnostic.diskHits;
    delay = 1800;
    activeUser = 'different-cache-user';
    card.hass = { ...card.hass, user: { id: activeUser, is_admin: false } };
    await frame();for(const release of oldJobs)release();await frame();
    const foreignHidden = !card._loadOk && !card.renderRoot.querySelector('.dev,.roomlabel,[data-hp-floor-cache="preview"]');
    await settle(card);
    const userIsolated = card.planHost.cacheScope.includes('different-cache-user')
      && card._floorPreparation.diagnostic.diskHits === diskHitsBefore;
    const authority = { foreignHidden, stageBlocked, userIsolated };
    // Checksum corruption is a miss of the actual card, not only a storage
    // unit predicate. Keep valid L1 so the canonical preparation can replace it.
    const corruptDb = await new Promise((resolve,reject)=>{const r=indexedDB.open('houseplan-derived-floors-v1',1);
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    let corruptMeta;
    for(let i=0;i<50&&!corruptMeta;i++){
      corruptMeta=await new Promise((resolve,reject)=>{const r=corruptDb.transaction('meta').objectStore('meta').getAll();
        r.onsuccess=()=>resolve(r.result.find(row=>row.scope===card.planHost.cacheScope&&row.floor===card._space));r.onerror=()=>reject(r.error);});
      if(!corruptMeta){card.requestUpdate();await frame();}
    }
    if(!corruptMeta)throw Error('confirmed generation missing');
    card.remove();
    await new Promise((resolve,reject)=>{const tx=corruptDb.transaction('geometry','readwrite');
      const stored=tx.objectStore('geometry').get(corruptMeta.id);stored.onsuccess=()=>{
        const row=stored.result;row.payload={...row.payload,text:'{}',bytes:2};tx.objectStore('geometry').put(row,corruptMeta.id);};
      tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||Error('cache record missing'));});
    corruptDb.close(); delay=0;
    card=await mount();await settle(card);
    const corruptionRecovered = card._floorPreparation.diagnostic.diskHits===0&&card._floorPreparation.diagnostic.misses>0
      &&card._floorPreparation.diagnostic.familyFallbacks===0&&!!card.renderRoot.querySelector('.dev');
    // Real mounted View under storage-access denial and an absent Worker API.
    // A successful frame is not misreported as background work in this path.
    const idbDescriptor = Object.getOwnPropertyDescriptor(window,'indexedDB');
    delete source.config.settings.summary_panel; delay = 0; localStorage.clear();
    let degraded;
    try {
      Object.defineProperty(window,'indexedDB',{configurable:true,get(){throw new DOMException('storage blocked','SecurityError');}});
      window.Worker = undefined;
      card = await mount(); await settle(card);
      degraded = { ready: !!card.renderRoot.querySelector('.dev'), diagnostics: structuredClone(card._floorPreparation.diagnostic) };
    } finally {
      window.Worker = NativeWorker;
      if(idbDescriptor)Object.defineProperty(window,'indexedDB',idbDescriptor);else delete window.indexedDB;
    }
    await window.__breakFloorWorkerAsset();
    card=await mount();await settle(card);
    const missingAsset=card._floorPreparation.diagnostic.scheduler;
    card.requestUpdate();await until(()=>card._floorPreparation.diagnostic.store.writes>0,'cold document seed');
    return { cold, disk, warm, cachedBeforeFresh, sameFit, diskBuilds, projection, isoBuilds, quarterTurnBuilds,
      preview, summary, authority, corruptionRecovered, degraded, missingAsset, publicationSource, memoryReturned, noDeviceWritesFromCache: writes === savedWrites, current: card._space, first: source.config.spaces[0].id };
  }, { fixture, expectedArea, expectedChanged, contact });
  // A real new document retires warmBoot's JS memo as well as the card. Merely
  // remounting in the same document cannot prove the cold SWR contract.
  await page.unroute('**/floor-worker-*.js');
  await page.goto(new URL('/demo.html?panel-cold=1',page.url()).href,{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{await import('/assets/houseplan-card.js');await customElements.whenDefined('houseplan-card');});
  result.coldDocument=await page.evaluate(async fixture=>{
    window.__card?.remove();
    const card=document.createElement('houseplan-card');let writes=0;
    const start=performance.now();let freshPair=0;
    card.hass={language:'en',locale:{language:'en'},user:{id:'different-cache-user',is_admin:false},
      states:fixture.states,devices:fixture.devices,entities:fixture.entities,areas:fixture.areas,
      connection:{connected:true,subscribeEvents:async()=>()=>{},subscribeMessage:async()=>()=>{}},
      callWS:async message=>{
        if(message.type==='houseplan/config/get'||message.type==='houseplan/layout/get'){
          await new Promise(resolve=>setTimeout(resolve,2500));freshPair=performance.now();
          return message.type==='houseplan/config/get'?{config:structuredClone(fixture.config),rev:1,can_write:false,summary_panel_api:1}
            :{layout:structuredClone(fixture.layout),rev:1};
        }
        if(message.type==='config/device_registry/list')return Object.values(fixture.devices);
        if(message.type==='config/entity_registry/list')return Object.values(fixture.entities);
        if(/houseplan\/.*(?:set|save|delete)/.test(message.type))writes++;return{ok:true};},callService:async()=>{writes++;},localize:()=>null,
      formatEntityState:state=>state.state,config:{unit_system:{length:'km'}}};
    card.setConfig({type:'custom:houseplan-card',title:'Cache fixture',icon_size:3.4});document.getElementById('host').replaceChildren(card);
    const until=async predicate=>{while(!predicate()){if(performance.now()-start>15000)throw Error('cold document did not paint '+JSON.stringify(card.houseplanFloorCacheDiagnostics()));await new Promise(resolve=>setTimeout(resolve,10));}};
    await until(()=>card._floorPreparation?.diagnostic.firstCachedFullFrame>0);
    const early=performance.now(),visible=!card._loadOk&&!card._booting&&!card._bootFading
      &&!!card.renderRoot.querySelector('.dev')&&getComputedStyle(card.renderRoot.querySelector('.zoomwrap')).visibility==='visible';
    const phases=structuredClone(card._floorPreparation.diagnostic);
    await until(()=>card._loadOk&&card._floorPreparation.diagnostic.readyCurrentFrame>0);
    const answer={visible,beforeFresh:early<freshPair,mountToCached:early-start,mountToFresh:freshPair-start,phases,noWrites:writes===0};
    card.remove();return answer;
  },fixture);
  console.log(JSON.stringify(result, null, 2));
  check('native worker used, not degraded', result.cold.scheduler.workerJobs > 0 && result.cold.scheduler.fallbackJobs === 0);
  check('disk hit before fresh pair includes devices', result.cachedBeforeFresh);
  check('a new document visibly paints cached full before the fresh pair without write authority', result.coldDocument.visible&&result.coldDocument.beforeFresh&&result.coldDocument.noWrites);
  check('disk hit bypasses real structural consumers', ['wallUnion','physicalBodies','innerContour','cleanFloor','roomFloorPaint','lightBarrier']
    .every(key => result.diskBuilds[key] === 0));
  check('saved fit equals full frame', result.sameFit);
  check('memory navigation reused prepared geometry', result.warm.memoryHits > 0 && result.memoryReturned);
  check('cache did not command devices or write plan', result.noDeviceWritesFromCache);
  check('in-place optimistic config/layout and deferred writes cannot authorize publication', result.publicationSource);
  check('L1 keeps a passive fit basis without live layers', result.preview.passive && (result.projection === 'iso'
    ? result.preview.shapeCount === 0 && !result.preview.previewDom && result.preview.phases.firstPreview === 0
    : result.preview.shapeCount > 0 && result.preview.previewDom));
  check('unchanged saved fit keeps preview and full camera', result.preview.camera);
  if (result.projection !== 'iso') check('actual SVG screen transform stays within one pixel', result.preview.screenCamera);
  check('a door change during worker preparation uses only the current light state', result.preview.freshLight);
  check('demanded summary has the canonical union/subtraction area', Math.abs(result.summary.area - result.summary.expectedArea) < 1e-8);
  check('foreign-floor stairs invalidate the scalar at equal server revision', Math.abs(result.summary.changed - result.summary.expectedChanged) < 1e-8);
  check('summary uses painted accepted persisted scalars without hidden-floor geometry warmup', result.summary.scalarPublished && result.summary.scalarHit);
  check('navigation preempts held area work and no union runs on main', result.summary.navigatedBeforeAreaRelease && result.summary.noMainUnion);
  check('old-user late work cannot publish into a new authority', result.authority.foreignHidden && result.authority.userIsolated);
  check('a held complete candidate blocks old scene input', result.authority.stageBlocked);
  check('corrupt geometry is replaced by canonical worker preparation', result.corruptionRecovered);
  check('storage denial and absent worker preserve an honestly degraded complete View', result.degraded.ready
    && result.degraded.diagnostics.store.errors > 0 && result.degraded.diagnostics.scheduler.workerErrors === 1
    && result.degraded.diagnostics.scheduler.fallbackJobs >= 1 && result.degraded.diagnostics.familyFallbacks === 0);
  check('projection remains the requested one', result.projection, isometric ? 'iso' : 'flat');
  check('a missing worker asset falls back once without an unhandled failure', result.missingAsset.workerErrors===1&&result.missingAsset.fallbackJobs===1);
  if(isometric)check('restored iso quarter turns never rebuild the physical source',
    result.isoBuilds === 0 && result.quarterTurnBuilds.every(count=>count===0));
} finally { await finish(browser); }
