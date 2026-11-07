// #1344: real Chromium import caching and silent writer intent.
import {readFileSync} from 'node:fs';
import {launchColdView,checkAll,finish} from './serve.mjs';
const manifest=JSON.parse(readFileSync('dist/houseplan-assets.json','utf8'));
const runtime=manifest.files.map(f=>f.path).find(p=>/houseplan-editor-runtime-[^/]+\.js$/.test(p));
if(!runtime)throw Error('missing editor runtime');
const name=runtime.split('/').at(-1), out={}, sessions=[];
const cold=async()=>{const s=await launchColdView();sessions.push(s);return s;};
const intent=page=>page.locator('houseplan-card [data-editor-navigation="plan"]').dispatchEvent('pointerenter');
try {
const s=await cold();let requests=0;
s.page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/'+name))requests++;});
out.noIntentColdView=await s.page.evaluate(name=>!window.__card._editorRuntime&&!performance.getEntriesByType('resource').some(e=>new URL(e.name).pathname.endsWith('/'+name)),name);
out.staleIntentFailsClosed=await s.page.evaluate(()=>{const c=window.__card,button=c.renderRoot.querySelector('[data-editor-navigation="plan"]');const before=c._serverCanWrite,config=c._config;c._serverCanWrite=false;button.dispatchEvent(new PointerEvent('pointerenter'));const reader=!c._editorRuntimeLoader._preloading;c._serverCanWrite=before;c._config={...config,kiosk:true};button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));const kiosk=!c._editorRuntimeLoader._preloading;c._config=config;return reader&&kiosk&&!c._editorRuntime;});
await s.page.evaluate(()=>{window.__quietMutations=[];window.__quietObserver=new MutationObserver(records=>window.__quietMutations.push(...records.map(r=>r.type)));window.__quietObserver.observe(window.__card.renderRoot,{subtree:true,attributes:true,childList:true,characterData:true});});
await intent(s.page);
await s.page.waitForFunction(()=>!!window.__card._editorRuntimeLoader._preloaded);
out.preloadLeavesDomUntouched=await s.page.evaluate(()=>{window.__quietObserver.disconnect();return window.__quietMutations.length===0;});
out.preloadSilent=await s.page.evaluate(()=>{const c=window.__card;return c._mode==='view'&&!c._editorRuntime&&c._editorRuntimeLoader.state==='idle'&&!c._editorRuntimeLoadingVisible&&!c._toast;});
await intent(s.page);await s.page.locator('houseplan-card [data-editor-navigation="plan"]').focus();
out.repeatedIntentDeduplicated=requests===1;
await s.page.locator('houseplan-card [data-editor-navigation="plan"]').click();
await s.page.waitForFunction(()=>window.__card._editorRuntimeLoader.state==='ready'&&window.__card._mode==='plan');
out.explicitUsesPreload=requests===1;
// A browser-cached failed import must not consume either explicit attempt.
const f=await cold(),urls=[];
await f.page.route('**/'+name+'*',async route=>{urls.push(route.request().url());if(urls.length<=2)await route.abort('failed');else await route.fallback();});
await intent(f.page);
await f.page.waitForFunction(()=>window.__card._editorRuntimeLoader._preloadFailed);
out.failedPreloadSilent=await f.page.evaluate(()=>{const c=window.__card;return c._mode==='view'&&!c._editorRuntime&&!c._editorRuntimeLoadingVisible&&!c._toast&&c._editorRuntimeLoader.state==='idle';});
await f.page.locator('houseplan-card [data-editor-navigation="plan"]').click();
await f.page.waitForFunction(()=>window.__card._editorRuntimeLoader.state==='ready'&&window.__card._mode==='plan');
out.failedPreloadLeavesBothAttempts=urls.length===3&&new Set(urls).size===3&&urls.slice(1).every(u=>new URL(u).searchParams.has('hp_retry'));

const russian=await cold();
const supportRu=manifest.files.map(file=>file.path).find(path=>/support-ru-[^/]+\.js$/.test(path))?.split('/').at(-1);
if(!supportRu)throw Error('missing Russian support dictionary');
await russian.page.evaluate(async()=>{const c=window.__card;c.setConfig({...c._config,language:'ru'});await c.updateComplete;});
await russian.page.waitForFunction(()=>window.__card.getAttribute('lang')==='ru'&&!window.__card._editorRuntime);
const localeUrls=[];
await russian.page.route('**/'+supportRu+'*',async route=>{
  localeUrls.push(route.request().url());
  if(localeUrls.length<=2)await route.abort('failed');else await route.fallback();
});
await intent(russian.page);
await russian.page.waitForFunction(()=>window.__card._editorRuntimeLoader._preloadFailed);
out.failedLocalePreloadSilent=localeUrls.length===1&&await russian.page.evaluate(()=>{
  const c=window.__card;return !c._editorRuntime&&!c._toast&&!c._editorRuntimeLoadingVisible&&c._mode==='view';
});
await russian.page.locator('houseplan-card [data-editor-navigation="plan"]').focus();
await russian.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
out.failedLocaleIntentDeduplicated=localeUrls.length===1;
await russian.page.locator('houseplan-card [data-editor-navigation="plan"]').click();
await russian.page.waitForFunction(()=>window.__card._editorRuntimeLoader.state==='ready'&&window.__card._mode==='plan');
console.log('locale retry evidence',JSON.stringify({urls:localeUrls,state:await russian.page.evaluate(()=>({toast:window.__card._toast,lang:window.__card.getAttribute('lang')}))}));
out.failedLocaleLeavesExplicitAttempts=localeUrls.length===3&&new Set(localeUrls).size===3
  &&new URL(localeUrls[1]).searchParams.has('retry')&&new URL(localeUrls[2]).searchParams.has('retry')
  &&await russian.page.evaluate(()=>!window.__card._toast&&window.__card.getAttribute('lang')==='ru');

// Click during a pending preload retains the existing delayed spinner.
const p=await cold();let release;const held=new Promise(r=>{release=r;});let pendingRequests=0;
await p.page.route('**/'+name+'*',async route=>{pendingRequests++;await held;await route.fallback();});
await intent(p.page);
await p.page.waitForFunction(()=>!!window.__card._editorRuntimeLoader._preloading);
await p.page.locator('houseplan-card [data-editor-navigation="plan"]').click();
await p.page.waitForFunction(()=>window.__card._editorRuntimeLoadingVisible===true);
out.pendingIntentKeepsLoadingContract=pendingRequests===1&&await p.page.evaluate(()=>!window.__card._editorRuntime&&window.__card._mode==='view');
release();await p.page.waitForFunction(()=>window.__card._editorRuntimeLoader.state==='ready');
out.pendingIntentCompletes=pendingRequests===1;
checkAll(out);
for(const x of sessions.slice(1))await x.browser.close();
await finish(s.browser,out);
}catch(error){for(const x of sessions)await x.browser.close();throw error;}
