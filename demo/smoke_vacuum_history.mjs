import {launchColdView,requirePinnedBrowser,checkAll,finish} from './serve.mjs';
import {prepareVacuumHistory,openVacuumHistory,chooseVacuumHistory,HISTORY_IDS as ids} from './helpers/vacuum-history.mjs';
import {writeFileSync} from 'node:fs';
requirePinnedBrowser();
const {page,browser}=await launchColdView();page.setDefaultTimeout(15000);
const out={};
const geometry=()=>page.evaluate(()=>window.__history999.geometry());
const waitHistory=id=>page.waitForFunction(id=>window.__card._vacHistory.shown?.id===id&&window.__card._vacHistory.visible,id);
try{
 await prepareVacuumHistory(page);const original=await geometry();
 let ui=await openVacuumHistory(page);
 out.ui030_section=await ui.history.getByRole('heading',{name:'Cleaning history preview',exact:true}).isVisible();
 out.initial_no_choice_no_fill=await ui.show.isDisabled()&&!(await ui.show.getAttribute('class')).split(' ').includes('on')&&await ui.hide.isDisabled();
 out.local_hint=await ui.history.getByText('The path is visible only on this device. You do not need to save settings.',{exact:true}).isVisible();
 await chooseVacuumHistory(page,ui.history,ids.a);
 out.selected_not_shown=!(await ui.show.isDisabled())&&!(await ui.show.getAttribute('class')).split(' ').includes('on')&&(await geometry())[0].current===original[0].current;
 await ui.show.click();await waitHistory(ids.a);let frames=await geometry();const pathA=frames[0].history;
 out.genuine_raw_affine_path=pathA.startsWith('M 100 100')&&pathA.endsWith('200 200');
 out.replace_only_this_robot_paths=!!pathA&&!frames[0].current&&!frames[0].previous&&frames[0].puck&&frames[0].tips===0;
 out.peer_isolation=frames[1].current===original[1].current&&frames[1].previous===original[1].previous&&!frames[1].history&&!frames[1].banner;
 out.active_fill_and_actual_label=(await ui.show.getAttribute('class')).split(' ').includes('on')&&(await ui.history.locator('[data-hp=vacuum-history-shown]').textContent()).includes('24.10.2026 · 03:00');
 await chooseVacuumHistory(page,ui.history,ids.b);
 out.pick_B_retains_A=(await geometry())[0].history===pathA&&(await ui.history.locator('[data-hp=vacuum-history-shown]').textContent()).includes('24.10.2026 · 03:00');
 await ui.show.click();await waitHistory(ids.b);frames=await geometry();const pathB=frames[0].history;
 out.show_B_real_gaps=pathB!==pathA&&(pathB.match(/M /g)||[]).length===2;
 await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 out.close_preserves_shown=(await geometry())[0].history===pathB;
 await page.locator('houseplan-card').first().locator('[data-hp=vacuum-history-banner] button').press('Enter');
 out.banner_hide_returns_current=(await geometry())[0].current===original[0].current&&!(await geometry())[0].history;
 ui=await openVacuumHistory(page);
 out.hide_keeps_choice=await ui.history.locator('select').inputValue()===ids.b&&!(await ui.show.getAttribute('class')).split(' ').includes('on')&&await ui.hide.isDisabled();
 await chooseVacuumHistory(page,ui.history,ids.a);
 await page.evaluate(()=>{window.__history999.hold=true;});await ui.show.click();
 await page.waitForFunction(()=>window.__history999.pending.length===1);
 await chooseVacuumHistory(page,ui.history,ids.b);
 await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>window.__history999.pending.shift().resolve());await waitHistory(ids.a);
 out.pending_A_survives_pick_B_and_close=(await geometry())[0].history===pathA;
 ui=await openVacuumHistory(page);
 out.reopen_shows_A_label_and_B_choice=await ui.history.locator('select').inputValue()===ids.b&&(await ui.history.locator('[data-hp=vacuum-history-shown]').textContent()).includes('24.10.2026 · 03:00');
 await ui.show.click();await page.waitForFunction(()=>window.__history999.pending.length===1);await ui.hide.click();
 await page.evaluate(()=>window.__history999.pending.shift().resolve());await page.evaluate(()=>window.__hpTest.settled());
 out.hide_retires_late_B=!(await geometry())[0].history&&(await geometry())[0].current===original[0].current;
 await chooseVacuumHistory(page,ui.history,ids.a);await ui.show.click();
 await chooseVacuumHistory(page,ui.history,ids.b);await ui.show.click();
 await page.waitForFunction(()=>window.__history999.pending.length===2);
 await page.evaluate(()=>window.__history999.pending.shift().resolve());await page.evaluate(()=>window.__hpTest.settled());
 out.old_finally_cannot_unlock_new=await ui.history.getAttribute('aria-busy')==='true'&&!(await geometry())[0].history;
 await page.evaluate(()=>window.__history999.pending.shift().resolve());await waitHistory(ids.b);
 out.latest_show_wins=(await geometry())[0].history===pathB;
 await page.evaluate(()=>{window.__history999.hold=false;window.__history999.getError='unavailable';});
 await chooseVacuumHistory(page,ui.history,ids.a);await ui.show.click();await page.evaluate(()=>window.__hpTest.settled());
 out.error_keeps_B_and_explains=(await geometry())[0].history===pathB&&(await ui.history.locator('[data-hp=vacuum-history-reason]').textContent()).includes('History is currently unavailable');
 await page.evaluate(()=>{window.__history999.getError=null;});
 await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 for(const mode of ['view','plan','decor','devices']){
  await page.evaluate(mode=>window.__hpTest.setMode(mode),mode);await page.evaluate(()=>window.__hpTest.settled());
  frames=await geometry();out[`mode_${mode}`]=['view','devices'].includes(mode)?frames[0].history===pathB:!frames[0].history&&!frames[0].banner;
 }
 await page.evaluate(async()=>{const w=window.__history999;w.book.e_vacuum_history999.current={...w.book.e_vacuum_history999.current,paths:[[[100,100],[700,600]]],revision:'live-new'};await w.publish();});
 out.live_updates_do_not_replace_preview=(await geometry())[0].history===pathB;
 await page.locator('houseplan-card').first().locator('[data-hp=vacuum-history-banner] button').click();
 out.hide_uses_latest_live=(await geometry())[0].current.endsWith('170 160');
 ui=await openVacuumHistory(page);await chooseVacuumHistory(page,ui.history,ids.a);await ui.show.click();await waitHistory(ids.a);
 await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>window.__hpTest.setMode('view'));
 for(const iso of [false,true]){
  await page.evaluate(on=>window.__hpTest.setVolumetricView(on),iso);await page.evaluate(()=>window.__hpTest.settled());
  frames=await geometry();out[`projection_${iso?'iso':'flat'}_same_geometry`]=frames[0].history===pathA&&frames[0].tips===0;
 }
 await page.evaluate(()=>{window.__history999.epoch='d'.repeat(32);});
 ui=await openVacuumHistory(page);
 out.catalog_before_trail_retires_preview=!(await geometry())[0].history&&await ui.hide.isDisabled()
  &&(await ui.history.locator('[data-hp=vacuum-history-reason]').textContent()).includes('Preview ended');
 await ui.show.click();await waitHistory(ids.a);
 out.new_show_after_catalog_epoch=await page.evaluate(()=>window.__card._vacHistory.shown.epoch==='d'.repeat(32));
 await ui.dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(async()=>{const w=window.__history999;w.epoch='e'.repeat(32);await w.publish();});
 out.confirmed_cleanup_retires_preview=!(await geometry())[0].history&&!(await geometry())[0].banner;
 out.no_history_writes_or_services=await page.evaluate(()=>window.__history999.writes.length===0&&window.__history999.services.length===0);
 out.live_book_never_replaced=await page.evaluate(()=>window.__history999.cards.every(card=>card._vacSrvTrails.e_vacuum_history999.current.revision==='live-new'));
 checkAll(out);
}catch(error){checkAll({scenario_completed:false});throw error;}
finally{
 if(process.env.HP_HISTORY_REPORT)writeFileSync(process.env.HP_HISTORY_REPORT,JSON.stringify({checks:out},null,2)+'\n');
 await finish(browser);
}
