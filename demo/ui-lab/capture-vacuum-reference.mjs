/** #1002: opt-in private acceptance capture. No live HA or prototype overrides.
 * Output must be outside the checkout; private input and images stay local.
 */
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {parseArgs} from 'node:util';
import {chromium,expect} from 'playwright/test';
import {createLabServer} from './server.mjs';
import {attestLaunchedBrowser} from '../../scripts/browser-attestation.mjs';
import {assertFreshDemoBundle} from '../bundle-freshness.mjs';

const {values:v}=parseArgs({options:Object.fromEntries(['fixture','theme','replay','ha-cache','output'].map(key=>[key,{type:'string'}]))});
for(const key of ['fixture','replay','output']) if(!v[key]) throw Error(`--${key} required`);
const repo=fileURLToPath(new URL('../../',import.meta.url));
if(!relative(repo,resolve(v.output)).startsWith('..')) throw Error('Private output must stay outside the repository');
const fixture=JSON.parse(readFileSync(v.fixture,'utf8')),config=fixture.vacuumReplay;
if(!config) throw Error('A captured vacuumReplay fixture is required');
const {createVacuumReplay}=await import(pathToFileURL(resolve(v.replay)).href);
let states=fixture.states;
const replay=createVacuumReplay(config,{readStates:()=>states,apply:next=>{states=next;}});
if(!replay) throw Error('Captured route is invalid');
const packet=replay.getTrailSnapshot();replay.dispose();
mkdirSync(v.output,{recursive:true});
const server=createLabServer({port:0,fixture:v.fixture,theme:v.theme,haCache:v['ha-cache']});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch();
try {
  await attestLaunchedBrowser(browser,{reason:'#1002 immutable private reference comparison'});
  const page=await browser.newPage({viewport:{width:712,height:884}});
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin||/^(data|blob):/.test(route.request().url())?route.continue():route.abort());
  await page.goto(origin);await page.waitForFunction(()=>window.__lab?.card?._devices?.length>0);
  await assertFreshDemoBundle(page);
  await page.evaluate(async({states,packet,id})=>{
    const old=window.__lab.card,base=old.hass.callWS.bind(old.hass);
    const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card',language:'ru'});
    card.hass={...old.hass,states,callWS:message=>message.type==='houseplan/trail/get'?Promise.resolve(packet):base(message)};
    old.replaceWith(card);window.__lab.card=card;window.__referenceVacuum=id;
  },{states,packet,id:config.markerId});
  await page.waitForFunction(()=>window.__lab.card._devices?.some(d=>d.id===window.__referenceVacuum));
  await page.evaluate(()=>{const c=window.__lab.card,d=c._devices.find(d=>d.id===window.__referenceVacuum);c._pickSpace(d.space);});
  await expect(page.locator('.vactrail path.core').first()).toBeAttached();
  await page.waitForTimeout(700); // finish the ordinary space/boot entrance before judging pixels
  await page.screenshot({path:resolve(v.output,'trail.png')});
  await page.evaluate(()=>{const c=window.__lab.card;c._openMarkerDialog(c._devices.find(d=>d.id===window.__referenceVacuum));});
  const dialog=page.locator('hp-dialog[data-kind="marker"]');
  await dialog.getByRole('button',{name:'Пылесос',exact:true}).click();
  await dialog.locator('dialog').evaluate(async e=>{await Promise.allSettled(e.getAnimations({subtree:true}).map(a=>a.finished));});
  const align=async(selector,y)=>dialog.locator(selector).first().evaluate((e,y)=>{
    let p=e.parentElement;
    while(p&&getComputedStyle(p).overflowY!=='auto') p=p.assignedSlot||p.parentElement||p.getRootNode().host;
    if(p) p.scrollTop+=e.getBoundingClientRect().top-y;
  },y);
  await align('.vacuum-profile .hpf-toggle',145);
  await page.screenshot({path:resolve(v.output,'settings.png')});
  await align('.vacuum-trail-color',163);
  await page.screenshot({path:resolve(v.output,'maps.png')});
  console.log('PASS private accepted data at 70%, 712x884; local captures only');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
