// #1184 supersedes the filled 24px reserve and viewport-based phone toolbar.
// Check native close hit targets, editor-to-editor geometry and localized names.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launch, finish } from './serve.mjs';
import { headerActionTarget, clickHeaderAction } from './helpers/header-actions.mjs';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';
import { GOLDEN_SCENARIOS } from './golden/matrix.mjs';
import { prepareGoldenScenario } from './golden/harness.mjs';
const {page,browser}=await launch({width:1800,height:900});
const card=page.locator('houseplan-card');
const modes=['plan','devices','decor'];
const words=Object.fromEntries(['en','ru'].map(lang=>[lang,JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`,import.meta.url),'utf8'))]));
const settle=async()=>{
  await page.evaluate(()=>window.__hpTest.settled());
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing);
};
try{
  for(const lang of ['en','ru']){
    await page.evaluate(language=>window.__card.setConfig({...window.__card._config,language}),lang);await settle();
    for(const width of [1800,1000,768,390,320]){
      await page.evaluate(width=>document.getElementById('host').style.cssText=`width:${width}px!important;max-width:none!important;padding:0!important;margin:0!important`,width);await settle();
      const menuPhase=await card.locator('.hdr').getAttribute('data-panel-flow')==='5';
      const add=card.locator(menuPhase ? '[data-hp="header-actions-trigger"]' : '[data-hp="space-add"]');
      await add.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
      const focusState=await add.evaluate(e=>({visible:e.matches(':focus-visible'),outlineWidth:getComputedStyle(e).outlineWidth,
        outlineStyle:getComputedStyle(e).outlineStyle,active:e.getRootNode().activeElement?.getAttribute('data-hp')}));
      assert.ok(focusState.visible,JSON.stringify({lang,width,menuPhase,focusState}));
      if(menuPhase)assert.equal(focusState.outlineStyle,'none','closed actions trigger must not retain an active focus frame');
      else assert.ok(focusState.outlineWidth==='2px'&&focusState.outlineStyle==='solid',JSON.stringify({lang,width,menuPhase,focusState}));
      let previous=null;
      for(const mode of modes){
        const tab=card.locator(`[data-hp="mode-tab"][data-mode="${mode}"]`);
        assert.equal(await tab.getAttribute('aria-label'),words[lang][`mode.${mode}`]);
        assert.equal(await tab.getAttribute('data-hp-tooltip'),words[lang][`mode.${mode}_tip`]);
        await clickHeaderAction(card,'mode-'+mode);await settle();
        if(await card.locator('.hdr').getAttribute('data-panel-flow')!=='5')
          assert.ok(await card.locator('.head [data-hp="editor-close"]').isVisible(),
            `allocated ${width}px header must retain its visible editor close action`);
        await headerActionTarget(card,'mode-view');
        await waitForUiKitPaint(page);
        const state=await card.evaluate(c=>{
          const root=c.shadowRoot,head=root.querySelector('.head'),group=head.querySelector('.modes');
          const slot=group.querySelector('.editor-close-slot'),active=group.querySelector('.modetab.active');
          const actionsOnly=head.parentElement.dataset.panelFlow==='5';
          const originalClose=slot.querySelector('.closex');
          const close=actionsOnly ? root.querySelector('[data-hp="header-actions-menu"]:not([inert]) [data-action="mode-view"]') : originalClose;
          const rect=close.getBoundingClientRect();
          const hit=root.elementFromPoint(rect.x+5,rect.y+rect.height/2);
          return {actionsOnly,width:(actionsOnly ? head.querySelector('[data-hp="header-actions-trigger"]') : group).getBoundingClientRect().width,height:head.getBoundingClientRect().height,
            closeWidth:rect.width,closeHeight:rect.height,closeAfterActive:active.nextElementSibling===slot,
            hit:hit===close||close.contains(hit),scroll:head.scrollWidth,available:head.clientWidth,
            x:rect.x+5,y:rect.y+rect.height/2,stage:root.querySelector('.stage').clientHeight,
            nestedClose:!!group.querySelector('.modetab .closex'),count:!!head.querySelector('.count')};
        });
        assert.ok(Math.round(state.closeWidth*1000)/1000>=44&&Math.round(state.closeHeight*1000)/1000>=44&&state.closeAfterActive&&state.hit,JSON.stringify(state));
        assert.ok(state.scroll<=state.available+1&&state.stage>50,JSON.stringify(state));
        assert.ok(!state.nestedClose&&!state.count,JSON.stringify(state));
        if(previous)assert.ok(Math.abs(previous.width-state.width)<1&&Math.abs(previous.height-state.height)<1,JSON.stringify({previous,state}));
        previous=state;
        if(state.actionsOnly){await page.keyboard.press('Escape');await card.locator('[data-hp="header-actions-menu"]:not([inert])').waitFor({state:'hidden'});}
      }
      const closeAction=await headerActionTarget(card,'mode-view');
      await waitForUiKitPaint(page);
      const box=await closeAction.boundingBox();
      await page.mouse.click(box.x+5,box.y+box.height/2);await settle();
      assert.equal(await card.locator('ha-card').getAttribute('data-hp-mode'),'view');
      assert.equal(await card.locator('.head [data-hp="editor-close"]').count(),0);
      assert.ok(await card.locator('.editor-close-slot').evaluate(e=>getComputedStyle(e).display==='none'&&!e.hasAttribute('tabindex')));
    }
  }
  // Exercise the addressed golden semantic owner without accepting old PNGs.
  for(const mode of ['view','plan']){
    const scene=GOLDEN_SCENARIOS.find(s=>s.id.startsWith('plan-rotation-phone-')&&s.mode===mode);
    assert.ok(scene, 'existing phone rotation fixture '+mode);
    const result=await prepareGoldenScenario(page,scene);
    assert.ok(result.phoneHeader.rows>0&&result.phoneHeader.height>0);
  }
}catch(error){await browser.close();throw error;}
await finish(browser);
