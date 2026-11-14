/** Three identical, fresh-context samples of the real editor, not a shell. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { watchPage } from '../serve.mjs';
import { clickHeaderAction } from '../helpers/header-actions.mjs';
import { createCoreProcess } from './core-process.mjs';
import { standaloneFixture } from './fixture.mjs';
import { standalonePath } from '../../scripts/standalone-build.mjs';

export async function measureStandalone(browser,manifest,capabilities){
  const samples=[],scene=standaloneFixture();
  const sceneSha256=createHash('sha256').update(JSON.stringify(scene)).digest('hex');
  for(let sample=1;sample<=3;sample++){
    const core=await createCoreProcess({config:scene,fingerprint:manifest.source.fingerprint,version:manifest.version});
    const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,colorScheme:'light',locale:'en-US'});
    const page=watchPage(await context.newPage()),requests=[],served=[];
    const fulfill=(route,type,bytes)=>{const body=Buffer.from(bytes);served.push({path:new URL(route.request().url()).pathname,rawBytes:body.length,gzipEquivalentBytes:gzipSync(body,{level:9}).length});return route.fulfill({contentType:type,body});};
    try{
      page.on('request',request=>requests.push(new URL(request.url()).pathname));
      await page.route('**/standalone-test',route=>fulfill(route,'text/html',readFileSync('demo/standalone/index.html')));
      await page.route('**/standalone-dist/**',route=>{
        const path=new URL(route.request().url()).pathname.slice('/standalone-dist/'.length);
        return fulfill(route,path.endsWith('.ttf')?'font/ttf':path.endsWith('.css')?'text/css':'text/javascript',readFileSync(standalonePath(resolve('dist-standalone'),path)));
      });
      await page.route('**/standalone-host.js',route=>fulfill(route,'text/javascript',readFileSync('demo/standalone/host.js')));
      await page.route('**/standalone-core-rpc',async route=>{
        try{await route.fulfill({json:await core.rpc(route.request().postDataJSON())});}
        catch(error){await route.fulfill({json:{error:{code:error.code||'test_core_error',message:error.message}}});}
      });
      const started=performance.now();await page.goto('http://demo.local/standalone-test');
      await page.evaluate(async capabilities=>{
        const api=await import('/standalone-dist/houseplan-standalone.js');const {createCorePlanHost}=await import('/standalone-host.js');
        window.__lab=createCorePlanHost(capabilities);window.__mount=api.mountHouseplan(document.querySelector('#host'),window.__lab.host,{language:'en',darkMode:false});window.__card=await window.__mount.ready;
      },capabilities);
      await page.waitForFunction(()=>window.__card._loadOk&&!window.__card._booting);
      const coldReadyMs=performance.now()-started,coldRequests=requests.slice(),coldAssets=served.slice();
      assert.equal(coldRequests.some(path=>path.includes('houseplan-editor-runtime-')),false);
      const editorStarted=performance.now();await clickHeaderAction(page.locator('houseplan-card'),'mode-plan');
      await page.locator('houseplan-card [data-hp="tool"][data-tool="draw"]').waitFor();
      const editorReadyMs=performance.now()-editorStarted;
      assert.ok(requests.some(path=>path.includes('houseplan-editor-runtime-')));
      assert.equal((await core.rpc({op:'snapshot'})).result.haImported,false);
      samples.push({sample,source:manifest.source,scene:'demo/standalone/fixture.mjs',sceneSha256,viewport:{width:1280,height:900},dpr:1,
        language:'en',theme:'light',cache:'new browser context; routing disables HTTP cache',browser:browser.version(),
        network:'local routed uncompressed files + prestarted real stdio core; no throttling',coldReadyMs,editorReadyMs,
        coldRequests,allRequests:requests,coldAssets,allAssets:served,
        rawColdDeliveredBytes:coldAssets.reduce((n,f)=>n+f.rawBytes,0),gzipColdEquivalentBytes:coldAssets.reduce((n,f)=>n+f.gzipEquivalentBytes,0),
        rawThroughEditorDeliveredBytes:served.reduce((n,f)=>n+f.rawBytes,0),gzipThroughEditorEquivalentBytes:served.reduce((n,f)=>n+f.gzipEquivalentBytes,0),
        transportEncoding:'identity; gzip numbers are equivalents, not a claim of on-wire compression'});
      await page.evaluate(()=>window.__mount.dispose());
      assert.deepEqual(await page.evaluate(()=>[window.__lab.listenerCount,window.__lab.subscriptionCount]),[0,0]);
      // Leave watched pages alive until the shared final exception verdict.
      // The product is already disposed; finish() closes their contexts.
    }finally{await core.close();}
  }
  return samples;
}
