import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const option=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];};
const repo=resolve(option('--repo',process.cwd()));
const {chromium}=await import(pathToFileURL(resolve(repo,'node_modules/playwright/index.mjs')));
const root=dirname(fileURLToPath(import.meta.url)),out=resolve(option('--out',root));await mkdir(out,{recursive:true});
const fixture=JSON.parse(await readFile(`${root}/../synthetic-fixture.json`,'utf8'));
fixture.entities['sensor.lab_temperature_battery']={entity_id:'sensor.lab_temperature_battery',device_id:'lab_temperature',platform:'demo',config_entry_id:'lab_entry',disabled_by:null,device_class:'battery'};
fixture.states['sensor.lab_temperature_battery']={entity_id:'sensor.lab_temperature_battery',state:'78',attributes:{device_class:'battery',unit_of_measurement:'%'}};
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1480,height:1080},deviceScaleFactor:1}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/fixture.json',r=>r.fulfill({json:fixture}));
  await page.route('**/provenance.json',async route=>{
    const response=await route.fetch(), p=await response.json();
    await route.fulfill({json:{...p,datasetId:'synthetic-glyph-orientation',privateDataset:false}});
  });
  await page.goto(option('--url','http://localhost:8891/'));
  await page.locator('.stage.projection-iso').waitFor();await page.waitForTimeout(2400);
  const observations=[];
  for(let turn=0;turn<4;turn++){
    await page.mouse.move(5,5);
    observations.push(await page.evaluate(()=>{
      const c=window.__lab.card,r=c.shadowRoot,stage=r.querySelector('.stage'),s=getComputedStyle(stage);
      const degrees=parseFloat(s.getPropertyValue('--hp-iso-content-turn'));
      const marker=new DOMMatrix(s.getPropertyValue('--hp-iso-marker-plane'));
      const room=new DOMMatrix(s.getPropertyValue('--hp-iso-room-plane'));
      const glyph=marker.rotate(degrees);
      const families=['.dev:not(.iso-tile-shadow) .device-core > ha-icon','.dev:not(.iso-tile-shadow) .device-core > .valtext','.dev:not(.iso-tile-shadow) .value-badge-content','.dev:not(.iso-tile-shadow) .device-battery-icon','.oplock-core > ha-icon'];
      const contents=families.map(selector=>({selector,items:[...r.querySelectorAll(selector)].map(el=>{
        const style=getComputedStyle(el);return {rotate:style.rotate,display:style.display,transform:style.transform};
      })}));
      const lqi=[...r.querySelectorAll('.dev:not(.iso-tile-shadow) .lqi')].map(el=>{
        const style=getComputedStyle(el),m=new DOMMatrix(style.transform);
        return {a:m.a,b:m.b,c:m.c,d:m.d,edgeX:style.getPropertyValue('--hp-iso-edge-unit-x'),edgeY:style.getPropertyValue('--hp-iso-edge-unit-y')};
      });
      return {rotation:c._rotation,degrees,matrixError:Math.max(...['a','b','c','d'].map(k=>Math.abs(glyph[k]-room[k]))),contents,lqi,roomEdgeX:s.getPropertyValue('--hp-iso-room-edge-x'),roomEdgeY:s.getPropertyValue('--hp-iso-room-edge-y')};
    }));
    await page.screenshot({path:`${out}/glyph-orientation-${turn*90}-20261119.png`});
    await page.locator('[data-hp="rotate-right"]').click();await page.waitForTimeout(650);
  }
  await writeFile(`${out}/glyph-orientation-report-20261119.json`,JSON.stringify({observations,errors},null,2)+'\n');
  for(const o of observations){
    assert.ok(o.matrixError<0.00001,'glyph and room planes agree');
    for(const family of o.contents){
      assert.ok(family.items.length,`fixture covers ${family.selector}`);
      for(const item of family.items)assert.equal(parseFloat(item.rotate),o.degrees,family.selector);
    }
    assert.ok(o.lqi.length,'fixture covers LQI');
    for(const q of o.lqi){
      assert.ok(Math.abs(q.a-Math.cos(o.degrees*Math.PI/180))<1e-6);
      assert.equal(q.edgeX,o.roomEdgeX);assert.equal(q.edgeY,o.roomEdgeY);
    }
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  await writeFile(`${out}/glyph-orientation-report-20261119.json`,JSON.stringify({observations,errors},null,2)+'\n');
  console.log(JSON.stringify({turns:observations.map(o=>({rotation:o.rotation,glyphTurn:o.degrees,matrixError:o.matrixError})),errors}));
}finally{await browser.close();}
