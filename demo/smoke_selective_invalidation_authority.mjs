// #1093 AC8: each retired-owner witness starts on an independent real scene.
import {launch,requirePinnedBrowser,reportPageErrors} from './serve.mjs';
import {makeSelectiveInvalidationFixture} from './fixtures/selective-invalidation.mjs';
import {installSelectiveInvalidationFixture} from './helpers/selective-invalidation-fixture.mjs';
import {runSaveAuthorityWitnesses} from './helpers/selective-invalidation-authority.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
requirePinnedBrowser();
const report={kind:'correctness-only',node:process.version,viewport:[1440,1000],dpr:1,manifest:JSON.parse(readFileSync('dist/houseplan-assets.json','utf8'))};
try {
 report.witnesses=await runSaveAuthorityWitnesses({scenarios:process.argv.find(a=>a.startsWith('--case='))?.slice(7).split(','),createScene:async()=>{
  const {page,browser}=await launch({width:1440,height:1000},1,[],{},undefined,undefined,'/demo.html?device-history=1');
  try {
   await page.locator('#host').evaluate(host=>host.style.width='1200px');
   await installSelectiveInvalidationFixture(page,makeSelectiveInvalidationFixture(false));
  } catch(error){await browser.close();throw error;}
  return {page,card:page.locator('houseplan-card'),close:async()=>{
   try { if (await reportPageErrors()) throw new Error('browser page errors'); }
   finally { await browser.close(); }
  }};
 }});
 console.log(JSON.stringify({pass:true,cases:report.witnesses.map(row=>row.scenario)}));
} catch(error){report.witnesses=error.authorityWitnesses;report.error=error.stack||String(error);console.error(report.error);process.exitCode=1;}
finally {mkdirSync('artifacts/1093',{recursive:true});writeFileSync('artifacts/1093/native-authority.json',JSON.stringify(report,null,2)+'\n');}
