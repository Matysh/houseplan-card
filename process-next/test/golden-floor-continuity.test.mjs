import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {requirePinnedBrowser,enforcePinnedBrowser} from '../../scripts/browser-attestation.mjs';
import {inspectTunnelContinuity} from '../catalog/golden-floor-continuity.mjs';

test('#1314 floor seam guard uses real pixels and rejects gaps without a tunnel DOM',{timeout:30000},async()=>{
  requirePinnedBrowser('golden floor seam regression');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    await enforcePinnedBrowser(browser);
    for(const dpr of [1,2]){
      const context=await browser.newContext({viewport:{width:320,height:140},deviceScaleFactor:dpr});
      const page=await context.newPage();
      const seed=async({gap=0,stripe=false,hidden=false,filled=true}={})=>{
        await page.setContent(`<style>body{margin:0;background:white}svg{display:block}</style><svg width="320" height="140"><path data-hp="room" class="${filled?'filled':''}" d="M20 20H300V${70-gap}H20Z" fill="${filled?'#66717c':'white'}" fill-opacity="${hidden?0:.55}"/><path data-hp="room" class="${filled?'filled':''}" d="M20 ${70+gap}H300V120H20Z" fill="${filled?'#66717c':'white'}" fill-opacity="${hidden?0:.55}"/>${stripe?'<rect x="40" y="69" width="240" height="2" fill="white"/>':''}</svg>`);
        await page.evaluate(()=>{window.__goldenCard={renderRoot:document,_openingsR:[{id:'door',rx:160,ry:70,angle:0,rlen:200}]};});
      };
      const inspect=async()=>inspectTunnelContinuity(page,await page.screenshot(),null,{openingId:'door',insetPx:2,maxChannelJump:3});
      await seed();const good=await inspect();assert.ok(good.samplePairs>0);assert.ok(good.maxJump<=3,JSON.stringify(good));
      await seed({gap:3});await assert.rejects(inspect,/coverage gap/);
      await seed({hidden:true});await assert.rejects(inspect,/floor missing/);
      await seed({filled:false});await assert.rejects(inspect,/floor missing/,'uniform white paper is not a room-coloured floor');
      await seed({stripe:true});assert.ok((await inspect()).maxJump>3,'the actual white stripe must fail the unchanged pixel tolerance');
      await context.close();
    }
  } finally {await browser.close();}
});
