// #999: real touch context, narrow kit popup and stage Hide without an editor.
import {launchColdView,requirePinnedBrowser,checkAll,finish} from './serve.mjs';
import {prepareVacuumHistory,openVacuumHistory,HISTORY_IDS as ids} from './helpers/vacuum-history.mjs';
import {writeFileSync} from 'node:fs';
requirePinnedBrowser();
const {page,browser}=await launchColdView({width:390,height:844},1,[],{hasTouch:true});
const out={};page.setDefaultTimeout(15000);
try{
 await page.addStyleTag({content:'#host{width:100%;box-sizing:border-box}'});
 await prepareVacuumHistory(page,{peer:false});const ui=await openVacuumHistory(page);
 const trigger=ui.history.locator('hp-settings-select button');await trigger.tap();
 const label=await page.evaluate(id=>window.__card._vacHistory.label(id),ids.a);
 await ui.history.getByRole('option',{name:label,exact:true}).tap();
 out.touch_choice_no_fill=await ui.history.locator('select').inputValue()===ids.a&&!(await ui.show.getAttribute('class')).split(' ').includes('on');
 await ui.show.tap();await page.waitForFunction(()=>window.__card._vacHistory.visible);
 out.narrow_actions_fit=await ui.history.evaluate(section=>{
  const bounds=section.getBoundingClientRect(),controls=[...section.querySelectorAll('button,hp-settings-select')];
  return section.scrollWidth<=section.clientWidth+1&&controls.every(e=>{const r=e.getBoundingClientRect();return r.left>=bounds.left-1&&r.right<=bounds.right+1;});
 });
 await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).tap();
 const banner=page.locator('houseplan-card').first().locator('[data-hp=vacuum-history-banner]');
 out.narrow_banner_fit=await banner.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth+1;});
 if(!out.narrow_banner_fit)console.log('banner observation',await banner.evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),viewport:innerWidth,scroll:e.scrollWidth,client:e.clientWidth,stage:e.parentElement.getBoundingClientRect().toJSON()})));
 await banner.locator('button').tap();
 out.touch_hide_returns_live=await page.evaluate(()=>{const g=window.__history999.geometry()[0];return !g.history&&!g.banner&&!!g.current;});
 out.touch_no_writes_or_services=await page.evaluate(()=>window.__history999.writes.length===0&&window.__history999.services.length===0);
 checkAll(out);
}catch(error){checkAll({scenario_completed:false});throw error;}
finally{
 if(process.env.HP_HISTORY_REPORT)writeFileSync(process.env.HP_HISTORY_REPORT,JSON.stringify({checks:out},null,2)+'\n');
 await finish(browser);
}
