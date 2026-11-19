import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=resolve(process.env.HP_REPO || process.cwd());
const {chromium}=await import(pathToFileURL(resolve(repo,'node_modules/playwright/index.mjs')));
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture=JSON.parse(await readFile(`${repo}/demo/ui-lab/fixture.json`,'utf8'));
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/fixture.json',route=>route.fulfill({json:fixture}));
 await page.route('**/provenance.json',async route=>{
  const response=await route.fetch();const p=await response.json();
  await route.fulfill({json:{...p,datasetId:'synthetic-quota-regression',privateDataset:false}});
 });
 await page.goto((process.env.HP_LAB_URL || 'http://localhost:8891/'));
 await page.waitForFunction(()=>window.__lab?.card?._devices?.length);
 const first=await page.evaluate(async()=>{
  const codec=await import('/session.mjs');const storage=await import('/session-storage.mjs');
  const mock=window.__lab.mock, identity=mock.identity;
  const previous=codec.serializeSession(identity,mock.snapshot());
  localStorage.setItem(mock.sessionKey,previous);
  localStorage.setItem('unrelated-preference','keep');
  let n=0;try {while(n<100){localStorage.setItem(`synthetic-fill-${n}`,'x'.repeat(256*1024));n++;}}catch{}
  const before=Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]));
  const large=mock.snapshot();large.config.settings.quotaTest='a'.repeat(6*1024*1024);
  let rejected=false;try {codec.saveSession(localStorage,identity,large);}catch(e){rejected=e.name==='QuotaExceededError';}
  await storage.saveBrowserSession(identity,large);
  const restored=await storage.loadBrowserSession(identity);
  const unchanged=JSON.stringify(before)===JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
  const queuedA=mock.snapshot(),queuedB=mock.snapshot();queuedA.config.settings.quotaOrder='first';queuedB.config.settings.quotaOrder='last';
  await Promise.all([storage.saveBrowserSession(identity,queuedA),storage.saveBrowserSession(identity,queuedB)]);
  const ordered=(await storage.loadBrowserSession(identity)).config.settings.quotaOrder;
  const originalPut=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){const req=originalPut.apply(this,args);this.transaction.abort();return req;};
  let aborted=false;try{await storage.saveBrowserSession(identity,queuedA);}catch{aborted=true;}finally{IDBObjectStore.prototype.put=originalPut;}
  const afterAbort=(await storage.loadBrowserSession(identity)).config.settings.quotaOrder;
  await storage.saveBrowserSession(identity,large);
  return {rejected,largeSize:restored.config.settings.quotaTest.length,unchanged,ordered,aborted,afterAbort,fillCount:n};
 });
 assert.equal(first.rejected,true);assert.equal(first.largeSize,6*1024*1024);assert.equal(first.unchanged,true);
 assert.equal(first.ordered,'last');assert.equal(first.aborted,true);assert.equal(first.afterAbort,'last');
 await page.reload();await page.waitForFunction(()=>window.__lab?.card?._devices?.length);
 const second=await page.evaluate(async()=>{
  const mock=window.__lab.mock,store=await import('/session-storage.mjs');
  const restored=mock.snapshot().config.settings.quotaTest.length;
  const persisted=await mock.persist();
  await store.resetBrowserSession(mock.identity);
  const reset=(await store.loadBrowserSession(mock.identity))===null;
  const backup=localStorage.getItem(mock.sessionKey)!==null;
  return {restored,persisted,reset,backup};
 });
 assert.equal(second.restored,6*1024*1024);assert.equal(second.persisted,true);assert.equal(second.reset,true);assert.equal(second.backup,true);
 await page.reload();await page.waitForFunction(()=>window.__lab?.card?._devices?.length);
 const noResurrection=await page.evaluate(()=>!window.__lab.mock.snapshot().config.settings.quotaTest);
 assert.equal(noResurrection,true);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,first,second,noResurrection,errors}));
} finally {await browser.close();}
